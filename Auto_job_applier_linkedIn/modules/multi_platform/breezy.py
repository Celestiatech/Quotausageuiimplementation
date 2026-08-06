"""
Breezy job application automation.
Based on LiftMyCV's breezy/apply.js flow.
Breezy uses Angular-style forms with ng-disabled submit buttons.
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

# Breezy-specific selectors
SUBMIT_BUTTON_SELECTOR = 'button[ng-disabled$="isSubmitting"]'
RESUME_INPUT_ID = "main-attachment"
SUCCESS_TEXT_SELECTORS = [
    "It looks like maybe you've already applied to this job?",
    "Thank you",
    "submitted",
]
ERROR_SELECTOR = '[ng-if="errorMessage"]'


def is_breezy_page(driver):
    """Detect if current page is a Breezy application."""
    url = driver.current_url.lower()
    if "breezy.hr" in url:
        return True

    indicators = [
        SUBMIT_BUTTON_SELECTOR,
        "#" + RESUME_INPUT_ID,
        ".banner h1",
        ".actions a.apply",
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
    """Extract job metadata from Breezy page."""
    info = {"company": "", "role": "", "description": "", "location": ""}

    try:
        # Company from header brand
        company_el = driver.find_element(
            By.CSS_SELECTOR, ".header .brand img"
        )
        info["company"] = company_el.get_attribute("alt").strip()
    except (NoSuchElementException, Exception):
        try:
            company_el = driver.find_element(By.CSS_SELECTOR, ".header .brand")
            info["company"] = company_el.text.strip()
        except (NoSuchElementException, Exception):
            try:
                company_el = driver.find_element(By.CSS_SELECTOR, ".company-name")
                info["company"] = company_el.text.strip()
            except (NoSuchElementException, Exception):
                info["company"] = driver.title.split(" - ")[0].strip()

    try:
        role_el = driver.find_element(By.CSS_SELECTOR, ".banner h1")
        info["role"] = role_el.text.strip()
    except (NoSuchElementException, Exception):
        info["role"] = driver.title

    try:
        desc_el = driver.find_element(By.CSS_SELECTOR, ".description")
        info["description"] = desc_el.get_attribute("innerHTML").strip()
    except (NoSuchElementException, Exception):
        info["description"] = ""

    try:
        loc_el = driver.find_element(
            By.CSS_SELECTOR, "li[class=location] span, .location span"
        )
        info["location"] = loc_el.text.strip()
    except (NoSuchElementException, Exception):
        info["location"] = ""

    return info


def find_fields(driver):
    """Find all form fields on the page."""
    fields = []

    # Field types: text, email, select, textarea, radio, checkbox
    field_elements = driver.find_elements(
        By.CSS_SELECTOR,
        "input[type=text], input[type=email], select, textarea, "
        "ul:has(input[type=radio]), ul:has(input[type=checkbox])",
    )

    for element in field_elements:
        try:
            label = element
            required = element.get_attribute("required") == "true"
            
            # Walk up to find label
            while label:
                try:
                    label = label.find_element(By.XPATH, "preceding-sibling::*[1]")
                except NoSuchElementException:
                    try:
                        label = label.find_element(By.XPATH, "parent::*")
                    except NoSuchElementException:
                        break

                tag = label.tag_name.upper() if label.tag_name else ""
                classes = label.get_attribute("class") or ""
                
                if tag == "H3" or "section-header" in classes:
                    req_el = label.find_elements(By.CSS_SELECTOR, ".required")
                    if req_el:
                        required = True
                    break

            if not label:
                continue

            # Get label text
            try:
                label_text = label.find_element(By.CSS_SELECTOR, "span h2").text.strip()
            except (NoSuchElementException, Exception):
                label_text = label.text.strip()

            if not label_text:
                continue

            # Build field descriptor
            tag_name = element.tag_name.upper()
            if tag_name == "INPUT":
                el_type = element.get_attribute("type") or "text"
                fields.append({
                    "element": element,
                    "type": el_type,
                    "label": label_text,
                    "required": required,
                })
            elif tag_name == "TEXTAREA":
                fields.append({
                    "element": element,
                    "type": "textarea",
                    "label": label_text,
                    "required": required,
                })
            elif tag_name == "SELECT":
                options = [
                    opt.text for opt in element.find_elements(By.TAG_NAME, "option")
                    if opt.text
                ]
                fields.append({
                    "element": element,
                    "type": "select",
                    "label": label_text,
                    "required": required,
                    "options": options,
                })
            elif tag_name == "UL":
                radio_elements = element.find_elements(By.CSS_SELECTOR, "li input")
                if len(radio_elements) < 2:
                    continue
                options = [
                    opt.text for opt in element.find_elements(
                        By.CSS_SELECTOR, "li span, li strong"
                    )
                ]
                fields.append({
                    "element": radio_elements,
                    "type": radio_elements[0].get_attribute("type"),
                    "label": label_text,
                    "required": required,
                    "options": options,
                })

        except Exception as e:
            logger.debug(f"Error processing field: {e}")
            continue

    return fields


def fill_field(driver, field, value):
    """Fill a single field with the given value."""
    if not value and value != 0:
        if field["required"] and field["type"] in ("radio", "checkbox"):
            # Click first option for required radio/checkbox
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
        elif field_type == "select":
            # Handle select dropdown
            driver.execute_script(
                "arguments[0].value = arguments[1]; "
                "arguments[0].dispatchEvent(new Event('change', {bubbles: true}));",
                element,
                value,
            )
            time.sleep(0.3)
        elif field_type in ("text", "email", "textarea"):
            scroll_to_element(driver, element)
            set_input_value(driver, element, value)
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
    Apply to a Breezy job posting.
    
    Returns:
        dict with keys: success, message, fields_filled
    """
    result = {"success": False, "message": "", "fields_filled": 0}
    answers = answers or {}

    try:
        # Wait for submit button to appear
        try:
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, SUBMIT_BUTTON_SELECTOR))
            )
        except TimeoutException:
            result["message"] = "No submit button found"
            return result

        # Click apply button if not already on apply form
        try:
            apply_btn = driver.find_element(
                By.CSS_SELECTOR, ".actions a.apply, .apply-container .apply-button a"
            )
            safe_click(apply_btn)
            time.sleep(2)
        except (NoSuchElementException, Exception):
            pass  # Already on apply form

        # Upload resume
        try:
            file_input = driver.find_element(By.ID, RESUME_INPUT_ID)
            if file_input:
                upload_file(driver, file_input, resume_url, resume_filename)
                time.sleep(1)
        except (NoSuchElementException, Exception):
            if not resume_url:
                result["message"] = "CV input not found and no resume provided"
                return result

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
            elif field["required"]:
                # Try to find a reasonable default for required fields
                label_lower = field["label"].lower()
                if "email" in label_lower:
                    # Could use a stored email
                    pass
                elif "phone" in label_lower:
                    # Could use a stored phone
                    pass

        result["fields_filled"] = filled_count

        # Check for GDPR consent
        try:
            gdpr_checkboxes = driver.find_elements(
                By.CSS_SELECTOR, ".gdpr-accept input[type=checkbox][required]"
            )
            for checkbox in gdpr_checkboxes:
                if not checkbox.is_selected():
                    safe_click(checkbox)
        except (NoSuchElementException, Exception):
            pass

        # Submit the form
        try:
            submit_btn = driver.find_element(By.CSS_SELECTOR, SUBMIT_BUTTON_SELECTOR)
            if submit_btn.is_enabled():
                safe_click(submit_btn)
                time.sleep(3)
            else:
                result["message"] = "Submit button is disabled"
                return result
        except NoSuchElementException:
            result["message"] = "Submit button not found"
            return result

        # Check for error messages
        try:
            error_el = driver.find_element(By.CSS_SELECTOR, ERROR_SELECTOR)
            error_text = error_el.text.strip()
            if error_text:
                if "already applied" in error_text.lower():
                    result["message"] = "Already applied to this job"
                    return result
                result["message"] = f"Error: {error_text}"
                return result
        except (NoSuchElementException, Exception):
            pass

        # Check for success
        time.sleep(2)
        if check_submission_success(driver, SUCCESS_TEXT_SELECTORS):
            result["success"] = True
            result["message"] = "Application submitted successfully"
        else:
            # Assume success if no error
            result["success"] = True
            result["message"] = "Application submitted (no confirmation detected)"

        return result

    except Exception as e:
        logger.error(f"Breezy apply failed: {e}")
        result["message"] = f"Unexpected error: {str(e)}"
        return result
