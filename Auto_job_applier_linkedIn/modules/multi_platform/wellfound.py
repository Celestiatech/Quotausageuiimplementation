"""
Wellfound (AngelList Talent) job application automation.
Based on LiftMyCV's wellfound/apply.js flow.
Wellfound uses React components with data-test attributes.
"""
import time
import logging
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
)

from .base import (
    safe_click,
    wait_and_find,
    wait_for_clickable,
    scroll_to_element,
    set_input_value,
    set_textarea_value,
    upload_file,
    check_required_field,
    clean_label,
    click_consent_boxes,
    is_form_error_visible,
    submit_form,
    check_submission_success,
)

logger = logging.getLogger(__name__)

# Wellfound-specific selectors
APPLY_BUTTON_SELECTOR = 'button[class*=styles_applyButton]'
MODAL_SELECTOR = 'div[data-test="JobApplication-Modal"]'
SUBMIT_BUTTON_SELECTOR = 'button[data-test=JobApplicationModal--SubmitButton]'
RESUME_INPUT_SELECTOR = 'div[data-test="JobApplication-Modal"] form input[type=file]'
FIELD_LABEL_SELECTOR = 'div[data-test="JobApplication-Modal"] form label.block'
COVER_LETTER_ID = "form-input--userNote"
SUCCESS_SELECTOR = 'button[class*=styles_applyButton][disabled]'


def is_wellfound_page(driver):
    """Detect if current page is a Wellfound application."""
    url = driver.current_url.lower()
    if "wellfound.com" in url:
        return True

    indicators = [
        APPLY_BUTTON_SELECTOR,
        MODAL_SELECTOR,
        '[data-test="JobApplication-Modal"]',
    ]
    for selector in indicators:
        try:
            el = driver.find_element(By.CSS_SELECTOR, selector)
            if el:
                return True
        except (NoSuchElementException, Exception):
            continue
    return False


def get_job_info(driver):
    """Extract job metadata from Wellfound page."""
    info = {"company": "", "role": "", "description": "", "location": ""}

    try:
        # Company from title: "Role at Company • ..."
        title_parts = driver.title.split(" at ")
        if len(title_parts) > 1:
            info["company"] = title_parts[1].split(" • ")[0].strip()
        else:
            info["company"] = driver.title.split(" • ")[0].strip()
    except (NoSuchElementException, Exception):
        info["company"] = driver.title

    try:
        # Role from title: "Role at Company • ..."
        title_parts = driver.title.split(" at ")
        info["role"] = title_parts[0].split(" • ")[0].strip()
    except (NoSuchElementException, Exception):
        info["role"] = driver.title

    try:
        desc_el = driver.find_element(By.CSS_SELECTOR, 'div[class^=styles_description]')
        info["description"] = desc_el.get_attribute("innerHTML").strip()
    except (NoSuchElementException, Exception):
        info["description"] = ""

    return info


def grab_fields(driver):
    """Grab all form fields from the Wellfound application modal."""
    fields = []

    labels = driver.find_elements(
        By.CSS_SELECTOR,
        'div[data-test="JobApplication-Modal"] form label.block',
    )

    for label in labels:
        try:
            result = {
                "element": None,
                "type": "",
                "label": "",
                "required": False,
            }

            # Get label text (first child text)
            try:
                first_child = label.find_element(By.XPATH, "child::*[1]")
                result["label"] = first_child.text.strip()
            except (NoSuchElementException, Exception):
                result["label"] = label.text.strip()

            if not result["label"]:
                continue

            # Handle required marker
            if result["label"].endswith("*"):
                result["label"] = result["label"][:-1].strip()
                result["required"] = True

            # Special handling for "What interests you" cover letter questions
            if result["label"].startswith("What interests you about working"):
                result["label"] = "Cover letter - " + result["label"]

            # Find the input container (second child)
            try:
                container = label.find_element(By.XPATH, "child::*[2]")
            except (NoSuchElementException, Exception):
                continue

            if not container:
                continue

            # Detect field type
            # Radio buttons
            radios = container.find_elements(By.CSS_SELECTOR, "input[type=radio]")
            if radios:
                result["type"] = "radio"
                result["element"] = radios
                result["options"] = [
                    r.find_element(By.XPATH, "following-sibling::label").text.strip()
                    for r in radios
                    if r.find_element(By.XPATH, "following-sibling::label")
                ]
            else:
                # Checkboxes
                checkboxes = label.find_elements(By.CSS_SELECTOR, "input[type=checkbox]")
                if checkboxes:
                    result["type"] = "checkbox"
                    result["element"] = checkboxes
                    result["options"] = [
                        c.find_element(By.XPATH, "following-sibling::label").text.strip()
                        for c in checkboxes
                        if c.find_element(By.XPATH, "following-sibling::label")
                    ]
                else:
                    # Select (React Select)
                    select_control = container.find_elements(
                        By.CSS_SELECTOR, ".select__control"
                    )
                    if select_control:
                        result["type"] = "select"
                        result["element"] = select_control[0]
                        # Expand to get options
                        try:
                            input_el = result["element"].find_element(By.TAG_NAME, "input")
                            driver.execute_script(
                                "arguments[0].dispatchEvent(new Event('mousedown', {bubbles: true}));",
                                input_el,
                            )
                            driver.execute_script(
                                "arguments[0].dispatchEvent(new Event('focusin', {bubbles: true}));",
                                input_el,
                            )
                            time.sleep(1)
                        except Exception:
                            pass
                        option_els = container.find_elements(
                            By.CSS_SELECTOR, ".select__menu .select__option"
                        )
                        result["options"] = [
                            opt.text.strip() for opt in option_els
                        ]
                        # Close dropdown
                        try:
                            input_el = result["element"].find_element(By.TAG_NAME, "input")
                            driver.execute_script(
                                "arguments[0].dispatchEvent(new Event('focusout', {bubbles: true}));",
                                input_el,
                            )
                        except Exception:
                            pass
                    else:
                        # Regular text input
                        try:
                            input_el = container.find_element(By.XPATH, "child::*[1]")
                            result["element"] = input_el
                            result["type"] = input_el.get_attribute("type") or "text"
                        except (NoSuchElementException, Exception):
                            continue

            # Also check for cover letter textarea
            if not result["element"]:
                cover = driver.find_element(By.ID, COVER_LETTER_ID)
                if cover:
                    result["element"] = cover
                    result["type"] = cover.get_attribute("type") or "textarea"
                    result["label"] = "Cover letter - " + (cover.get_attribute("placeholder") or "")
                    result["required"] = True

            if result["element"] and result["type"]:
                fields.append(result)

        except Exception as e:
            logger.debug(f"Error processing field label: {e}")
            continue

    return fields


def fill_field(driver, field, value):
    """Fill a single field with the given value."""
    if not value and value != 0:
        if field["required"] and isinstance(field["element"], list) and field["element"]:
            # Click first radio/checkbox for required
            safe_click(field["element"][0])
        return False

    element = field["element"]
    field_type = field["type"]

    try:
        if isinstance(element, list):
            # Radio or checkbox group
            values = value if isinstance(value, list) else [value]
            for i, el in enumerate(element):
                option_text = field.get("options", [])[i] if i < len(field.get("options", [])) else ""
                if option_text in values or value == option_text:
                    if not el.is_selected():
                        safe_click(el)
                        time.sleep(0.3)
        elif field_type == "select":
            # React Select: click to open, select option, close
            try:
                input_el = element.find_element(By.TAG_NAME, "input")
                driver.execute_script(
                    "arguments[0].dispatchEvent(new Event('mousedown', {bubbles: true}));",
                    input_el,
                )
                driver.execute_script(
                    "arguments[0].dispatchEvent(new Event('focusin', {bubbles: true}));",
                    input_el,
                )
                time.sleep(1)
            except Exception:
                pass

            # Find and click matching option
            container = element.find_element(By.XPATH, "parent::*")
            option_els = container.find_elements(
                By.CSS_SELECTOR, ".select__menu .select__option"
            )
            for opt in option_els:
                if opt.text.strip() == value:
                    safe_click(opt)
                    time.sleep(0.5)
                    break

            # Close dropdown
            try:
                driver.execute_script(
                    "arguments[0].dispatchEvent(new Event('focusout', {bubbles: true}));",
                    input_el,
                )
            except Exception:
                pass
        elif field_type in ("text", "email"):
            scroll_to_element(driver, element)
            set_input_value(driver, element, value)
            time.sleep(0.3)
        elif field_type == "textarea":
            scroll_to_element(driver, element)
            set_textarea_value(driver, element, value)
            time.sleep(0.3)
        else:
            set_input_value(driver, element, value)
            time.sleep(0.3)

        return True
    except Exception as e:
        logger.debug(f"Failed to fill field '{field['label']}': {e}")
        return False


def apply_to_job(driver, resume_url=None, resume_filename="resume.pdf", answers=None):
    """
    Apply to a Wellfound job posting.
    
    Returns:
        dict with keys: success, message, fields_filled
    """
    result = {"success": False, "message": "", "fields_filled": 0}
    answers = answers or {}

    try:
        # Click apply button
        try:
            apply_btn = wait_for_clickable(
                driver, By.CSS_SELECTOR, APPLY_BUTTON_SELECTOR, timeout=5
            )
            if apply_btn:
                safe_click(apply_btn)
                time.sleep(2)
            else:
                result["message"] = "Apply button not found"
                return result
        except (TimeoutException, Exception):
            result["message"] = "Apply button not found"
            return result

        # Wait for modal
        try:
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, MODAL_SELECTOR))
            )
        except TimeoutException:
            result["message"] = "Application modal did not appear"
            return result

        # Check for submit button (skip if external link)
        try:
            submit_btn = driver.find_element(By.CSS_SELECTOR, SUBMIT_BUTTON_SELECTOR)
            if submit_btn.is_enabled() is False:
                time.sleep(2)
        except (NoSuchElementException, Exception):
            result["message"] = "Submit button not found (may be external link)"
            return result

        # Upload resume
        try:
            file_input = driver.find_element(By.CSS_SELECTOR, RESUME_INPUT_SELECTOR)
            if file_input:
                upload_file(driver, file_input, resume_url, resume_filename)
                time.sleep(1)
        except (NoSuchElementException, Exception):
            pass  # Resume may be optional

        # Collect fields
        fields = grab_fields(driver)
        if not fields:
            result["message"] = "No form fields found"
            return result

        # Fill fields
        filled_count = 0
        for field in fields:
            value = answers.get(field["label"])
            if value is not None:
                if fill_field(driver, field, value):
                    filled_count += 1

        result["fields_filled"] = filled_count

        # Submit
        try:
            submit_btn = driver.find_element(
                By.CSS_SELECTOR, SUBMIT_BUTTON_SELECTOR
            )
            if submit_btn and submit_btn.is_enabled():
                safe_click(submit_btn)
                time.sleep(3)
            else:
                result["message"] = "Submit button is disabled"
                return result
        except NoSuchElementException:
            result["message"] = "Submit button not found"
            return result

        # Check for success
        try:
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, SUCCESS_SELECTOR))
            )
            result["success"] = True
            result["message"] = "Application submitted successfully"
        except TimeoutException:
            # Check if modal closed or button changed
            if check_submission_success(driver, ["Applied", "submitted", "received"]):
                result["success"] = True
                result["message"] = "Application submitted successfully"
            else:
                result["success"] = True
                result["message"] = "Application submitted (no confirmation detected)"

        return result

    except Exception as e:
        logger.error(f"Wellfound apply failed: {e}")
        result["message"] = f"Unexpected error: {str(e)}"
        return result
