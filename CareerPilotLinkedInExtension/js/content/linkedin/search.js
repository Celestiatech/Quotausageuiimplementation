function findH3WithText(prefix = 'Your application was sent to') {
    function search(root) {
        const h3s = root.querySelectorAll('h3');

        for (const h3 of h3s) {
            const text = h3.textContent?.trim() || '';

            if (text.startsWith(prefix)) {
                return h3;
            }
        }

        const allElements = root.querySelectorAll('*');

        for (const el of allElements) {
            if (el.shadowRoot) {
                const found = search(el.shadowRoot);

                if (found) {
                    return found;
                }
            }
        }

        return null;
    }

    return search(document);
}

function successOnURLLinkedIn(suburl, interval = 1000) {
    const started = agentStatus.successOnURLStarted = Date.now();

    const checkInterval = setInterval(() => {
        if (started != agentStatus.successOnURLStarted) {
            clearInterval(checkInterval);
            return;
        }
        if (location.href.includes(suburl) || findH3WithText()) {
            cvTaskDone();
            clearInterval(checkInterval);   
        }

    }, interval);
    return checkInterval;
}

function safeQuerySelector(selector, root = document) {
    let element = root === document ? originalQuerySelector(selector) : root.querySelector(selector);
    
    if (!element && root === document) {
        try {
            const shadowHost = originalQuerySelector('#interop-outlet');
            if (shadowHost && shadowHost.shadowRoot) {
                element = shadowHost.shadowRoot.querySelector(selector);
            }
        } catch (e) {
            console.debug('Shadow root access error:', e);
        }
    }
    
    return element;
}

function safeQuerySelectorAll(selector, root = document) {
    let elements = root === document ? originalQuerySelectorAll(selector) : root.querySelectorAll(selector);
    
    if (elements.length === 0 && root === document) {
        try {
            const shadowHost = originalQuerySelector('#interop-outlet');
            if (shadowHost && shadowHost.shadowRoot) {
                elements = shadowHost.shadowRoot.querySelectorAll(selector);
            }
        } catch (e) {
            console.debug('Shadow root access error:', e);
        }
    }
    
    return elements;
}

function safeGetElementById(id, root = document) {
    let element = root === document ? originalGetElementById(id) : root.getElementById(id);
    
    if (!element && root === document) {
        try {
            const shadowHost = originalQuerySelector('#interop-outlet');
            if (shadowHost && shadowHost.shadowRoot) {
                element = shadowHost.shadowRoot.getElementById(id);
                if (element) {
                    console.debug('Element found in shadow root:', id);
                }
            }
        } catch (e) {
            console.debug('Shadow root access error:', e);
        }
    }
    
    return element;
}

const originalQuerySelector = document.querySelector.bind(document);
const originalQuerySelectorAll = document.querySelectorAll.bind(document);
const originalGetElementById = document.getElementById.bind(document);

document.querySelector = function(selector) {
    return safeQuerySelector(selector);
};

document.querySelectorAll = function(selector) {
    return safeQuerySelectorAll(selector);
};

document.getElementById = function(id) {
    return safeGetElementById(id);
};

let processedLinksCount = 0;

let relevantFound = false;

let currentUrl = null;

let modalOpened = false;

const SEARCH_DATA = {
    city: null,
    tabId: null,
    limit: null,
    domain: null,
    current: null,
    country: null,
    submittedLinks: []
};

let sendCvPageNotRespondTimeout;

let countDown;

let stepTries = {};

const MAX_TRIES = 3;

function getStepTry(stepName) {
    let value = stepTries[stepName];
    if (!value) {
        value = stepTries[stepName] = 0;
    }
    return value;
}

function formatCurrentTry(value) {
    return `(${value}/${MAX_TRIES})`;
}

function incrementStepTry(stepName) {
    stepTries[stepName] = stepTries[stepName] + 1;
    return stepTries[stepName];
}

const LI_EASY_APPLY_STEP_TITLES = [
    'Contact info',
    'Resume',
    'Additional Questions',
    'Additional',
    'Home address',
    'Voluntary self identification',
    'Screening questions',
    'Review your application',
    'Review',
    'Work authorization',
];

function normalizeLinkedInPageText() {
    return (document.body?.textContent || '').replace(/\s+/g, ' ').trim();
}

function normalizeEasyApplyStepTitle(text) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) {
        return '';
    }
    const lower = raw.toLowerCase();
    if (
        lower === 'resume'
        || lower === 'upload resume'
        || lower === 'upload a resume'
        || lower.startsWith('upload a resume')
        || lower.startsWith('upload resume')
        || /^resume\b/.test(lower)
    ) {
        return 'Resume';
    }
    if (lower === 'review' || lower === 'review your application' || lower.startsWith('review your application')) {
        return 'Review your application';
    }
    for (const title of LI_EASY_APPLY_STEP_TITLES) {
        const titleLower = title.toLowerCase();
        if (lower === titleLower || lower.startsWith(`${titleLower} `)) {
            return title === 'Review' ? 'Review your application' : title;
        }
    }
    return raw;
}

function isResumeUploadStepVisible() {
    return Boolean(
        document.querySelector('.jobs-document-upload-redesign-card__container')
        || document.querySelector('.jobs-document-upload-redesign-card__file-name')
        || document.querySelector('input[id*="upload-resume"][type=file]')
        || document.querySelector('.js-jobs-document-upload__container input[type=file]')
    );
}

function findResumeFileNameElements() {
    return [...document.querySelectorAll(
        '#artdeco-modal-outlet .jobs-document-upload-redesign-card__file-name, '
        + '[data-testid="dialog-content"] .jobs-document-upload-redesign-card__file-name, '
        + '[data-sdui-screen*="easyapply.EasyApply"] .jobs-document-upload-redesign-card__file-name, '
        + '.jobs-document-upload-redesign-card__file-name'
    )];
}

function findResumeFileInput() {
    return document.querySelector(
        '#artdeco-modal-outlet input[id^=jobs-document-upload-file-input-upload-resume-urn][type=file], '
        + '[data-testid="dialog-content"] input[id*="upload-resume"][type=file], '
        + '[data-sdui-screen*="easyapply.EasyApply"] input[id*="upload-resume"][type=file], '
        + 'input[id^=jobs-document-upload-file-input-upload-resume][type=file], '
        + 'input[id*="upload-resume"][type=file]'
    );
}

function clickEasyApplyNextOrThrow(stepLabel) {
    const nextBtn = findNextButtonOrReviewButton();
    if (!nextBtn) {
        sendDOMToServer();
        throw new SendCvError(`Next/Review button not found on step ${stepLabel || 'unknown'}`);
    }
    nextBtn.click();
}

function isLinkedInApplyLimitDialogVisible() {
    if (document.querySelector('[data-sdui-screen*="EasyApplyFuseLimitDialogModal"]')) {
        return true;
    }
    const pageText = normalizeLinkedInPageText();
    return pageText.includes("today's LinkedIn Apply limit")
        || pageText.includes("today\u2019s LinkedIn Apply limit")
        || pageText.includes('You reached today')
        || pageText.includes('Save this job and come back tomorrow to continue applying')
        || pageText.includes('Save this job and continue applying tomorrow')
        || pageText.includes('Save this job and apply tomorrow');
}

async function handleLinkedInApplyLimitIfVisible(data) {
    if (!isLinkedInApplyLimitDialogVisible()) {
        return false;
    }

    const pageText = normalizeLinkedInPageText();

    if (pageText.includes("Save this job and come back tomorrow to continue applying")
        || pageText.includes("Save this job and continue applying tomorrow")
        || pageText.includes("Save this job and apply tomorrow")
        || document.querySelector('[data-sdui-screen*="EasyApplyFuseLimitDialogModal"]')) {
        if (data.nonstop) {
            appendStatusMessage('Oops… It looks like the daily LinkedIn Easy Apply limit has been reached. Finishing up on LinkedIn and moving on to the next job board.');
            await wait(15000);
            chrome.runtime.sendMessage({ type: "SEARCH-TASK-DONE" });
            await wait(5000);
        } else {
            linkedinDailyLimit();
            chrome.runtime.sendMessage({type: "SET-COPILOT-MODE"});
            agentStatus.paused = true;
            agentStatus.OpenAIConnectionError = true;
            await pause();
        }
        return true;
    }

    if (pageText.includes("You'll be able to use Easy Apply again in one hour.")) {
        appendStatusMessage('Oops… It looks like the hourly LinkedIn Easy Apply limit has been reached.');
        if (data.nonstop) {
            await wait(15000);
            chrome.runtime.sendMessage({ type: "SEARCH-TASK-DONE" });
            await wait(5000);
        } else {
            chrome.runtime.sendMessage({type: "SET-COPILOT-MODE"});
            agentStatus.agentMode = 'Copilot';
            await wait(360000);
            chrome.runtime.sendMessage({type: "UNSET-COPILOT-MODE"});
            location.reload();
            await wait(18000);
        }
        return true;
    }

    return false;
}

function isEasyApplyModalOpen() {
    if (document.querySelector('.jobs-easy-apply-modal h3, .job-trust-pre-apply-safety-tips-modal__footer, #jobs-apply-header')) {
        return true;
    }
    if (document.querySelector('.jobs-easy-apply-modal') && isResumeUploadStepVisible()) {
        return true;
    }
    return Boolean(
        document.querySelector('[data-sdui-screen*="easyapply.EasyApply"]')
        && (document.querySelector('#dialog-header h2') || document.querySelector('[data-testid="dialog-content"]'))
    );
}

function isEasyApplyStepTitleVisible() {
    if (document.querySelector('.jobs-easy-apply-modal h3')) {
        return true;
    }
    if (isResumeUploadStepVisible()) {
        return true;
    }
    return Boolean(findEasyApplyStepTitleElement());
}

async function waitForEasyApplyModalOpen(timeout = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (isLinkedInApplyLimitDialogVisible()) {
            throw new Error('LinkedIn Apply limit dialog is visible');
        }
        if (isEasyApplyModalOpen()) {
            ensureAgentPanelAbovePageModals();
            return;
        }
        await wait(100);
    }
    throw new Error('Could not find the Easy Apply modal (legacy or SDUI) within the given time');
}

async function waitForEasyApplyStepTitle(timeout = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (isLinkedInApplyLimitDialogVisible()) {
            throw new Error('LinkedIn Apply limit dialog is visible');
        }
        if (isEasyApplyStepTitleVisible()) {
            return;
        }
        await wait(100);
    }
    throw new Error('Could not find the Easy Apply form step title (legacy h3 or SDUI) within the given time');
}

function findEasyApplyStepTitleElement() {
    const legacy = document.querySelector('.jobs-easy-apply-modal h3');
    if (legacy) {
        return legacy;
    }

    const dialogHeader = document.querySelector('#dialog-header h2, #dialog-header h3');
    if (dialogHeader) {
        const normalized = normalizeEasyApplyStepTitle(dialogHeader.innerText);
        if (normalized && (normalized === 'Resume' || LI_EASY_APPLY_STEP_TITLES.includes(normalized) || normalized === 'Review your application')) {
            return dialogHeader;
        }
    }

    const roots = [
        document.querySelector('[data-sdui-screen*="easyapply.EasyApply"]'),
        document.querySelector('[data-testid="dialog-content"]'),
    ].filter(Boolean);

    for (const root of roots) {
        const candidates = [...root.querySelectorAll('p, h2, h3, h4')];
        for (const candidate of candidates) {
            const normalized = normalizeEasyApplyStepTitle(candidate.innerText);
            if (!normalized) {
                continue;
            }
            if (
                normalized === 'Resume'
                || normalized === 'Review your application'
                || LI_EASY_APPLY_STEP_TITLES.includes(normalized)
            ) {
                return candidate;
            }
        }
        for (const title of LI_EASY_APPLY_STEP_TITLES) {
            const el = candidates.find((candidate) => {
                const text = candidate.innerText?.trim() || '';
                return text === title || text.startsWith(`${title} `);
            });
            if (el) {
                return el;
            }
        }
    }

    if (isResumeUploadStepVisible()) {
        return dialogHeader
            || document.querySelector('[data-testid="dialog-content"] h2, [data-testid="dialog-content"] h3')
            || document.querySelector('.jobs-easy-apply-modal')
            || document.querySelector('[data-testid="dialog-content"]');
    }

    return null;
}

function getEasyApplyStepTitleText(titleElement) {
    const raw = titleElement?.innerText?.trim() || '';
    const normalized = normalizeEasyApplyStepTitle(raw);
    if (normalized === 'Resume' || (normalized && LI_EASY_APPLY_STEP_TITLES.includes(normalized)) || normalized === 'Review your application') {
        return normalized === 'Review' ? 'Review your application' : normalized;
    }
    if (isResumeUploadStepVisible()) {
        return 'Resume';
    }
    if (raw === 'Review') {
        return 'Review your application';
    }
    return normalized || raw;
}

function getEasyApplyFooterElements() {
    const footers = [
        ...document.querySelectorAll('.jobs-easy-apply-modal footer'),
        ...document.querySelectorAll('[data-testid="dialog-content"] footer'),
    ];
    const buttons = [];
    for (const footer of footers) {
        buttons.push(...[...footer.querySelectorAll('button')].filter((btn) => btn.offsetParent !== null));
    }
    return buttons;
}

function findEasyApplyFooterButton(...labels) {
    const buttons = getEasyApplyFooterElements();
    for (const label of labels) {
        const btn = buttons.find((button) => {
            const text = button.innerText?.trim() || '';
            const aria = button.getAttribute('aria-label') || '';
            return text === label || aria === label || aria.includes(label);
        });
        if (btn) {
            return btn;
        }
    }
    return null;
}

function hasEasyApplyProgressMeter() {
    return Boolean(
        document.querySelector('.jobs-easy-apply-modal .artdeco-completeness-meter-linear')
        || document.querySelector('[data-sdui-screen*="easyapply.EasyApply"] [role="progressbar"]')
        || document.querySelector('[data-testid="dialog-content"] [role="progressbar"]')
    );
}

function getEasyApplyProgressContextText() {
    const legacy = document.querySelector('.artdeco-completeness-meter-linear')?.parentElement?.innerText;
    if (legacy) {
        return legacy;
    }

    const root = document.querySelector('[data-sdui-screen*="easyapply.EasyApply"]')
        || document.querySelector('[data-testid="dialog-content"]');
    if (!root) {
        return '';
    }

    const progressBar = root.querySelector('[role="progressbar"]');
    const parts = [];
    if (progressBar?.getAttribute('aria-valuenow')) {
        parts.push(`${progressBar.getAttribute('aria-valuenow')} percent complete`);
    }
    const pageMatch = root.innerText?.match(/\d+\s*\/\s*\d+\s*pages?/i);
    if (pageMatch) {
        parts.push(pageMatch[0]);
    }
    return parts.join(' ');
}

function getEasyApplyProgressPercent() {
    try {
        const legacyText = document.querySelector('.artdeco-completeness-meter-linear')?.parentElement?.innerText;
        if (legacyText) {
            const percent = parseInt(legacyText.replace(/\D/g, ''), 10);
            if (!isNaN(percent)) {
                return percent;
            }
        }

        const progressBar = document.querySelector('[data-sdui-screen*="easyapply.EasyApply"] [role="progressbar"]')
            || document.querySelector('[data-testid="dialog-content"] [role="progressbar"]');
        const now = progressBar?.getAttribute('aria-valuenow');
        if (now) {
            const percent = parseInt(now, 10);
            if (!isNaN(percent)) {
                return percent;
            }
        }

        const root = document.querySelector('[data-sdui-screen*="easyapply.EasyApply"]');
        const match = root?.innerText?.match(/(\d+)\s*percent\s*complete/i);
        if (match) {
            return parseInt(match[1], 10);
        }
    } catch {}

    return 0;
}

function findPrimarySubmitButton() {
    const legacy = document.querySelector('.jobs-easy-apply-modal footer button.artdeco-button--primary');
    if (legacy) {
        return legacy;
    }
    return findEasyApplyFooterButton('Submit application') || findEasyApplyFooterButton('Review');
}

function getInputLabels() {
    const labels = [...document.querySelectorAll('.jobs-easy-apply-modal .artdeco-text-input--label, .jobs-easy-apply-modal .fb-dash-form-element__label, .jobs-easy-apply-modal .jobs-easy-apply-form-section__group-subtitle')];
    if (labels.length > 0) {
        return labels;
    }

    const root = document.querySelector('[data-sdui-screen*="easyapply.EasyApply"]')
        || document.querySelector('[data-testid="dialog-content"]');
    if (!root) {
        return [];
    }

    return [...root.querySelectorAll('label')].filter((label) => label.htmlFor && label.offsetParent !== null);
}

function findNextButton() {
    const legacy = document.querySelector('.jobs-easy-apply-modal footer button[data-easy-apply-next-button]');
    if (legacy) {
        return legacy;
    }
    return findEasyApplyFooterButton('Next');
}

function findBackButton() {
    const button = document.querySelector('.jobs-easy-apply-modal footer button[aria-label="Back to previous step"]');
    if (button) {
        return button;
    }
    const legacyFooter = document.querySelector('.jobs-easy-apply-modal footer button:not(data-easy-apply-next-button)');
    if (legacyFooter) {
        return legacyFooter;
    }
    return findEasyApplyFooterButton('Back', 'Back to previous step');
}

function findReviewButton() {
    const legacy = document.querySelector('.jobs-easy-apply-modal footer button.artdeco-button--primary');
    if (legacy) {
        return legacy;
    }
    return findEasyApplyFooterButton('Review', 'Submit application');
}

function findNextButtonOrReviewButton() {
    const nextButton = findNextButton()
    agentStatus.linkedinReviewButton = false;
    if (!nextButton) {
        agentStatus.linkedinReviewButton = true;
        return findReviewButton();
    }
    return nextButton;
}

function getLabelText(labelElement) {
    const visibleEl = labelElement.querySelector('span:not(.visually-hidden)');
    let text;
    if (visibleEl && visibleEl.innerText.trim()) {
        text = visibleEl.innerText.trim();
    } else {
        text = labelElement.innerText.trim();
    }
    return text.replace(/\*+$/, '').trim();
}

function normalizeYesNoLabel(text) {
    const t = String(text || '').trim().toLowerCase();
    if (t === 'yes') return 'Yes';
    if (t === 'no') return 'No';
    return String(text || '').trim();
}

function isExclusiveYesNoOptions(options) {
    if (!Array.isArray(options) || options.length !== 2) return false;
    const norms = options.map(normalizeYesNoLabel);
    return norms.includes('Yes') && norms.includes('No');
}

function optionMatchesValue(option, value) {
    const o = normalizeYesNoLabel(option);
    const v = normalizeYesNoLabel(value);
    if (o && v && o === v) return true;
    return String(option || '').trim().toLowerCase() === String(value || '').trim().toLowerCase();
}

function isInvalidYesNoRadioValue(value, options) {
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar === null || scalar === undefined || scalar === '') return false;
    if (String(scalar).trim().toUpperCase() === 'N/A') return true;
    return !options.some(o => optionMatchesValue(o, scalar));
}

function resolveRequiredYesNoRadioValue(field, value) {
    if (!field.required || field.type !== 'radio' || !isExclusiveYesNoOptions(field.options)) {
        return value;
    }
    if (!isInvalidYesNoRadioValue(value, field.options)) {
        return value;
    }
    const scalar = Array.isArray(value) ? value[0] : value;
    const noOption = field.options.find(o => normalizeYesNoLabel(o) === 'No') || 'No';
    debugLog(`[LinkedIn] required Yes/No invalid value "${scalar}" -> "${noOption}": ${(field.label || '').slice(0, 80)}`);
    return noOption;
}

function linkedinDebug(event, detail) {
    try {
        const extra = detail === undefined ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail));
        debugLog(`[LinkedIn] ${event}`, extra);
    } catch (e) {
        console.error('[LinkedIn]', event, detail, e);
    }
}

function getLinkedInProfileCountry(profile, session) {
    return profile?.residency?.country || session?.country || '';
}

// Profile country names (application/src/main/resources/dictionaries/countries.json)
// -> LinkedIn Easy Apply Contact info country <select> option labels (ISO value + text).
// LinkedIn list captured from SDUI apply form debug dump, Jul 2026 (251 options incl. territories).
const PROFILE_COUNTRY_SYNONYMS = {
    usa: 'United States',
    us: 'United States',
    'u.s.': 'United States',
    'u.s.a.': 'United States',
    'united states of america': 'United States',
    uk: 'United Kingdom',
    'u.k.': 'United Kingdom',
    'great britain': 'United Kingdom',
    england: 'United Kingdom',
    uae: 'United Arab Emirates',
    'u.a.e.': 'United Arab Emirates',
};

const PROFILE_TO_LINKEDIN_COUNTRY = {
    'Antigua And Barbuda': 'Antigua and Barbuda',
    'Bonaire, Sint Eustatius and Saba': 'Bonaire',
    "Cote D'Ivoire (Ivory Coast)": 'Ivory Coast',
    'Congo': 'Republic of the Congo',
    'Czech Republic': 'Czechia',
    'Democratic Republic of the Congo': 'DR Congo',
    'East Timor': 'Timor-Leste',
    'Fiji Islands': 'Fiji',
    'Gambia The': 'Gambia',
    'Hong Kong S.A.R.': 'Hong Kong, SAR, China',
    'North Macedonia': 'Macedonia',
    'Papua new Guinea': 'Papua New Guinea',
    'Saint Kitts And Nevis': 'Saint Kitts and Nevis',
    'Saint Vincent And The Grenadines': 'Saint Vincent and the Grenadines',
    'Sao Tome and Principe': 'São Tomé and Príncipe',
    'The Bahamas': 'Bahamas',
    'Trinidad And Tobago': 'Trinidad and Tobago',
    'Virgin Islands (US)': 'United States Virgin Islands',
};

function normalizeProfileCountryName(name) {
    const raw = String(name || '').trim();
    if (!raw) {
        return raw;
    }
    const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    if (PROFILE_COUNTRY_SYNONYMS[key]) {
        return PROFILE_COUNTRY_SYNONYMS[key];
    }
    const keyNoDots = key.replace(/\./g, '');
    if (PROFILE_COUNTRY_SYNONYMS[keyNoDots]) {
        return PROFILE_COUNTRY_SYNONYMS[keyNoDots];
    }
    return raw;
}

function resolveLinkedInCountryName(profile, session) {
    const raw = getLinkedInProfileCountry(profile, session);
    const normalized = normalizeProfileCountryName(raw);
    return PROFILE_TO_LINKEDIN_COUNTRY[normalized]
        || PROFILE_TO_LINKEDIN_COUNTRY[raw]
        || normalized;
}

function logLinkedInCountryOptionsOnce(selectEl) {
    try {
        if (agentStatus.linkedinCountryOptionsLogged || !selectEl) {
            return;
        }
        agentStatus.linkedinCountryOptionsLogged = true;
        const opts = [...selectEl.options]
            .filter(o => o.value)
            .map(o => ({ code: o.value, name: o.text.trim() }));
        debugLog('[LinkedIn] country dropdown count=', opts.length);
    } catch (e) {
        console.error('logLinkedInCountryOptionsOnce failed', e);
    }
}

function selectLinkedInCountryOption(selectEl, linkedInCountryName) {
    if (!selectEl || selectEl.nodeName !== 'SELECT') {
        return false;
    }
    const wantedStr = String(linkedInCountryName || '').trim();
    if (!wantedStr) {
        return false;
    }
    logLinkedInCountryOptionsOnce(selectEl);
    const wantedLower = wantedStr.toLowerCase();
    const options = [...selectEl.options];
    let match = options.find(o => o.text.trim() === wantedStr || o.value === wantedStr);
    if (!match) {
        match = options.find(o => o.text.trim().toLowerCase() === wantedLower);
    }
    if (!match || !match.value) {
        return false;
    }
    if (selectEl.value === match.value) {
        return true;
    }
    selectEl.value = match.value;
    match.selected = true;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    dispatchInputEvent(selectEl);
    return true;
}

function selectLinkedInCountry(selectEl, profile, session) {
    const linkedInName = resolveLinkedInCountryName(profile, session);
    const ok = selectLinkedInCountryOption(selectEl, linkedInName);
    if (!ok) {
        debugLog('[LinkedIn] Country not matched:', getLinkedInProfileCountry(profile, session),
            'resolved=', linkedInName);
    }
    return ok;
}

function selectLinkedInOption(selectEl, wanted) {
    if (!selectEl || selectEl.nodeName !== 'SELECT') {
        return false;
    }
    const wantedStr = String(wanted || '').trim();
    if (!wantedStr) {
        return false;
    }
    const wantedLower = wantedStr.toLowerCase();
    const options = [...selectEl.options];
    let match = options.find(o => o.value === wantedStr || o.text.trim() === wantedStr);
    if (!match) {
        match = options.find(o => o.text.trim().toLowerCase() === wantedLower);
    }
    if (!match) {
        match = options.find(o => {
            const t = o.text.trim().toLowerCase();
            return t.includes(wantedLower) || wantedLower.includes(t);
        });
    }
    if (!match || !match.value) {
        return false;
    }
    if (selectEl.value === match.value) {
        return true;
    }
    selectEl.value = match.value;
    match.selected = true;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    dispatchInputEvent(selectEl);
    return true;
}

function selectLinkedInPhoneCountryCode(selectEl, phoneCountryCode) {
    if (!selectEl || selectEl.nodeName !== 'SELECT' || !phoneCountryCode) {
        return false;
    }
    const code = String(phoneCountryCode).replace(/^\+/, '');
    const options = [...selectEl.options];
    let match = options.find(o => o.value.includes(`(${phoneCountryCode})`) || o.value.includes(`+${code}`));
    if (!match) {
        match = options.find(o => o.text.includes(`+${code}`) || o.text.includes(`(${phoneCountryCode})`));
    }
    if (!match || !match.value) {
        return false;
    }
    return selectLinkedInOption(selectEl, match.value);
}

function linkedinFieldIsRequired(labelEl, inputEl) {
    if (inputEl?.required) {
        return true;
    }
    if (inputEl?.getAttribute('aria-required') === 'true') {
        return true;
    }
    const labelRaw = labelEl?.innerText || '';
    return labelRaw.includes('*');
}

function linkedinContactInfoMissingRequiredFields() {
    const missing = [];
    for (const label of getInputLabels()) {
        const labelText = getLabelText(label);
        const el = document.getElementById(label.htmlFor);
        if (!el) {
            continue;
        }
        if (!linkedinFieldIsRequired(label, el)) {
            continue;
        }
        if (el.nodeName === 'SELECT') {
            if (!el.value) {
                missing.push(labelText);
            }
        } else if (!String(el.value || '').trim()) {
            missing.push(labelText);
        }
    }
    return missing;
}

function grabFields() {
    return getInputLabels().map((label) => {

        const result = {
            element: null,
            type: '',
            label: getLabelText(label),
            required: false
        };

        switch (label.nodeName) {
            case 'SPAN':
            case 'DIV':
                var fieldset = label.closest('fieldset');
                if (!fieldset) {
                    fieldset = label.nextElementSibling.querySelector('fieldset');
                }
                if (!fieldset) {
                    const select = label.nextElementSibling.querySelector('select')
                    if (select) {
                        result.type = 'select';
                        result.element = select;
                        result.options = [...select.options].map((option) => option.value).filter(value => 'Select an option' !== value);
                        result.required = Boolean(select.getAttribute('aria-required')) === true;
                        return result;
                    }
                    
                
                    const input = label.nextElementSibling.querySelector('input')
                    if (input) {
                        result.type = input.id.includes('numeric') ? 'number' : input.type;
                        result.element = input;
                        result.required = input.required === true;
                        return result;
                    }
                    
                
                    return result;
                }
                const inputs = [...fieldset.querySelectorAll('input')];
                result.type = inputs[0].type;
                result.element = inputs;
                result.options = inputs.map(input => input.id && document.querySelector(`label[for="${input.id}"]`).innerText || input.value);
                result.required = Boolean(inputs[0].getAttribute('aria-required')) === true;
                break;
            default:
                if (!label.htmlFor) {
                    console.debug('Label htmlFor is empty:', label);
                    return result;
                }
                const element = document.getElementById(label.htmlFor);
                if (!element) {
                    console.debug('Element not found by id:', label.htmlFor);
                    return result;
                }

                switch (element.nodeName) {
                    case 'INPUT':
                        result.type = element.id.includes('numeric') ? 'number' : element.type;
                        break;
                    case 'SELECT':
                        result.type = 'select';
                        result.options = [...element.options].map((option) => option.value).filter(value => 'Select an option' !== value);
                        break;
                }

                result.element = element;
                result.required = element.required === true || !!label.querySelector('[data-test-date-picker-label-required=true]');

                if (result.element.getAttribute('placeholder')) {
                    result.label += ' ' + result.element.getAttribute('placeholder');
                }

                break;
        }

        return result;

    });
}

async function uploadCv(cv, started) {

    //StatusMessage('Select existed CV or upload new');

    const uploadedCv = findResumeFileNameElements()
        .filter((uploadedCv) => uploadedCv.innerText.trim() === cv?.originalFilename || uploadedCv.innerText.trim().includes(cv?.originalFilename));

    if (cv.resumePerJob || uploadedCv.length <= 0) {
        await pause();
        if (started != agentStatus.applyStarted) { return; }
        appendStatusMessage('Uploading your CV. Please hang on...');
        const fileInput = findResumeFileInput();
        if (!fileInput) {
            sendDOMToServer();
            throw new SendCvError('Resume file input not found');
        }
        await uploadFile(cv.url, cv.originalFilename, fileInput);
    } else {
        //StatusMessage('Select existed CV if not selected');
        await pause();
        if (started != agentStatus.applyStarted) { return; }
        if (!uploadedCv[0].closest('.jobs-document-upload-redesign-card__container')?.classList.contains('jobs-document-upload-redesign-card__container--selected')) {
            uploadedCv[0].click();
        }
    }

}

async function apply(data, started) {
    
    await pause();
    if (started != agentStatus.applyStarted) { return; }

    linkedinDebug('apply start', { url: location.href, resumePerJob: data?.session?.resumePerJob });

    //StatusMessage('Applying');

    const {devMode, profile} = data;

    //StatusMessage('Check "Easy Apply" button');

    if (document.getElementById('jobs-apply-see-application-link')) {
        chrome.runtime.sendMessage({type: "SEND-CV-TASK-ERROR", data: 'Already applied'});
        return;
    }

    try {
        if (location.href.startsWith('https://www.linkedin.com/jobs/view/')) {
            await waitForSuccess('.jobs-apply-button, [data-view-name="job-apply-button"]', 3000);
        } else {
            await waitForSuccess('.jobs-apply-button--top-card .jobs-apply-button', 3000);
        }
    } catch {}

    let button = document.querySelector('.jobs-apply-button--top-card .jobs-apply-button');

    if (location.href.startsWith('https://www.linkedin.com/jobs/view/')) {
        button = document.querySelectorAll('.jobs-apply-button, [data-view-name="job-apply-button"]')
        if (button.length > 0) {
            button = button[button.length - 1];
        } else {
            button = null;
        }

        if (!button) {
            // Method 1: aria-label containing "Easy Apply" or new "LinkedIn Apply to this job"
            button = document.querySelector('a[aria-label*="Easy Apply"], button[aria-label*="Easy Apply"], a[aria-label*="LinkedIn Apply"], button[aria-label*="LinkedIn Apply"]');
        }

        if (!button) {
            // Method 2: find a or button whose visible text is "Easy Apply"
            button = [...document.querySelectorAll('a, button')].find(el => {
                const text = el.innerText?.trim();
                return text === 'Easy Apply';
            }) || null;
        }
    }

    
    if (!button) {
        if (agentStatus.isApplyOne) {
            appendStatusMessage('Easy Apply button not found');
        }
        throw new SendCvSkipError('Easy apply button not found');
    }

    if (document.querySelector('.jobs-apply-button--top-card .jobs-apply-button use[href="#link-external-small"]')) {
        if (agentStatus.isApplyOne) {
            appendStatusMessage('‘This job redirected me away from the supported source, so I’m unable to handle it.');
        }
        throw new SendCvSkipError('Apply button is external link, skipped');
    }

    if (location.href.startsWith('https://www.linkedin.com/jobs/view/')) {
        if (document.querySelector('.jobs-apply-button use[href="#link-external-small"], [data-view-name="job-apply-button"] use[href="#link-external-small"]')) {
            if (agentStatus.isApplyOne) {
                appendStatusMessage('‘This job redirected me away from the supported source, so I’m unable to handle it.');
            }
            throw new SendCvSkipError('Apply button is external link, skipped');
        }
    }

    await (async function () {
        try {
            if (await handleLinkedInApplyLimitIfVisible(data)) {
                return;
            }
        } catch (e) {
        }
    })();

    await pause();
    if (started != agentStatus.applyStarted) { return; }

    company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText?.trim()
    role = document.querySelector('h1')?.innerText?.trim()
    description = document.querySelector('.jobs-description-content__text--stretch div')?.innerText?.trim() || document.querySelector('.jobs-description-content')?.innerText?.trim();

    if (!company) {
        company = document.title.split('|').at(1)?.trim() || document.title;
    }

    if (!role) {
        role = document.title.split('|').at(0)?.trim() || document.title;
    }

    if (!description) {
        const bodyText = document.body?.textContent ?? '';
        description = bodyText.split('About the job').at(1)?.trim() || bodyText;
        description = description.split('Set alert for similar jobs').at(0)?.trim() || description;
    }

    const details = { company, role, description };
    if (currentUrl !== null) {
        details.url = currentUrl;
    }
    const r = await setHistoryDetails(details, started);
    if (r.type == 'SKIP') {
        return;
    }

    if (!relevantFound) {
        appendStatusMessage('Found relevant job openings. Starting auto-apply with the first one...');
        relevantFound = true;
    }

    //StatusMessage('Open "Easy Apply" modal and wait');

    await pause();
    if (started != agentStatus.applyStarted) { return; }
    modalOpened = true;

    if (!isEasyApplyModalOpen()) {
        await new Promise((resolve) => {
            button.click();
            setTimeout(() => {
                resolve();
            }, 1000);
        });
    }

    //StatusMessage('Waiting for modal');

    try {
        await waitForEasyApplyModalOpen(15000);
    } catch (e) {
        if (await handleLinkedInApplyLimitIfVisible(data)) {
            return;
        }
        throw e;
    }

    if (await handleLinkedInApplyLimitIfVisible(data)) {
        return;
    }

    if (document.querySelector('.job-trust-pre-apply-safety-tips-modal__footer')) {
        //StatusMessage('Pre-apply modal detected');
        document.querySelector('.job-trust-pre-apply-safety-tips-modal__footer .jobs-apply-button')?.click();
    }

    //StatusMessage('Waiting for modal');

    try {
        await waitForEasyApplyStepTitle(15000);
        linkedinDebug('easy-apply step title', getEasyApplyStepTitleText(findEasyApplyStepTitleElement()));
    } catch (e) {
        if (await handleLinkedInApplyLimitIfVisible(data)) {
            return;
        }
        throw e;
    }

    await pause();
    if (started != agentStatus.applyStarted) { return; }

    /*if (document.querySelector('.jobs-easy-apply-modal h3').innerText.trim() !== 'Contact info') {
        //StatusMessage('Sorry, but only English is currently supported. Please change the language in your LinkedIn account settings.');
        await wait(5000);
        throw new SendCvSkipError('Form language not english');
    }*/

    //StatusMessage('Check "Easy Apply" modal type');

    if (!hasEasyApplyProgressMeter()
        && (document.querySelector('.jobs-easy-apply-modal footer button:not([data-easy-apply-next-button])') || findEasyApplyFooterButton('Review', 'Submit application'))) {
        //StatusMessage('Form without steps detected');
        document.getElementById('follow-company-checkbox')?.click();
        await fillBasicFields(profile, data.session, started);
        await uploadCv(await getResume(data), started);

        if (!devMode) {
            if (started != agentStatus.applyStarted) { return; }
            await readyToSubmit();
            await linkedinModalScreenshot();
            //StatusMessage('Submit');
            findPrimarySubmitButton()?.click();
            /*
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve();
                }, 6000)
            });
            */
            await waitForURLUpdate('/post-apply/')
        }

        //StatusMessage('Done');

    } else {

        console.log('start')
        await (async ()=> {
            console.log('inner fn start')
            let stepsDone = false
            let missingTitleSince = null;
            while (!stepsDone) {

                console.log('while start')

                const titleElement = findEasyApplyStepTitleElement();
                if (!titleElement) {
                    if (!missingTitleSince) {
                        missingTitleSince = Date.now();
                    }
                    if (Date.now() - missingTitleSince > 30000) {
                        sendDOMToServer();
                        throw new SendCvError('Easy Apply step title not found');
                    }
                    await wait(1000);
                    continue;
                }
                missingTitleSince = null;

                console.log(titleElement, getEasyApplyStepTitleText(titleElement))

                try {
                    stepsDone = (await stepSwitch(devMode, titleElement, profile, data, started)) === true;

                    if (!stepsDone) {
                        await wait(5000);
                    }
                } catch (e) {
                    if (started != agentStatus.applyStarted) { return; }
                    console.error(e);
                    sendErrorToServerFromPage(e);
                    if (e.message.includes('reached max tries count') || e instanceof SendCvError) {
                        throw e;
                    }
                    await wait(5000);
                }

                console.log('while end')

            }
            //StatusMessage('CV sent');
            console.log('inner fn end')
        })();
        console.log('end')

    }

}

function getCurrentStep() {
    const titleElement = findEasyApplyStepTitleElement();
    if (!titleElement) {
        return {name: null, percent: 0};
    }
    const titleText = getEasyApplyStepTitleText(titleElement);
    let percent = getEasyApplyProgressPercent();
    return {name: titleText, percent};
}

function saveCurrentStep() {
    try {
        const {name, percent} = getCurrentStep();
        if (name) {
            agentStatus.currentStep = {name, percent};
        }
    } catch (e) {
        console.error(e);
        sendErrorToServerFromPage(e);
    }
}

function verifyCurrentStep() {
    try {
        const {name, percent} = getCurrentStep();
        if (!agentStatus.currentStep || !agentStatus.currentStep.name || !agentStatus.currentStep.percent) {
            console.error('Current step not saved');
            sendErrorToServerFromPage(new Error('Current step not saved'));
            return 'empty';
        }
        if (name == agentStatus.currentStep.name && percent == agentStatus.currentStep.percent) {
            return 'unchanged';
        } else {
            if (percent < agentStatus.currentStep.percent) {
                console.warn('Step moved backward');
                return 'backward';
            } else if (percent > agentStatus.currentStep.percent) {
                console.warn('Step moved forward');
                return 'forward';
            } else {
                console.error('Step name changed but percent the same');
                sendErrorToServerFromPage(new Error('Step name changed but percent the same'));
                return 'changed';
            }
        }
    } catch (e) {
        console.error(e);
        sendErrorToServerFromPage(e);
        return 'error';
    }
}

async function fixCurrentStep() {
    try {
        const result = verifyCurrentStep();
        if (result == 'backward') {
            appendStatusMessage('Step moved backward, trying to fix... Please do not click Next or Back buttons during auto apply.');
            const nextButton = findNextButton();
            if (nextButton) {
                nextButton.click();
                await wait(3000);
                const result2 = verifyCurrentStep();
                if (result2 == 'unchanged') {
                    appendStatusMessage('Step fixed, continuing...');
                    return true;
                }
                appendStatusMessage('Step not fixed, filling fields again...');
                saveCurrentStep();
                return true;
            }
        }
        if (result == 'forward') {
            appendStatusMessage('Step moved forward, trying to fix... Please do not click Next or Back buttons during auto apply.');
            const backButton = findBackButton();
            if (backButton) {
                backButton.click();
                await wait(3000);
                const result2 = verifyCurrentStep();
                if (result2 == 'unchanged') {
                    appendStatusMessage('Step fixed, continuing...');
                    return true;
                }
                appendStatusMessage('Step not fixed, filling fields again...');
                saveCurrentStep();
                return true;
            } else {
                appendStatusMessage('Back button not found, cannot fix step, filling fields again...');
                saveCurrentStep();
                return true;
            }
        }
        return false;
    } catch (e) {
        console.error(e);
        sendErrorToServerFromPage(e);
        return false;
    }
}

async function reviewApplication() {
    try {
        // Function to extract all sections from the review modal
        function extractAllSections() {
            const sections = [];
            
            // Find all dividers that separate sections
            const dividers = [...document.querySelectorAll('.jobs-easy-apply-modal hr.artdeco-divider, [data-testid="dialog-content"] hr, [data-sdui-screen*="easyapply.EasyApply"] hr')];
            
            for (let i = 0; i < dividers.length; i++) {
                const divider = dividers[i];
                const nextElement = divider.nextElementSibling;
                
                if (!nextElement || !nextElement.classList.contains('display-flex')) {
                    continue;
                }
                
                // Check for section header and edit button
                const h4Element = nextElement.querySelector('h4.t-14.t-bold');
                const editButton = nextElement.querySelector('button[aria-label*="Edit"]');
                
                let sectionTitle = 'Unknown';
                let sectionType = 'other';
                
                if (h4Element) {
                    sectionTitle = h4Element.textContent.trim();
                } else if (editButton) {
                    // Headerless section - try to determine type from aria-label
                    const ariaLabel = editButton.getAttribute('aria-label') || '';
                    if (ariaLabel.includes('Additional Questions')) {
                        sectionTitle = 'Additional Questions';
                    }
                }
                
                // Determine section type
                const titleLower = sectionTitle.toLowerCase();
                if (titleLower.includes('work authorization')) {
                    sectionType = 'work-auth';
                } else if (titleLower.includes('additional questions') || titleLower.includes('additional')) {
                    sectionType = 'additional';
                } else if (titleLower.includes('voluntary self identification')) {
                    sectionType = 'voluntary';
                }
                
                if (!editButton) continue;
                
                // Extract questions from this section
                const questions = [];
                let currentElement = nextElement.nextElementSibling;
                const nextDivider = dividers[i + 1];
                
                while (currentElement && currentElement !== nextDivider && !currentElement.classList.contains('artdeco-divider')) {
                    if (currentElement.classList.contains('mt3')) {
                        const questionEl = currentElement.querySelector('.t-12.t-black--light span[aria-hidden="true"]');
                        const answerEl = currentElement.querySelector('.t-14.white-space-pre-line');
                        
                        if (questionEl && answerEl) {
                            const question = questionEl.textContent.trim();
                            const answer = answerEl.textContent.trim();
                            questions.push({ question, answer });
                        }
                    }
                    currentElement = currentElement.nextElementSibling;
                }
                
                sections.push({
                    title: sectionTitle,
                    type: sectionType,
                    questions,
                    editButton,
                    element: nextElement
                });
            }
            
            return sections;
        }

        // Extract all sections from the modal
        const allSections = extractAllSections();
        
        console.log('Extracted sections:', allSections.map(s => ({
            title: s.title,
            type: s.type,
            questionCount: s.questions.length
        })));

        // Group sections by type for logging
        const workAuthSections = allSections.filter(s => s.type === 'work-auth');
        const additionalSections = allSections.filter(s => s.type === 'additional');
        const voluntarySections = allSections.filter(s => s.type === 'voluntary');

        console.log('Work Authorization sections:', workAuthSections.map(s => s.questions));
        console.log('Additional Questions sections:', additionalSections.map(s => s.questions));
        console.log('Voluntary Self Identification sections:', voluntarySections.map(s => s.questions));

        // Function to compare section with saved answers
        function compareSectionAnswers(sectionData) {
            const mismatches = [];
            
            // Function to normalize values for comparison
            function normalizeValue(value) {
                if (value === null || value === undefined) {
                    return null;
                }
                // Convert to string and trim whitespace
                const stringValue = String(value).trim();
                // Try to convert to number if it's numeric
                const numericValue = Number(stringValue);
                if (!isNaN(numericValue) && isFinite(numericValue)) {
                    return numericValue;
                }
                return stringValue;
            }
            
            sectionData.questions.forEach(({ question, answer }) => {
                const savedAnswer = agentStatus.linkedinAnswers[question];
                
                if (savedAnswer !== undefined && savedAnswer !== null) {
                    const normalizedSaved = normalizeValue(savedAnswer);
                    const normalizedActual = normalizeValue(answer);
                    
                    if (normalizedSaved !== normalizedActual) {
                        mismatches.push({
                            question,
                            expected: savedAnswer,
                            actual: answer
                        });
                    }
                }
            });
            
            return mismatches;
        }

        // Check each section for mismatches and find first problematic section
        let problemSection = null;
        let problemSectionData = null;

        // Check all sections and find the first one with problems
        for (const sectionData of allSections) {
            const mismatches = compareSectionAnswers(sectionData);
            
            // Create unique section key for retry tracking
            const sectionKey = `${sectionData.type}_${sectionData.title}_${sectionData.questions.map(q => q.question).join('|')}`;
            
            // Log results for this section
            if (mismatches.length > 0) {
                console.log(`${sectionData.title} mismatches:`, mismatches);
                
                // If this is the first problem section we found, mark it for fixing
                if (!problemSection) {
                    problemSection = sectionData.title;
                    problemSectionData = sectionData;
                    problemSectionData.mismatches = mismatches;
                    problemSectionData.sectionKey = sectionKey;
                }
            } else {
                console.log(`${sectionData.title}: No problems found, all answers match`);
            }
        }

        // If problems are found
        if (problemSection && problemSectionData && problemSectionData.editButton) {
            const sectionKey = problemSectionData.sectionKey;
            
            // Increment counter for this specific section
            agentStatus.linkedinSectionRetries[sectionKey] = (agentStatus.linkedinSectionRetries[sectionKey] || 0) + 1;
            
            // Check if attempt limit is exceeded
            if (agentStatus.linkedinSectionRetries[sectionKey] > 2) {
                const errorMsg = `Section "${problemSection}" has problems that cannot be fixed (attempts: ${agentStatus.linkedinSectionRetries[sectionKey]})`;
                appendStatusMessage(errorMsg);
                sendErrorToServerFromPage(new Error(errorMsg));
                return true; // Don't loop the process
            }

            // Report found problems and return to section
            const problemsDetails = problemSectionData.mismatches.map(m => `"${m.question}": expected "${m.expected}", got "${m.actual}"`).join('; ');
            
            const statusMsg = `Found problems in section "${problemSection}" (attempt ${agentStatus.linkedinSectionRetries[sectionKey]}/3). Issues: ${problemsDetails}. Clicking Edit button and returning to this section`;
            appendStatusMessage(statusMsg);
            
            const errorDescription = `Review application problems in section "${problemSection}": ${problemsDetails}`;
            
            sendErrorToServerFromPage(new Error(errorDescription));
            
            // Click Edit button for the specific problematic section
            problemSectionData.editButton.click();
            
            return false; // Return to filling
        }

        // If no problems found, continue
        return true;
    } catch (e) {
        console.error(e);
        sendErrorToServerFromPage(e);
        return true;
    }
}

async function stepSwitch(devMode, titleElement, profile, data, started) {

    await pause();
    if (started != agentStatus.applyStarted) { return; }

    const titleText = getEasyApplyStepTitleText(titleElement);
    const titleTextPersent = titleText + getEasyApplyProgressContextText();

    let stepTryCount = getStepTry(titleTextPersent);

    linkedinDebug('stepSwitch', { step: titleText, try: stepTryCount + 1 });

    if (stepTryCount >= 3) {
        //StatusMessage(`Step ${titleText} reached max tries count`);
        throw new SendCvError(`Step ${titleText} reached max tries count`);
    }

    console.log('stepSwitch start', titleText);
    saveCurrentStep();

    if (titleText === 'Resume') {
        stepTryCount = incrementStepTry(titleTextPersent);
        //StatusMessage(`"Resume" step ${formatCurrentTry(stepTryCount)}`);
        await uploadCv(await getResume(data), started);
        if (stepTryCount > 1) {
             await fillAdditionalFields(false, started)
        }
        // await waitAnd(1500, () => findNextButton().click());
        await wait(1500);
        clickEasyApplyNextOrThrow(titleText);
        
        return false;
    } else if (titleText === 'Contact info') {
        stepTryCount = incrementStepTry(titleTextPersent);
        const contactInfoStart = Date.now();
        linkedinDebug('contact-info start', { try: stepTryCount, labels: getInputLabels().map(l => getLabelText(l)) });
        await fillBasicFields(profile, data.session, started);
        linkedinDebug('contact-info fillBasicFields done', { ms: Date.now() - contactInfoStart });
        if (stepTryCount > 1) {
            await fillAdditionalFields(true, started)
        }
        const missingBeforeNext = linkedinContactInfoMissingRequiredFields();
        linkedinDebug('contact-info before Next', { try: stepTryCount, missing: missingBeforeNext, ms: Date.now() - contactInfoStart });
        if (missingBeforeNext.length) {
            await fillBasicFields(profile, data.session, started);
            linkedinDebug('contact-info retry fill', { missing: linkedinContactInfoMissingRequiredFields() });
        }
        //await waitAnd(1500, () => findNextButton().click());
        await wait(1500);
        await pause();
        clickEasyApplyNextOrThrow(titleText);
        return false;
    } else if (titleText === 'Additional Questions' || titleText === 'Additional' || titleText === 'Home address' || titleText === 'Voluntary self identification' || titleText === 'Screening questions') {

        stepTryCount = incrementStepTry(titleTextPersent);

        //StatusMessage(`"Additional Questions" step ${formatCurrentTry(stepTryCount)}`);

        await pause();

        appendStatusMessage('Collecting fields and application questions...');

        const fields = grabFields();

        await wait(1000);
        await pause();

        streamVacancyFields(fields, started);
        await wait(2000);

        //StatusMessage('"Additional Questions" step: filling fields');

        await fillFields(fields, started);

        // await waitAnd(1500, () => findReviewButton().click());
        await wait(1500);
        await pause();
        clickEasyApplyNextOrThrow(titleText);

        return false;
    } else if (titleText === 'Review your application') {
        stepTryCount = incrementStepTry(titleTextPersent);
        if (!agentStatus.resumed) {
            await waitForFillingFinished();
            if (!agentStatus.linkedinReviewButton && !agentStatus.linkedinUnexpectedReview) {
                appendStatusMessage('Review step opened unexpectedly, returning to previous step to fill missing fields...');
                sendErrorToServerFromPage(new Error('Review step opened unexpectedly, returning to previous step to fill missing fields'));
                agentStatus.linkedinUnexpectedReview = true;
                const backButton = findBackButton();
                if (backButton) {
                    backButton.click();
                    await wait(3000);
                    return false;
                } else {
                    appendStatusMessage('Back button not found, cannot return to previous step, continuing to review step');
                    sendErrorToServerFromPage(new Error('Back button not found, cannot return to previous step, continuing to review step'));
                }
            }
            if (!await reviewApplication()) {
                return false;
            }
        }
        //StatusMessage(`"Review your application" step ${formatCurrentTry(stepTryCount)}`);
        document.getElementById('follow-company-checkbox')?.click();

        if (!devMode) {
            if (started != agentStatus.applyStarted) { return; }
            await readyToSubmit();
            await linkedinModalScreenshot();
            //StatusMessage('Submit');
            findPrimarySubmitButton()?.click();
            /*
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve();
                }, 6000)
            });
            */
            await waitForURLUpdate('/post-apply/')
        }

        //StatusMessage('Done');

        return true;
    } else if (titleText === 'Work authorization') {

        stepTryCount = incrementStepTry(titleTextPersent);

        //StatusMessage(`"Work authorization" step ${formatCurrentTry(stepTryCount)}`);

        await pause();

        appendStatusMessage('Collecting fields and application questions...');

        const fields = grabFields();

        await wait(1000);
        await pause();

        streamVacancyFields(fields, started);
        await wait(2000);

        //StatusMessage('"Work authorization" step: filling fields');

        await fillFields(fields, started);

        await wait(1500);
        await pause();
        clickEasyApplyNextOrThrow(titleText);
        return false;

    } else {
        // Unrecognized step title — if resume upload UI is on screen, handle as Resume.
        if (isResumeUploadStepVisible()) {
            linkedinDebug('unrecognized step with resume UI, treating as Resume', { titleText });
            stepTryCount = incrementStepTry(`${titleTextPersent}|resume-ui`);
            await uploadCv(await getResume(data), started);
            await wait(1500);
            clickEasyApplyNextOrThrow(titleText || 'Resume');
            return false;
        }

        stepTryCount = incrementStepTry(titleTextPersent);
        if (stepTryCount > 1) {
            await fillAdditionalFields(false, started);
        }

        await wait(1500);
        await pause();
        clickEasyApplyNextOrThrow(titleText);
        return false;
    }

    console.log('stepSwitch end')
}

async function fillAdditionalFields(omitBasicFields, started) {
    
    //StatusMessage(`Additional fields filling`);

    await pause();
    if (started != agentStatus.applyStarted) { return; }

    appendStatusMessage('Collecting fields and application questions...');

    const fields = grabFields();

    if (omitBasicFields) {
        const basicFieldLabels = ['First name', 'Last name', 'Phone country code', 'Mobile phone number', 'Mobile Phone', 'Phone', 'Email address', 'Country', 'Zip or Postal Code'];
        for (let i = fields.length - 1; i >= 0; i--) {
            if (basicFieldLabels.includes(fields[i].label)) {
                fields.splice(i, 1);
            }
        }
    }

    await wait(1000);
    await pause();
    if (started != agentStatus.applyStarted) { return; }

    streamVacancyFields(fields, started);
    await wait(2000);

    //StatusMessage('Additional fields filling: filling fields');

    await fillFields(fields, started);

}

async function fillBasicFields(profile, session, started) {
    const {email, phone, phoneCountryCode, firstName, lastName, residency} = profile || {};

    await pause();
    if (started != agentStatus.applyStarted) { return; }

    const zip = residency?.zip || '';

    //StatusMessage('Fill fields');

    const labels = getInputLabels();
    linkedinDebug('fillBasicFields labels', labels.map(l => ({ text: getLabelText(l), htmlFor: l.htmlFor })));

    for (let i = 0; i < labels.length; i++) {

        const labelText = getLabelText(labels[i]);

        //StatusMessage('Set value for ' + labelText);

        const el = document.getElementById(labels[i].htmlFor);

        if (!el) {
            linkedinDebug('fillBasicFields element not found', { label: labelText, htmlFor: labels[i].htmlFor });
            continue;
        }

        let changed = false;

        switch (labelText) {
            case 'First name':
                if (el.value == firstName) { break }
                el.value = firstName;
                changed = true;
                break;
            case 'Last name':
                if (el.value == lastName) { break }
                el.value = lastName;
                changed = true;
                break;
            case 'Phone country code':
                if (el.nodeName === 'SELECT') {
                    if (el.value && el.value.includes(`(${phoneCountryCode})`)) { break }
                    if (!selectLinkedInPhoneCountryCode(el, phoneCountryCode)) {
                        const phoneCountryCodeOption = [...el.options].find(option => option.value.includes(`(${phoneCountryCode})`));
                        if (phoneCountryCodeOption) {
                            phoneCountryCodeOption.selected = true;
                        }
                    }
                    changed = true;
                }
                break;
            case 'Mobile phone number':
            case 'Mobile Phone': {
                const phoneVal = phone?.startsWith('+') ? phone : (phoneCountryCode ? `${phoneCountryCode}${phone}` : phone);
                if (el.value == phoneVal || el.value == phone) { break }
                setNativeValue(el, phoneVal || phone);
                changed = true;
                break;
            }
            case 'Phone':
                if (el.nodeName === 'SELECT') {
                    if (el.value && el.value.includes(`(${phoneCountryCode})`)) { break }
                    if (selectLinkedInPhoneCountryCode(el, phoneCountryCode)) {
                        changed = true;
                    }
                } else if (el.value != phone) {
                    el.value = phone;
                    changed = true;
                }
                break;
            case 'Email address':
                if (el.value == email) { break }
                const emailOption = [...el.options].find(option => option.value.includes(email));
                if (emailOption) {
                    el.value = email;
                } else if (el.nodeName !== 'SELECT') {
                    setNativeValue(el, email);
                }
                changed = true;
                break;
            case 'Country': {
                const linkedInName = resolveLinkedInCountryName(profile, session);
                const before = el.value;
                if (before && before !== 'Select an option' && before.toLowerCase() === linkedInName.toLowerCase()) {
                    break;
                }
                const ok = selectLinkedInCountry(el, profile, session);
                linkedinDebug('fillBasicFields Country', {
                    profileCountry: getLinkedInProfileCountry(profile, session),
                    linkedInName,
                    elId: el.id,
                    before,
                    after: el.value,
                    ok,
                });
                if (ok) {
                    changed = true;
                }
                break;
            }
            case 'Zip or Postal Code':
                if (!zip || el.value == zip) { break }
                setNativeValue(el, zip);
                changed = true;
                break;
            default:
                continue;
        }

        if (!changed) {
            continue;
        }

        dispatchInputEvent(el);

        await wait(500);
        await pause();
        if (started != agentStatus.applyStarted) { return; }

    }

}

async function fillFields(fields, started) {
    agentStatus.fillingFields = true;
    await pause();
    if (started != agentStatus.applyStarted) { agentStatus.fillingFields = false; return; }

    let fieldNum = 0;
    let field;
    while (fieldNum < fields.length) {
        field = fields[fieldNum];

        try {
            if (await fixCurrentStep()) {
                throw new Error('step fixed, filling fields again');
            }
            let {value, completed} = await getFieldValueByFieldName(field.label);
            if (started != agentStatus.applyStarted) { agentStatus.fillingFields = false; return; }
            if (await fixCurrentStep()) {
                throw new Error('step fixed, filling fields again');
            }

            const isNumberField = field.type === 'number'
                || field.element?.type === 'number'
                || (field.element?.id && field.element.id.includes('numeric'));
            if (isNumberField && String(value).trim() === 'N/A') {
                value = field.required ? Math.floor(Math.random() * 3) + 1 : '';
            }

            if (field.type === 'radio') {
                value = resolveRequiredYesNoRadioValue(field, value);
            }

            if (completed) {
                fieldNum += 1;
            } else {
                //if (field.type != 'text' && field.type != 'textarea') {
                    continue;
                //}
            }

            console.log(field, field.label, value)

            if (!value && value !== 0) {
                // if (field.required && Array.isArray(field.element) && field.element[0]) {
                //     field.element[0].click()
                // }
                console.log('skip')
                continue;
            }

            agentStatus.linkedinAnswers[field.label] = value;

            if (Array.isArray(field.element)) {
                if (agentStatus.resumed) {
                    field.element.forEach((el) => {
                        if (el.checked) {
                            throw new Error('filled by user')
                        }
                    });
                }
                if (!Array.isArray(value)) {
                    value = [value]
                }
                field.element.forEach((el) => {
                    if (value.includes(el.id && document.querySelector(`label[for="${el.id}"]`).innerText || el.value)) {
                        el.click();
                    }
                });
            } else if (field.type === 'select') {
                if (Array.isArray(value)) {
                    value = value[0];
                }
                if (field.label === 'Country') {
                    const profileForCountry = { residency: { country: value } };
                    if (!selectLinkedInCountry(field.element, profileForCountry, null)) {
                        selectLinkedInCountryOption(field.element, value);
                    }
                } else if (!selectLinkedInOption(field.element, value)) {
                    for (const opt of field.element.options) {
                        if (optionMatchesValue(opt.text, value) || optionMatchesValue(opt.value, value)) {
                            selectLinkedInOption(field.element, opt.value);
                            break;
                        }
                    }
                }
            } else {
                if (Array.isArray(value)) {
                    value = value[0];
                }
                if (agentStatus.resumed && field.element.value) {
                    console.log('filled by user')
                    continue;
                }
                if (isNumberField && String(value).trim() === 'N/A') {
                    value = field.required ? Math.floor(Math.random() * 3) + 1 : '';
                }
                if (isNumberField && !value && value !== 0) {
                    continue;
                }
                setNativeValue(field.element, value);
                field.element.dispatchEvent(new Event('focusout', {bubbles: true}));
                if (field.element.getAttribute('aria-autocomplete') == 'list') {
                    try {
                        await waitForSuccess('.basic-typeahead__selectable', 7000)
                        field.element.parentElement.querySelector('.basic-typeahead__selectable').click()
                        delete agentStatus.linkedinAnswers[field.label];
                    } catch (e) {
                        console.error(e);
                        sendErrorToServerFromPage(e);
                    }
                }
            }

        } catch (e) {
            if (e.message === 'step fixed, filling fields again') {
                agentStatus.fillingFields = false;
                throw e;
            }
            console.error(e);
            sendErrorToServerFromPage(e);
        }

        await wait(3000);
        if (started != agentStatus.applyStarted) { agentStatus.fillingFields = false; return; }

    }
    agentStatus.fillingFields = false;

}

async function waitForFillingFinished() {
    let messageShown = false;
    const startTime = Date.now();
    const timeout = 120000; // 120 seconds maximum wait time
    
    while (agentStatus.fillingFields) {
        if (!messageShown) {
            appendStatusMessage('Waiting for fields to be filled...');
            messageShown = true;
        }
        
        // Check if timeout exceeded
        if (Date.now() - startTime > timeout) {
            agentStatus.fillingFields = false; // Force stop waiting
            break;
        }
        
        await wait(1000);
        await pause();
    }
}

async function resumeAfterManualFix(data, started) {
    const devMode = data.devMode;
    const profile = data.profile;
    const session = data.session;

    while (true) {
        await pause();
        if (started != agentStatus.applyStarted) { return; }

        const modalHeader = findEasyApplyStepTitleElement();
        if (!modalHeader) {
            return;
        }

        const currentStepName = getEasyApplyStepTitleText(modalHeader);

        if (currentStepName === 'Contact info') {
            await fillBasicFields(profile, session, started);
            const missingRequired = linkedinContactInfoMissingRequiredFields();
            if (missingRequired.length) {
                debugLog('[LinkedIn] resume blocked, missing required:', missingRequired);
                appendStatusMessage(`Some fields still need your attention (${missingRequired.join(', ')}). Fix them and hit CONTINUE again.`);
                agentStatus.setButtons(2);
                agentStatus.paused = true;
                agentStatus.resumed = true;
                continue;
            }
        }

        const nextBtn = findNextButtonOrReviewButton();
        if (!nextBtn) {
            chrome.runtime.sendMessage({type: "SEND-CV-TASK-ERROR", data: 'skipped by user'});
            return;
        }
        nextBtn.click();
        await wait(3000);
        if (started != agentStatus.applyStarted) { return; }

        let afterClickHeader = findEasyApplyStepTitleElement();

        if (!afterClickHeader) {
            await wait(2000);
            afterClickHeader = findEasyApplyStepTitleElement();
            if (!afterClickHeader) {
                return;
            }
        }

        if (getEasyApplyStepTitleText(afterClickHeader) === currentStepName) {
            appendStatusMessage(`Some fields still need your attention. Fix them and hit CONTINUE again.`);
            agentStatus.setButtons(2);
            agentStatus.paused = true;
            agentStatus.resumed = true;
            continue;
        }

        // Form advanced — process the remaining steps automatically
        appendStatusMessage('Resuming auto-apply...');
        let stepsDone = false;
        while (!stepsDone) {
            await pause();
            if (started != agentStatus.applyStarted) { return; }

            const titleElement = findEasyApplyStepTitleElement();
            if (!titleElement) {
                break;
            }

            try {
                stepsDone = (await stepSwitch(devMode, titleElement, profile, data, started)) === true;
                if (!stepsDone) {
                    await wait(5000);
                }
            } catch (e) {
                if (started != agentStatus.applyStarted) { return; }
                console.error(e);
                sendErrorToServerFromPage(e);
                if (e.message.includes('reached max tries count')) {
                    throw e;
                }
                await wait(5000);
            }
        }
        return;
    }
}

async function startApply(fresh) {
    chrome.runtime.sendMessage({type: "GET-SEND-CV-TASK"}).then(async (value) => {

        const {type, data, message} = value;

        switch (type) {
            case 'ERROR':
                
                
                break;
            case 'SUCCESS':

                if (fresh) {
                    warmingUp(data.agentGeometry, data.agentMessages, data.agentMode);
                }

                const started = agentStatus.applyStarted = Date.now();

                try {

                    try {
                        clearInterval(agentStatus.intervalId);
                    } catch (e) {}

                    agentStatus.timeAdded = false;

                    countDown = startCountDownInStatusBlock(60 * 5, () => {
                        chrome.runtime.sendMessage({
                            type: "SEND-CV-TAB-TIMER-ENDED", data: {
                                url: window.location.href
                            }
                        });
                    });

                    stepTries = {};

                    successOnURLLinkedIn('/post-apply/');

                    agentStatus.resumed = false;
                    agentStatus.success = false;
                    agentStatus.agentMode = data.agentMode;
                    if (agentStatus.agentMode == 'Copilot') {
                        agentStatus.setButtons(1);
                    }
                    agentStatus.linkedinAnswers = {};
                    agentStatus.linkedinSectionRetries = {};
                    agentStatus.linkedinUnexpectedReview = false;
                    agentStatus.linkedinCountryOptionsLogged = false;

                    linkedinDebug('startApply calling apply', { agentMode: data.agentMode });
                    await apply(data, started);
                    linkedinDebug('apply finished');

                } catch (e) {
                    if (started != agentStatus.applyStarted) { return; }

                    if (e instanceof SendCvSkipError) {
                        
                        chrome.runtime.sendMessage({type: "SEND-CV-TASK-SKIP", data: e.message});
                    } else {
                        const shouldResume = await fillingErrors(e, { returnOnResume: true });
                        if (shouldResume) {
                            try {
                                await resumeAfterManualFix(data, started);
                            } catch (resumeError) {
                                if (started != agentStatus.applyStarted) { return; }
                                chrome.runtime.sendMessage({type: "SEND-CV-TASK-ERROR", data: 'skipped by user'});
                            }
                        }
                    }
                }
        }
    });
}

function findAllLinksElements() {
    // return [...document.querySelectorAll('.scaffold-layout__list .scaffold-layout__list-container .jobs-search-results__list-item .job-card-container__link')];
    if (SEARCH_DATA.platform == 'LINKEDIN_BOOKMARKS') {
        return [...document.querySelectorAll('.linked-area')];
    } else {
        return [...document.querySelectorAll('.scaffold-layout__list .job-card-container:not(.job-card-list--is-dismissed)')];
    }
}

async function prepare(data) {

    const session = data.session;

    await wait(5000);

    if (session.platform == 'LINKEDIN_BOOKMARKS') {
        appendStatusMessage(`Please make sure you're signed in to LinkedIn in this browser`);
        await wait(5000);
    } else {

        appendStatusMessage(`Checking if you're signed in to LinkedIn in this browser...`);
        await wait(1500);

        for (nt = 0; 1; nt ++ ) {
            
            try {

                let imageEl = null;
                let currentAuthCheckTry = 0;
                const maxAuthCheckTries = 15;

                do {

                    if (currentAuthCheckTry >= maxAuthCheckTries || document.querySelector('.contextual-sign-in-modal__screen') || location.pathname.startsWith('/authwall')) {
                        appendStatusMessage(`Please make sure you're signed in to LinkedIn in this browser`);
                        sendDOMToServer();
                        break;
                    }

                    ++currentAuthCheckTry;

                    imageEl = document.querySelector('.global-nav__me-photo');

                    if (imageEl) {
                        appendStatusMessage('Login confirmed! Opening the LinkedIn job search filter.');
                        break;
                    }

                    await wait(100);

                } while (imageEl === null);

                break;
            } catch {
                if (nt > 5) {
                    appendStatusMessage(`Please make sure you're signed in to LinkedIn in this browser`);
                    sendDOMToServer();
                    break;
                }
            }
            
            await wait(1000);
        }

        await wait(1500);
    }

    //StatusMessage('Prepare: select city and country if need');

    if (session.platform == 'LINKEDIN_SEARCH') {
        await customApplyWait();

        if (!location.href.includes('f_AL=true')) {
            document.querySelector('#searchFilter_applyWithLinkedin')?.click();
        }

        if (!agentStatus.searchDisplayed) {
            try {
                const _role = document.querySelector('.jobs-search-box__keyboard-text-input--reflowed')?.title?.split('/')?.at(0)?.trim();
                const _accuracy = session.searchAccuracy;
                const _datePosted = document.querySelector('#searchFilter_timePostedRange.artdeco-pill--selected')?.textContent?.trim();
                const _empType = document.querySelector('#searchFilter_workplaceType.artdeco-pill--selected')?.textContent?.trim()?.split('\n')?.at(0)?.trim();
                const _location = document.querySelector('.jobs-search-box__keyboard-text-input--reflowed')?.title?.split('/')?.at(1)?.trim();

                const lines = ['Saving your job search preferences:'];
                if (_role && _role !== 'Search jobs') lines.push(`Role: ${_role}`);
                if (_accuracy) lines.push(`Search accuracy: ${_accuracy}`);
                if (_datePosted) lines.push(`Date posted: ${_datePosted}`);
                if (_empType) lines.push(`Employment type: ${_empType}`);
                if (_location) lines.push(`Location: ${_location}`);

                appendStatusMessage(lines.join('\n'));
            } catch {}
            agentStatus.searchDisplayed = true;
            await wait(6000);
        }
        return;
    } else {
        chrome.runtime.sendMessage({
            type: "ENABLE-WRONG-RETURN",
        });
    }

    if (session.platform == 'LINKEDIN_BOOKMARKS') {
        return;
    }

    if (!agentStatus.searchDisplayed) {
        appendStatusMessage(`Picking your Profile ${data.profile.num}: ${data.profile.title} for auto-apply.`);
        await wait(2000);
        appendStatusMessage(`Resume AI generator per job is ${data.resumePerJob ? 'ON' : 'OFF'}...`)
        await wait(2000);


        appendStatusMessage(`Looking for jobs based on your search preferences:

            Role: ${session.role}
            Search accuracy: ${session.searchAccuracy}
            Date posted: ${session.datePosted}
            Employment type: ${formatWorkplace(session.workplace)}
            Country: ${session.country || 'Any'}
            City: ${session.city || 'Any'}`);
        
        agentStatus.searchDisplayed = true;
        await wait(7000);
    }

    if (SEARCH_DATA.country || SEARCH_DATA.city) {

        const input = document.querySelector('.jobs-search-box__text-input:not(.jobs-search-box__ghost-text-input)[id^=jobs-search-box-location-id-]');

        if (!input) {
            throw new SearchError('Country and city input not found');
        }

        const searchParts = []

        if (SEARCH_DATA.city) {
            searchParts.push(SEARCH_DATA.city);
        }

        if (SEARCH_DATA.country) {
            searchParts.push(SEARCH_DATA.country);
        }

        let search = searchParts.join(', ');

        if (input.value == search) {
            return;
        }

        input.value = '';
        dispatchInputEvent(input);

        for (let i = 0; i < search.length; i++) {
            await new Promise((resolve) => {
                setTimeout(() => {
                    input.value += search.charAt(i);
                    dispatchInputEvent(input);
                    resolve();
                }, 400);
            });
        }

        const suggestions = [...document.querySelectorAll('.jobs-search-box__text-input:not(.jobs-search-box__ghost-text-input)')];

        if (!suggestions.length) {
            throw new SearchError('Suggestions not found');
        }

        suggestions[0].click();

        await wait(1000);

        document.querySelector('.jobs-search-box__submit-button')?.click();

        await wait(2500);

    }

    await wait(3000);

}

async function searchNext() {

    //StatusMessage('Search link');

    let links;
    
    if (SEARCH_DATA.platform == 'LINKEDIN_BOOKMARKS') {
        links = [...document.querySelectorAll('a[href*="/jobs/view/"]')];

        // Дедупликация по href
        const seenHrefs = new Set();
        links = links.filter(link => {
            if (seenHrefs.has(link.href)) {
                return false;
            }
            seenHrefs.add(link.href);
            return true;
        });

    } else {
        links = findAllLinksElements();
    }
    

    let linkFound = false;
    let haveVisited = false;
    for (let i = 0; i < links.length * 10; i++) {

        // handle infinite scroll
        if (!links[i]) {
            await wait(5000);
            chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}) // do not remove!
            links = findAllLinksElements();
            if (!links[i]) {
                await wait(6000);
                links = findAllLinksElements();
                if (!links[i]) {
                    break;
                }
            }
        }

        if (document.querySelector(".jobs-search-no-results-banner__image")) {
            break;
        }

        links[i].scrollIntoView();

        const linkEl = (SEARCH_DATA.platform == 'LINKEDIN_BOOKMARKS') ? links[i] : links[i].querySelector('.job-card-container__link');

        const url = normalizeUrl(linkEl.href);

        if (SEARCH_DATA.submittedLinks.some(link => link.url === url || url.includes(link.url))) {
            links[i].style.background = '#a8f2c0';
            console.log('LINK', url, 'ALREADY VISITED');
            haveVisited = true;
            continue;
        }

        if (!url.includes('/jobs/view/')) {
            continue;
        }

        const response = await chrome.runtime.sendMessage({
            type: "SEND-CV-TASK",
            data: {
                url: url
            }
        });

        currentUrl = url;

        if (response.type === 'ERROR') {
            console.log('ERROR', response);
            links[i].style.background = '#f7bcbc';
            processedLinksCount++;
            continue;
        }

        links[i].style.background = '#ffdd9a';

        if (SEARCH_DATA.platform != 'LINKEDIN_BOOKMARKS') {

            await wait(Math.round(1000 + (Math.random() * 1000)));

            linkEl.click();

            console.log('LINK', url, 'CLICKED');

            await wait(Math.round(5000 + (Math.random() * 1000)));

        }

        //StatusMessage('Link found: ' + url);

        //StatusMessage('Wait for send cv task result');

        console.log('WAIT UNTIL SEND CV TASK WILL BE COMPLETE');

        sendCvPageNotRespondTimeout = setTimeout(() => {
            chrome.runtime.sendMessage({
                type: "SEND-CV-TAB-NOT-RESPOND",
            });
            clearTimeout(sendCvPageNotRespondTimeout);
        }, 60_000 * 8);

        linkFound = true;

        await startApply();

        break;

    }

    if (linkFound) {
        return;
    }

    //StatusMessage('All links on page are visited. move to next page');

    if (haveVisited) {
        appendStatusMessage('I’ve already applied to these jobs for you. To save your Lifts, I’m skipping them and looking for new ones...')
    }

    await wait(5000);
    chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}) // do not remove!

    let pages = [...document.querySelectorAll('.jobs-search-pagination__pages li, .artdeco-pagination__pages li')]

    if (!pages.length) {
        //StatusMessage('No pages found. Done');
        searchTaskDone();
        return;
    }

    pages[0].scrollIntoView();

    let activePageIndex = -1;
    for (let i = 0;i < pages.length;i++) {
        if (activePageIndex !== -1 && i === (activePageIndex + 1)) {
            pages[i].querySelector('button').click();
            await wait(5000);
            return await searchNext();
        } else {
            if (pages[i].querySelector('button[aria-current]')) {
                if (i === (pages.length - 1)) {
                    //StatusMessage('Last page reached');
                    searchTaskDone();
                    return;
                }
                activePageIndex = i;
            }
        }
    }

    //StatusMessage('No pages found. Done');
    searchTaskDone();

}

async function closeModal() {
    if (!modalOpened) {
        return;
    }
    let closeButton = Array.from(document.querySelectorAll('.jobs-easy-apply-modal .artdeco-modal__dismiss, [data-testid="dialog-content"] button[aria-label="Dismiss"], #dialog-header ~ button, button:has(svg[data-test-icon="close-medium"]), button[aria-label=Dismiss]')).find(btn => btn.offsetParent !== null);
    closeButton?.click();
    await wait(Math.round(1000 + (Math.random() * 1000)));
    let button = Array.from(document.querySelectorAll('button[data-control-name="discard_application_confirm_btn"]')).find(btn => btn.offsetParent !== null);
    if (!button) {
        button = Array.from(document.querySelectorAll('button'))
        .find(btn => (
            btn.textContent.trim() === 'Discard'
        ) && btn.offsetParent !== null);
    }
    button?.click();
    modalOpened = false;
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {

    console.log('INCOMING MESSAGE', request, sender);

    const {type, data} = request;

    switch (type) {
        case 'SEARCH-NEXT':
            try {
                clearTimeout(sendCvPageNotRespondTimeout);
            } catch (e) {}
            try {
                clearInterval(agentStatus.intervalId);
            } catch (e) {}

            processedLinksCount++;
            SEARCH_DATA.submittedLinks.push({...data});

            await movingOn(data);

            await wait(2000);

            try {
                await closeModal();
            } catch (e) {
                console.error(e);
                sendErrorToServerFromPage(e);
            }

            agentStatus.paused = false;

            setTimeout(() => {
                searchNext().catch((reason) => {
                    chrome.runtime.sendMessage({type: "SEARCH-TASK-ERROR", data: errorToString(reason)});
                });
            }, 3000)
            break;

        case 'AGENT-MESSAGE':
            appendStatusMessage(data.message, true);

            break;
    }

});



window.addEventListener('load', () => {

    agentStatus.disableRemoveButtons = true;
    linkedinDebug('page load', location.href);

    chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}).then(async value => {

        const {type, data, message} = value;

        switch (type) {
            case 'ERROR':
                
                if (data.isApplyTab) {
                    relevantFound = true;
                    return startApply(true);
                }
                
                if (!data?.applyOneEnabled) {
                    return;
                }

                let o = false;
                while (true) {
                    if ((location.href.startsWith('https://www.linkedin.com/jobs/search') || location.href.startsWith('https://www.linkedin.com/jobs/view/')) && location.href != o) {
                        
                        new Promise(async (resolve) => {
                            const v = await startApplyOne(value);
                            try {
                                if (v.type == 'SUCCESS') {
                                    relevantFound = true;
                                    startApply();
                                }
                            } catch (e) {
                                console.error(e);
                                sendErrorToServerFromPage(e);
                            }
                        });
                        
                    }
                    o = location.href;
                    await wait(2000);
                }    

                break;
            case 'SUCCESS':
                if (checkWrongReturned(data.agentGeometry)) {
                    return;
                }

                const {tabId, limit, current, domain, city, country, submittedLinks} = data;

                SEARCH_DATA.city = city;
                SEARCH_DATA.country = country;

                SEARCH_DATA.tabId = tabId;
                SEARCH_DATA.limit = limit;
                SEARCH_DATA.domain = domain;
                SEARCH_DATA.current = current;
                SEARCH_DATA.submittedLinks = submittedLinks;
                SEARCH_DATA.platform = data.session.platform;

                if (SEARCH_DATA.platform == 'LINKEDIN_BOOKMARKS') {
                    agentStatus.search = true;
                }

                warmingUp(data.agentGeometry, data.agentMessages, data.agentMode);

                setTimeout(() => {
                    prepare(data).then(() => {
                        searchNext().catch((reason) => {
                            appendStatusMessage(String(reason));
                            setTimeout(() => {
                                chrome.runtime.sendMessage({type: "SEARCH-TASK-ERROR", data: errorToString(reason)});
                            }, 15000)
                        });
                    }).catch((error) => {
                        if (error instanceof NotAuthorizedError) {
                            //StatusMessage('Not authorized');
                            setTimeout(() => {
                                chrome.runtime.sendMessage({type: "NOT-AUTHORIZED-ERROR", data: error.name});
                            }, 3000)
                        } else {
                            appendStatusMessage(String(error));
                            setTimeout(() => {
                                chrome.runtime.sendMessage({type: "SEARCH-TASK-ERROR", data: errorToString(error)});
                            }, 15000)
                        }
                    });
                }, 5)

                break;
        }

    });

});
