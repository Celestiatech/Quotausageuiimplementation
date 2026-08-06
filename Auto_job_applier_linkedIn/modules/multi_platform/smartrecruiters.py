"""
SmartRecruiters job application automation.
Based on LiftMyCV's smartrecruiters/apply.js flow.
SmartRecruiters uses web components (spl-*) with shadow DOM.
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

# SmartRecruiters-specific selectors
EASY_APPLY_CONTAINER = '[data-test="easy-apply-container"]'
RESUME_DROPZONE = 'spl-dropzone[data-test="resume-upload"]'
SUBMIT_BUTTON_SELECTOR = 'button[data-test="submit-application"], button[type="submit"]'
SUCCESS_SELECTORS = [
    '[data-test="application-success"]',
    ".application-submitted",
    ".success-message",
]
SKIP_WORDS = ["Diversity", "diversity", "DIVERSITY", "Survey", "survey", "SURVEY"]


def is_smartrecruiters_page(driver):
    """Detect if current page is a SmartRecruiters application."""
    indicators = [
        EASY_APPLY_CONTAINER,
        RESUME_DROPZONE,
        '[data-test="apply-button"]',
        "spl-button[data-test='apply-button']",
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
    return "smartrecruiters.com" in url


def get_job_info(driver):
    """Extract job metadata from SmartRecruiters page."""
    info = {"company": "", "role": "", "description": "", "location": ""}

    try:
        company_el = driver.find_elements(
            By.CSS_SELECTOR,
            '[data-test="company-name"], .company-name, .posting-headline h2',
        )
        if company_el:
            info["company"] = company_el[0].text.strip()
    except Exception:
        pass

    try:
        role_el = driver.find_elements(
            By.CSS_SELECTOR,
            '[data-test="job-title"], .posting-headline h1, h1',
        )
        if role_el:
            info["role"] = role_el[0].text.strip()
    except (NoSuchElementException, Exception):
        pass

    try:
        location_el = driver.find_elements(
            By.CSS_SELECTOR,
            '[data-test="location"], .location, .posting-headline .location',
        )
        if location_el:
            info["location"] = location_el[0].text.strip()
    except (NoSuchElementException, Exception):
        pass

    try:
        desc_el = driver.find_elements(
            By.CSS_SELECTOR,
            '[data-test="job-description"], .job-description, #job-description',
        )
        if desc_el:
            info["description"] = desc_el[0].get_attribute("innerHTML").strip()
    except (NoSuchElementException, Exception):
        pass

    return info


def collect_fields(driver):
    """
    Collect all form fields from SmartRecruiters application.
    Uses JavaScript to handle shadow DOM web components.
    Returns list of field descriptors.
    """
    fields = []

    try:
        # Use JavaScript to collect fields from shadow DOM
        fields_data = driver.execute_script("""
            function collectFields() {
                const fields = [];
                const seen = new Set();

                // Find all question containers
                const containers = document.querySelectorAll(
                    '[data-test*="question"], spl-question-field, .question-container'
                );

                for (const container of containers) {
                    // Skip if hidden
                    if (container.offsetParent === null) continue;

                    // Get label
                    let label = '';
                    const labelEl = container.querySelector(
                        'label, [data-test="question-label"], spl-typography-label'
                    );
                    if (labelEl) {
                        label = labelEl.textContent.trim();
                    }

                    if (!label || seen.has(label)) continue;
                    seen.add(label);

                    // Skip resume upload
                    if (label.toLowerCase().includes('resume') ||
                        label.toLowerCase().includes('upload')) continue;

                    // Skip diversity/survey
                    const skipWords = ['Diversity', 'Survey'];
                    if (skipWords.some(w => label.includes(w))) continue;

                    // Check if required
                    const required = container.querySelector(
                        '[aria-required="true"], [data-required="true"], .required'
                    ) !== null || label.includes('*');

                    // Find input element
                    const input = container.querySelector(
                        'input:not([type="hidden"]):not([type="file"]), textarea, select'
                    );
                    if (!input) continue;

                    const tag = input.tagName.toLowerCase();
                    const type = tag === 'input' ?
                        (input.getAttribute('type') || 'text').toLowerCase() : tag;

                    const field = {
                        element: null, // Will be resolved later
                        id: input.id || null,
                        type: type,
                        label: label.replace(/\\*/g, '').trim(),
                        required: required,
                        options: []
                    };

                    // Handle radio/checkbox groups
                    if (type === 'radio' || type === 'checkbox') {
                        const fieldset = container.querySelector('fieldset');
                        if (fieldset) {
                            const labels = fieldset.querySelectorAll('label');
                            field.options = Array.from(labels).map(l => l.textContent.trim());
                            field.element = Array.from(labels).map(l => {
                                const inp = document.getElementById(l.getAttribute('for'));
                                return inp ? inp.id : null;
                            }).filter(Boolean);
                        }
                    }

                    // Handle select
                    if (tag === 'select') {
                        const options = input.querySelectorAll('option');
                        field.options = Array.from(options)
                            .filter(o => o.value)
                            .map(o => o.textContent.trim());
                    }

                    fields.push(field);
                }

                return fields;
            }
            return collectFields();
        """)

        # Resolve element references
        for field_data in fields_data:
            element = None
            if field_data.get("id"):
                try:
                    element = driver.find_element(By.ID, field_data["id"])
                except NoSuchElementException:
                    continue
            elif field_data.get("element"):
                # For radio/checkbox groups, find first element
                try:
                    element = driver.find_element(By.ID, field_data["element"][0])
                except (NoSuchElementException, IndexError):
                    continue

            if element:
                field_data["element"] = element
                fields.append(field_data)

    except Exception as e:
        logger.debug(f"Error collecting fields: {e}")

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
    element_ids = field["element"]
    options = field["options"]

    if not isinstance(value, list):
        value = [value]

    for i, el_id in enumerate(element_ids):
        try:
            el = driver.find_element(By.ID, el_id)
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
    Main SmartRecruiters application flow.
    Returns dict with success status and details.
    """
    result = {"success": False, "message": "", "fields_filled": 0}

    try:
        # Wait for page to load
        time.sleep(2)

        # Verify this is a SmartRecruiters page
        if not is_smartrecruiters_page(driver):
            result["message"] = "Not a SmartRecruiters application page"
            return result

        # Get job info
        job_info = get_job_info(driver)
        logger.info(f"SmartRecruiters job: {job_info.get('role', 'unknown')} at {job_info.get('company', 'unknown')}")

        # Click Apply button if present
        apply_btn = wait_and_find(
            driver, By.CSS_SELECTOR,
            '[data-test="apply-button"], spl-button[data-test="apply-button"]',
            timeout=5,
        )
        if apply_btn:
            scroll_to_element(driver, apply_btn)
            safe_click(apply_btn)
            time.sleep(2)

        # Upload resume if required
        resume_input = wait_and_find(
            driver, By.CSS_SELECTOR,
            f'{RESUME_DROPZONE} input[type="file"], input[data-test="resume-upload"]',
            timeout=5,
        )
        if resume_input and resume_url:
            try:
                upload_file(driver, resume_input, resume_url, resume_filename)
                time.sleep(2)
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
        logger.error(f"SmartRecruiters apply error: {e}")
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
