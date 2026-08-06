"""
Recruitee job application automation.
Based on LiftMyCV's recruitee/apply.js flow.
Recruitee uses data-cy attributes for test IDs and a clean form structure.
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

# Recruitee-specific selectors
APPLY_BUTTON_SELECTOR = '[data-cy=apply-button-nav]'
SUBMIT_BUTTON_SELECTOR = '[data-testid=submit-application-form-button]'
RESUME_INPUT_SELECTOR = '[data-cy=fileInputField]'
COVER_LETTER_SWITCH = '[data-cy="cover-letter-switch-button"]'
LEGAL_AGREEMENTS_SELECTOR = 'section[data-cy=segment-legal-agreements]'
SUCCESS_URL_PATTERN = "/applied"


def is_recruitee_page(driver):
    """Detect if current page is a Recruitee application."""
    url = driver.current_url.lower()
    if "recruitee.com" in url:
        return True

    indicators = [
        APPLY_BUTTON_SELECTOR,
        SUBMIT_BUTTON_SELECTOR,
        RESUME_INPUT_SELECTOR,
        '[data-cy="section-background-wrapper"]',
        '[data-cy=navigation-section-grid-container]',
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
    """Extract job metadata from Recruitee page."""
    info = {"company": "", "role": "", "description": "", "location": ""}

    try:
        company_el = driver.find_element(
            By.CSS_SELECTOR,
            '[data-cy=navigation-section-grid-container] a span',
        )
        info["company"] = company_el.text.strip()
    except (NoSuchElementException, Exception):
        info["company"] = driver.title.split(" - ")[0].strip()

    try:
        role_el = driver.find_element(By.CSS_SELECTOR, "main h1")
        info["role"] = role_el.text.strip()
    except (NoSuchElementException, Exception):
        info["role"] = driver.title

    try:
        desc_el = driver.find_element(
            By.CSS_SELECTOR, "h2.custom-css-style-job-description"
        )
        info["description"] = desc_el.find_element(
            By.XPATH, "parent::*"
        ).get_attribute("innerHTML").strip()
    except (NoSuchElementException, Exception):
        info["description"] = ""

    try:
        loc_el = driver.find_element(
            By.CSS_SELECTOR, '[data-cy=section-wrapper-padder] ul li:nth-child(2)'
        )
        info["location"] = loc_el.text.strip()
    except (NoSuchElementException, Exception):
        info["location"] = ""

    return info


def find_fields(driver):
    """Find all form fields using label[for] pattern."""
    fields = []
    labels = driver.find_elements(By.TAG_NAME, "label")

    for label in labels:
        try:
            for_attr = label.get_attribute("for")
            if not for_attr:
                continue

            element = driver.find_element(By.ID, for_attr)
            if not element:
                continue

            # Skip file inputs (handled separately)
            el_tag = element.tag_name.upper()
            el_type = element.get_attribute("type") or ""

            if el_type == "file":
                continue

            # Get required status
            required = False
            try:
                span = label.find_element(By.TAG_NAME, "span")
                required = span.text.strip() == "*"
            except (NoSuchElementException, Exception):
                pass

            # Get label text
            label_text = label.text.strip()
            if label_text.endswith("*"):
                label_text = label_text[:-1].strip()

            # Skip phone number hint
            if label_text.startswith("Phone number"):
                label_text = "Phone number"

            # Handle radio/checkbox groups in fieldsets
            if el_type in ("radio", "checkbox"):
                fieldset = element.find_element(By.XPATH, "ancestor::fieldset")
                if fieldset:
                    legend = fieldset.find_element(By.TAG_NAME, "legend")
                    label_text = legend.text.strip()
                    if label_text.endswith("*"):
                        label_text = label_text[:-1].strip()
                    required = bool(legend.find_elements(By.CSS_SELECTOR, "span"))

                    # Get all options
                    option_labels = fieldset.find_elements(By.TAG_NAME, "label")
                    options = [opt.text.strip() for opt in option_labels]
                    option_elements = [
                        driver.find_element(By.ID, opt.get_attribute("for"))
                        for opt in option_labels
                        if opt.get_attribute("for")
                    ]

                    fields.append({
                        "element": option_elements,
                        "type": el_type,
                        "label": label_text,
                        "required": required,
                        "options": options,
                    })
                    continue

            # Regular input or textarea
            if el_tag == "INPUT":
                fields.append({
                    "element": element,
                    "type": el_type,
                    "label": label_text,
                    "required": required,
                })
            elif el_tag == "TEXTAREA":
                fields.append({
                    "element": element,
                    "type": "textarea",
                    "label": label_text,
                    "required": required,
                })

        except (NoSuchElementException, StaleElementReferenceException):
            continue
        except Exception as e:
            logger.debug(f"Error processing label: {e}")
            continue

    return fields


def fill_field(driver, field, value):
    """Fill a single field with the given value."""
    if not value and value != 0:
        if field["required"] and field["type"] in ("radio", "checkbox"):
            if isinstance(field["element"], list) and field["element"]:
                safe_click(field["element"][0])
            return True
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
    Apply to a Recruitee job posting.
    
    Returns:
        dict with keys: success, message, fields_filled
    """
    result = {"success": False, "message": "", "fields_filled": 0}
    answers = answers or {}

    try:
        # Dismiss cookie banner
        try:
            cookie_btn = driver.find_element(
                By.CSS_SELECTOR, '[data-cy="agree-to-all-cookies"]'
            )
            safe_click(cookie_btn)
            time.sleep(0.5)
        except (NoSuchElementException, Exception):
            pass

        # Click apply button
        try:
            apply_btn = wait_for_clickable(driver, By.CSS_SELECTOR, APPLY_BUTTON_SELECTOR, timeout=5)
            if apply_btn:
                safe_click(apply_btn)
                time.sleep(2)
            else:
                result["message"] = "Apply button not found"
                return result
        except (TimeoutException, Exception):
            result["message"] = "Apply button not found"
            return result

        # Wait for submit button
        try:
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, SUBMIT_BUTTON_SELECTOR))
            )
        except TimeoutException:
            result["message"] = "Submit button not found after clicking apply"
            return result

        # Upload resume
        try:
            file_input = driver.find_element(By.CSS_SELECTOR, RESUME_INPUT_SELECTOR)
            if file_input:
                upload_file(driver, file_input, resume_url, resume_filename)
                time.sleep(1)
        except (NoSuchElementException, Exception):
            if not resume_url:
                result["message"] = "Resume input not found and no resume provided"
                return result

        # Handle cover letter switch
        try:
            cl_switch = driver.find_element(By.CSS_SELECTOR, COVER_LETTER_SWITCH)
            if cl_switch.text.strip() == "Write it here instead":
                safe_click(cl_switch)
                time.sleep(0.5)
        except (NoSuchElementException, Exception):
            pass

        # Collect fields
        fields = find_fields(driver)
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

        # Accept legal agreements
        try:
            legal_sections = driver.find_elements(
                By.CSS_SELECTOR, LEGAL_AGREEMENTS_SELECTOR
            )
            for section in legal_sections:
                checkboxes = section.find_elements(By.CSS_SELECTOR, "input[type=checkbox]")
                for checkbox in checkboxes:
                    if not checkbox.is_selected():
                        safe_click(checkbox)
        except (NoSuchElementException, Exception):
            pass

        # Submit
        try:
            submit_btn = driver.find_element(By.CSS_SELECTOR, SUBMIT_BUTTON_SELECTOR)
            scroll_to_element(driver, submit_btn)
            time.sleep(0.5)
            safe_click(submit_btn)
            time.sleep(3)
        except NoSuchElementException:
            result["message"] = "Submit button not found"
            return result

        # Check for success (URL should contain /applied)
        try:
            WebDriverWait(driver, 10).until(
                lambda d: SUCCESS_URL_PATTERN in d.current_url
            )
            result["success"] = True
            result["message"] = "Application submitted successfully"
        except TimeoutException:
            # Check page content for success
            if check_submission_success(driver, ["Thank you", "submitted", "received"]):
                result["success"] = True
                result["message"] = "Application submitted successfully"
            else:
                result["success"] = True
                result["message"] = "Application submitted (no confirmation detected)"

        return result

    except Exception as e:
        logger.error(f"Recruitee apply failed: {e}")
        result["message"] = f"Unexpected error: {str(e)}"
        return result
