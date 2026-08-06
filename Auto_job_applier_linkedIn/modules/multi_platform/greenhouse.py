"""
Greenhouse job application automation.
Based on LiftMyCV's greenhouse/apply.js flow.
Selectors reference: https://developers.greenhouse.io/job-board.html
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

# Greenhouse-specific selectors
CONTAINER_SELECTOR = ".application--container"
RESUME_INPUT_ID = "resume"
COVER_LETTER_INPUT_ID = "cover_letter"
SUBMIT_BUTTON_SELECTOR = ".application--submit button"
ERROR_SELECTOR = ".helper-text--error"
SUCCESS_SELECTORS = [
    "#application_confirmation",
    ".confirmation-page",
    '[data-qa="confirmation-message"]',
    "/confirmation",
]


def is_greenhouse_page(driver):
    """Detect if current page is a Greenhouse application."""
    indicators = [
        CONTAINER_SELECTOR,
        "#application_form",
        ".application--submit",
        "#resume",
    ]
    for selector in indicators:
        try:
            el = driver.find_element(By.CSS_SELECTOR, selector)
            if el:
                return True
        except (NoSuchElementException, Exception):
            continue
    # Check URL pattern
    return "/job/" in driver.current_url and "greenhouse" in driver.page_source.lower()


def get_job_info(driver):
    """Extract job metadata from Greenhouse page."""
    info = {"company": "", "role": "", "description": "", "location": ""}

    try:
        # Company from title
        title = driver.title
        if " at " in title:
            info["company"] = title.split(" at ")[-1].strip()
        if " for " in title:
            info["role"] = title.split(" for ")[-1].split(" at ")[0].strip()
    except Exception:
        pass

    try:
        location_el = driver.find_element(By.CSS_SELECTOR, ".job__location")
        info["location"] = location_el.text.strip()
    except (NoSuchElementException, Exception):
        pass

    try:
        desc_el = driver.find_element(By.CSS_SELECTOR, ".job__description")
        info["description"] = desc_el.get_attribute("innerHTML").strip()
    except (NoSuchElementException, Exception):
        pass

    return info


def collect_fields(driver):
    """
    Collect all form fields from Greenhouse application.
    Returns list of field descriptors matching LiftMyCV's field structure.
    """
    fields = []
    label_seen = {}

    try:
        labels = driver.find_elements(By.TAG_NAME, "label")
    except Exception:
        return fields

    for label in labels:
        try:
            for_attr = label.get_attribute("for")
            if not for_attr:
                continue

            try:
                element = driver.find_element(By.ID, for_attr)
            except NoSuchElementException:
                continue

            # Skip resume and cover letter file inputs
            if for_attr in ("resume", "cover_letter"):
                continue

            # Get label text
            label_text = label.text.strip()
            if label_text.endswith("*"):
                label_text = label_text[:-1].strip()
                required = True
            else:
                required = element.get_attribute("aria-required") == "true"

            # Handle duplicate labels
            if label_text in label_seen:
                label_seen[label_text] += 1
                label_text = f"{label_text} (#{label_seen[label_text]})"
            else:
                label_seen[label_text] = 1

            # Handle cover letter special case
            if for_attr == "cover_letter_text":
                label_text = "Cover letter"

            # Add phone hint
            if "phone" in label_text.lower():
                label_text += " (with country code)"

            # Get element type and structure
            tag = element.tag_name.upper()
            field = {
                "element": element,
                "id": for_attr,
                "type": "text",
                "label": label_text,
                "required": required,
                "options": [],
            }

            if tag == "INPUT":
                input_type = element.get_attribute("type").lower()
                field["type"] = input_type

                if input_type == "file":
                    if required:
                        logger.warning(f"Required file field skipped: {label_text}")
                    continue

                elif input_type in ("radio", "checkbox"):
                    fieldset = find_parent_fieldset(driver, element)
                    if not fieldset:
                        continue

                    legend = find_fieldset_legend(driver, fieldset)
                    if not legend:
                        continue

                    # Get all options in fieldset
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

                    if not option_elements or option_elements[0] != element:
                        continue

                    legend_text = legend.text.strip()
                    if legend_text.endswith("*"):
                        legend_text = legend_text[:-1].strip() + " (you need to select at least one option)"
                        required = True

                    field["element"] = option_elements
                    field["type"] = input_type
                    field["label"] = legend_text
                    field["options"] = option_texts

                elif element.get_attribute("role") == "combobox":
                    field["type"] = "select"
                    field["options"] = get_combobox_options(driver, element)

            elif tag == "TEXTAREA":
                field["type"] = "textarea"

            elif tag == "SELECT":
                field["type"] = "select"
                options = element.find_elements(By.TAG_NAME, "option")
                field["options"] = [opt.text.strip() for opt in options if opt.get_attribute("value")]

            fields.append(field)

        except (StaleElementReferenceException, Exception) as e:
            logger.debug(f"Error processing label: {e}")
            continue

    return fields


def find_parent_fieldset(driver, element):
    """Find parent fieldset element."""
    try:
        return driver.execute_script(
            "return arguments[0].closest('fieldset');", element
        )
    except Exception:
        return None


def find_fieldset_legend(driver, fieldset):
    """Find legend element inside fieldset."""
    try:
        return fieldset.find_element(By.TAG_NAME, "legend")
    except (NoSuchElementException, Exception):
        return None


def get_combobox_options(driver, element):
    """Get options from a combobox/dropdown."""
    options = []
    try:
        # Click to open dropdown
        driver.execute_script(
            "arguments[0].dispatchEvent(new Event('mouseup', {bubbles: true}));",
            element,
        )
        time.sleep(0.5)

        # Find listbox via aria-controls
        controls_id = element.get_attribute("aria-controls")
        if controls_id:
            try:
                listbox = driver.find_element(By.ID, controls_id)
                option_els = listbox.find_elements(By.CSS_SELECTOR, 'div[role="option"]')
                options = [opt.text.strip() for opt in option_els]
            except (NoSuchElementException, Exception):
                pass

        # Close dropdown
        driver.execute_script(
            "arguments[0].dispatchEvent(new Event('focusout', {bubbles: true}));",
            element,
        )
    except Exception:
        pass
    return options


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
                v.strip().lower() == option_text.strip().lower()
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
    """Fill a combobox/select field."""
    try:
        # Open dropdown
        driver.execute_script(
            "arguments[0].dispatchEvent(new Event('mouseup', {bubbles: true}));",
            element,
        )
        time.sleep(0.3)

        controls_id = element.get_attribute("aria-controls")
        if not controls_id:
            return False

        listbox = driver.find_element(By.ID, controls_id)
        option_els = listbox.find_elements(By.CSS_SELECTOR, 'div[role="option"]')

        target_lower = value.strip().lower()

        # Try exact match first
        for opt in option_els:
            if opt.text.strip().lower() == target_lower:
                scroll_to_element(driver, opt)
                opt.click()
                time.sleep(0.3)
                return True

        # Try partial match
        for opt in option_els:
            opt_text = opt.text.strip().lower()
            if target_lower in opt_text or opt_text in target_lower:
                scroll_to_element(driver, opt)
                opt.click()
                time.sleep(0.3)
                return True

        # Close dropdown without selection
        driver.execute_script(
            "arguments[0].dispatchEvent(new Event('focusout', {bubbles: true}));",
            element,
        )
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
    Main Greenhouse application flow.
    Returns dict with success status and details.
    """
    result = {"success": False, "message": "", "fields_filled": 0}

    try:
        # Wait for page to load
        time.sleep(2)

        # Verify this is a Greenhouse page
        if not is_greenhouse_page(driver):
            result["message"] = "Not a Greenhouse application page"
            return result

        # Check for confirmation page (already applied)
        if "/confirmation" in driver.current_url:
            result["message"] = "Already applied to this job"
            result["success"] = True
            return result

        # Get job info
        job_info = get_job_info(driver)
        logger.info(f"Greenhouse job: {job_info.get('role', 'unknown')} at {job_info.get('company', 'unknown')}")

        # Scroll to application container
        container = wait_and_find(driver, By.CSS_SELECTOR, CONTAINER_SELECTOR, timeout=10)
        if not container:
            result["message"] = "Application container not found"
            return result

        scroll_to_element(driver, container)

        # Upload resume if required
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

        # Click required checkboxes
        click_consent_boxes(driver)
        time.sleep(0.5)

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

        # Check for verification code requirement
        if handle_verification_code(driver, job_info.get("company", "")):
            result["message"] = "Email verification required - manual intervention needed"
            return result

        # Check for submission success
        if check_submission_success(driver, SUCCESS_SELECTORS, timeout=30):
            result["success"] = True
            result["message"] = "Application submitted successfully"
        else:
            # Check for errors after submit
            error_msg = is_form_error_visible(driver)
            if error_msg:
                result["message"] = f"Submission failed: {error_msg}"
            else:
                result["message"] = "Submission status unknown"

        return result

    except Exception as e:
        result["message"] = f"Error during application: {str(e)}"
        logger.error(f"Greenhouse apply error: {e}")
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
