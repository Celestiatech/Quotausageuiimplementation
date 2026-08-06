"""
Base utilities for multi-platform job application automation.
Selenium equivalents of LiftMyCV's shared functionality.
"""
import time
import logging
from functools import wraps
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    ElementClickInterceptedException,
)

logger = logging.getLogger(__name__)


def retry_on_failure(max_retries=3, delay=2, backoff=2):
    """
    Decorator to retry function on failure.
    
    Args:
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries (seconds)
        backoff: Multiplier for delay after each retry
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.debug(f"Attempt {attempt + 1} failed for {func.__name__}: {e}")
                        time.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        logger.debug(f"All {max_retries + 1} attempts failed for {func.__name__}")
            
            raise last_exception
        return wrapper
    return decorator


def safe_click(element, timeout=2):
    """Click an element with retry logic."""
    try:
        element.click()
        return True
    except ElementClickInterceptedException:
        try:
            element.parent.execute_script("arguments[0].click();", element)
            return True
        except Exception:
            return False
    except Exception as e:
        logger.debug(f"safe_click failed: {e}")
        return False


def wait_and_find(driver, by, value, timeout=10):
    """Wait for element and return it."""
    try:
        return WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((by, value))
        )
    except TimeoutException:
        return None


def wait_for_clickable(driver, by, value, timeout=10):
    """Wait for element to be clickable."""
    try:
        return WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((by, value))
        )
    except TimeoutException:
        return None


def scroll_to_element(driver, element, offset=200):
    """Scroll to bring element into view."""
    try:
        driver.execute_script(
            "arguments[0].scrollIntoView({block: 'center'});", element
        )
        time.sleep(0.3)
    except Exception:
        pass


def set_input_value(driver, element, value):
    """Set input value using JavaScript (bypasses React controlled inputs)."""
    try:
        driver.execute_script(
            """
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            ).set;
            nativeInputValueSetter.call(arguments[0], arguments[1]);
            arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
            arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
            """,
            element,
            value,
        )
        return True
    except Exception as e:
        logger.debug(f"set_input_value failed: {e}")
        return False


def set_textarea_value(driver, element, value):
    """Set textarea value using JavaScript."""
    try:
        driver.execute_script(
            """
            var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 'value'
            ).set;
            nativeTextAreaValueSetter.call(arguments[0], arguments[1]);
            arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
            arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
            """,
            element,
            value,
        )
        return True
    except Exception as e:
        logger.debug(f"set_textarea_value failed: {e}")
        return False


def upload_file(driver, file_input, file_url, filename="resume.pdf"):
    """Upload file via URL (fetch blob and set on file input)."""
    try:
        # Use JS to fetch file and create DataTransfer
        driver.execute_script(
            """
            return (async function() {
                const response = await fetch(arguments[0]);
                const blob = await response.blob();
                const file = new File([blob], arguments[1], { type: blob.type });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                arguments[2].files = dataTransfer.files;
                arguments[2].dispatchEvent(new Event('change', { bubbles: true }));
            })();
            """,
            file_url,
            filename,
            file_input,
        )
        return True
    except Exception as e:
        logger.debug(f"upload_file failed: {e}")
        return False


def wait_for_upload_complete(driver, selector, timeout=30):
    """Wait for upload success indicator."""
    try:
        WebDriverWait(driver, timeout).until(
            lambda d: d.find_element(By.CSS_SELECTOR, selector).is_displayed()
        )
        return True
    except TimeoutException:
        return False


def check_required_field(label_element):
    """Check if a field is required based on label text or asterisk."""
    try:
        text = label_element.text.strip()
        if text.endswith("*") or "✱" in text:
            return True
        # Check for required indicator sibling
        required_span = label_element.find_element(
            By.CSS_SELECTOR, ".required, strong"
        )
        return required_span.text.strip() == "*"
    except (NoSuchElementException, Exception):
        return False


def clean_label(text):
    """Clean label text by removing required markers and extra whitespace."""
    text = text.strip()
    text = text.replace("✱", "").replace("*", "").strip()
    text = text.replace("\n", " ").strip()
    return text


def click_consent_boxes(driver):
    """Click any consent/checkbox required boxes."""
    try:
        checkboxes = driver.find_elements(
            By.CSS_SELECTOR,
            'input[type="checkbox"][required]:not(:checked), '
            'input[type="checkbox"][aria-required="true"]:not(:checked)',
        )
        for cb in checkboxes:
            try:
                if cb.is_displayed():
                    cb.click()
                    time.sleep(0.3)
            except Exception:
                pass
    except Exception:
        pass


def is_form_error_visible(driver):
    """Check for visible error messages."""
    error_selectors = [
        ".helper-text--error",
        ".error-message",
        '[role="alert"]',
        '[id$="_error"]',
        '[data-ui="error"]',
    ]
    for selector in error_selectors:
        try:
            errors = driver.find_elements(By.CSS_SELECTOR, selector)
            for err in errors:
                if err.is_displayed() and err.text.strip():
                    return err.text.strip()
        except Exception:
            pass
    return None


def handle_verification_code(driver, company, email_field_id="email"):
    """Handle email verification if required (manual intervention needed)."""
    try:
        verification = driver.find_element(By.ID, "email-verification")
        if verification.is_displayed():
            logger.warning(
                "Email verification required - manual intervention needed"
            )
            return True
    except (NoSuchElementException, Exception):
        pass
    return False


def submit_form(driver, submit_selector):
    """Click submit button and wait for result."""
    try:
        submit_btn = wait_for_clickable(driver, By.CSS_SELECTOR, submit_selector, timeout=10)
        if submit_btn:
            scroll_to_element(driver, submit_btn)
            time.sleep(0.5)
            safe_click(submit_btn)
            return True
    except Exception as e:
        logger.debug(f"submit_form failed: {e}")
    return False


def check_submission_success(driver, success_selectors, timeout=30):
    """Check for submission success indicators."""
    for selector in success_selectors:
        try:
            WebDriverWait(driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            return True
        except TimeoutException:
            continue
    return False
