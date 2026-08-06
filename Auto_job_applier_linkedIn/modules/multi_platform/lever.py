"""
Lever job application automation.
Based on LiftMyCV's lever/apply.js flow.
Lever uses simple .application-form with .application-question .application-label structure.
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

# Lever-specific selectors
APPLICATION_FORM_SELECTOR = ".application-form"
RESUME_INPUT_ID = "resume-upload-input"
SUBMIT_BUTTON_ID = "btn-submit"
UPLOAD_SUCCESS_SELECTOR = ".resume-upload-success"
SKIP_WORDS = ["Diversity", "diversity", "DIVERSITY", "Survey", "survey", "SURVEY"]
SUCCESS_SELECTORS = [
    'h3[data-qa="msg-submit-success"]',
    "/thanks",
    "/already-received",
]


def is_lever_page(driver):
    """Detect if current page is a Lever application."""
    indicators = [
        APPLICATION_FORM_SELECTOR,
        "#" + RESUME_INPUT_ID,
        "#" + SUBMIT_BUTTON_ID,
        ".posting-headline",
        ".application-question",
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
    return "lever.co" in url or "leap.co" in url


def get_job_info(driver):
    """Extract job metadata from Lever page."""
    info = {"company": "", "role": "", "description": "", "location": ""}

    try:
        # Company from logo or title
        logo = driver.find_element(By.CSS_SELECTOR, ".main-header-logo img")
        info["company"] = logo.get_attribute("alt").replace(" logo", "").strip()
    except (NoSuchElementException, Exception):
        try:
            info["company"] = driver.title.split(" - ")[0].strip()
        except Exception:
            pass

    try:
        role_el = driver.find_element(By.CSS_SELECTOR, ".posting-headline h2")
        info["role"] = role_el.text.strip()
    except (NoSuchElementException, Exception):
        pass

    try:
        location_el = driver.find_element(By.CSS_SELECTOR, ".location")
        info["location"] = location_el.text.strip()
    except (NoSuchElementException, Exception):
        pass

    try:
        desc_el = driver.find_element(By.CSS_SELECTOR, "[data-qa='job-description']")
        info["description"] = desc_el.find_element(By.XPATH, "..").get_attribute("innerHTML").strip()
    except (NoSuchElementException, Exception):
        pass

    return info


def should_skip_form(form_element):
    """Check if form should be skipped (diversity/survey)."""
    try:
        form_text = form_element.text
        return any(skip_word in form_text for skip_word in SKIP_WORDS)
    except Exception:
        return False


def collect_fields(driver):
    """
    Collect all form fields from Lever application.
    Returns list of field descriptors matching LiftMyCV's field structure.
    """
    fields = []

    try:
        forms = driver.find_elements(By.CSS_SELECTOR, APPLICATION_FORM_SELECTOR)
    except Exception:
        return fields

    for form in forms:
        # Skip diversity/survey forms
        if should_skip_form(form):
            logger.info("Skipping form: contains skip word(s)")
            continue

        try:
            labels = form.find_elements(By.CSS_SELECTOR, ".application-question .application-label")
        except Exception:
            continue

        for label in labels:
            try:
                # Check if required
                required = label.find_element(By.CSS_SELECTOR, ".required") is not None

                # Get label text
                label_text = label.text.replace("\n✱", "").replace('"', "'").strip()

                # Skip resume and LinkedIn fields
                if "Resume/CV" in label_text or label_text.strip().startswith("LinkedIn profile"):
                    continue

                # Find the question container and field
                question = label.find_element(By.XPATH, "./ancestor::div[contains(@class, 'application-question')]")
                field_container = question.find_element(By.CSS_SELECTOR, ".application-field")

                field = {
                    "element": None,
                    "type": "text",
                    "label": label_text,
                    "required": required,
                    "options": [],
                    "id": "",
                }

                # Detect field type
                try:
                    input_el = field_container.find_element(By.CSS_SELECTOR, "& > input")
                    field["element"] = input_el
                    field["type"] = input_el.get_attribute("type").lower()
                    field["id"] = input_el.get_attribute("id") or ""
                except (NoSuchElementException, Exception):
                    try:
                        textarea_el = field_container.find_element(By.CSS_SELECTOR, "& > textarea")
                        field["element"] = textarea_el
                        field["type"] = "textarea"
                        field["id"] = textarea_el.get_attribute("id") or ""
                    except (NoSuchElementException, Exception):
                        try:
                            select_el = field_container.find_element(By.CSS_SELECTOR, ".application-dropdown select")
                            field["element"] = select_el
                            field["type"] = "select"
                            field["id"] = select_el.get_attribute("id") or ""
                            options = select_el.find_elements(By.TAG_NAME, "option")
                            field["options"] = [
                                opt.text.strip() for opt in options
                                if opt.get_attribute("value") and opt.get_attribute("value").strip()
                            ]
                        except (NoSuchElementException, Exception):
                            try:
                                # Radio/checkbox group
                                inputs = field_container.find_elements(By.CSS_SELECTOR, "& > ul input")
                                if inputs:
                                    field["element"] = inputs
                                    field["type"] = inputs[0].get_attribute("type").lower()
                                    field["options"] = [
                                        inp.get_attribute("value") for inp in inputs
                                        if inp.get_attribute("value") and inp.get_attribute("value").strip()
                                    ]
                                else:
                                    logger.debug(f"Unknown field: {label_text}")
                                    continue
                            except Exception:
                                continue

                fields.append(field)

            except (StaleElementReferenceException, NoSuchElementException, Exception) as e:
                logger.debug(f"Error processing label: {e}")
                continue

    # Add additional information field if present
    try:
        additional_info = driver.find_element(By.ID, "additional-information")
        fields.append({
            "element": additional_info,
            "type": "textarea",
            "label": "Add a cover letter or anything else you want to share.",
            "required": False,
            "options": [],
            "id": "additional-information",
        })
    except (NoSuchElementException, Exception):
        pass

    return fields


def wait_for_upload(driver, timeout=30):
    """Wait for resume upload to complete."""
    try:
        WebDriverWait(driver, timeout).until(
            lambda d: d.execute_script(
                f"return document.querySelector('.resume-upload-success')?.style?.display === 'inline'"
            )
        )
        return True
    except TimeoutException:
        return False


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
            option_value = options[i] if i < len(options) else ""
            should_check = any(
                v.strip().lower() == option_value.strip().lower()
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
    Main Lever application flow.
    Returns dict with success status and details.
    """
    result = {"success": False, "message": "", "fields_filled": 0}

    try:
        # Wait for page to load
        time.sleep(2)

        # Verify this is a Lever page
        if not is_lever_page(driver):
            result["message"] = "Not a Lever application page"
            return result

        # Check for already applied/thanks page
        current_url = driver.current_url
        if "/thanks" in current_url or "/already-received" in current_url:
            result["message"] = "Already applied to this job"
            result["success"] = True
            return result

        # Check if we need to click "Apply" button first
        if not current_url.endswith("/apply"):
            apply_btn = wait_and_find(
                driver, By.CSS_SELECTOR, ".posting-header a.template-btn-submit", timeout=5
            )
            if apply_btn:
                # Check workplace/location filters here if needed
                scroll_to_element(driver, apply_btn)
                time.sleep(0.5)
                safe_click(apply_btn)
                time.sleep(3)
                # After clicking, we might get redirected
                # Wait for form to load
                wait_and_find(driver, By.CSS_SELECTOR, APPLICATION_FORM_SELECTOR, timeout=15)

        # Get job info
        job_info = get_job_info(driver)
        logger.info(f"Lever job: {job_info.get('role', 'unknown')} at {job_info.get('company', 'unknown')}")

        # Upload resume
        resume_input = wait_and_find(driver, By.ID, RESUME_INPUT_ID, timeout=5)
        if resume_input and resume_url:
            try:
                upload_file(driver, resume_input, resume_url, resume_filename)
                # Wait for upload to complete
                if wait_for_upload(driver, timeout=30):
                    logger.info("Resume uploaded successfully")
                else:
                    logger.warning("Resume upload completion not confirmed")
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

        # Click consent checkboxes
        try:
            consent_boxes = driver.find_elements(By.CSS_SELECTOR, ".consent-required")
            for box in consent_boxes:
                if box.is_displayed() and not box.is_selected():
                    box.click()
                    time.sleep(0.3)
        except Exception:
            pass

        # Check for errors before submit
        error_msg = is_form_error_visible(driver)
        if error_msg:
            result["message"] = f"Form errors: {error_msg}"
            return result

        # Validate form
        try:
            form = driver.find_element(By.ID, "application-form")
            invalid_fields = driver.execute_script(
                """
                var form = arguments[0];
                var invalid = [];
                for (var i = 0; i < form.elements.length; i++) {
                    var field = form.elements[i];
                    if (!field.checkValidity()) {
                        invalid.push(field.name + ': ' + field.validationMessage);
                    }
                }
                return invalid;
                """,
                form,
            )
            if invalid_fields:
                result["message"] = f"Invalid fields: {'; '.join(invalid_fields)}"
                return result
        except (NoSuchElementException, Exception):
            pass

        # Submit the form
        if not submit_form(driver, f"#{SUBMIT_BUTTON_ID}"):
            result["message"] = "Submit button not found or not clickable"
            return result

        time.sleep(6)

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
        logger.error(f"Lever apply error: {e}")
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
