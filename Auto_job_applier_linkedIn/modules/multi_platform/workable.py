"""
Workable job application automation.
Based on LiftMyCV's workable/apply.js flow.
Workable uses aria-labelledby attribute for field identification and dialog-based forms.
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

# Workable-specific selectors
FIELDS_SELECTOR = (
    'main fieldset[aria-labelledby], '
    'main div[role="group"][aria-labelledby], '
    'main input[aria-labelledby]:not([aria-hidden="true"],[type="file"]), '
    'main textarea[aria-labelledby], '
    'main input[texts]:not([aria-hidden="true"],[type="file"]), '
    'main input[placeholder][inputmode="tel"]:not([aria-hidden="true"],[type="file"]), '
    'dialog fieldset[aria-labelledby], '
    'dialog div[role="group"][aria-labelledby], '
    'dialog input[aria-labelledby]:not([aria-hidden="true"],[type="file"]), '
    'dialog textarea[aria-labelledby], '
    'dialog input[texts]:not([aria-hidden="true"],[type="file"]), '
    'dialog input[placeholder][inputmode="tel"]:not([aria-hidden="true"],[type="file"])'
)
RESUME_INPUT_SELECTOR = 'input[data-ui="resume"][type="file"]'
AVATAR_INPUT_SELECTOR = 'input[data-ui="avatar"][type="file"]'
APPLY_NOW_SELECTOR = '[data-ui="overview-apply-now"]'
APPLY_BUTTON_SELECTOR = 'button[data-ui="apply-button"]'
SUCCESS_SELECTORS = [
    'div[data-ui="successful-submit"]',
    '[data-ui="application-form-success-subtitle"]',
    '[data-ui="application-success"]',
]
GDPR_CHECKBOX_SELECTOR = 'input[name="gdpr"]:not(:checked)'


def is_workable_page(driver):
    """Detect if current page is a Workable application."""
    indicators = [
        '[data-ui="job-title"]',
        '[data-ui="job-description"]',
        '[data-ui="resume"]',
        'input[aria-labelledby]',
        "main fieldset[aria-labelledby]",
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
    return "workable.com" in url or "apply.workable.com" in url


def get_job_info(driver):
    """Extract job metadata from Workable page."""
    info = {"company": "", "role": "", "description": "", "location": ""}

    try:
        company_el = driver.find_element(By.CSS_SELECTOR, 'a[data-ui="company-logo"] img')
        info["company"] = company_el.get_attribute("alt").strip()
    except (NoSuchElementException, Exception):
        try:
            company_el = driver.find_element(By.CSS_SELECTOR, '[data-ui="overview-company"] a')
            info["company"] = company_el.text.strip()
        except (NoSuchElementException, Exception):
            pass

    try:
        role_el = driver.find_element(By.CSS_SELECTOR, '[data-ui="job-title"]')
        info["role"] = role_el.text.strip()
    except (NoSuchElementException, Exception):
        try:
            role_el = driver.find_element(By.CSS_SELECTOR, '[data-ui="overview-title"]')
            info["role"] = role_el.text.strip()
        except (NoSuchElementException, Exception):
            pass

    try:
        location_el = driver.find_element(By.CSS_SELECTOR, '[data-ui="job-location"]')
        info["location"] = location_el.text.strip()
    except (NoSuchElementException, Exception):
        try:
            location_el = driver.find_element(By.CSS_SELECTOR, '[data-ui="overview-location"]')
            info["location"] = location_el.text.strip()
        except (NoSuchElementException, Exception):
            pass

    try:
        desc_el = driver.find_element(By.CSS_SELECTOR, '[data-ui="job-description"]')
        info["description"] = desc_el.find_element(By.XPATH, "..").get_attribute("innerHTML").strip()
    except (NoSuchElementException, Exception):
        pass

    return info


def is_required_field(label_element):
    """Check if field is required based on asterisk indicator."""
    try:
        # Check for strong element with *
        strong = label_element.find_element(By.XPATH, "./parent::*//strong")
        return strong.text.strip() == "*"
    except (NoSuchElementException, Exception):
        pass

    try:
        text = label_element.text.strip()
        return text.startswith("*") or "✱" in text
    except Exception:
        return False


def clean_field_label(label_element):
    """Clean label text and detect required status."""
    text = label_element.text.strip()
    required = False

    if text.startswith("*\n"):
        required = True
        text = text.replace("*\n", "").strip()

    if "alary" in text:
        text += " (input digits only)"

    return text, required


def collect_fields(driver):
    """
    Collect all form fields from Workable application.
    Returns list of field descriptors matching LiftMyCV's field structure.
    """
    fields = []

    try:
        field_elements = driver.find_elements(By.CSS_SELECTOR, FIELDS_SELECTOR)
    except Exception:
        return fields

    for el in field_elements:
        try:
            # Skip hidden inputs
            if el.get_attribute("aria-hidden") == "true":
                continue
            if el.get_attribute("type") == "file":
                continue

            field = {
                "element": el,
                "type": "",
                "label": "",
                "required": False,
                "options": [],
                "id": el.get_attribute("id") or "",
            }

            # Get label from aria-labelledby or parent label
            aria_labelled_by = el.get_attribute("aria-labelledby")
            if aria_labelled_by:
                try:
                    label_el = driver.find_element(By.ID, aria_labelled_by)
                except NoSuchElementException:
                    continue
            else:
                label_el = el.find_element(By.XPATH, "./ancestor::label")
                if not label_el:
                    continue

            field["label"], field["required"] = clean_field_label(label_el)
            if not is_required_field(label_el):
                field["required"] = False

            # Handle date inputs
            if el.parent and el.parent.find_elements(By.CSS_SELECTOR, '[data-ui="calendar-icon"]'):
                placeholder = el.get_attribute("placeholder")
                if placeholder:
                    field["label"] += " " + placeholder

            # Detect field type based on element and tag
            tag = el.tag_name.upper()
            node_name = driver.execute_script("return arguments[0].nodeName;", el)

            if tag in ("INPUT", "TEXTAREA"):
                input_type = el.get_attribute("type").lower()
                field["type"] = input_type

                # Handle combobox/select
                if el.get_attribute("role") == "combobox":
                    field["type"] = "select"
                    field["options"] = get_combobox_options(driver, el)

            elif tag == "DIV" or node_name == "DIV":
                # Radio/checkbox group in div container
                inputs = el.find_elements(By.TAG_NAME, "input")
                if inputs:
                    field["type"] = inputs[0].get_attribute("type").lower()
                    field["element"] = inputs
                    field["options"] = [
                        inp.find_element(By.XPATH, "./ancestor::label").text.strip()
                        for inp in inputs
                        if inp.find_element(By.XPATH, "./ancestor::label")
                    ]

            elif tag == "FIELDSET" or node_name == "FIELDSET":
                # Radio/checkbox group in fieldset
                inputs = el.find_elements(By.TAG_NAME, "input")
                if inputs:
                    field["type"] = inputs[0].get_attribute("type").lower()
                    field["element"] = inputs
                    field["options"] = [
                        inp.find_element(By.XPATH, "./ancestor::label").text.strip()
                        for inp in inputs
                        if inp.find_element(By.XPATH, "./ancestor::label")
                    ]

            if field["type"] and field["label"]:
                fields.append(field)

        except (StaleElementReferenceException, NoSuchElementException, Exception) as e:
            logger.debug(f"Error processing field: {e}")
            continue

    # Add phone field if present (special handling)
    try:
        phone_input = driver.find_element(By.CSS_SELECTOR, 'input[name="phone"]')
        if phone_input:
            phone_label_id = driver.execute_script(
                "return arguments[0].closest('[aria-labelledby]')?.getAttribute('aria-labelledby');",
                phone_input,
            )
            if phone_label_id:
                phone_label = driver.find_element(By.ID, phone_label_id)
                fields.append({
                    "element": phone_input,
                    "type": "tel",
                    "label": phone_label.text.strip(),
                    "required": is_required_field(phone_label),
                    "options": [],
                    "id": "phone",
                })
    except (NoSuchElementException, Exception):
        pass

    return fields


def get_combobox_options(driver, element):
    """Get options from a combobox/dropdown."""
    options = []
    try:
        # Click to open dropdown
        element.click()
        time.sleep(0.5)

        # Get options from container or document
        select_container = element.find_element(By.XPATH, "./ancestor::div[@data-input-type='select']")
        container_opts = [
            li.text.strip()
            for li in select_container.find_elements(By.CSS_SELECTOR, "dialog ul li")
        ]

        doc_opts = [
            li.text.strip()
            for li in driver.find_elements(By.CSS_SELECTOR, 'dialog[open] ul li, ul[role="listbox"] li')
            if not li.find_element(By.XPATH, "./ancestor::*[contains(@class, 'iti__')]")
        ]

        options = container_opts if container_opts else doc_opts

        # Close dropdown
        driver.find_element(By.TAG_NAME, "body").click()
        time.sleep(0.2)

    except Exception as e:
        logger.debug(f"get_combobox_options failed: {e}")

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
        scroll_to_element(driver, element)
        element.click()
        time.sleep(0.5)

        # Get all list items from open dropdown
        selectors = [
            "dialog[open] ul li",
            'ul[role="listbox"] li',
            '[data-input-type="select"] dialog ul li',
            '[data-ui*="dropdown"] li',
        ]

        all_items = []
        for selector in selectors:
            try:
                items = driver.find_elements(By.CSS_SELECTOR, selector)
                all_items.extend(items)
            except Exception:
                continue

        # Filter out phone country items
        all_items = [
            item for item in all_items
            if not item.find_element(By.XPATH, "./ancestor::*[contains(@class, 'iti__')]")
            and not item.find_element(By.XPATH, "./ancestor::*[contains(@class, 'iti__country')]")
        ]

        # Remove duplicates
        seen = set()
        unique_items = []
        for item in all_items:
            item_id = id(item)
            if item_id not in seen:
                seen.add(item_id)
                unique_items.append(item)
        all_items = unique_items

        target_lower = value.strip().lower()

        # Try exact match first
        for item in all_items:
            if item.text.strip().lower() == target_lower:
                scroll_to_element(driver, item)
                item.click()
                time.sleep(0.3)
                # Trigger change events
                driver.execute_script(
                    "arguments[0].dispatchEvent(new Event('change', {bubbles: true})); "
                    "arguments[0].dispatchEvent(new FocusEvent('blur', {bubbles: true}));",
                    element,
                )
                return True

        # Try partial match
        for item in all_items:
            item_text = item.text.strip().lower()
            if target_lower in item_text or item_text in target_lower:
                scroll_to_element(driver, item)
                item.click()
                time.sleep(0.3)
                driver.execute_script(
                    "arguments[0].dispatchEvent(new Event('change', {bubbles: true})); "
                    "arguments[0].dispatchEvent(new FocusEvent('blur', {bubbles: true}));",
                    element,
                )
                return True

        # Close dropdown without selection
        driver.find_element(By.TAG_NAME, "body").click()
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

    # Handle phone field with country code
    if field_label := element.get_attribute("aria-labelledby"):
        try:
            label_el = driver.find_element(By.ID, field_label)
            if "phone" in label_el.text.lower():
                return fill_phone_field(driver, element, value)
        except (NoSuchElementException, Exception):
            pass

    return set_input_value(driver, element, str(value))


def fill_phone_field(driver, element, value):
    """Fill phone field with country code selection."""
    try:
        # Find and click country code selector
        country_selector = element.find_element(By.XPATH, "./ancestor::*//div[@role='combobox']")
        if country_selector:
            country_selector.click()
            time.sleep(0.3)

            # Find country list
            country_list = driver.find_elements(By.CSS_SELECTOR, ".iti__dropdown-content li.iti__country")
            for country in country_list:
                try:
                    dial_code = country.find_element(By.CSS_SELECTOR, ".iti__dial-code")
                    if dial_code.text.strip() == value.get("country_code", "+1"):
                        country.click()
                        time.sleep(0.2)
                        break
                except (NoSuchElementException, Exception):
                    continue

            # Set phone number (without country code)
            phone_number = value.get("number", value) if isinstance(value, dict) else value
            return set_input_value(driver, element, str(phone_number))

    except (NoSuchElementException, Exception):
        # Fallback: just set the value
        return set_input_value(driver, element, str(value))

    return False


def apply_to_job(driver, resume_url=None, resume_filename="resume.pdf", answers=None):
    """
    Main Workable application flow.
    Returns dict with success status and details.
    """
    result = {"success": False, "message": "", "fields_filled": 0}

    try:
        # Wait for page to load
        time.sleep(2)

        # Verify this is a Workable page
        if not is_workable_page(driver):
            result["message"] = "Not a Workable application page"
            return result

        # Check for job unavailable
        try:
            unavailable = driver.find_element(By.CSS_SELECTOR, '[data-ui="job-unavailable"]')
            if unavailable.is_displayed():
                result["message"] = "Job is no longer available"
                return result
        except (NoSuchElementException, Exception):
            pass

        # Get job info
        job_info = get_job_info(driver)
        logger.info(f"Workable job: {job_info.get('role', 'unknown')} at {job_info.get('company', 'unknown')}")

        # Click Apply Now if available
        apply_now = wait_and_find(driver, By.CSS_SELECTOR, APPLY_NOW_SELECTOR, timeout=3)
        if apply_now:
            safe_click(apply_now)
            time.sleep(3)

        # Clear any existing sections
        try:
            clear_buttons = driver.find_elements(By.CSS_SELECTOR, 'a[data-ui^="clear-section-"]')
            for btn in clear_buttons:
                safe_click(btn)
                time.sleep(0.3)
        except Exception:
            pass

        # Upload resume
        resume_input = wait_and_find(driver, By.CSS_SELECTOR, RESUME_INPUT_SELECTOR, timeout=5)
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

        # Click GDPR checkbox if present
        try:
            gdpr = driver.find_element(By.CSS_SELECTOR, GDPR_CHECKBOX_SELECTOR)
            if gdpr.is_displayed():
                gdpr.click()
                time.sleep(0.3)
        except (NoSuchElementException, Exception):
            pass

        # Upload to any remaining required file inputs
        try:
            file_inputs = driver.find_elements(By.CSS_SELECTOR, 'main input[type="file"], dialog input[type="file"]')
            for inp in file_inputs:
                inp_id = inp.get_attribute("id") or ""
                if inp_id not in ("resume", "avatar") and not inp.get_attribute("files"):
                    # Check if required
                    try:
                        parent_span = inp.find_element(By.XPATH, "./parent::*/span")
                        if parent_span.text.strip().startswith("*") and resume_url:
                            upload_file(driver, inp, resume_url, resume_filename)
                            time.sleep(1)
                    except (NoSuchElementException, Exception):
                        pass
        except Exception:
            pass

        # Check for errors before submit
        error_msg = is_form_error_visible(driver)
        if error_msg:
            result["message"] = f"Form errors: {error_msg}"
            return result

        # Submit the form
        if not submit_form(driver, APPLY_BUTTON_SELECTOR):
            result["message"] = "Submit button not found or not clickable"
            return result

        time.sleep(2)

        # Check for errors after submit
        error_selectors = ['[id$="_error"]', '[data-ui="error"]', '.error-message', '[role="alert"]']
        for selector in error_selectors:
            try:
                errors = driver.find_elements(By.CSS_SELECTOR, selector)
                for err in errors:
                    if err.is_displayed() and err.text.strip():
                        result["message"] = f"Submission error: {err.text.strip()}"
                        return result
            except Exception:
                continue

        # Check for submission success
        if check_submission_success(driver, SUCCESS_SELECTORS, timeout=60):
            result["success"] = True
            result["message"] = "Application submitted successfully"
        else:
            result["message"] = "Submission status unknown"

        return result

    except Exception as e:
        result["message"] = f"Error during application: {str(e)}"
        logger.error(f"Workable apply error: {e}")
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
        elif "github" in label_lower:
            return answers.get("github", answers.get("GitHub", ""))
        elif "salary" in label_lower or "compensation" in label_lower:
            return answers.get("salary", answers.get("expected_salary", "120000"))

    return None
