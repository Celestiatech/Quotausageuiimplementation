"""
Platform router for multi-platform job application automation.
Detects the platform and dispatches to the correct apply module.
Supports: Greenhouse, Lever, Workable, Glassdoor, SmartRecruiters, Ashby, Breezy, Recruitee, Wellfound
"""
import logging
import time
from urllib.parse import urlparse

from .greenhouse import is_greenhouse_page, apply_to_job as greenhouse_apply
from .lever import is_lever_page, apply_to_job as lever_apply
from .workable import is_workable_page, apply_to_job as workable_apply
from .glassdoor import is_glassdoor_page, apply_to_job as glassdoor_apply
from .smartrecruiters import is_smartrecruiters_page, apply_to_job as smartrecruiters_apply
from .ashby import is_ashby_page, apply_to_job as ashby_apply
from .breezy import is_breezy_page, apply_to_job as breezy_apply
from .recruitee import is_recruitee_page, apply_to_job as recruitee_apply
from .wellfound import is_wellfound_page, apply_to_job as wellfound_apply

logger = logging.getLogger(__name__)

# Platform detection order (most specific first)
PLATFORM_DETECTORS = [
    ("greenhouse", is_greenhouse_page),
    ("lever", is_lever_page),
    ("workable", is_workable_page),
    ("glassdoor", is_glassdoor_page),
    ("smartrecruiters", is_smartrecruiters_page),
    ("ashby", is_ashby_page),
    ("breezy", is_breezy_page),
    ("recruitee", is_recruitee_page),
    ("wellfound", is_wellfound_page),
]


def detect_platform(driver):
    """
    Detect the job board platform for the current page.
    Returns platform name or None if unsupported.
    """
    # First try URL-based detection (faster)
    url = driver.current_url.lower()

    if "greenhouse.io" in url or "boards.greenhouse.io" in url:
        return "greenhouse"
    if "lever.co" in url or "leap.co" in url:
        return "lever"
    if "workable.com" in url or "apply.workable.com" in url:
        return "workable"
    if "breezy.hr" in url:
        return "breezy"
    if "recruitee.com" in url:
        return "recruitee"
    if "wellfound.com" in url:
        return "wellfound"

    # Fall back to DOM-based detection
    for platform_name, detector in PLATFORM_DETECTORS:
        try:
            if detector(driver):
                return platform_name
        except Exception as e:
            logger.debug(f"Detection failed for {platform_name}: {e}")
            continue

    return None


def is_supported_platform(driver):
    """Check if the current page is on a supported platform."""
    return detect_platform(driver) is not None


def apply_to_job(driver, platform=None, resume_url=None, resume_filename="resume.pdf", answers=None, max_retries=2):
    """
    Apply to a job using the appropriate platform-specific module.
    
    Args:
        driver: Selenium WebDriver instance
        platform: Platform name (auto-detected if None)
        resume_url: URL of resume to upload
        resume_filename: Filename for the resume
        answers: Dict of field label -> value for auto-filling
        max_retries: Maximum number of retry attempts on failure
    
    Returns:
        dict with keys:
            - success (bool): Whether application was submitted
            - message (str): Status message
            - fields_filled (int): Number of fields filled
            - platform (str): Detected platform name
            - retries (int): Number of retries performed
    """
    # Auto-detect platform if not provided
    if platform is None:
        platform = detect_platform(driver)

    if platform is None:
        return {
            "success": False,
            "message": "Unsupported or unrecognized job board platform",
            "fields_filled": 0,
            "platform": None,
            "retries": 0,
        }

    logger.info(f"Detected platform: {platform}")

    # Dispatch to platform-specific module
    apply_functions = {
        "greenhouse": greenhouse_apply,
        "lever": lever_apply,
        "workable": workable_apply,
        "glassdoor": glassdoor_apply,
        "smartrecruiters": smartrecruiters_apply,
        "ashby": ashby_apply,
        "breezy": breezy_apply,
        "recruitee": recruitee_apply,
        "wellfound": wellfound_apply,
    }

    apply_func = apply_functions.get(platform)
    if apply_func is None:
        return {
            "success": False,
            "message": f"Platform '{platform}' is not implemented",
            "fields_filled": 0,
            "platform": platform,
            "retries": 0,
        }

    # Execute application with retry logic
    retries = 0
    last_result = None
    
    for attempt in range(max_retries + 1):
        try:
            result = apply_func(driver, resume_url, resume_filename, answers)
            result["platform"] = platform
            result["retries"] = retries
            
            if result.get("success"):
                return result
            
            last_result = result
            
            # Don't retry if it's a definite failure (e.g., already applied)
            if "already applied" in result.get("message", "").lower():
                return result
            
            # Retry on non-success
            if attempt < max_retries:
                retries += 1
                logger.info(f"Attempt {attempt + 1} failed, retrying... ({retries}/{max_retries})")
                time.sleep(2)  # Wait before retry
                
                # Reload page for retry
                try:
                    driver.refresh()
                    time.sleep(2)
                except Exception:
                    pass
                    
        except Exception as e:
            last_result = {
                "success": False,
                "message": f"Error: {str(e)}",
                "fields_filled": 0,
                "platform": platform,
                "retries": retries,
            }
            
            if attempt < max_retries:
                retries += 1
                logger.info(f"Attempt {attempt + 1} raised exception, retrying... ({retries}/{max_retries})")
                time.sleep(2)
                
                # Reload page for retry
                try:
                    driver.refresh()
                    time.sleep(2)
                except Exception:
                    pass
    
    # Return last result after all retries exhausted
    if last_result:
        last_result["retries"] = retries
        return last_result
    
    return {
        "success": False,
        "message": "All retry attempts failed",
        "fields_filled": 0,
        "platform": platform,
        "retries": retries,
    }


def get_platform_info(driver):
    """
    Get information about the current platform.
    Returns dict with platform name and basic page info.
    """
    platform = detect_platform(driver)
    info = {
        "platform": platform,
        "url": driver.current_url,
        "title": driver.title,
    }

    if platform:
        # Get platform-specific info
        try:
            if platform == "greenhouse":
                from .greenhouse import get_job_info
                info.update(get_job_info(driver))
            elif platform == "lever":
                from .lever import get_job_info
                info.update(get_job_info(driver))
            elif platform == "workable":
                from .workable import get_job_info
                info.update(get_job_info(driver))
            elif platform == "breezy":
                from .breezy import get_job_info
                info.update(get_job_info(driver))
            elif platform == "recruitee":
                from .recruitee import get_job_info
                info.update(get_job_info(driver))
            elif platform == "wellfound":
                from .wellfound import get_job_info
                info.update(get_job_info(driver))
        except Exception as e:
            logger.debug(f"Failed to get job info: {e}")

    return info


# Platform URL patterns for searching/linking
PLATFORM_URL_PATTERNS = {
    "greenhouse": [
        "boards.greenhouse.io",
        "job-boards.greenhouse.io",
    ],
    "lever": [
        "jobs.lever.co",
        "jobs.leap.co",
    ],
    "workable": [
        "apply.workable.com",
        "jobs.workable.com",
    ],
    "glassdoor": [
        "glassdoor.com",
        "indeed.com",
    ],
    "smartrecruiters": [
        "smartrecruiters.com",
    ],
    "ashby": [
        "ashbyhq.com",
        "jobs.ashbyhq.com",
    ],
    "breezy": [
        "breezy.hr",
    ],
    "recruitee": [
        "recruitee.com",
    ],
    "wellfound": [
        "wellfound.com",
    ],
}


def is_platform_url(url, platform=None):
    """
    Check if a URL belongs to a specific platform (or any supported platform).
    
    Args:
        url: URL to check
        platform: Platform name to check for (checks all if None)
    
    Returns:
        bool
    """
    url_lower = url.lower()

    if platform:
        patterns = PLATFORM_URL_PATTERNS.get(platform, [])
        return any(pattern in url_lower for pattern in patterns)

    # Check all platforms
    for platform_name, patterns in PLATFORM_URL_PATTERNS.items():
        if any(pattern in url_lower for pattern in patterns):
            return True

    return False


def get_supported_platforms():
    """Return list of supported platform names."""
    return list(PLATFORM_URL_PATTERNS.keys())
