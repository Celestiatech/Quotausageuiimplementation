"""
Glassdoor job application automation.
Based on LiftMyCV's glassdoor/apply.js flow.
Glassdoor uses Indeed-style forms with ia-Questions-item structure.
"""
import time
import logging
from datetime import datetime
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

# Glassdoor-specific selectors
QUESTIONS_CONTAINER = ".ia-Questions-item"
SUBMIT_BUTTON_SELECTOR = 'button[data-test="submit-button"], .ia-continueButton'
SUCCESS_SELECTORS = [
    '[data-test="apply-success"]',
    ".ia-ApplicationSuccess",
    ".application-confirmed",
]
SKIP_WORDS = ["Diversity", "diversity", "DIVERSITY", "Survey", "survey", "SURVEY"]


def is_glassdoor_page(driver):
    """Detect if current page is a Glassdoor application."""
    indicators = [
        ".ia-Questions-item",
        '[data-test="apply-button"]',
        ".ia-continueButton",
        "#ApplicationForm",
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
    return "glassdoor.com" in url or "indeed.com" in url


def get_job_info(driver):
    """Extract job metadata from Glassdoor page."""
    info = {"company": "", "role": "", "description": "", "location": ""}

    try:
        # Company from header or logo
        company_el = driver.find_elements(
            By.CSS_SELECTOR,
            '[data-test="employer-short-name"], .employer-short-name, [data-test="top-card-employer-name"]',
        )
        if company_el:
            info["company"] = company_el[0].text.strip()
        else:
            info["company"] = driver.title.split(" - ")[-2].strip() if " - " in driver.title else ""
    except Exception:
        pass

    try:
        role_el = driver.find_elements(
            By.CSS_SELECTOR,
            '[data-test="job-title"], .job-title, h1[data-test="job-title"]',
        )
        if role_el:
            info["role"] = role_el[0].text.strip()
    except (NoSuchElementException, Exception):
        pass

    try:
        location_el = driver.find_elements(
            By.CSS_SELECTOR,
            '[data-test="job-location"], .job-location',
        )
        if location_el:
            info["location"] = location_el[0].text.strip()
    except (NoSuchElementException, Exception):
        pass

    try:
        desc_el = driver.find_elements(
            By.CSS_SELECTOR,
            '[data-test="JobDescriptionContainer"], .jobDescriptionText',
        )
        if desc_el:
            info["description"] = desc_el[0].get_attribute("innerHTML").strip()
    except (NoSuchElementException, Exception):
        pass

    return info


def collect_fields(driver):
    """
    Collect all form fields from Glassdoor application.
    Returns list of field descriptors.
    """
    fields = []

    try:
        question_items = driver.find_elements(By.CSS_SELECTOR, QUESTIONS_CONTAINER)
    except Exception:
        return fields

    for item in question_items:
        try:
            # Skip if hidden
            if not item.is_displayed():
                continue

            # Get label
            label_el = item.find_elements(
                By.CSS_SELECTOR, "label, legend, .question-label"
            )
            if not label_el:
                continue

            label_text = label_el[0].text.strip()
            if not label_text:
                continue

            # Skip resume upload
            if "resume" in label_text.lower() or "upload" in label_text.lower():
                continue

            # Skip diversity/survey questions
            if any(skip_word in label_text for skip_word in SKIP_WORDS):
                continue

            # Check if required
            required = "*" in label_text or item.find_elements(
                By.CSS_SELECTOR, '[aria-required="true"], .required'
            )

            # Clean label
            label_text = clean_label(label_text)

            # Find input element
            input_el = item.find_elements(
                By.CSS_SELECTOR,
                'input:not([type="hidden"]):not([type="file"]), textarea, select',
            )
            if not input_el:
                continue

            element = input_el[0]
            tag = element.tag_name.lower()
            input_type = element.get_attribute("type").lower() if tag == "input" else tag

            field = {
                "element": element,
                "type": input_type,
                "label": label_text,
                "required": required,
                "options": [],
            }

            # Handle radio/checkbox groups
            if input_type in ("radio", "checkbox"):
                fieldset = item.find_elements(By.CSS_SELECTOR, "fieldset")
                if fieldset:
                    options = fieldset[0].find_elements(By.CSS_SELECTOR, "label")
                    field["element"] = [
                        driver.find_element(By.ID, opt.get_attribute("for"))
                        for opt in options
                        if opt.get_attribute("for")
                    ]
                    field["options"] = [opt.text.strip() for opt in options]
                else:
                    # Single checkbox
                    field["element"] = [element]

            # Handle select
            elif tag == "select":
                options = element.find_elements(By.TAG_NAME, "option")
                field["options"] = [
                    opt.text.strip() for opt in options if opt.get_attribute("value")
                ]

            fields.append(field)

        except (StaleElementReferenceException, NoSuchElementException, Exception) as e:
            logger.debug(f"Error processing question item: {e}")
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


def handle_today_date(driver, element):
    """Handle 'Today's Date' field with MM/DD/YYYY format."""
    today = datetime.now()
    date_str = today.strftime("%m/%d/%Y")
    return set_input_value(driver, element, date_str)


def apply_to_job(driver, resume_url=None, resume_filename="resume.pdf", answers=None):
    """
    Main Glassdoor application flow.
    Returns dict with success status and details.
    """
    result = {"success": False, "message": "", "fields_filled": 0}

    try:
        # Wait for page to load
        time.sleep(2)

        # Verify this is a Glassdoor page
        if not is_glassdoor_page(driver):
            result["message"] = "Not a Glassdoor application page"
            return result

        # Get job info
        job_info = get_job_info(driver)
        logger.info(f"Glassdoor job: {job_info.get('role', 'unknown')} at {job_info.get('company', 'unknown')}")

        # Click Apply button if present
        apply_btn = wait_and_find(
            driver, By.CSS_SELECTOR,
            '[data-test="apply-button"], .applyBtn, button[data-za-detail-page-name="apply"]',
            timeout=5,
        )
        if apply_btn:
            scroll_to_element(driver, apply_btn)
            safe_click(apply_btn)
            time.sleep(2)

        # Collect form fields
        fields = collect_fields(driver)
        if not fields:
            result["message"] = "No form fields found"
            return result

        logger.info(f"Found {len(fields)} form fields")

        # Fill fields with provided answers
        filled_count = 0
        for field in fields:
            # Handle special fields
            if "today" in field["label"].lower() and "date" in field["label"].lower():
                if handle_today_date(driver, field["element"]):
                    filled_count += 1
                continue

            value = get_answer_for_field(field, answers)
            if value is not None:
                if fill_field(driver, field, value):
                    filled_count += 1
                time.sleep(0.5)

        result["fields_filled"] = filled_count
        logger.info(f"Filled {filled_count}/{len(fields)} fields")

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
        logger.error(f"Glassdoor apply error: {e}")
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
