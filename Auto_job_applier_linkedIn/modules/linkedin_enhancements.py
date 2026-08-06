'''
LinkedIn Enhancements - Adopted from LiftMyCV best practices
Features:
- Shadow DOM selector override for SDUI
- URL deduplication
- Daily/hourly limit detection
- Smart error recovery
- External link detection
- Progress bar tracking
'''

import json
import os
from time import sleep
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, WebDriverException

from modules.helpers import print_lg, buffer


# ============================================================
# 1. SHADOW DOM SELECTOR OVERRIDE
# ============================================================

SHADOW_DOM_OVERRIDE_JS = """
// Override querySelector to search inside Shadow DOM (LinkedIn SDUI)
const _origQuerySelector = document.querySelector.bind(document);
const _origQuerySelectorAll = document.querySelectorAll.bind(document);
const _origGetElementById = document.getElementById.bind(document);

document.querySelector = function(selector) {
    let el = _origQuerySelector(selector);
    if (!el) {
        try {
            const shadowHost = _origQuerySelector('#interop-outlet');
            if (shadowHost && shadowHost.shadowRoot) {
                el = shadowHost.shadowRoot.querySelector(selector);
            }
        } catch(e) {}
    }
    return el;
};

document.querySelectorAll = function(selector) {
    let els = _origQuerySelectorAll(selector);
    if (els.length === 0) {
        try {
            const shadowHost = _origQuerySelector('#interop-outlet');
            if (shadowHost && shadowHost.shadowRoot) {
                els = shadowHost.shadowRoot.querySelectorAll(selector);
            }
        } catch(e) {}
    }
    return els;
};

document.getElementById = function(id) {
    let el = _origGetElementById(id);
    if (!el) {
        try {
            const shadowHost = _origQuerySelector('#interop-outlet');
            if (shadowHost && shadowHost.shadowRoot) {
                el = shadowHost.shadowRoot.getElementById(id);
            }
        } catch(e) {}
    }
    return el;
};

'shadow_dom_override_installed';
"""


def inject_shadow_dom_override(driver: WebDriver) -> bool:
    '''
    Inject Shadow DOM selector override into the current page.
    This fixes LinkedIn's SDUI architecture where elements are inside Shadow DOM.
    Returns True if injection was successful.
    '''
    try:
        result = driver.execute_script(SHADOW_DOM_OVERRIDE_JS)
        if result == 'shadow_dom_override_installed':
            print_lg("Shadow DOM override injected successfully.")
            return True
        else:
            print_lg("Shadow DOM override injection returned unexpected result.")
            return False
    except Exception as e:
        print_lg(f"Failed to inject Shadow DOM override: {e}")
        return False


def safe_find_element(driver: WebDriver, by: By, value: str, timeout: float = 5.0):
    '''
    Find element with Shadow DOM fallback.
    Tries normal selector first, then falls back to Shadow DOM.
    '''
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    try:
        return WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((by, value))
        )
    except NoSuchElementException:
        # Try Shadow DOM fallback via JavaScript
        try:
            if by == By.CSS_SELECTOR:
                js = f"""
                (() => {{
                    let el = document.querySelector('{value}');
                    if (!el) {{
                        const shadowHost = document.querySelector('#interop-outlet');
                        if (shadowHost && shadowHost.shadowRoot) {{
                            el = shadowHost.shadowRoot.querySelector('{value}');
                        }}
                    }}
                    return el;
                }})()
                """
            elif by == By.ID:
                js = f"""
                (() => {{
                    let el = document.getElementById('{value}');
                    if (!el) {{
                        const shadowHost = document.querySelector('#interop-outlet');
                        if (shadowHost && shadowHost.shadowRoot) {{
                            el = shadowHost.shadowRoot.getElementById('{value}');
                        }}
                    }}
                    return el;
                }})()
                """
            elif by == By.XPATH:
                # XPath doesn't work in Shadow DOM, try JS fallback
                return None
            else:
                return None

            return driver.execute_script(js)
        except Exception:
            return None


# ============================================================
# 2. URL DEDUPLICATION
# ============================================================

SUBMITTED_URLS_FILE = "submitted_urls.json"


def load_submitted_urls(filepath: str = SUBMITTED_URLS_FILE) -> set:
    '''Load previously submitted URLs from file.'''
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return set(data) if isinstance(data, list) else set()
    except Exception as e:
        print_lg(f"Failed to load submitted URLs: {e}")
    return set()


def save_submitted_urls(urls: set, filepath: str = SUBMITTED_URLS_FILE) -> None:
    '''Save submitted URLs to file.'''
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(list(urls), f, indent=2)
    except Exception as e:
        print_lg(f"Failed to save submitted URLs: {e}")


def is_already_submitted(url: str, submitted_urls: set) -> bool:
    '''Check if a URL has already been submitted.'''
    # Normalize URL for comparison
    normalized = url.rstrip('/').split('?')[0]
    for submitted in submitted_urls:
        submitted_normalized = submitted.rstrip('/').split('?')[0]
        if normalized == submitted_normalized:
            return True
    return False


def mark_as_submitted(url: str, submitted_urls: set) -> None:
    '''Mark a URL as submitted.'''
    submitted_urls.add(url)


# ============================================================
# 3. LINKEDIN DAILY/HOURLY LIMIT DETECTION
# ============================================================

DAILY_LIMIT_PHRASES = [
    "today's LinkedIn Apply limit",
    "today\u2019s LinkedIn Apply limit",
    "You reached today",
    "Save this job and come back tomorrow to continue applying",
    "Save this job and continue applying tomorrow",
    "Save this job and apply tomorrow",
    "exceeded the daily application limit",
]

HOURLY_LIMIT_PHRASES = [
    "You'll be able to use Easy Apply again in one hour",
    "You will be able to use Easy Apply again in one hour",
    "hourly limit",
]


def check_daily_limit(driver: WebDriver) -> bool:
    '''
    Check if LinkedIn daily Easy Apply limit has been reached.
    Returns True if limit is reached.
    '''
    try:
        page_text = driver.execute_script("return document.body.innerText;").lower()
        for phrase in DAILY_LIMIT_PHRASES:
            if phrase.lower() in page_text:
                print_lg(f"Daily LinkedIn Easy Apply limit detected: '{phrase}'")
                return True
        # Also check for the limit dialog element
        limit_dialog = driver.find_elements(By.CSS_SELECTOR, '[data-sdui-screen*="EasyApplyFuseLimitDialogModal"]')
        if limit_dialog:
            print_lg("Daily limit dialog detected.")
            return True
    except Exception as e:
        print_lg(f"Error checking daily limit: {e}")
    return False


def check_hourly_limit(driver: WebDriver) -> bool:
    '''
    Check if LinkedIn hourly Easy Apply limit has been reached.
    Returns True if limit is reached.
    '''
    try:
        page_text = driver.execute_script("return document.body.innerText;").lower()
        for phrase in HOURLY_LIMIT_PHRASES:
            if phrase.lower() in page_text:
                print_lg(f"Hourly LinkedIn Easy Apply limit detected: '{phrase}'")
                return True
    except Exception as e:
        print_lg(f"Error checking hourly limit: {e}")
    return False


def handle_apply_limit(driver: WebDriver, nonstop: bool = False) -> str:
    '''
    Handle LinkedIn apply limit.
    Returns: 'daily', 'hourly', or 'none'
    '''
    if check_daily_limit(driver):
        if nonstop:
            print_lg("Daily limit reached in nonstop mode. Will continue with other platforms if available.")
        return 'daily'
    elif check_hourly_limit(driver):
        if nonstop:
            print_lg("Hourly limit reached. Waiting 1 hour...")
            sleep(3600)  # Wait 1 hour
            return 'hourly'
        return 'hourly'
    return 'none'


# ============================================================
# 4. SMART ERROR RECOVERY
# ============================================================

def detect_step_change(driver: WebDriver, previous_progress: dict) -> tuple[str, float]:
    '''
    Detect if the Easy Apply form has moved to a different step.
    Returns: (step_name, progress_percent)
    '''
    try:
        # Try to find progress bar
        progress_bar = driver.find_elements(By.CSS_SELECTOR, '.artdeco-completeness-meter-linear')
        if progress_bar:
            parent = progress_bar[0].find_element(By.XPATH, '..')
            text = parent.text
            # Extract percentage from text like "Step 2 of 5" or "50%"
            import re
            percent_match = re.search(r'(\d+)%', text)
            if percent_match:
                current_percent = float(percent_match.group(1))
            else:
                current_percent = 0.0
        else:
            current_percent = 0.0

        # Try to find step title
        step_title = None
        title_selectors = [
            '.jobs-easy-apply-modal h3',
            '#dialog-header h2',
            '#dialog-header h3',
        ]
        for selector in title_selectors:
            try:
                el = driver.find_element(By.CSS_SELECTOR, selector)
                step_title = el.text.strip()
                if step_title:
                    break
            except NoSuchElementException:
                continue

        return step_title or 'Unknown', current_percent
    except Exception as e:
        print_lg(f"Error detecting step change: {e}")
        return 'Unknown', 0.0


def recover_from_step_change(driver: WebDriver, previous_progress: dict, current_progress: tuple) -> bool:
    '''
    Try to recover from unexpected step changes.
    Returns True if recovery was successful.
    '''
    current_name, current_percent = current_progress
    prev_name = previous_progress.get('name', 'Unknown')
    prev_percent = previous_progress.get('percent', 0.0)

    if current_percent < prev_percent:
        # Step moved backward - click Next to move forward
        print_lg("Step moved backward. Trying to click Next...")
        try:
            next_btn = driver.find_elements(By.CSS_SELECTOR, '.jobs-easy-apply-modal footer button[data-easy-apply-next-button]')
            if next_btn:
                next_btn[0].click()
                sleep(2)
                return True
        except Exception as e:
            print_lg(f"Failed to click Next for recovery: {e}")

    elif current_percent > prev_percent:
        # Step moved forward unexpectedly - click Back to go back
        print_lg("Step moved forward unexpectedly. Trying to click Back...")
        try:
            back_btn = driver.find_elements(By.CSS_SELECTOR, '.jobs-easy-apply-modal footer button[aria-label="Back to previous step"]')
            if back_btn:
                back_btn[0].click()
                sleep(2)
                return True
        except Exception as e:
            print_lg(f"Failed to click Back for recovery: {e}")

    return False


# ============================================================
# 5. EXTERNAL LINK DETECTION
# ============================================================

def is_external_apply_button(driver: WebDriver) -> bool:
    '''
    Check if the Apply button is an external link (redirects to another site).
    Returns True if it's an external link.
    '''
    try:
        # Check for external link icon
        external_icons = driver.find_elements(By.CSS_SELECTOR,
            '.jobs-apply-button--top-card .jobs-apply-button use[href="#link-external-small"], '
            '[data-view-name="job-apply-button"] use[href="#link-external-small"]'
        )
        if external_icons:
            return True

        # Check button text
        apply_btn = driver.find_elements(By.CSS_SELECTOR,
            '.jobs-apply-button--top-card .jobs-apply-button, '
            '[data-view-name="job-apply-button"]'
        )
        if apply_btn:
            # Check if it has aria-label indicating external
            aria_label = apply_btn[0].get_attribute('aria-label') or ''
            if 'external' in aria_label.lower() or 'redirect' in aria_label.lower():
                return True

            # Check for SVG icon indicating external link
            svg_use = apply_btn[0].find_elements(By.TAG_NAME, 'use')
            for use in svg_use:
                href = use.get_attribute('href') or ''
                if 'link-external' in href:
                    return True
    except Exception as e:
        print_lg(f"Error checking external link: {e}")
    return False


# ============================================================
# 6. PROGRESS BAR TRACKING
# ============================================================

def get_easy_apply_progress(driver: WebDriver) -> dict:
    '''
    Get current Easy Apply form progress.
    Returns dict with step_name, percent, and total_steps.
    '''
    result = {
        'step_name': 'Unknown',
        'percent': 0.0,
        'total_steps': 0,
        'current_step_num': 0
    }

    try:
        # Get progress percentage
        progress_bar = driver.find_elements(By.CSS_SELECTOR, '.artdeco-completeness-meter-linear')
        if progress_bar:
            parent = progress_bar[0].find_element(By.XPATH, '..')
            text = parent.text
            import re

            # Try "Step X of Y" format
            step_match = re.search(r'Step\s+(\d+)\s+of\s+(\d+)', text)
            if step_match:
                result['current_step_num'] = int(step_match.group(1))
                result['total_steps'] = int(step_match.group(2))
                result['percent'] = (result['current_step_num'] / result['total_steps']) * 100
            else:
                # Try percentage format
                percent_match = re.search(r'(\d+)%', text)
                if percent_match:
                    result['percent'] = float(percent_match.group(1))

        # Get step title
        step_name, _ = detect_step_change(driver, {})
        result['step_name'] = step_name

    except Exception as e:
        print_lg(f"Error getting progress: {e}")

    return result


# ============================================================
# 7. INITIALIZE ENHANCEMENTS
# ============================================================

# ============================================================
# 8. FLOATING STATUS PANEL
# ============================================================

STATUS_PANEL_CSS = """
#linkedin-bot-status-panel {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 320px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #333;
    overflow: hidden;
    border: 1px solid #e0e0e0;
}
#linkedin-bot-status-panel .panel-header {
    background: #0a66c2;
    color: white;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
}
#linkedin-bot-status-panel .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
}
#linkedin-bot-status-panel .panel-header .close-btn {
    cursor: pointer;
    font-size: 18px;
    opacity: 0.8;
}
#linkedin-bot-status-panel .panel-header .close-btn:hover {
    opacity: 1;
}
#linkedin-bot-status-panel .panel-body {
    padding: 16px;
}
#linkedin-bot-status-panel .stat-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    padding: 6px 0;
    border-bottom: 1px solid #f0f0f0;
}
#linkedin-bot-status-panel .stat-row:last-child {
    border-bottom: none;
}
#linkedin-bot-status-panel .stat-label {
    color: #666;
}
#linkedin-bot-status-panel .stat-value {
    font-weight: 600;
    color: #0a66c2;
}
#linkedin-bot-status-panel .status-message {
    margin-top: 12px;
    padding: 10px;
    background: #f0f7ff;
    border-radius: 8px;
    font-size: 12px;
    color: #0a66c2;
    max-height: 80px;
    overflow-y: auto;
}
#linkedin-bot-status-panel .progress-bar {
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    margin-top: 8px;
    overflow: hidden;
}
#linkedin-bot-status-panel .progress-fill {
    height: 100%;
    background: #0a66c2;
    border-radius: 3px;
    transition: width 0.3s ease;
}
"""

STATUS_PANEL_HTML = """
<div id="linkedin-bot-status-panel">
    <div class="panel-header">
        <h3>LinkedIn Auto-Apply Bot</h3>
        <span class="close-btn" onclick="this.parentElement.parentElement.style.display='none'">&times;</span>
    </div>
    <div class="panel-body">
        <div class="stat-row">
            <span class="stat-label">Applied:</span>
            <span class="stat-value" id="bot-applied-count">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Skipped:</span>
            <span class="stat-value" id="bot-skipped-count">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Failed:</span>
            <span class="stat-value" id="bot-failed-count">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Current:</span>
            <span class="stat-value" id="bot-current-job">-</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" id="bot-progress" style="width: 0%"></div>
        </div>
        <div class="status-message" id="bot-status-msg">Initializing...</div>
    </div>
</div>
"""

STATUS_PANEL_INJECT_JS = """
(() => {
    // Inject CSS if not already present
    if (!document.getElementById('linkedin-bot-status-styles')) {
        const style = document.createElement('style');
        style.id = 'linkedin-bot-status-styles';
        style.textContent = `%CSS%`;
        document.head.appendChild(style);
    }

    // Inject panel if not already present
    if (!document.getElementById('linkedin-bot-status-panel')) {
        const div = document.createElement('div');
        div.innerHTML = `%HTML%`;
        document.body.appendChild(div.firstElementChild);
    }

    // Make panel draggable
    const panel = document.getElementById('linkedin-bot-status-panel');
    const header = panel.querySelector('.panel-header');
    let isDragging = false, startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left = (startLeft + e.clientX - startX) + 'px';
        panel.style.top = (startTop + e.clientY - startY) + 'px';
        panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => { isDragging = false; });

    'status_panel_installed';
})()
"""


def inject_status_panel(driver: WebDriver) -> bool:
    '''Inject the floating status panel into the page.'''
    try:
        js = STATUS_PANEL_INJECT_JS.replace('%CSS%', STATUS_PANEL_CSS).replace('%HTML%', STATUS_PANEL_HTML)
        result = driver.execute_script(js)
        if result == 'status_panel_installed':
            print_lg("Status panel injected successfully.")
            return True
    except Exception as e:
        print_lg(f"Failed to inject status panel: {e}")
    return False


def update_status_panel(driver: WebDriver, applied: int = 0, skipped: int = 0,
                       failed: int = 0, current_job: str = "-", progress: float = 0,
                       message: str = "") -> None:
    '''Update the floating status panel with current stats.'''
    try:
        js = f"""
        (() => {{
            const setEl = (id, val) => {{
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            }};
            setEl('bot-applied-count', '{applied}');
            setEl('bot-skipped-count', '{skipped}');
            setEl('bot-failed-count', '{failed}');
            setEl('bot-current-job', '{current_job[:40]}');
            setEl('bot-status-msg', '{message[:100]}');
            const bar = document.getElementById('bot-progress');
            if (bar) bar.style.width = '{min(progress, 100)}%';
        }})()
        """
        driver.execute_script(js)
    except Exception as e:
        pass  # Silent fail for status updates


class LinkedInEnhancements:
    '''
    Container for LinkedIn enhancement features.
    '''
    
    def __init__(self, driver: WebDriver):
        self.driver = driver
        self.submitted_urls = load_submitted_urls()
        self.previous_progress = {}
        self.step_history = []
        self.applied_count = 0
        self.skipped_count = 0
        self.failed_count = 0
        self.status_panel_injected = False
        
    def init_session(self):
        '''Initialize enhancements for a new session.'''
        inject_shadow_dom_override(self.driver)
        self.inject_status_panel()
        print_lg(f"Loaded {len(self.submitted_urls)} previously submitted URLs.")
        
    def inject_status_panel(self):
        '''Inject the floating status panel.'''
        try:
            inject_status_panel(self.driver)
            self.status_panel_injected = True
        except Exception as e:
            print_lg(f"Failed to inject status panel: {e}")

    def on_page_load(self):
        '''Call this when navigating to a new page.'''
        inject_shadow_dom_override(self.driver)
        if self.status_panel_injected:
            inject_status_panel(self.driver)
        
    def update_stats(self, applied: int = None, skipped: int = None,
                    failed: int = None, current_job: str = None, message: str = None):
        '''Update status panel stats.'''
        if applied is not None: self.applied_count = applied
        if skipped is not None: self.skipped_count = skipped
        if failed is not None: self.failed_count = failed
        update_status_panel(
            self.driver,
            applied=self.applied_count,
            skipped=self.skipped_count,
            failed=self.failed_count,
            current_job=current_job or "-",
            message=message or ""
        )

    def is_duplicate(self, url: str) -> bool:
        '''Check if URL was already submitted.'''
        return is_already_submitted(url, self.submitted_urls)
        
    def mark_submitted(self, url: str):
        '''Mark URL as submitted and save.'''
        mark_as_submitted(url, self.submitted_urls)
        save_submitted_urls(self.submitted_urls)
        
    def check_limits(self) -> str:
        '''Check for LinkedIn limits. Returns 'daily', 'hourly', or 'none'.'''
        return handle_apply_limit(self.driver)
        
    def is_external_link(self) -> bool:
        '''Check if current job has external apply button.'''
        return is_external_apply_button(self.driver)
        
    def get_progress(self) -> dict:
        '''Get current form progress.'''
        return get_easy_apply_progress(self.driver)
        
    def try_recover(self) -> bool:
        '''Try to recover from step change issues.'''
        current = detect_step_change(self.driver, self.previous_progress)
        recovered = recover_from_step_change(self.driver, self.previous_progress, current)
        self.previous_progress = {'name': current[0], 'percent': current[1]}
        return recovered
