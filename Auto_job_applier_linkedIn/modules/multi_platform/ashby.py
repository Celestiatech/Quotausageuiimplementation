"""
Ashby job application automation.
Based on LiftMyCV's ashbyhq/apply.js flow.
Ashby uses standard HTML forms with labels and fieldsets.
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

# Ashby-specific selectors
APPLICATION_FORM = ".ashby-application-form"
RESUME_INPUT_ID = "_systemfield_resume"
SUBMIT_BUTTON_SELECTOR = ".ashby-application-form-submit-button"
SUCCESS_SELECTORS = [
    ".ashby-application-form-success-container",
    ".application-submitted",
    ".success-message",
]


def is_ashby_page(driver):
    """Detect if current page is an Ashby application."""
    indicators = [
        APPLICATION_FORM,
        ".ashby-job-posting-header",
        ".ashby-application-form-submit-button",
        "#_systemfield_resume",
    ]
    for selector in indicators:
        try:
            el = driver.find_element(By.CSS_SELECTOR, selector)
            if el:
                return True
        except (NoSuchElementException, Exception):
            continue
    # Check URL pattern
    url = driver.current_url.lower()
    return "ashbyhq.com" in url or "jobs.ashbyhq.com" in url


def get_job_info(driver):
    """Extract job metadata from Ashby page."""
    info = {"company": "", "role": "", "description": "", "location": ""}

    try:
        # Company from logo or header
        company_el = driver.find_elements(
            By.CSS_SELECTOR,
            ".ashby-job-posting-header img, .ashby-job-posting-header ul",
        )
        if company_el:
            info["company"] = company_el[0].get_attribute("alt") or company_el[0].text.strip()
    except Exception:
        pass

    try:
        role_el = driver.find_elements(
            By.CSS_SELECTOR,
            "h1.ashby-job-posting-heading, h1",
        )
        if role_el:
            info["role"] = role_el[0].text.strip()
    except (NoSuchElementException, Exception):
        pass

    try:
        # Get location from left pane
        left_pane = driver.find_elements(
            By.CSS_SELECTOR,
            ".ashby-job-posting-left-pane div",
        )
        for block in left_pane:
            try:
                h2 = block.find_element(By.TAG_NAME, "h2")
                p = block.find_element(By.TAG_NAME, "p")
                if "location" in h2.text.lower():
                    info["location"] = p.text.strip()
            except (NoSuchElementException, Exception):
                continue
    except (NoSuchElementException, Exception):
        pass

    try:
        desc_el = driver.find_elements(
            By.CSS_SELECTOR,
            "#overview, .ashby-job-posting-description",
        )
        if desc_el:
            info["description"] = desc_el[0].get_attribute("innerHTML").strip()
    except (NoSuchElementException, Exception):
        pass

    return info


def collect_fields(driver):
    """
    Collect all form fields from Ashby application.
    Returns list of field descriptors.
    """
    fields = []
    processed_ids = set()

    try:
        labels = driver.find_elements(By.TAG_NAME, "label")
    except Exception:
        return fields

    for label in labels:
        try:
            # Skip hidden labels
            if not label.is_displayed():
                continue

            for_attr = label.get_attribute("for")
            if not for_attr:
                continue

            # Skip resume and consent fields
            if "_systemfield_resume" in for_attr:
                continue
            if "_systemfield_data_consent_ack" in for_attr:
                continue

            try:
                element = driver.find_element(By.ID, for_attr)
            except NoSuchElementException:
                continue

            # Skip duplicate inputs
            if for_attr in processed_ids:
                continue
            processed_ids.add(for_attr)

            # Get label text
            label_text = label.text.strip()
            if not label_text:
                continue

            # Check if required
            required = element.get_attribute("required") == "true" or "required" in label.get_attribute("class")

            # Handle phone field hint
            if "phone" in label_text.lower():
                label_text += " (with country code)"

            field = {
                "element": element,
                "id": for_attr,
                "type": "text",
                "label": label_text,
                "required": required,
                "options": [],
            }

            tag = element.tag_name.upper()
            if tag == "INPUT":
                input_type = element.get_attribute("type").lower()
                field["type"] = input_type

                if input_type == "file":
                    if required:
                        logger.warning(f"Required file field skipped: {label_text}")
                    continue

                elif input_type in ("radio", "checkbox"):
                    fieldset = element.find_element(By.XPATH, "./ancestor::fieldset")
                    if fieldset:
                        legend = fieldset.find_elements(By.TAG_NAME, "label")
                        if legend:
                            option_labels = fieldset.find_elements(
                                By.CSS_SELECTOR,
                                "label:not(.ashby-application-form-question-title)",
                            )
                            option_elements = []
                            option_texts = []

                            for opt_label in option_labels:
                                opt_for = opt_label.get_attribute("for")
                                if opt_for:
                                    try:
                                        opt_el = driver.find_element(By.ID, opt_for)
                                        option_elements.append(opt_el)
                                        option_texts.append(opt_label.text.strip())
                                    except NoSuchElementException:
                                        continue

                            if option_elements and option_elements[0] == element:
                                field["element"] = option_elements
                                field["options"] = option_texts
                                label_text = legend[0].text.strip()
                                field["label"] = label_text

            elif tag == "TEXTAREA":
                field["type"] = "textarea"

            elif tag == "SELECT":
                field["type"] = "select"
                options = element.find_elements(By.TAG_NAME, "option")
                field["options"] = [
                    opt.text.strip() for opt in options if opt.get_attribute("value")
                ]

            fields.append(field)

        except (StaleElementReferenceException, NoSuchElementException, Exception) as e:
            logger.debug(f"Error processing label: {e}")
            continue

    return fields


def fill_field(driver, field, value):
    """Fill a single field with the given value."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return False

    element = field["element"]
    field_type = field["type"]

    try:
        if isinstance(element, list):
            # Radio/checkbox group
            return fill_option_group(driver, field, value)
        elif field_type == "select":
            return fill_select_field(driver, element, value)
        elif field_type == "textarea":
            return fill_textarea(driver, element, value)
        elif field_type in ("text", "email", "tel", "url", "number"):
            return fill_text_input(driver, element, value)
        else:
            return set_input_value(driver, element, str(value))
    except Exception as e:
        logger.debug(f"fill_field failed for {field.get('label', 'unknown')}: {e}")
        return False


def fill_option_group(driver, field, value):
    """Fill radio/checkbox group."""
    elements = field["element"]
    options = field["options"]

    if not isinstance(value, list):
        value = [value]

    for i, el in enumerate(elements):
        try:
            option_text = options[i] if i < len(options) else ""
            should_check = any(
                v.strip().lower() in option_text.strip().lower()
                for v in value
            )

            if should_check and not el.is_selected():
                scroll_to_element(driver, el)
                el.click()
                time.sleep(0.3)
            elif not should_check and el.is_selected() and field["type"] == "checkbox":
                el.click()
                time.sleep(0.3)
        except Exception:
            continue
    return True


def fill_select_field(driver, element, value):
    """Fill a select dropdown field."""
    try:
        scroll_to_element(driver, element)

        # Find matching option
        options = element.find_elements(By.TAG_NAME, "option")
        for opt in options:
            if opt.text.strip().lower() == value.strip().lower():
                opt_value = opt.get_attribute("value")
                if opt_value:
                    driver.execute_script(
                        "arguments[0].value = arguments[1]; "
                        "arguments[0].dispatchEvent(new Event('change', {bubbles: true}));",
                        element,
                        opt_value,
                    )
                    return True

        # Partial match
        for opt in options:
            if value.strip().lower() in opt.text.strip().lower():
                opt_value = opt.get_attribute("value")
                if opt_value:
                    driver.execute_script(
                        "arguments[0].value = arguments[1]; "
                        "arguments[0].dispatchEvent(new Event('change', {bubbles: true}));",
                        element,
                        opt_value,
                    )
                    return True

        return False
    except Exception as e:
        logger.debug(f"fill_select_field failed: {e}")
        return False


def fill_textarea(driver, element, value):
    """Fill textarea field."""
    scroll_to_element(driver, element)
    return set_textarea_value(driver, element, str(value))


def fill_text_input(driver, element, value):
    """Fill text/email/tel/url/number input."""
    scroll_to_element(driver, element)
    return set_input_value(driver, element, str(value))


def apply_to_job(driver, resume_url=None, resume_filename="resume.pdf", answers=None):
    """
    Main Ashby application flow.
    Returns dict with success status and details.
    """
    result = {"success": False, "message": "", "fields_filled": 0}

    try:
        # Wait for page to load
        time.sleep(2)

        # Verify this is an Ashby page
        if not is_ashby_page(driver):
            result["message"] = "Not an Ashby application page"
            return result

        # Get job info
        job_info = get_job_info(driver)
        logger.info(f"Ashby job: {job_info.get('role', 'unknown')} at {job_info.get('company', 'unknown')}")

        # Click Application tab if present
        tab_btn = wait_and_find(
            driver, By.CSS_SELECTOR,
            ".ashby-job-posting-right-pane-application-tab",
            timeout=5,
        )
        if tab_btn:
            scroll_to_element(driver, tab_btn)
            safe_click(tab_btn)
            time.sleep(2)

        # Upload resume
        resume_input = wait_and_find(driver, By.ID, RESUME_INPUT_ID, timeout=5)
        if resume_input and resume_url:
            try:
                upload_file(driver, resume_input, resume_url, resume_filename)
                time.sleep(1.5)
                logger.info("Resume uploaded successfully")
            except Exception as e:
                logger.warning(f"Resume upload failed: {e}")

        # Collect form fields
        fields = collect_fields(driver)
        if not fields:
            result["message"] = "No form fields found"
            return result

        logger.info(f"Found {len(fields)} form fields")

        # Fill fields with provided answers
        filled_count = 0
        for field in fields:
            value = get_answer_for_field(field, answers)
            if value is not None:
                if fill_field(driver, field, value):
                    filled_count += 1
                time.sleep(0.5)

        result["fields_filled"] = filled_count
        logger.info(f"Filled {filled_count}/{len(fields)} fields")

        # Auto-check consent checkboxes
        try:
            consent_boxes = driver.find_elements(
                By.CSS_SELECTOR,
                'input[type="checkbox"][id*="systemfield_data_consent_ack"]',
            )
            for box in consent_boxes:
                if not box.is_selected():
                    box.click()
                    time.sleep(0.3)
        except Exception:
            pass

        # Check for errors before submit
        error_msg = is_form_error_visible(driver)
        if error_msg:
            result["message"] = f"Form errors: {error_msg}"
            return result

        # Submit the form
        if not submit_form(driver, SUBMIT_BUTTON_SELECTOR):
            result["message"] = "Submit button not found or not clickable"
            return result

        time.sleep(3)

        # Check for submission success
        if check_submission_success(driver, SUCCESS_SELECTORS, timeout=30):
            result["success"] = True
            result["message"] = "Application submitted successfully"
        else:
            result["message"] = "Submission status unknown"

        return result

    except Exception as e:
        result["message"] = f"Error during application: {str(e)}"
        logger.error(f"Ashby apply error: {e}")
        return result


def get_answer_for_field(field, answers):
    """Get answer value for a field from answers dict."""
    if not answers:
        return None

    label_lower = field["label"].lower()

    # Direct match
    if field["label"] in answers:
        return answers[field["label"]]

    # Partial match
    for key, value in answers.items():
        if key.lower() in label_lower or label_lower in key.lower():
            return value

    # Type-based defaults for required fields
    if field["required"]:
        if "phone" in label_lower:
            return answers.get("phone", answers.get("Phone", ""))
        elif "email" in label_lower:
            return answers.get("email", answers.get("Email", ""))
        elif "name" in label_lower:
            if "first" in label_lower:
                return answers.get("first_name", "")
            elif "last" in label_lower:
                return answers.get("last_name", "")
            return answers.get("name", answers.get("Full Name", ""))
        elif "location" in label_lower or "city" in label_lower:
            return answers.get("location", answers.get("city", ""))
        elif "linkedin" in label_lower:
            return answers.get("linkedin", answers.get("LinkedIn", ""))

    return None
