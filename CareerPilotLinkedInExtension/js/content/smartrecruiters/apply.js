

let countDown;

const SKIP_WORDS = ['Diversity', 'diversity', 'DIVERSITY', 'Survey', 'survey', 'SURVEY'];
const COVER_LETTER_LABEL = 'Let the company know about your interest working there';
const COVER_LETTER_SUFFIX = ' (write cover letter)';
const LANGUAGE_LABEL_PATTERNS = [
    /^language input for entry \d+$/i,
    /^level for .*language entry \d+$/i,
    /^level for language entry \d+$/i
];
const LANGUAGE_LEVEL_MAPPING = {
    'native': 'Native',
    'c2 mastery': 'Fluent',
    'c2': 'Fluent',
    'c1 advanced': 'Fluent',
    'c1': 'Fluent',
    'b2 upper intermediate': 'Advanced',
    'b2': 'Advanced',
    'b1 intermediate': 'Intermediate',
    'b1': 'Intermediate',
    'a2 elementary': 'Beginner',
    'a2': 'Beginner',
    'a1 beginner': 'Beginner',
    'a1': 'Beginner',
    'a0 starter': 'Beginner',
    'a0': 'Beginner',
    'beginner': 'Beginner',
    'intermediate': 'Intermediate',
    'advanced': 'Advanced',
    'fluent': 'Fluent'
};

function shouldIgnoreLanguageLabel(label) {
    if (!label) {
        return false;
    }
    const cleaned = cleanLabelText(label);
    if (!cleaned) {
        return false;
    }
    return LANGUAGE_LABEL_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function mapLanguageLevel(proficiency) {
    if (!proficiency) {
        return null;
    }
    const cleaned = cleanLabelText(proficiency).toLowerCase();
    if (!cleaned) {
        return null;
    }
    if (LANGUAGE_LEVEL_MAPPING[cleaned]) {
        return LANGUAGE_LEVEL_MAPPING[cleaned];
    }

    const directMatch = Object.entries(LANGUAGE_LEVEL_MAPPING)
        .find(([key]) => cleaned.includes(key));
    return directMatch ? directMatch[1] : null;
}

function getInnerFormControl(element, maxDepth = 10, visited = new Set(), debug = false) {
    if (!element || visited.has(element)) {
        return null;
    }
    
    visited.add(element);

    // Check if this is a SmartRecruiters web component that acts as a control
    // These don't have native inputs inside - they ARE the controls
    const tagName = element.tagName?.toLowerCase();
    if (tagName === 'spl-radio' || tagName === 'spl-checkbox') {
        if (debug) {
            console.log(`[getInnerFormControl] Found SmartRecruiters web component: ${tagName}`);
        }
        // Return the web component itself - it will be handled specially
        return element;
    }

    if (element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement) {
        return element;
    }

    if (maxDepth <= 0) {
        if (debug) console.log('[getInnerFormControl] Max depth reached');
        return null;
    }

    if (debug) {
        console.log(`[getInnerFormControl] Searching in ${element.tagName}`, {
            id: element.id,
            hasShadowRoot: !!element.shadowRoot,
            depth: 10 - maxDepth
        });
    }

    // Try direct querySelector first (light DOM) 
    if (typeof element.querySelector === 'function') {
        const inner = element.querySelector('input, select, textarea');
        if (inner) {
            if (debug) console.log('[getInnerFormControl] Found in light DOM via querySelector');
            return inner;
        }
        if (debug && element.children && element.children.length > 0) {
            console.log(`[getInnerFormControl] querySelector found nothing, but element has ${element.children.length} children`);
        }
    }

    // Deep search through shadow DOM recursively
    if (element.shadowRoot) {
        if (debug) console.log('[getInnerFormControl] Searching in shadow root');
        
        // First try direct query in shadow root
        const inner = element.shadowRoot.querySelector('input, select, textarea');
        if (inner) {
            if (debug) console.log('[getInnerFormControl] Found directly in shadow root');
            return inner;
        }
        
        // Log what's actually in the shadow root if debugging
        if (debug && !inner) {
            const allInShadow = element.shadowRoot.querySelectorAll('input, select, textarea');
            console.log(`[getInnerFormControl] Shadow querySelector found ${allInShadow.length} controls`);
            
            // Log ALL descendants to see what's actually in shadow root
            const allDescendants = element.shadowRoot.querySelectorAll('*');
            console.log(`[getInnerFormControl] All shadow descendants (${allDescendants.length}):`,
                Array.from(allDescendants).slice(0, 20).map(el => ({
                    tag: el.tagName,
                    id: el.id || '',
                    type: el.type || '',
                    name: el.name || '',
                    hasShadow: !!el.shadowRoot
                }))
            );
            
            // Also check direct children
            const directChildren = Array.from(element.shadowRoot.children);
            console.log(`[getInnerFormControl] Shadow root direct children:`, directChildren.map(c => ({
                tag: c.tagName,
                hasShadow: !!c.shadowRoot,
                children: c.children?.length || 0
            })));
        }

        // Then recursively search all elements in shadow root
        const allElements = element.shadowRoot.querySelectorAll('*');
        if (debug) {
            console.log(`[getInnerFormControl] Shadow root has ${allElements.length} descendants`);
        }
        
        for (const nested of allElements) {
            // Check ALL elements that have shadow root, not just custom elements
            if (nested.shadowRoot) {
                if (debug) {
                    console.log(`[getInnerFormControl] Recursing into ${nested.tagName} (has shadow)`);
                }
                const found = getInnerFormControl(nested, maxDepth - 1, visited, debug);
                if (found) {
                    return found;
                }
            }
        }
    }
    
    // Also search light DOM children (for slotted content)
    // This is crucial for custom elements that use slots
    if (element.children && element.children.length > 0) {
        if (debug) {
            console.log(`[getInnerFormControl] Searching ${element.children.length} light DOM children`);
            for (let i = 0; i < Math.min(5, element.children.length); i++) {
                const child = element.children[i];
                console.log(`[getInnerFormControl]   Child[${i}]: ${child.tagName} (isSupportedControl: ${isSupportedControl(child)})`);
            }
        }
        
        for (const child of element.children) {
            // First check if this child itself is a supported control
            if (isSupportedControl(child)) {
                if (debug) console.log(`[getInnerFormControl] Found control in light DOM: ${child.tagName}`);
                return child;
            }
            
            // Then recurse into this child
            const found = getInnerFormControl(child, maxDepth - 1, visited, debug);
            if (found) {
                return found;
            }
        }
    }

    if (debug) console.log('[getInnerFormControl] Nothing found');
    return null;
}

function querySelectorDeep(rootOrSelector, selectorMaybe) {
    let root;
    let selector;

    if (typeof rootOrSelector === 'string' && selectorMaybe === undefined) {
        root = document;
        selector = rootOrSelector;
    } else {
        root = rootOrSelector || document;
        selector = selectorMaybe;
    }

    if (!root || !selector) {
        return null;
    }

    const selectors = selector.split(',').map((item) => item.trim()).filter(Boolean);
    if (selectors.length === 0) {
        return null;
    }

    const seen = new Set();

    const visit = (node) => {
        if (!node || seen.has(node)) {
            return null;
        }
        seen.add(node);

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (selectors.some((sel) => element.matches?.(sel))) {
                return element;
            }

            if (element.shadowRoot) {
                const matchInShadow = visit(element.shadowRoot);
                if (matchInShadow) {
                    return matchInShadow;
                }
            }

            if (element.tagName === 'SLOT') {
                let assignedNodes = [];
                try {
                    assignedNodes = element.assignedNodes({flatten: true});
                } catch {
                    assignedNodes = element.assignedNodes();
                }
                for (const assigned of assignedNodes) {
                    const matchInAssigned = visit(assigned);
                    if (matchInAssigned) {
                        return matchInAssigned;
                    }
                }
            }

            const children = element.children;
            for (let i = 0; i < children.length; i += 1) {
                const childMatch = visit(children[i]);
                if (childMatch) {
                    return childMatch;
                }
            }
        } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.DOCUMENT_NODE) {
            const childNodes = node.childNodes;
            for (let i = 0; i < childNodes.length; i += 1) {
                const fragmentMatch = visit(childNodes[i]);
                if (fragmentMatch) {
                    return fragmentMatch;
                }
            }
        }

        return null;
    };

    return visit(root);
}

function querySelectorAllDeep(rootOrSelector, selectorMaybe) {
    let root;
    let selector;

    if (typeof rootOrSelector === 'string' && selectorMaybe === undefined) {
        root = document;
        selector = rootOrSelector;
    } else {
        root = rootOrSelector || document;
        selector = selectorMaybe;
    }

    if (!root || !selector) {
        return [];
    }

    const selectors = selector.split(',').map((item) => item.trim()).filter(Boolean);
    if (selectors.length === 0) {
        return [];
    }

    const results = [];
    const seen = new Set();

    const visit = (node) => {
        if (!node || seen.has(node)) {
            return;
        }
        seen.add(node);

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (selectors.some((sel) => element.matches?.(sel))) {
                results.push(element);
            }

            if (element.shadowRoot) {
                visit(element.shadowRoot);
            }

            if (element.tagName === 'SLOT') {
                let assignedNodes = [];
                try {
                    assignedNodes = element.assignedNodes({flatten: true});
                } catch {
                    assignedNodes = element.assignedNodes();
                }
                assignedNodes.forEach((assigned) => visit(assigned));
            }

            const children = element.children;
            for (let i = 0; i < children.length; i += 1) {
                visit(children[i]);
            }
        } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.DOCUMENT_NODE) {
            const childNodes = node.childNodes;
            for (let i = 0; i < childNodes.length; i += 1) {
                visit(childNodes[i]);
            }
        }
    };

    visit(root);
    return results;
}

function augmentFieldLabel(label) {
    if (!label) {
        return label;
    }
    if (label === COVER_LETTER_LABEL) {
        return `${label}${COVER_LETTER_SUFFIX}`;
    }
    return label;
}

function describeNode(node) {
    if (!node) {
        return null;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        return {
            nodeType: 'text',
            text: (node.textContent || '').trim().slice(0, 60)
        };
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return {
            nodeType: node.nodeType
        };
    }

    const element = node;
    return {
        nodeType: 'element',
        tag: element.tagName,
        id: element.id || null,
        classes: element.classList?.value || null,
        hasShadowRoot: !!element.shadowRoot,
        slot: element.slot || null,
        dataTest: element.getAttribute?.('data-test') || null,
        name: element.getAttribute?.('name') || null
    };
}

function traceNodeHierarchy(node, maxDepth = 20) {
    const chain = [];
    let current = node;
    let depth = 0;

    while (current && depth < maxDepth) {
        chain.push({
            relation: depth === 0 ? 'self' : 'parent',
            node: describeNode(current)
        });

        const root = current.getRootNode?.();
        const host = root?.host;
        if (host) {
            chain.push({
                relation: 'host',
                node: describeNode(host)
            });
        }

        if (current.assignedSlot) {
            chain.push({
                relation: 'assignedSlot',
                node: describeNode(current.assignedSlot)
            });
        }

        if (current.parentElement) {
            current = current.parentElement;
        } else if (host && host !== current) {
            current = host;
        } else {
            current = current.parentNode && current.parentNode !== current ? current.parentNode : null;
        }

        depth += 1;
    }

    return chain;
}

function getHeaderHeight() {
    const header = document.querySelector('header, .header, [role="banner"]');
    return (header ? header.clientHeight : 0) + 90;
}

function isAnyIframeVisible() {
    const iframes = document.querySelectorAll('iframe');
    return Array.from(iframes).some((iframe) => {
        const rect = iframe.getBoundingClientRect();
        const isVisible = (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top + rect.height > 0 &&
            rect.left + rect.width > 0 &&
            rect.bottom > 0 &&
            rect.right > 0
        );
        const style = window.getComputedStyle(iframe);
        return isVisible && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
}

function findFileInputWithin(element) {
    if (!element) {
        return null;
    }

    if (element.matches && element.matches('input[type="file"]')) {
        return element;
    }

    if (element.querySelector) {
        const direct = element.querySelector('input[type="file"]');
        if (direct) {
            return direct;
        }
    }

    const shadowRoot = element.shadowRoot;
    if (!shadowRoot) {
        return null;
    }

    const shadowInput = shadowRoot.querySelector('input[type="file"]');
    if (shadowInput) {
        return shadowInput;
    }

    const slots = shadowRoot.querySelectorAll('slot');
    for (const slot of slots) {
        if (typeof slot.assignedElements !== 'function') {
            continue;
        }
        let assigned = [];
        try {
            assigned = slot.assignedElements({flatten: true});
        } catch {
            assigned = slot.assignedElements();
        }
        for (const assignedNode of assigned) {
            const nested = findFileInputWithin(assignedNode);
            if (nested) {
                return nested;
            }
        }
    }

    return null;
}

function collectFileInputsFromNode(node, results, visited) {
    if (!node || visited.has(node)) {
        return;
    }

    visited.add(node);

    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        if (typeof el.matches === 'function' && el.matches('input[type="file"]')) {
            results.push(el);
        }

        if (el.shadowRoot) {
            collectFileInputsFromNode(el.shadowRoot, results, visited);
        }

        if (el.tagName === 'SLOT') {
            let assignedNodes = [];
            try {
                assignedNodes = el.assignedNodes({flatten: true});
            } catch {
                assignedNodes = el.assignedNodes();
            }
            for (const assigned of assignedNodes) {
                collectFileInputsFromNode(assigned, results, visited);
            }
        }
    }

    const childNodes = node.childNodes || [];
    for (const child of childNodes) {
        collectFileInputsFromNode(child, results, visited);
    }
}

function scoreFileInput(input) {
    let score = 0;
    const dropzone = input.closest('spl-dropzone');
    const dataTest = dropzone?.getAttribute?.('data-test') || '';

    if (dropzone) {
        score += 10;
    }

    if (dataTest.includes('resume')) {
        score += 10;
    }

    if (dropzone?.closest('[data-test="easy-apply-container"]')) {
        score += 5;
    }

    if (dropzone?.closest('[data-test="resume-upload-container"]')) {
        score += 5;
    }

    if (input.closest('[data-test="avatar"]')) {
        score -= 20;
    }

    return score;
}

function getDropzoneHostForInput(input) {
    if (!input) {
        return null;
    }

    if (typeof input.closest === 'function') {
        const host = input.closest('spl-dropzone');
        if (host) {
            return host;
        }
    }

    let root = input.getRootNode ? input.getRootNode() : null;
    while (root) {
        const host = root.host;
        if (host && typeof host.matches === 'function' && host.matches('spl-dropzone')) {
            return host;
        }
        root = host && host.getRootNode ? host.getRootNode() : null;
}

    return null;
}

function getDropzoneStateSnapshot(dropzone, fileInput) {
    const labelTexts = new Set();
    const filesAttr = dropzone?.getAttribute ? dropzone.getAttribute('files') || '' : '';
    const filesCount = fileInput?.files?.length || 0;
    let hasFileNameElement = false;

    const shadow = dropzone?.shadowRoot;
    if (shadow) {
        const labelNodes = shadow.querySelectorAll('.c-spl-dropzone-label, .c-spl-dropzone-label-browse, [data-test="file-name"], .file-name, .uploaded, [id*="dropzone-label"]');
        labelNodes.forEach((node) => {
            const text = node.textContent?.trim().toLowerCase();
            if (text) {
                labelTexts.add(text);
            }
        });
        if (shadow.querySelector('[data-test="file-name"], .c-spl-dropzone-file-name, .file-name, .uploaded')) {
            hasFileNameElement = true;
        }
    }

    return {
        filesAttr,
        filesCount,
        labelTexts,
        hasFileNameElement
    };
}

async function waitForDropzoneUploadConfirmation(dropzone, fileInput, initialSnapshot, attempts = 30, delay = 500) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const state = getDropzoneStateSnapshot(dropzone, fileInput);

        const fileCountIncreased = state.filesCount > initialSnapshot.filesCount;
        const attrChanged = state.filesAttr && state.filesAttr !== '[]' && state.filesAttr !== initialSnapshot.filesAttr;
        const labelChanged = [...state.labelTexts].some((text) => !initialSnapshot.labelTexts.has(text));
        const hasFileNameElement = state.hasFileNameElement;

        if (fileCountIncreased || attrChanged || labelChanged || hasFileNameElement) {
            console.log('[SmartRecruiters] Resume upload confirmed', {
                attempt,
                filesCount: state.filesCount,
                filesAttr: state.filesAttr,
                labelTexts: [...state.labelTexts]
            });
            return true;
        }

        if (attempt === 1 || attempt % 5 === 0) {
            console.log('[SmartRecruiters] Waiting for resume upload confirmation', {
                attempt,
                attempts,
                filesCount: state.filesCount,
                filesAttr: state.filesAttr,
                labelTexts: [...state.labelTexts]
            });
        }

        await wait(delay);
    }

    const finalState = getDropzoneStateSnapshot(dropzone, fileInput);
    console.warn('[SmartRecruiters] Resume upload confirmation timed out', {
        initial: {
            filesCount: initialSnapshot.filesCount,
            filesAttr: initialSnapshot.filesAttr,
            labelTexts: [...initialSnapshot.labelTexts]
        },
        final: {
            filesCount: finalState.filesCount,
            filesAttr: finalState.filesAttr,
            labelTexts: [...finalState.labelTexts]
        }
    });

    return false;
}

function findResumeFileInput() {
    const dropzoneSelectors = [
        'spl-dropzone[data-test="resume-upload"]',
        'spl-dropzone[data-test="apply-with-resume-container"]',
        'spl-dropzone[enablefiledeletions]'
    ];

    for (const selector of dropzoneSelectors) {
        const dropzone = document.querySelector(selector);
        const input = findFileInputWithin(dropzone);
        if (input) {
            return input;
        }
    }

    const collected = [];
    const visited = new Set();
    collectFileInputsFromNode(document, collected, visited);

    const candidates = collected.filter((input) => {
        if (!input.isConnected) {
            return false;
        }
        if (input.closest('[data-test="avatar"]')) {
            return false;
        }
        const accept = (input.getAttribute('accept') || '').toLowerCase();
        if (!accept) {
            return true;
        }
        if (accept.includes('.pdf') || accept.includes('.doc') || accept.includes('application/')) {
            return true;
        }
        return false;
    }).sort((a, b) => scoreFileInput(b) - scoreFileInput(a));

    return candidates[0] || null;
}

async function waitForResumeFileInput(attempts = 12, delay = 500) {
    for (let i = 0; i < attempts; i++) {
        const input = findResumeFileInput();
        if (input) {
            console.log('[SmartRecruiters] Resume file input found', {attempt: i + 1});
            return input;
        }
        if (i === 0 || (i + 1) % 5 === 0) {
            console.log('[SmartRecruiters] Resume file input not found yet', {attempt: i + 1, attempts});
        }
        await wait(delay);
    }
    console.warn('[SmartRecruiters] Resume file input not found after retries', {attempts});
    return null;
}

function cssEscapeIdentifier(value) {
    if (!value) {
        return '';
    }
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_\-]/g, match => `\\${match}`);
}

function cleanLabelText(text) {
    if (!text) {
        return '';
    }
    return text
        .replace(/Value is required/gi, '')
        .replace(/This field is required/gi, '')
        .replace(/\*/g, '')
        // Normalize typographic apostrophes/quotes to ASCII equivalents
        .replace(/[\u2018\u2019\u02BC\u02B9]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeMatchValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const normalized = normalizeMatchValue(item);
            if (normalized) {
                return normalized;
            }
        }
        return '';
    }
    if (typeof value === 'object') {
        const candidates = ['label', 'value', 'name', 'title', 'text'];
        for (const key of candidates) {
            const candidateValue = value[key];
            if (candidateValue !== undefined && candidateValue !== null) {
                const normalized = normalizeMatchValue(candidateValue);
                if (normalized) {
                    return normalized;
                }
            }
        }
        return '';
    }
    return cleanLabelText(String(value)).toLowerCase();
}

function findHostAncestor(element, selector) {
    if (!element || !selector) {
        return null;
    }

    const selectorList = selector.split(',').map((item) => item.trim()).filter(Boolean);
    if (selectorList.length === 0) {
        return null;
    }

    const visited = new Set();
    const queue = [element];
    const steps = [];
    let iterations = 0;

    while (queue.length > 0 && iterations < 200) {
        const current = queue.shift();
        if (!current || visited.has(current)) {
            continue;
        }

        visited.add(current);
        iterations += 1;

        steps.push({
            phase: 'inspect',
            node: describeNode(current)
        });

        if (current.nodeType === Node.ELEMENT_NODE && selectorList.some((sel) => sel && current.matches(sel))) {
            return current;
        }

        const root = current.getRootNode?.();
        if (root?.host && !visited.has(root.host)) {
            queue.push(root.host);
            steps.push({phase: 'queueHost', node: describeNode(root.host)});
        }

        if (current.assignedSlot && !visited.has(current.assignedSlot)) {
            queue.push(current.assignedSlot);
            steps.push({phase: 'queueAssignedSlot', node: describeNode(current.assignedSlot)});
        }

        if (current.parentElement && !visited.has(current.parentElement)) {
            queue.push(current.parentElement);
            steps.push({phase: 'queueParentElement', node: describeNode(current.parentElement)});
        }

        if (current.parentNode && current.parentNode !== current && !visited.has(current.parentNode)) {
            queue.push(current.parentNode);
            steps.push({phase: 'queueParentNode', node: describeNode(current.parentNode)});
        }

        if (current instanceof ShadowRoot && current.host && !visited.has(current.host)) {
            queue.push(current.host);
            steps.push({phase: 'queueShadowRootHost', node: describeNode(current.host)});
        }
    }

    console.warn('[SmartRecruiters] Ancestor search failed', {
        selector,
        start: describeNode(element),
        steps: steps.slice(0, 200)
    });

    return null;
}

function parseLabelElement(element) {
    if (!element) {
        return {label: null, requiredHint: false};
    }
    const text = cleanLabelText(element.textContent || '');
    if (!text) {
        return {label: null, requiredHint: false};
    }
    const requiredHint = !!(element.querySelector?.('[aria-hidden="true"],[data-required="true"],.required-indicator') || /\*/.test(element.textContent || ''));
    return {label: text, requiredHint};
}

function findLabelInDocument(control) {
    const id = control?.id;
    if (id) {
        const selector = `[for="${cssEscapeIdentifier(id)}"]`;
        const labelEl = document.querySelector(selector);
        const info = parseLabelElement(labelEl);
        if (info.label) {
            return info;
        }
    }
    if (typeof control.closest === 'function') {
        const parentLabel = control.closest('label');
        const info = parseLabelElement(parentLabel);
        if (info.label) {
            return info;
        }
    }
    const ariaLabelledBy = control?.getAttribute?.('aria-labelledby');
    if (ariaLabelledBy) {
        const ids = ariaLabelledBy.split(/\s+/).filter(Boolean);
        const pieces = ids
            .map((labelId) => document.getElementById(labelId))
            .filter((node) => !!node)
            .map((node) => cleanLabelText(node.textContent || ''))
            .filter((text) => !!text);
        if (pieces.length > 0) {
            return {label: pieces.join(' ').trim(), requiredHint: false};
        }
    }
    return {label: null, requiredHint: false};
}

function findLabelInHost(host) {
    if (!host) {
        return {label: null, requiredHint: false};
    }

    const requiredHint = !!(host.hasAttribute?.('required') || host.getAttribute?.('aria-required') === 'true' || host.dataset?.required === 'true');

    if (typeof host.getAttribute === 'function') {
        const attrLabel = host.getAttribute('label') || host.getAttribute('aria-label') || host.dataset?.label;
        if (attrLabel) {
            return {
                label: cleanLabelText(attrLabel),
                requiredHint
            };
        }
    }

    const selectors = [
        'label[slot="label"]',
        '[slot="label"]',
        '.c-spl-form-field-label-wrapper',
        '.c-spl-form-field-label',
        'spl-typography-label',
        'legend',
        '[slot="label-content"]',
        '.question-label',
        '[data-test="question-label"]'
    ];

    for (const source of [host, host?.shadowRoot]) {
        if (!source) {
            continue;
        }
        for (const selector of selectors) {
            const labelEl = source.querySelector?.(selector);
            const info = parseLabelElement(labelEl);
            if (info.label) {
                return {
                    label: info.label,
                    requiredHint: requiredHint || info.requiredHint
                };
            }
        }
    }

    const slotLabel = extractLabelFromSlots(host) || extractLabelFromSlots(host.shadowRoot);
    if (slotLabel) {
        return {
            label: slotLabel,
            requiredHint
        };
    }

    return {label: null, requiredHint};
}

function extractFieldLabelData(control) {
    const visitedHosts = new Set();
    let current = control;

    while (current) {
        const root = current.getRootNode?.();
        if (!root) {
            break;
        }

        if (root.host && !visitedHosts.has(root.host)) {
            const hostInfo = findLabelInHost(root.host);
            visitedHosts.add(root.host);
            if (hostInfo.label) {
                return hostInfo;
            }
            current = root.host;
            continue;
        }

        if (root instanceof Document) {
            const info = findLabelInDocument(control);
            if (info.label) {
                return info;
            }
            break;
        }

        if (!root.host && current.parentElement) {
            current = current.parentElement;
        } else {
            break;
        }
    }

    const fallbackLabel = control?.getAttribute?.('aria-label') || control?.getAttribute?.('placeholder');
    if (fallbackLabel) {
        return {label: cleanLabelText(fallbackLabel), requiredHint: false};
    }

    return {label: null, requiredHint: false};
}

function isControlRequired(control) {
    if (!control) {
        return false;
    }

    if (control.required || control.hasAttribute?.('required') || control.getAttribute?.('aria-required') === 'true') {
        return true;
    }

    const visitedHosts = new Set();
    let current = control;
    while (current) {
        const root = current.getRootNode?.();
        const host = root?.host;
        if (!host || visitedHosts.has(host)) {
            break;
        }
        if (host.hasAttribute?.('required') || host.getAttribute?.('aria-required') === 'true' || host.classList?.contains?.('required')) {
            return true;
        }
        if (host.shadowRoot) {
            const indicator = host.shadowRoot.querySelector('[aria-hidden="true"], .required-indicator, [data-required="true"]');
            if (indicator && /\*/.test(indicator.textContent || '')) {
                return true;
            }
        }
        visitedHosts.add(host);
        current = host;
    }

    return false;
}

function isSupportedControl(element) {
    if (!element || !element.tagName) {
        return false;
    }

    const tag = element.tagName.toLowerCase();

    // SmartRecruiters web components that act as controls
    if (tag === 'spl-radio' || tag === 'spl-checkbox') {
        return true;
    }

    if (tag === 'textarea' || tag === 'select') {
        return true;
    }

    if (tag !== 'input') {
        return false;
    }

    const type = (element.getAttribute('type') || 'text').toLowerCase();
    if (['hidden', 'file', 'submit', 'button', 'reset', 'image'].includes(type)) {
        return false;
    }

    return true;
}

function collectFormControls(root) {
    const results = [];
    const seen = new Set();

    function traverse(node) {
        if (!node || seen.has(node)) {
            return;
        }
        seen.add(node);

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (isSupportedControl(element)) {
                results.push(element);
            }
            if (element.shadowRoot) {
                traverse(element.shadowRoot);
            }
            const children = element.children;
            for (let i = 0; i < children.length; i += 1) {
                traverse(children[i]);
            }
        } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.DOCUMENT_NODE) {
            const childNodes = node.childNodes;
            for (let i = 0; i < childNodes.length; i += 1) {
                traverse(childNodes[i]);
            }
        }
    }

    traverse(root);
    return results;
}

function getControlType(element) {
    if (!element || !element.tagName) {
        return null;
    }

    const tag = element.tagName.toLowerCase();
    
    // SmartRecruiters web components
    if (tag === 'spl-radio') {
        return 'radio';
    }
    if (tag === 'spl-checkbox') {
        return 'checkbox';
    }
    
    if (tag === 'textarea') {
        return 'textarea';
    }
    if (tag === 'select') {
        return 'select';
    }
    if (tag === 'input') {
        const type = (element.getAttribute('type') || 'text').toLowerCase();
        if (['hidden', 'file', 'submit', 'reset', 'button', 'image'].includes(type)) {
            return null;
        }
        if (type === 'radio' || type === 'checkbox') {
            return type;
        }
        return 'text';
    }
    return null;
}

function findOptionLabel(control) {
    if (!control) {
        return null;
    }

    const id = control.id;
    if (id) {
        const selector = `[for="${cssEscapeIdentifier(id)}"]`;
        const root = control.getRootNode?.();
        if (root?.querySelector) {
            const labelEl = root.querySelector(selector);
            const info = parseLabelElement(labelEl);
            if (info.label) {
                return info.label;
            }
        }
        const docLabel = document.querySelector(selector);
        const info = parseLabelElement(docLabel);
        if (info.label) {
            return info.label;
        }
    }

    if (typeof control.closest === 'function') {
        const parentLabel = control.closest('label');
        const info = parseLabelElement(parentLabel);
        if (info.label) {
            return info.label;
        }
    }

    const host = findHostAncestor(control, 'spl-radio, spl-checkbox, spl-select-option, spl-option, spl-autocomplete-option');
    if (host) {
        const attrLabel = host.getAttribute?.('label') || host.getAttribute?.('aria-label') || host.dataset?.label;
        if (attrLabel) {
            const cleaned = cleanLabelText(attrLabel);
            if (cleaned) {
                return cleaned;
            }
        }

        const hostSlotLabel = extractLabelFromSlots(host) || extractLabelFromSlots(host.shadowRoot);
        if (hostSlotLabel) {
            return hostSlotLabel;
        }

        const selectors = [
            'label[slot="label"]',
            '[slot="label"]',
            '.c-spl-radio__label',
            '.c-spl-checkbox__label',
            '.c-spl-select-option__label',
            '.c-spl-option__label',
            '.c-spl-autocomplete-option__label'
        ];

        for (const selector of selectors) {
            const node = host.shadowRoot?.querySelector(selector) || host.querySelector?.(selector);
            if (node) {
                const info = parseLabelElement(node);
                if (info.label) {
                    return info.label;
                }
            }
        }
    }

    const ariaLabel = control.getAttribute?.('aria-label');
    if (ariaLabel) {
        return cleanLabelText(ariaLabel);
    }

    const value = control.value;
    if (value) {
        return cleanLabelText(value);
    }

    return null;
}

function collectOptionCandidates(control) {
    if (!control) {
        return [];
    }

    const candidates = new Set();

    const addCandidate = (val) => {
        if (val === null || val === undefined) {
            return;
        }
        const cleaned = cleanLabelText(String(val));
        if (cleaned) {
            candidates.add(cleaned);
        }
    };

    addCandidate(control.value);
    addCandidate(control.getAttribute?.('value'));
    addCandidate(control.getAttribute?.('data-value'));
    addCandidate(control.getAttribute?.('aria-label'));
    addCandidate(control.getAttribute?.('title'));
    addCandidate(control.dataset?.label);
    addCandidate(control.dataset?.value);

    const optionLabel = findOptionLabel(control);
    if (optionLabel) {
        candidates.add(optionLabel);
    }

    const host = findHostAncestor(control, 'spl-radio, spl-checkbox, spl-select-option, spl-option, spl-autocomplete-option');
    if (host) {
        addCandidate(host.getAttribute?.('value'));
        addCandidate(host.getAttribute?.('data-value'));
        addCandidate(host.dataset?.value);
        addCandidate(host.getAttribute?.('label'));
        addCandidate(host.getAttribute?.('aria-label'));
        addCandidate(host.dataset?.label);

        const slotLabel = extractLabelFromSlots(host) || extractLabelFromSlots(host.shadowRoot);
        if (slotLabel) {
            candidates.add(slotLabel);
        }

        const selectors = [
            'label[slot="label"]',
            '[slot="label"]',
            '.c-spl-radio__label',
            '.c-spl-checkbox__label',
            '.c-spl-select-option__label',
            '.c-spl-option__label',
            '.c-spl-autocomplete-option__label'
        ];

        for (const selector of selectors) {
            const node = host.shadowRoot?.querySelector(selector) || host.querySelector?.(selector);
            if (node) {
                const info = parseLabelElement(node);
                if (info.label) {
                    candidates.add(info.label);
                }
            }
        }
    }

    return Array.from(candidates);
}

function getSmartRecruitersDropdownHost(element) {
    const phoneDropdownHost = getPhoneCountryDropdownHost(element);
    if (phoneDropdownHost) {
        return phoneDropdownHost;
    }

    let current = element;

    while (current) {
        if (current.closest) {
            const direct = current.closest('spl-dropdown');
            if (direct) {
                return direct;
            }
        }

        const root = current.getRootNode ? current.getRootNode() : null;
        const host = root?.host;
        if (!host) {
            break;
        }

        if (host.matches?.('spl-dropdown')) {
            return host;
        }

        current = host;
    }

    return null;
}

function isSmartRecruitersDropdownInput(element) {
    if (!element) {
        return false;
    }

    if (element.getAttribute?.('role') === 'combobox') {
        return true;
    }

    if (element.getAttribute?.('aria-haspopup') === 'true') {
        return true;
    }

    if (getSmartRecruitersDropdownHost(element)) {
        return true;
    }

    return false;
}

function isPhoneNumberLabel(label) {
    if (!label) {
        return false;
    }
    const normalized = label.toLowerCase().replace(/\*/g, '').trim();
    const patterns = [
        'phone number',
        'phone no',
        'phone',
        'telefonnummer',
        'numéro de téléphone',
        'numero de telefone',
        'número de teléfono',
        'numero de telefono',
        'teléfono',
        'telefono',
        'téléphone',
        'telephone',
        'handynummer',
        'mobile number',
        'cell phone',
        'contact number'
    ];
    return patterns.some((pattern) => normalized === pattern || normalized.includes(pattern));
}

function normalizeDialCode(code) {
    const digits = String(code || '').replace(/\D/g, '');
    return digits ? `+${digits}` : '';
}

function getProfileDialCode(profile) {
    return normalizeDialCode(profile?.phoneCountryCode || profile?.general?.phoneCountryCode || '');
}

function normalizePhoneCountryText(text) {
    return String(text || '').replace(/\s+/g, '');
}

function extractDialCodeFromPhoneCountryText(text) {
    const normalized = normalizePhoneCountryText(text);
    const match = normalized.match(/\+\d{1,4}/);
    return match ? match[0] : '';
}

function phoneCountryOptionMatches(optionText, dialCode) {
    const text = String(optionText || '').trim();
    if (!text || !dialCode) {
        return false;
    }
    const codeDigits = String(dialCode).replace(/\D/g, '');
    if (!codeDigits) {
        return false;
    }
    const normalizedText = normalizePhoneCountryText(text);

    // +91 must not match as a substring of +591, +910, etc.
    if (new RegExp(`\\+${codeDigits}(?!\\d)`).test(normalizedText)) {
        return true;
    }

    // Parenthesized form: India (+91)
    if (new RegExp(`\\(\\+${codeDigits}\\)`).test(text)) {
        return true;
    }

    // Trailing code token without +: "India 91"
    if (new RegExp(`(?:^|[\\s,(])${codeDigits}(?!\\d)(?:[\\s),]|$)`).test(text)) {
        return true;
    }

    return false;
}

function readSmartRecruitersPhoneCountryDisplay(countryElement) {
    if (!countryElement) {
        return '';
    }
    const value = countryElement.value?.trim();
    if (value && !/search by country|region or code/i.test(value)) {
        return value;
    }

    const phoneHost = findHostAncestor(countryElement, 'spl-phone-field, spl-phone, sr-question-field-phone-number');
    if (phoneHost) {
        const deepText = getElementDeepText(phoneHost).replace(/\s+/g, ' ').trim();
        const dialMatch = deepText.match(/\+\d{1,4}/);
        if (dialMatch) {
            return dialMatch[0];
        }
        if (deepText && !/search by country|region or code/i.test(deepText)) {
            return deepText.slice(0, 120);
        }
    }

    const host = getSmartRecruitersDropdownHost(countryElement) || countryElement.getRootNode?.()?.host;
    if (host) {
        const deepText = getElementDeepText(host);
        if (deepText && !/search by country|region or code/i.test(deepText)) {
            return deepText;
        }
    }
    return countryElement.getAttribute?.('aria-label')?.trim() || value || '';
}

function readCommittedPhoneDialCode(countryElement) {
    const toggle = getPhoneCountryToggleButton(countryElement);
    if (toggle) {
        const toggleDialCode = extractDialCodeFromPhoneCountryText(getElementDeepText(toggle));
        if (toggleDialCode) {
            return toggleDialCode;
        }
    }

    const phoneHost = findHostAncestor(countryElement, 'spl-phone-field, spl-phone, sr-question-field-phone-number');
    if (!phoneHost) {
        return '';
    }

    const candidates = [];
    const nodes = querySelectorAllDeep(phoneHost, 'button, [role="button"]');
    for (const node of nodes) {
        const text = getElementDeepText(node).replace(/\s+/g, ' ').trim();
        if (!text || text.length > 28 || /search by country/i.test(text)) {
            continue;
        }
        const dialCode = extractDialCodeFromPhoneCountryText(text);
        if (dialCode) {
            candidates.push({ dialCode, text, len: text.length });
        }
    }

    if (!candidates.length) {
        return '';
    }

    candidates.sort((a, b) => a.len - b.len);
    return candidates[0].dialCode;
}

function getPhoneCountryToggleButton(countryElement) {
    const phoneHost = findHostAncestor(countryElement, 'spl-phone-field, spl-phone, sr-question-field-phone-number');
    if (!phoneHost) {
        return null;
    }

    const buttons = querySelectorAllDeep(phoneHost, 'button, [role="button"]');
    for (const button of buttons) {
        const text = normalizePhoneCountryText(getElementDeepText(button));
        if (/^\+\d{1,4}$/.test(text)) {
            return button;
        }
    }

    return getPhoneCountryDropdownHost(countryElement);
}

function findPhoneCountryMenuSearchInput(menuId, countryElement, phoneHost) {
    if (menuId) {
        const menu = document.getElementById(menuId);
        if (menu) {
            const menuInput = querySelectorDeep(menu, 'input[type="text"], input[type="search"], [role="combobox"]');
            if (menuInput) {
                return menuInput;
            }
        }
    }

    const openTrigger = getPhoneCountryOpenTrigger(countryElement);
    return findPhoneCountrySearchInput(countryElement, openTrigger, phoneHost) || openTrigger;
}

function debugPhoneHostState(countryElement, tag) {
    const phoneHost = findHostAncestor(countryElement, 'spl-phone-field, spl-phone, sr-question-field-phone-number');
    if (!phoneHost) {
        return;
    }
    const shortTexts = [];
    const nodes = querySelectorAllDeep(phoneHost, 'button, span, div, input, [role="button"]');
    for (const node of nodes) {
        const text = getElementDeepText(node).replace(/\s+/g, ' ').trim();
        if (text && text.length <= 28) {
            shortTexts.push({ tag: node.tagName, text });
        }
    }
    debugLog('[SR-Phone] host state', {
        tag,
        committed: readCommittedPhoneDialCode(countryElement),
        shortTexts: shortTexts.slice(0, 12)
    });
}

function isSmartRecruitersPhoneCountrySet(countryElement, dialCode) {
    if (!countryElement || !dialCode) {
        return false;
    }

    const committedDialCode = readCommittedPhoneDialCode(countryElement);
    return !!(committedDialCode && phoneCountryOptionMatches(committedDialCode, dialCode));
}

function isLikelyPhoneCountryControl(element) {
    if (!element) {
        return false;
    }
    if (element.type === 'tel' || element.getAttribute?.('inputmode') === 'tel') {
        return false;
    }
    if (element.tagName?.toLowerCase() === 'select') {
        return true;
    }
    return isSmartRecruitersDropdownInput(element);
}

function isLikelyPhoneNumberControl(element) {
    if (!element) {
        return false;
    }
    if (element.type === 'tel' || element.getAttribute?.('inputmode') === 'tel') {
        return true;
    }
    return !isLikelyPhoneCountryControl(element);
}

function findPhoneCountryControlNear(numberInput) {
    if (!numberInput) {
        return null;
    }

    const hostSelectors = [
        'sr-question-field-phone-number',
        'sr-question-field-phone',
        'spl-phone',
        'oc-question-field',
        '[data-test*="phone"]'
    ];

    for (const selector of hostSelectors) {
        const host = findHostAncestor(numberInput, selector);
        if (!host) {
            continue;
        }
        const candidates = querySelectorAllDeep(host, 'input, select, [role="combobox"]');
        for (const candidate of candidates) {
            if (candidate === numberInput) {
                continue;
            }
            if (isLikelyPhoneCountryControl(candidate)) {
                return candidate;
            }
        }
    }

    let parent = numberInput.parentElement || numberInput.getRootNode?.()?.host;
    for (let depth = 0; depth < 10 && parent; depth += 1) {
        const searchRoot = parent.shadowRoot || parent;
        const candidates = querySelectorAllDeep(searchRoot, 'input, select, [role="combobox"]');
        for (const candidate of candidates) {
            if (candidate === numberInput) {
                continue;
            }
            if (isLikelyPhoneCountryControl(candidate)) {
                return candidate;
            }
        }
        parent = parent.parentElement || parent.getRootNode?.()?.host;
    }

    return null;
}

function getDialCodeCountrySearchName(dialCode) {
    const codeDigits = String(dialCode || '').replace(/\D/g, '');
    const namesByCode = {
        '91': 'India',
        '61': 'Australia',
        '49': 'Germany',
        '44': 'United Kingdom',
        '64': 'New Zealand',
        '33': 'France',
        '1': 'United States'
    };
    return namesByCode[codeDigits] || '';
}

function buildPhoneCountryTargetLabels(dialCode, profile) {
    const codeDigits = String(dialCode || '').replace(/\D/g, '');
    const profileCountry = String(profile?.country || profile?.general?.country || '').trim();
    const mappedCountry = getDialCodeCountrySearchName(dialCode);
    const country = profileCountry || mappedCountry;
    const labels = [];

    if (country) {
        labels.push(`${country} +${codeDigits}`);
        labels.push(country);
    }
    if (codeDigits === '1') {
        labels.push('United States');
    }
    labels.push(dialCode);
    if (codeDigits) {
        labels.push(`+${codeDigits}`);
    }
    return labels.filter((label, index, arr) => label && arr.indexOf(label) === index);
}

function getPhoneCountryDropdownHost(countryElement) {
    const phoneHost = findHostAncestor(countryElement, 'spl-phone-field, spl-phone, sr-question-field-phone-number');
    if (!phoneHost) {
        return null;
    }
    const dropdowns = querySelectorAllDeep(phoneHost, 'spl-dropdown');
    return dropdowns[0] || null;
}

async function selectSmartRecruitersPhoneCountryCode(countryElement, dialCode, profile = null, numberElement = null) {
    if (!countryElement || !dialCode) {
        return false;
    }

    const phoneHost = findHostAncestor(countryElement, 'spl-phone-field, spl-phone, sr-question-field-phone-number');
    const toggleButton = getPhoneCountryToggleButton(countryElement);
    const dropdownHostEl = getPhoneCountryDropdownHost(countryElement);
    const openTrigger = getPhoneCountryOpenTrigger(countryElement);
    const menuId = openTrigger.getAttribute?.('aria-controls') || dropdownHostEl?.getAttribute?.('aria-controls');
    const activeInput = findPhoneCountryMenuSearchInput(menuId, countryElement, phoneHost);
    const searchTerms = buildPhoneCountryTargetLabels(dialCode, profile);

    debugLog('[SR-Phone] opening country picker', {
        dialCode,
        triggerTag: openTrigger?.tagName,
        toggleTag: toggleButton?.tagName,
        searchTag: activeInput?.tagName,
        menuId,
        hasDropdownHost: !!dropdownHostEl,
        searchTerms
    });
    debugPhoneHostState(countryElement, 'before');

    for (const term of searchTerms) {
        const desiredLabel = term.includes('+')
            ? term
            : (term === 'United States' ? 'United States +1' : term);
        const typingTerm = desiredLabel.replace(/\s*\+\d+\s*$/, '').trim() || desiredLabel;

        (toggleButton || dropdownHostEl || openTrigger).click?.();
        await wait(500);

        debugLog('[SR-Phone] typing and selecting', { dialCode, desiredLabel, typingTerm });
        activeInput.focus?.();
        activeInput.click?.();
        await replayTypingForDropdown(activeInput, typingTerm);
        await wait(1200);

        const arrowDown = { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, composed: true };
        activeInput.dispatchEvent?.(new KeyboardEvent('keydown', arrowDown));
        activeInput.dispatchEvent?.(new KeyboardEvent('keyup', arrowDown));
        await wait(200);

        const enterInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true };
        activeInput.dispatchEvent?.(new KeyboardEvent('keydown', enterInit));
        activeInput.dispatchEvent?.(new KeyboardEvent('keyup', enterInit));
        await wait(500);

        if (numberElement) {
            numberElement.focus?.();
            numberElement.click?.();
            await wait(400);
        }
        notifyPhoneHostChanged(countryElement);
        debugPhoneHostState(countryElement, `after-${typingTerm}`);

        const committed = readCommittedPhoneDialCode(countryElement);
        const countryOk = isSmartRecruitersPhoneCountrySet(countryElement, dialCode);
        debugLog('[SR-Phone] attempt result', { dialCode, desiredLabel, committed, countryOk });

        if (countryOk) {
            return true;
        }
    }

    debugLog('[SR-Phone] country dropdown: selection not committed', {
        dialCode,
        searchTerms,
        committed: readCommittedPhoneDialCode(countryElement)
    });
    return false;
}

function stripDialCodeFromPhoneNumber(rawPhone, dialCode) {
    let digits = String(rawPhone || '').replace(/\D/g, '');
    const codeDigits = String(dialCode || '').replace(/\D/g, '');
    if (codeDigits && digits.startsWith(codeDigits)) {
        digits = digits.slice(codeDigits.length);
    }
    return digits;
}

async function fillSmartRecruitersPhoneField(field, value, profile) {
    const dialCode = getProfileDialCode(profile) || '+1';
    const countryElement = field.countryElement || findPhoneCountryControlNear(field.element);
    const numberElement = field.element;
    const phoneHost = findHostAncestor(countryElement || numberElement, 'spl-phone-field, spl-phone, sr-question-field-phone-number');

    const beforeCountry = readSmartRecruitersPhoneCountryDisplay(countryElement);
    debugLog('[SR-Phone] fill start', {
        dialCode,
        profilePhone: profile?.phone,
        aiValue: value,
        beforeCountry,
        hasCountryElement: !!countryElement
    });

    if (countryElement) {
        const countrySelected = await selectSmartRecruitersPhoneCountryCode(countryElement, dialCode, profile, numberElement);
        const activeInput = findPhoneCountrySearchInput(
            countryElement,
            getPhoneCountryOpenTrigger(countryElement),
            phoneHost
        );
        closeSmartRecruitersDropdown(
            activeInput,
            getSmartRecruitersDropdownHost(activeInput) || getSmartRecruitersDropdownHost(countryElement),
            { allowEscape: false }
        );
        await wait(300);

        const afterCountry = readSmartRecruitersPhoneCountryDisplay(countryElement);
        const countryOk = isSmartRecruitersPhoneCountrySet(countryElement, dialCode);
        debugLog('[SR-Phone] country result', {
            dialCode,
            beforeCountry,
            afterCountry,
            committedDialCode: readCommittedPhoneDialCode(countryElement),
            countrySelected,
            countryOk
        });
        if (!countryOk) {
            debugLog('[SR-Phone] WARNING: country code may not match profile', {
                expected: dialCode,
                actual: afterCountry,
                committed: readCommittedPhoneDialCode(countryElement)
            });
        }
    } else {
        debugLog('[SR-Phone] WARNING: country dropdown not found near phone input');
    }

    let nationalNumber = stripDialCodeFromPhoneNumber(value || profile?.phone || '', dialCode);
    if (!nationalNumber && profile?.phone) {
        nationalNumber = stripDialCodeFromPhoneNumber(profile.phone, dialCode);
    }

    scrollToTargetAdjusted(numberElement, getHeaderHeight());
    numberElement.focus?.();
    numberElement.click?.();
    setNativeValue(numberElement, nationalNumber);
    numberElement.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    numberElement.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    numberElement.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
    const hostEl = numberElement.getRootNode?.()?.host;
    if (hostEl) {
        hostEl.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
        hostEl.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
    }
    notifyPhoneHostChanged(countryElement || numberElement);
    await wait(300);

    debugLog('[SR-Phone] number filled', {
        nationalNumber,
        inputValue: numberElement.value,
        committedDialCode: readCommittedPhoneDialCode(countryElement),
        phoneFieldValid: !phoneHost?.classList?.contains?.('ng-invalid')
    });
}

function mergeSmartRecruitersPhoneFields(fields) {
    for (let i = 0; i < fields.length - 1; i += 1) {
        const currentField = fields[i];
        const nextField = fields[i + 1];

        if (!isPhoneNumberLabel(currentField.label) || !isPhoneNumberLabel(nextField.label)) {
            continue;
        }

        const currentIsCountry = isLikelyPhoneCountryControl(currentField.element);
        const nextIsCountry = isLikelyPhoneCountryControl(nextField.element);
        let countryElement = null;
        let numberElement = null;

        if (currentIsCountry && !nextIsCountry) {
            countryElement = currentField.element;
            numberElement = nextField.element;
        } else if (nextIsCountry && !currentIsCountry) {
            countryElement = nextField.element;
            numberElement = currentField.element;
        } else if (isLikelyPhoneNumberControl(nextField.element)) {
            countryElement = isLikelyPhoneCountryControl(currentField.element) ? currentField.element : findPhoneCountryControlNear(nextField.element);
            numberElement = nextField.element;
        } else {
            countryElement = findPhoneCountryControlNear(currentField.element);
            numberElement = currentField.element;
        }

        fields.splice(i, 2, 1, {
            label: currentField.label,
            type: 'phone',
            required: currentField.required || nextField.required,
            element: numberElement,
            countryElement
        });
        debugLog('[SR-Phone] merged consecutive phone fields', {
            label: currentField.label,
            hasCountryElement: !!countryElement
        });
        return;
    }

    for (const field of fields) {
        if (!isPhoneNumberLabel(field.label) || field.type === 'phone') {
            continue;
        }
        field.type = 'phone';
        field.countryElement = findPhoneCountryControlNear(field.element);
        debugLog('[SR-Phone] upgraded phone field to phone type', {
            label: field.label,
            hasCountryElement: !!field.countryElement
        });
    }
}

function getQuestionFieldHost(element) {
    let host = findHostAncestor(element, 'sr-question-field-radio, sr-question-field-checkbox');
    if (!host) {
        const intermediate = findHostAncestor(element, 'spl-radio, spl-checkbox');
        if (intermediate) {
            host = findHostAncestor(intermediate, 'sr-question-field-radio, sr-question-field-checkbox');
        }
    }
    return host;
}

function getAssignedSlotText(slot) {
    if (!slot) {
        return '';
    }

    let assignedNodes = [];
    if (typeof slot.assignedNodes === 'function') {
        try {
            assignedNodes = slot.assignedNodes({flatten: true});
        } catch {
            assignedNodes = slot.assignedNodes();
        }
    } else if (slot.childNodes) {
        assignedNodes = Array.from(slot.childNodes);
    }

    const pieces = [];
    assignedNodes.forEach((node) => {
        const text = node?.textContent;
        if (text) {
            pieces.push(text);
        }
    });

    return cleanLabelText(pieces.join(' '));
}

function getElementDeepText(element) {
    if (!element) {
        return '';
    }

    const pieces = [];
    const visited = new Set();

    const traverse = (node) => {
        if (!node || visited.has(node)) {
            return;
        }
        visited.add(node);

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text) {
                pieces.push(text);
            }
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName?.toLowerCase?.();
            if (tagName === 'script' || tagName === 'style') {
                return;
            }

            if (node.shadowRoot) {
                traverse(node.shadowRoot);
            }

            if (node.tagName === 'SLOT') {
                let assignedNodes = [];
                try {
                    assignedNodes = node.assignedNodes({flatten: true});
                } catch {
                    assignedNodes = node.assignedNodes();
                }
                assignedNodes.forEach((assigned) => traverse(assigned));
            }
        }

        const children = node.childNodes || [];
        for (const child of children) {
            traverse(child);
        }
    };

    traverse(element);
    return cleanLabelText(pieces.join(' '));
}

function extractLabelFromSlots(root) {
    if (!root || typeof root.querySelectorAll !== 'function') {
        return null;
    }

    const slotSelectors = [
        'slot[name="label-content"]',
        'slot[name="label"]',
        'slot[name="question"]'
    ];

    for (const selector of slotSelectors) {
        const slot = root.querySelector(selector);
        const label = getAssignedSlotText(slot);
        if (label) {
            return label;
        }
    }

    return null;
}

function extractQuestionHostLabel(host) {
    if (!host) {
        return null;
    }

    const attrLabel = host.getAttribute?.('label') || host.getAttribute?.('aria-label');
    if (attrLabel) {
        const cleaned = cleanLabelText(attrLabel);
        if (cleaned) {
            return cleaned;
        }
    }

    const selectors = [
        '[slot="label-content"]',
        '[data-test="question-label"]',
        '.question-label',
        '.c-spl-form-field-label',
        'spl-typography-label',
        'label'
    ];

    for (const selector of selectors) {
        const node = host.querySelector?.(selector);
        if (node?.textContent) {
            const label = cleanLabelText(node.textContent);
            if (label) {
                return label;
            }
        }
        const shadowNode = host.shadowRoot?.querySelector(selector);
        if (shadowNode?.textContent) {
            const label = cleanLabelText(shadowNode.textContent);
            if (label) {
                return label;
            }
        }
    }

    const slotLabel = extractLabelFromSlots(host) || extractLabelFromSlots(host.shadowRoot);
    if (slotLabel) {
        return slotLabel;
    }

    const group = host.querySelector?.('spl-radio-group, spl-checkbox-group');
    if (group) {
        const groupAttr = group.getAttribute?.('label') || group.getAttribute?.('aria-label');
        if (groupAttr) {
            const label = cleanLabelText(groupAttr);
            if (label) {
                return label;
            }
        }

        for (const selector of selectors) {
            const groupNode = group.querySelector?.(selector) || group.shadowRoot?.querySelector?.(selector);
            if (groupNode?.textContent) {
                const label = cleanLabelText(groupNode.textContent);
                if (label) {
                    return label;
                }
            }
        }

        const groupSlotLabel = extractLabelFromSlots(group) || extractLabelFromSlots(group.shadowRoot);
        if (groupSlotLabel) {
            return groupSlotLabel;
        }
    }

    return null;
}

function findQuestionGroupInfo(control, fallbackLabelInfo) {
    const fallbackLabel = fallbackLabelInfo?.label || '';
    const fallbackRequired = !!fallbackLabelInfo?.requiredHint;

    const questionHost = getQuestionFieldHost(control);
    let groupHost = findHostAncestor(control, 'spl-radio-group, spl-checkbox-group');
    if (!groupHost) {
        const intermediate = findHostAncestor(control, 'spl-radio, spl-checkbox');
        if (intermediate) {
            groupHost = findHostAncestor(intermediate, 'spl-radio-group, spl-checkbox-group');
        }
    }

    if (!questionHost && !groupHost) {
        console.warn('[SmartRecruiters] Radio control without group host', {
            controlId: control.id,
            fallbackLabel,
            hierarchy: traceNodeHierarchy(control)
        });
        return null;
    }

    const labelCandidates = [];
    let requiredHint = fallbackRequired;

    const collectFromNode = (node) => {
        if (!node) {
            return;
        }

        const candidateLabel = extractQuestionHostLabel(node);
        if (candidateLabel) {
            labelCandidates.push(candidateLabel);
        }

        if (node.hasAttribute?.('required') || node.getAttribute?.('aria-required') === 'true') {
            requiredHint = true;
        }

        if (!requiredHint && node.shadowRoot) {
            const indicator = node.shadowRoot.querySelector('[aria-hidden="true"], .required-indicator, [data-required="true"]');
            if (indicator && /\*/.test(indicator.textContent || '')) {
                requiredHint = true;
            }
        }
    };
    collectFromNode(questionHost);

    if (questionHost) {
        const nestedGroup = questionHost.querySelector?.('spl-radio-group, spl-checkbox-group') || questionHost.shadowRoot?.querySelector?.('spl-radio-group, spl-checkbox-group');
        collectFromNode(nestedGroup);
    }

    collectFromNode(groupHost);

    if (fallbackLabel) {
        labelCandidates.push(fallbackLabel);
    }

    const chosenLabel = labelCandidates
        .map((text) => (text ? text.trim() : ''))
        .filter((text) => text.length > 0)
        .sort((a, b) => b.length - a.length)[0] || null;

    const hostForGrouping = questionHost || groupHost;

    console.log('[SmartRecruiters] Radio group analysis', {
        controlId: control.id,
        hasQuestionHost: !!questionHost,
        hasGroupHost: !!groupHost,
        labelCandidates,
        chosenLabel,
        requiredHint
    });

    return {
        label: chosenLabel,
        requiredHint,
        host: hostForGrouping
    };
}

function findDropdownOptions(dropdownHost, menuId, extraRoots = []) {
    const selector = 'spl-autocomplete-option, spl-select-option, [role="option"], [data-test="dropdown-option"], .c-spl-autocomplete-option-content';
    const options = [];
    const seen = new Set();

    const addFromRoot = (root) => {
        if (!root) {
            return;
        }
        const found = root === document.body
            ? querySelectorAllDeep(root, selector)
            : [
                ...(root.querySelectorAll?.(selector) || []),
                ...querySelectorAllDeep(root, selector)
            ];
        for (const option of found) {
            if (seen.has(option)) {
                continue;
            }
            seen.add(option);
            options.push(option);
        }
    };

    if (menuId) {
        addFromRoot(document.getElementById(menuId));
    }

    if (dropdownHost?.shadowRoot) {
        addFromRoot(dropdownHost.shadowRoot);
    }

    addFromRoot(dropdownHost);

    for (const root of extraRoots) {
        addFromRoot(root);
    }

    if (options.length === 0) {
        addFromRoot(document.body);
    }

    return options.filter((option) => {
        const rect = option.getBoundingClientRect?.();
        return rect && rect.width > 0 && rect.height > 0;
    });
}

function getPhoneCountryOpenTrigger(countryElement) {
    const phoneHost = findHostAncestor(countryElement, 'spl-phone-field, spl-phone, sr-question-field-phone-number');
    if (!phoneHost) {
        return countryElement;
    }

    const dropdowns = querySelectorAllDeep(phoneHost, 'spl-dropdown');
    for (const dropdown of dropdowns) {
        const control = getInnerFormControl(dropdown) || dropdown;
        if (control && control.type !== 'tel' && control.getAttribute?.('inputmode') !== 'tel') {
            return control;
        }
    }

    const buttons = querySelectorAllDeep(phoneHost, 'button');
    for (const button of buttons) {
        const text = getElementDeepText(button).replace(/\s+/g, ' ').trim();
        if (/^\+\d{1,4}(\s|$)/.test(text) && text.length < 20) {
            return button;
        }
    }

    const nonTelInputs = querySelectorAllDeep(phoneHost, 'input, [role="combobox"], select').filter((input) => {
        return input.type !== 'tel' && input.getAttribute?.('inputmode') !== 'tel';
    });
    if (nonTelInputs.length > 0) {
        return nonTelInputs[0];
    }

    return countryElement;
}

function findPhoneCountrySearchInput(countryElement, openTrigger, phoneHost) {
    if (countryElement && countryElement !== openTrigger && isLikelyPhoneCountryControl(countryElement)) {
        return countryElement;
    }

    const root = phoneHost || document.body;
    const inputs = querySelectorAllDeep(root, 'input, [role="combobox"]');
    return inputs.find((input) => {
        if (input === openTrigger || input.type === 'tel' || input.getAttribute?.('inputmode') === 'tel') {
            return false;
        }
        const hint = `${input.placeholder || ''} ${input.getAttribute?.('aria-label') || ''}`.toLowerCase();
        return /country|region|code|search/.test(hint);
    }) || inputs.find((input) => input !== openTrigger && input.type !== 'tel' && input.getAttribute?.('inputmode') !== 'tel');
}

function closeSmartRecruitersDropdown(activeInput, dropdownHost, { allowEscape = false } = {}) {
    if (!activeInput) {
        return;
    }

    if (dropdownHost?.hasAttribute?.('open')) {
        dropdownHost.removeAttribute('open');
    }

    if (allowEscape && activeInput.getAttribute?.('aria-expanded') === 'true') {
        const escapeInit = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, composed: true };
        activeInput.dispatchEvent?.(new KeyboardEvent('keydown', escapeInit));
        activeInput.dispatchEvent?.(new KeyboardEvent('keyup', escapeInit));
    }
}

function notifyPhoneHostChanged(countryElement) {
    const phoneHost = findHostAncestor(countryElement, 'spl-phone-field, spl-phone, sr-question-field-phone-number');
    if (!phoneHost) {
        return;
    }
    phoneHost.dispatchEvent?.(new Event('input', { bubbles: true, composed: true }));
    phoneHost.dispatchEvent?.(new Event('change', { bubbles: true, composed: true }));
    phoneHost.dispatchEvent?.(new Event('blur', { bubbles: true, composed: true }));
}

function findPhoneCountryDropdownOptions(countryElement, dropdownHost, menuId, requireVisible = true) {
    const phoneHost = findHostAncestor(countryElement, 'spl-phone-field, spl-phone, sr-question-field-phone-number');
    const options = findDropdownOptions(dropdownHost, menuId, [phoneHost].filter(Boolean));
    if (options.length > 0 || requireVisible) {
        return options;
    }

    const selector = 'spl-autocomplete-option, spl-select-option, [role="option"], [data-test="dropdown-option"], .c-spl-autocomplete-option-content';
    const relaxed = [];
    const seen = new Set();
    const menu = menuId ? document.getElementById(menuId) : null;
    const roots = [menu, phoneHost, dropdownHost?.shadowRoot, dropdownHost].filter(Boolean);
    for (const root of roots) {
        const found = root === phoneHost || root === menu
            ? querySelectorAllDeep(root, selector)
            : [...(root.querySelectorAll?.(selector) || []), ...querySelectorAllDeep(root, selector)];
        for (const option of found) {
            if (!seen.has(option)) {
                seen.add(option);
                relaxed.push(option);
            }
        }
    }
    return relaxed;
}

async function selectDropdownOptionByText(inputElement, desiredLabel) {
    if (!inputElement || !desiredLabel) {
        return false;
    }

    const dropdownHost = getSmartRecruitersDropdownHost(inputElement);
    if (!dropdownHost) {
        console.warn('[SmartRecruiters] Dropdown host not found for language level input');
        return false;
    }

    const menuId = inputElement.getAttribute?.('aria-controls') || dropdownHost.getAttribute?.('aria-controls');
    const normalizedDesired = normalizeMatchValue(desiredLabel);

    inputElement.focus?.();
    inputElement.dispatchEvent?.(new Event('focus', {bubbles: true, composed: true}));
    inputElement.click?.();

    setNativeValue(inputElement, desiredLabel);
    inputElement.dispatchEvent?.(new Event('input', {bubbles: true, composed: true}));

    const arrowInit = {key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, composed: true};
    inputElement.dispatchEvent?.(new KeyboardEvent('keydown', arrowInit));
    inputElement.dispatchEvent?.(new KeyboardEvent('keyup', arrowInit));

    const options = await waitForDropdownOptions(dropdownHost, menuId);
    if (options.length === 0) {
        console.warn('[SmartRecruiters] Dropdown options not available for desired selection', {
            desiredLabel,
            menuId
        });
        return false;
    }

    let match = null;
    let matchText = '';
    for (const option of options) {
        const text = extractDropdownOptionText(option);
        if (!text) {
            continue;
        }
        if (normalizeMatchValue(text) === normalizedDesired) {
            match = option;
            matchText = text;
            break;
        }
    }

    if (!match) {
        console.warn('[SmartRecruiters] Desired dropdown option not found', {
            desiredLabel,
            available: options.map((option) => extractDropdownOptionText(option)).filter(Boolean)
        });
    } else {
        const target = getDropdownClickableTarget(match);
        if (target) {
            target.dispatchEvent?.(new PointerEvent('pointerover', {bubbles: true, composed: true}));
            target.dispatchEvent?.(new PointerEvent('pointerenter', {bubbles: false, composed: true}));
            target.dispatchEvent?.(new PointerEvent('pointerdown', {bubbles: true, composed: true}));
            target.dispatchEvent?.(new MouseEvent('mouseover', {bubbles: true, composed: true}));
            target.dispatchEvent?.(new MouseEvent('mouseenter', {bubbles: false, composed: true}));
            target.dispatchEvent?.(new MouseEvent('mousedown', {bubbles: true, composed: true}));
            target.click?.();
            if (matchText) {
                setNativeValue(inputElement, matchText);
            }
            target.dispatchEvent?.(new MouseEvent('mouseup', {bubbles: true, composed: true}));
            target.dispatchEvent?.(new PointerEvent('pointerup', {bubbles: true, composed: true}));
        }
    }

    await wait(200);
    inputElement.dispatchEvent?.(new Event('change', {bubbles: true, composed: true}));

    if (dropdownHost.hasAttribute?.('open')) {
        dropdownHost.removeAttribute('open');
    }

    if (inputElement.getAttribute?.('aria-expanded') === 'true') {
        const escapeInit = {key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, composed: true};
        inputElement.dispatchEvent?.(new KeyboardEvent('keydown', escapeInit));
        inputElement.dispatchEvent?.(new KeyboardEvent('keyup', escapeInit));
    }

    return !!match;
}

function extractDropdownOptionText(option) {
    if (!option) {
        return '';
    }

    const textCandidates = [];

    const addCandidate = (value) => {
        if (value) {
            textCandidates.push(cleanLabelText(String(value)));
        }
    };

    addCandidate(option.textContent);
    addCandidate(option.getAttribute?.('label'));
    addCandidate(option.getAttribute?.('aria-label'));
    addCandidate(option.getAttribute?.('value'));
    addCandidate(option.dataset?.label);
    addCandidate(option.dataset?.value);

    if (option.shadowRoot) {
        addCandidate(option.shadowRoot.textContent);
        const slot = option.shadowRoot.querySelector?.('slot');
        if (slot) {
            addCandidate(getAssignedSlotText(slot));
        }
    }

    const filtered = textCandidates.map((candidate) => candidate.trim()).filter((candidate) => candidate.length > 0);
    return filtered[0] || '';
}

async function waitForDropdownOptions(dropdownHost, menuId, maxWaitMs = 10000) {
    const pollIntervalMs = 1000;
    const maxAttempts = Math.max(1, Math.ceil(maxWaitMs / pollIntervalMs));
    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const options = findDropdownOptions(dropdownHost, menuId);
        if (options.length > 0) {
            if (attempt > 1) {
                console.log('[SmartRecruiters] Dropdown options available', {
                    menuId,
                    attempt,
                    elapsedMs: Date.now() - startTime
                });
            }
            return options;
        }

        if (attempt === 1 || attempt === maxAttempts) {
            console.log('[SmartRecruiters] Waiting for dropdown options', {
                attempt,
                maxAttempts,
                menuId,
                elapsedMs: Date.now() - startTime
            });
        }

        if (attempt < maxAttempts) {
            await wait(pollIntervalMs);
        }
    }

    return [];
}

async function waitForUrlChange(initialUrl, initialDelayMs = 5000, maxTotalWaitMs = 30000, pollIntervalMs = 500) {
    await wait(initialDelayMs);
    if (window.location.href !== initialUrl) {
        return true;
    }

    let elapsed = initialDelayMs;
    while (elapsed < maxTotalWaitMs) {
        await wait(pollIntervalMs);
        elapsed += pollIntervalMs;
        if (window.location.href !== initialUrl) {
            return true;
        }
    }

    return window.location.href !== initialUrl;
}

function getSmartRecruitersStepSignature() {
    const questionTests = querySelectorAllDeep(document.body, '[data-test^="question-"]')
        .map(el => el.getAttribute('data-test'))
        .filter(Boolean)
        .sort();
    return JSON.stringify({
        questions: questionTests.slice(0, 40),
        hasSubmit: !!document.querySelector('oc-button[data-test="footer-submit"]'),
        hasNext: !!document.querySelector('oc-button[data-test="footer-next"]'),
        href: window.location.href
    });
}

async function waitForSmartRecruitersStepAdvance(initialUrl, initialSignature, initialDelayMs = 5000, maxTotalWaitMs = 45000, pollIntervalMs = 500) {
    await wait(initialDelayMs);
    if (window.location.href !== initialUrl) {
        return true;
    }
    if (getSmartRecruitersStepSignature() !== initialSignature) {
        debugLog('[SR] step advanced via DOM change (no URL change)');
        return true;
    }
    if (document.querySelector('oc-button[data-test="footer-submit"]') && !JSON.parse(initialSignature).hasSubmit) {
        debugLog('[SR] step advanced to submit step');
        return true;
    }

    let elapsed = initialDelayMs;
    while (elapsed < maxTotalWaitMs) {
        await wait(pollIntervalMs);
        elapsed += pollIntervalMs;
        if (window.location.href !== initialUrl) {
            return true;
        }
        if (getSmartRecruitersStepSignature() !== initialSignature) {
            debugLog('[SR] step advanced via DOM change after wait', { elapsed });
            return true;
        }
    }

    return window.location.href !== initialUrl || getSmartRecruitersStepSignature() !== initialSignature;
}

async function fillLanguageEntries(languages, root = document) {
    if (!Array.isArray(languages) || languages.length === 0) {
        return false;
    }

    const searchRoot = root || document;
    const host = querySelectorDeep(searchRoot, 'sr-question-field-languages');
    if (!host) {
        return false;
    }

    if (host.dataset.languagesFilled === 'true') {
        return true;
    }

    const getRows = () => querySelectorAllDeep(host, '[data-test="question-language-row"]');
    const addButton = querySelectorDeep(host, '[data-test="question-language-add"]');

    const ensureRowCount = async (count) => {
        let rows = getRows();
        while (rows.length < count && addButton) {
            const prevCount = rows.length;
            addButton.click?.();
            let attempts = 0;
            while (attempts < 10) {
                await wait(300);
                rows = getRows();
                if (rows.length > prevCount) {
                    break;
                }
                attempts += 1;
            }
            if (rows.length <= prevCount) {
                console.warn('[SmartRecruiters] Language row was not added as expected', {desiredCount: count, currentCount: rows.length});
                break;
            }
        }
        return getRows();
    };

    let rows = await ensureRowCount(languages.length);
    if (rows.length === 0) {
        return false;
    }

    const entriesToFill = Math.min(rows.length, languages.length);

    for (let index = 0; index < entriesToFill; index += 1) {
        const row = rows[index];
        const entry = languages[index] || {};
        const languageName = cleanLabelText(entry.language || '') || '';
        const desiredLevel = mapLanguageLevel(entry.proficiency || '');

        if (!languageName && !desiredLevel) {
            continue;
        }

        const languageHost = querySelectorDeep(row, '[data-test="question-language-input"], spl-input');
        const languageInput = getInnerFormControl(languageHost);
        if (languageInput && languageName) {
            setNativeValue(languageInput, languageName);
            languageInput.dispatchEvent?.(new Event('input', {bubbles: true, composed: true}));
            languageInput.dispatchEvent?.(new Event('change', {bubbles: true, composed: true}));
        }

        if (desiredLevel) {
            const comboboxHost = querySelectorDeep(row, '[role="combobox"], spl-input[role="combobox"]');
            const comboboxInput = getInnerFormControl(comboboxHost) || comboboxHost;
            if (comboboxInput) {
                const matched = await selectDropdownOptionByText(comboboxInput, desiredLevel);
                if (!matched) {
                    console.warn('[SmartRecruiters] Failed to select language level', {
                        desiredLevel,
                        index
                    });
                }
            }
        }
    }

    host.dataset.languagesFilled = 'true';
    console.log('[SmartRecruiters] Language entries populated', {
        filled: entriesToFill
    });
    return true;
}

function buildKeyboardEventInit(char) {
    const isSingleChar = typeof char === 'string' && char.length === 1;
    const upper = isSingleChar ? char.toUpperCase() : '';
    const keyCode = isSingleChar ? upper.charCodeAt(0) : 0;

    return {
        key: char,
        code: isSingleChar && /[A-Z]/.test(upper) ? `Key${upper}` : (isSingleChar ? `Key${upper}` : 'KeyA'),
        keyCode,
        which: keyCode,
        bubbles: true,
        composed: true
    };
}

async function replayTypingForDropdown(inputElement, text) {
    if (!inputElement || !text) {
        return;
    }

    // Clear current value to mimic user starting to type from scratch.
    setNativeValue(inputElement, '');
    inputElement.dispatchEvent?.(new Event('input', {bubbles: true, composed: true}));

    // Small pause to let observers react to the cleared value.
    await wait(50);

    for (const char of text) {
        const eventInit = buildKeyboardEventInit(char);
        inputElement.dispatchEvent?.(new KeyboardEvent('keydown', eventInit));
        inputElement.dispatchEvent?.(new KeyboardEvent('keypress', eventInit));

        const nextValue = `${inputElement.value || ''}${char}`;
        setNativeValue(inputElement, nextValue);
        inputElement.dispatchEvent?.(new Event('input', {bubbles: true, composed: true}));

        inputElement.dispatchEvent?.(new KeyboardEvent('keyup', eventInit));

        await wait(50);
    }
}

function getDropdownClickableTarget(option) {
    if (!option) {
        return null;
    }

    if (option.shadowRoot) {
        const button = option.shadowRoot.querySelector('button, [role="option"], .c-spl-autocomplete-option-content');
        if (button) {
            return button;
        }
    }

    const descendants = option.querySelectorAll('button, [role="option"], .c-spl-autocomplete-option-content');
    if (descendants.length > 0) {
        return descendants[0];
    }

    return option;
}

async function selectFirstDropdownOption(inputElement, targetValue = null) {
    if (!inputElement) {
        console.warn('[SmartRecruiters] Dropdown input missing');
        return false;
    }

    const dropdownHost = getSmartRecruitersDropdownHost(inputElement);
    const menuId = inputElement.getAttribute?.('aria-controls') || dropdownHost?.getAttribute?.('aria-controls');

    // Use provided targetValue if given, otherwise read from input
    const desiredText = targetValue !== null ? String(targetValue).trim() : (inputElement.value || '').trim();

    debugLog('[SR] Dropdown selection start', {
        label: extractFieldLabelData(inputElement).label,
        desiredText,
        menuId,
        hasDropdownHost: !!dropdownHost
    });

    inputElement.focus?.();
    inputElement.dispatchEvent?.(new Event('focus', {bubbles: true, composed: true}));
    inputElement.click?.();

    // First try: open dropdown without typing (works for simple fixed-choice dropdowns)
    await wait(400);
    const arrowInitEarly = {key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, composed: true};
    inputElement.dispatchEvent?.(new KeyboardEvent('keydown', arrowInitEarly));
    inputElement.dispatchEvent?.(new KeyboardEvent('keyup', arrowInitEarly));
    await wait(600);
    const earlyOptions = findDropdownOptions(dropdownHost, menuId).filter(o => {
        const r = o.getBoundingClientRect?.(); return r && r.width > 0 && r.height > 0;
    });

    if (earlyOptions.length > 0) {
        debugLog('[SR] Dropdown opened without typing', { count: earlyOptions.length, label: extractFieldLabelData(inputElement).label });
        // We have options - no need to type. Proceed to matching below.
    } else if (desiredText) {
        // No options visible yet - need to type to trigger autocomplete.
        // Type a prefix (first 4 chars, or the whole value if it's short) - a real user
        // wouldn't type the full city name before picking from suggestions.
        const typingPrefix = desiredText.length <= 5 ? desiredText : desiredText.slice(0, 4);
        debugLog('[SR] Typing prefix to trigger dropdown', { prefix: typingPrefix, full: desiredText });
        await replayTypingForDropdown(inputElement, typingPrefix);
        await wait(800);
    }

    const options = await waitForDropdownOptions(dropdownHost, menuId, 8000);
    if (options.length === 0) {
        debugLog('[SR] Dropdown options not found', { label: extractFieldLabelData(inputElement).label, menuId });
        return false;
    }

    const desiredValueNormalized = normalizeMatchValue(desiredText);
    let selectedOption = null;
    let selectedOptionText = '';

    // Exact match first
    if (desiredValueNormalized) {
        for (const option of options) {
            const optionText = extractDropdownOptionText(option);
            if (!optionText) continue;
            if (normalizeMatchValue(optionText) === desiredValueNormalized) {
                selectedOption = option;
                selectedOptionText = optionText;
                break;
            }
        }
    }

    // Fuzzy/partial match fallback
    if (!selectedOption && desiredValueNormalized) {
        for (const option of options) {
            const optionText = extractDropdownOptionText(option);
            if (!optionText) continue;
            const normalizedOpt = normalizeMatchValue(optionText);
            if (normalizedOpt.includes(desiredValueNormalized) || desiredValueNormalized.includes(normalizedOpt)) {
                selectedOption = option;
                selectedOptionText = optionText;
                break;
            }
        }
    }

    const allOptionTexts = options.map(o => extractDropdownOptionText(o) || o.textContent?.trim() || '');
    debugLog('[SR] Dropdown options found', {
        count: options.length,
        desiredText,
        desiredNormalized: desiredValueNormalized,
        allOptions: allOptionTexts,
        selectedOptionText: selectedOption ? (extractDropdownOptionText(selectedOption) || selectedOption.textContent?.trim() || '') : null,
        exactMatch: selectedOption ? normalizeMatchValue(extractDropdownOptionText(selectedOption) || '') === desiredValueNormalized : false
    });

    if (!selectedOption) {
        // No match found — do not fall back to selecting a random option
        return false;
    }

    selectedOptionText = extractDropdownOptionText(selectedOption) || selectedOption.textContent?.trim() || '';

    const target = getDropdownClickableTarget(selectedOption);
    if (!target) {
        console.warn('[SmartRecruiters] Dropdown option target missing', selectedOption);
        return false;
    }

    console.log('[SmartRecruiters] Clicking dropdown option', {
        optionTag: selectedOption.tagName,
        targetTag: target.tagName,
        optionText: selectedOptionText || selectedOption.textContent?.trim()
    });

    target.dispatchEvent?.(new PointerEvent('pointerover', {bubbles: true, composed: true}));
    target.dispatchEvent?.(new PointerEvent('pointerenter', {bubbles: false, composed: true}));
    target.dispatchEvent?.(new PointerEvent('pointerdown', {bubbles: true, composed: true}));
    target.dispatchEvent?.(new MouseEvent('mouseover', {bubbles: true, composed: true}));
    target.dispatchEvent?.(new MouseEvent('mouseenter', {bubbles: false, composed: true}));
    target.dispatchEvent?.(new MouseEvent('mousedown', {bubbles: true, composed: true}));
    target.click?.();
    if (selectedOptionText) {
        setNativeValue(inputElement, selectedOptionText);
    }
    target.dispatchEvent?.(new MouseEvent('mouseup', {bubbles: true, composed: true}));
    target.dispatchEvent?.(new PointerEvent('pointerup', {bubbles: true, composed: true}));

    await wait(200);
    const enterInit = {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true};
    inputElement.dispatchEvent?.(new KeyboardEvent('keydown', enterInit));
    inputElement.dispatchEvent?.(new KeyboardEvent('keyup', enterInit));
    inputElement.dispatchEvent?.(new Event('change', {bubbles: true, composed: true}));

    if (dropdownHost?.hasAttribute?.('open')) {
        dropdownHost.removeAttribute('open');
        console.log('[SmartRecruiters] Dropdown host closed via attribute removal');
    }

    if (inputElement.getAttribute?.('aria-expanded') === 'true') {
        const escapeInit = {key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, composed: true};
        inputElement.dispatchEvent?.(new KeyboardEvent('keydown', escapeInit));
        inputElement.dispatchEvent?.(new KeyboardEvent('keyup', escapeInit));
        console.log('[SmartRecruiters] Dropdown closed via Escape key');
    }

    console.log('[SmartRecruiters] Dropdown selection complete', {
        inputValue: inputElement.value,
        ariaExpanded: inputElement.getAttribute?.('aria-expanded'),
        hostOpen: dropdownHost?.hasAttribute?.('open')
    });

    return true;
}

async function collectSmartRecruitersDropdownOptions(inputElement, maxWaitMs = 3000) {
    if (!inputElement) {
        return null;
    }

    const dropdownHost = getSmartRecruitersDropdownHost(inputElement);
    if (!dropdownHost) {
        return null;
    }

    const labelInfo = extractFieldLabelData(inputElement) || {};
    console.log('[SmartRecruiters] Inspecting dropdown for options', {
        label: labelInfo.label || inputElement.getAttribute?.('aria-label') || inputElement.id,
        elementType: inputElement.tagName,
        hasDropdownHost: true
    });

    const menuId = inputElement.getAttribute?.('aria-controls') || dropdownHost.getAttribute?.('aria-controls');
    const originalValue = inputElement.value;
    const originalSelectionStart = inputElement.selectionStart;
    const originalSelectionEnd = inputElement.selectionEnd;

    inputElement.focus?.();
    inputElement.dispatchEvent?.(new Event('focus', {bubbles: true, composed: true}));
    inputElement.click?.();

    const openDelay = 500 + Math.floor(Math.random() * 1500);
    await wait(openDelay);

    const arrowInit = {key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, composed: true};
    inputElement.dispatchEvent?.(new KeyboardEvent('keydown', arrowInit));
    inputElement.dispatchEvent?.(new KeyboardEvent('keyup', arrowInit));

    const optionsElements = await waitForDropdownOptions(dropdownHost, menuId, Math.max(1000, maxWaitMs));
    const options = optionsElements
        .map((option) => extractDropdownOptionText(option))
        .filter((text) => text.length > 0);

    if (dropdownHost?.hasAttribute?.('open')) {
        dropdownHost.removeAttribute('open');
    }

    if (inputElement.getAttribute?.('aria-expanded') === 'true') {
        const escapeInit = {key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, composed: true};
        inputElement.dispatchEvent?.(new KeyboardEvent('keydown', escapeInit));
        inputElement.dispatchEvent?.(new KeyboardEvent('keyup', escapeInit));
    }

    if (inputElement.value !== originalValue) {
        setNativeValue(inputElement, originalValue || '');
        inputElement.dispatchEvent?.(new Event('input', {bubbles: true, composed: true}));
        inputElement.dispatchEvent?.(new Event('change', {bubbles: true, composed: true}));
    }

    if (typeof originalSelectionStart === 'number' && typeof originalSelectionEnd === 'number') {
        inputElement.setSelectionRange?.(originalSelectionStart, originalSelectionEnd);
    }

    inputElement.blur?.();

    if (options.length > 0) {
        const uniqueOptions = [...new Set(options)];
        console.log('[SmartRecruiters] Dropdown options captured', {
            label: labelInfo.label || inputElement.id,
            count: uniqueOptions.length,
            sample: uniqueOptions.slice(0, 5)
        });
        return uniqueOptions;
    }

    console.log('[SmartRecruiters] Dropdown options not found', {
        label: labelInfo.label || inputElement.id,
        menuId
    });

    return null;
}

// ===================== Experience & Education Section Fill =====================

function formatDateForSmartRecruiters(instant) {
    if (!instant) return null;
    try {
        // instant is epoch seconds (Java Instant), convert to milliseconds for JS Date
        const d = new Date(instant * 1000);
        if (isNaN(d.getTime())) return null;
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return { month, year, formatted: `${month}/${year}` };
    } catch {
        return null;
    }
}

async function fillDateField(formRoot, fieldSelector, dateInfo) {
    if (!dateInfo) return false;

    debugLog('[SR-Exp] fillDateField looking for', fieldSelector);

    const host = querySelectorDeep(formRoot, fieldSelector);
    if (!host) {
        debugLog('[SR-Exp] Date field host not found:', fieldSelector);
        return false;
    }

    // Find the spl-date-picker component
    let datePicker = host;
    if (host.tagName !== 'SPL-DATE-PICKER') {
        datePicker = querySelectorDeep(host, 'spl-date-picker') || host;
    }

    // Find OC-DATEPICKER (the Angular component that holds the CVA/FormControl)
    // host may be a wrapper DIV; OC-DATEPICKER is the actual Angular form control host
    let ocDatePickerEl = (host.tagName === 'OC-DATEPICKER') ? host : querySelectorDeep(host, 'oc-datepicker');
    if (!ocDatePickerEl) {
        // Walk up from input through shadow DOM boundaries
        let el = datePicker;
        while (el) {
            if (el.tagName === 'OC-DATEPICKER') { ocDatePickerEl = el; break; }
            el = el.parentElement || el.getRootNode()?.host;
        }
    }

    // Find the inner text input (the trigger for the date picker popup)
    const input = getInnerFormControl(host) || host;

    // Walk up to find the nearest ancestor with __ngContext__ (Angular LView)
    let ngAncestorTag = null;
    let ngAncestorCtx = null;
    {
        let walkEl = ocDatePickerEl?.parentElement || ocDatePickerEl?.getRootNode()?.host;
        let depth = 0;
        while (walkEl && depth < 20) {
            if (walkEl.__ngContext__ !== undefined) { ngAncestorTag = walkEl.tagName; ngAncestorCtx = walkEl.__ngContext__; break; }
            walkEl = walkEl.parentElement || walkEl.getRootNode()?.host;
            depth++;
        }
    }

    debugLog('[SR-Exp] Date field input found:', {
        tag: input.tagName,
        type: input.type,
        value: input.value,
        datePickerTag: datePicker.tagName,
        hostTag: host.tagName,
        ocPickerTag: ocDatePickerEl?.tagName,
        ocValue: ocDatePickerEl?.value,
        ocClass: ocDatePickerEl?.className,
        protoProps: ocDatePickerEl ? Object.getOwnPropertyNames(Object.getPrototypeOf(ocDatePickerEl)).filter(k => k !== 'constructor').join(',').substring(0, 400) : 'none',
        ngAncestorTag
    });

    // Click the input to open the date picker popup
    input.focus();
    input.click();
    await wait(800);

    const targetYear = dateInfo.year;
    const targetMonthIdx = parseInt(dateInfo.month) - 1;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthAbbrevs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    debugLog('[SR-Exp] Looking for month/year in picker:', { month: monthNames[targetMonthIdx], year: targetYear });

    // Set the year using keyboard navigation on the year input
    const yearInput = querySelectorDeep(datePicker, 'input[type="number"]');
    if (yearInput) {
        const currentYear = parseInt(yearInput.value) || new Date().getFullYear();
        const yearDiff = currentYear - targetYear;
        debugLog('[SR-Exp] Year navigation:', { currentYear, targetYear, diff: yearDiff });

        if (yearDiff !== 0) {
            yearInput.focus();
            await wait(100);

            // Use ArrowDown/ArrowUp keypresses to change the year (flatpickr handles these)
            const arrowKey = yearDiff > 0 ? 'ArrowDown' : 'ArrowUp';
            const arrowKeyCode = yearDiff > 0 ? 40 : 38;
            const steps = Math.abs(yearDiff);

            for (let j = 0; j < Math.min(steps, 50); j++) {
                yearInput.dispatchEvent(new KeyboardEvent('keydown', {
                    key: arrowKey, code: arrowKey, keyCode: arrowKeyCode, which: arrowKeyCode,
                    bubbles: true, cancelable: true
                }));
                yearInput.dispatchEvent(new KeyboardEvent('keyup', {
                    key: arrowKey, code: arrowKey, keyCode: arrowKeyCode, which: arrowKeyCode,
                    bubbles: true
                }));
                await wait(50);
            }
            await wait(300);

            // If arrow keys didn't work, try direct value + change event
            const yearAfterArrows = parseInt(yearInput.value);
            if (yearAfterArrows !== targetYear) {
                debugLog('[SR-Exp] Arrow keys did not change year, trying direct value assignment');
                yearInput.value = String(targetYear);
                yearInput.dispatchEvent(new Event('change', { bubbles: true }));
                yearInput.dispatchEvent(new Event('input', { bubbles: true }));
                await wait(300);

                // Also try clicking prev/next navigation spans (flatpickr uses spans, not buttons)
                const navElements = querySelectorAllDeep(datePicker,
                    '.flatpickr-prev-month, .flatpickr-next-month, [class*="prev-month"], [class*="next-month"], span[role="button"]');
                if (navElements.length >= 2) {
                    const navEl = yearDiff > 0 ? navElements[0] : navElements[1];
                    debugLog('[SR-Exp] Trying nav element clicks:', { tag: navEl.tagName, class: navEl.className });
                    for (let j = 0; j < Math.min(Math.abs(yearDiff), 30); j++) {
                        navEl.click();
                        await wait(100);
                    }
                    await wait(300);
                }
            }

            const newYear = parseInt(yearInput.value);
            debugLog('[SR-Exp] Year after navigation:', newYear);
        }
    }

    // Find flatpickr instance BEFORE clicking month (calendar is currently open).
    // flatpickr stores the instance on the element it was initialized on (_flatpickr property).
    // In SPL-DATE-PICKER it may be on the shadow DOM input, on datePicker itself, or on
    // the calendar container element — search all possible locations.
    let fpInstance = null;
    const fpSearchRoots = [input, datePicker, host];
    for (const el of fpSearchRoots) {
        if (el && el._flatpickr) { fpInstance = el._flatpickr; break; }
    }
    if (!fpInstance && datePicker.shadowRoot) {
        for (const el of datePicker.shadowRoot.querySelectorAll('*')) {
            if (el._flatpickr) { fpInstance = el._flatpickr; break; }
        }
    }
    if (!fpInstance) {
        // flatpickr may append calendar to body — check open calendar containers
        const fpCals = querySelectorAllDeep(datePicker, '.flatpickr-calendar');
        for (const cal of fpCals) {
            if (cal._flatpickr || cal._fp) { fpInstance = cal._flatpickr || cal._fp; break; }
        }
    }
    debugLog('[SR-Exp] flatpickr instance search:', !!fpInstance,
        'onInput:', !!input._flatpickr, 'onPicker:', !!datePicker._flatpickr, 'onHost:', !!host._flatpickr);

    // Try to click the correct month
    let monthClicked = false;
    const monthElements = querySelectorAllDeep(datePicker, '[role="gridcell"], .flatpickr-monthSelect-month');
    if (monthElements.length >= 12) {
        // Month grid found (flatpickr monthSelect plugin) - click by index
        debugLog('[SR-Exp] Found month grid, clicking month index', targetMonthIdx);
        monthElements[targetMonthIdx]?.click();
        monthClicked = true;
        await wait(800);  // longer wait so flatpickr's onChange fires
        debugLog('[SR-Exp] After month click:', { inputVal: input.value, ocClass: ocDatePickerEl?.className, ocVal: ocDatePickerEl?.value });
    } else {
        // Fallback: search all elements by text
        const allElements = querySelectorAllDeep(datePicker, '*');
        for (const el of allElements) {
            const text = (el.textContent || '').trim();
            const ownText = el.childNodes?.length === 1 && el.childNodes[0].nodeType === 3 ? text : null;
            if (ownText && (
                ownText.toLowerCase() === monthNames[targetMonthIdx].toLowerCase() ||
                ownText.toLowerCase() === monthAbbrevs[targetMonthIdx].toLowerCase()
            )) {
                debugLog('[SR-Exp] Clicking month element:', { tag: el.tagName, text: ownText });
                el.click();
                monthClicked = true;
                await wait(800);
                break;
            }
        }
    }

    // Reinforce value via flatpickr instance API — this fires flatpickr's onChange
    // which triggers SPL-DATE-PICKER → OC-DATEPICKER → Angular model update
    if (fpInstance && typeof fpInstance.setDate === 'function') {
        const dateObj = new Date(targetYear, targetMonthIdx, 1);
        fpInstance.setDate(dateObj, true);  // triggerChange=true fires onChange callbacks
        debugLog('[SR-Exp] Set date via flatpickr instance, dates:', fpInstance.selectedDates?.length);
        await wait(500);
    } else if (monthClicked) {
        debugLog('[SR-Exp] No flatpickr instance found anywhere, relying on click only');
    }

    const isoValue = `${targetYear}-${String(targetMonthIdx + 1).padStart(2, '0')}`;
    const formattedMMYYYY = `${String(targetMonthIdx + 1).padStart(2, '0')}/${targetYear}`;

    // Try Angular __ngContext__ to directly call CVA _onChange on the OC-DATEPICKER component.
    // ocDatePickerEl = OC-DATEPICKER element; __ngContext__ is Angular's LView; LView[8] = component instance.
    if (monthClicked && !fpInstance) {
        const ngCtx = ocDatePickerEl?.__ngContext__;
        const comp = Array.isArray(ngCtx) ? ngCtx[8] : null;
        if (comp) {
            debugLog('[SR-Exp] OC-DATEPICKER component:', comp.constructor?.name,
                'changeKeys:', Object.keys(comp).filter(k => /change|_on/i.test(k)));
            // Try common Angular CVA onChange callback patterns
            const tryCall = (fn, val) => { try { fn.call(comp, val); return true; } catch(e) { return false; } };
            const dateVal = new Date(targetYear, targetMonthIdx, 1);
            let cvaUpdated = false;
            // Try _onChange (standard Angular CVA pattern) with multiple value formats
            if (typeof comp._onChange === 'function') {
                cvaUpdated = tryCall(comp._onChange, formattedMMYYYY)
                    || tryCall(comp._onChange, dateVal)
                    || tryCall(comp._onChange, isoValue);
                debugLog('[SR-Exp] _onChange called, success:', cvaUpdated, 'val:', formattedMMYYYY);
            } else if (typeof comp.onChange === 'function') {
                cvaUpdated = tryCall(comp.onChange, formattedMMYYYY) || tryCall(comp.onChange, dateVal);
                debugLog('[SR-Exp] onChange called, success:', cvaUpdated);
            } else {
                // Log available function keys for diagnosis
                debugLog('[SR-Exp] No _onChange found. comp fns:',
                    Object.entries(comp).filter(([,v]) => typeof v === 'function').map(([k]) => k).slice(0, 20));
            }
        } else {
            debugLog('[SR-Exp] __ngContext__ not LView or no [8]:', typeof ngCtx, Array.isArray(ngCtx),
                'ocPicker:', ocDatePickerEl?.tagName, 'ngCtx[8]:', ngCtx?.[8]);
        }
        await wait(300);
    }

    // Also set via component value property + custom events (belt-and-suspenders)
    // Skip if OC-DATEPICKER is already valid (month click succeeded) — running setNativeValue
    // with the MM/YYYY formatted string would re-trigger validation and cause ng-invalid.
    const ocAlreadyValid = ocDatePickerEl?.classList?.contains('ng-valid');
    if (!fpInstance && !ocAlreadyValid) {
        // Try setting value property on OC-DATEPICKER (web component setter)
        if (ocDatePickerEl && ocDatePickerEl !== datePicker) {
            try { ocDatePickerEl.value = formattedMMYYYY; } catch(e) {}
            try { ocDatePickerEl.value = isoValue; } catch(e) {}
            // Dispatch change event on OC-DATEPICKER itself
            ocDatePickerEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        }
        datePicker.setAttribute?.('value', isoValue);
        datePicker.value = isoValue;
        // Try spl-date-picker-change with multiple detail formats
        const detailFmts = [
            { value: formattedMMYYYY },
            { value: isoValue },
            { value: new Date(targetYear, targetMonthIdx, 1) },
            formattedMMYYYY
        ];
        for (const detail of detailFmts) {
            datePicker.dispatchEvent(new CustomEvent('spl-date-picker-change', { detail, bubbles: true, composed: true }));
        }
        datePicker.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        await wait(300);

        // Also set the text input directly
        setNativeValue(input, dateInfo.formatted);
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        await wait(300);
    }

    // Close the picker — do NOT press Escape as it may cancel flatpickr selection
    await wait(200);

    // Fire blur/focusout on host elements to trigger Angular's "touched" state
    if (datePicker && datePicker !== input) {
        datePicker.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
        datePicker.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
    }
    if (host && host !== datePicker && host !== input) {
        host.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
        host.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
    }
    await wait(300);

    debugLog('[SR-Exp] Date field value after fill:', input.value, 'fpDates:', fpInstance?.selectedDates?.map(d => d.toISOString()), 'ocVal:', ocDatePickerEl?.value, 'ocClass:', ocDatePickerEl?.className);
    return true;
}

async function fillTextFieldInSection(formRoot, fieldSelector, value) {
    if (!value) return false;

    const host = querySelectorDeep(formRoot, fieldSelector);
    if (!host) {
        debugLog('[SR-Exp] Text field host not found:', fieldSelector);
        return false;
    }

    const input = getInnerFormControl(host) || host;
    debugLog('[SR-Exp] Text field input found:', {
        tag: input.tagName,
        type: input.type,
        selector: fieldSelector,
        value: value,
        hostTag: host.tagName,
        allowCustomValues: host.hasAttribute?.('allowcustomvalues')
    });

    const isSplAutocomplete = host.tagName === 'SPL-AUTOCOMPLETE';

    if (isSplAutocomplete) {
        // For spl-autocomplete: type char-by-char to trigger suggestion API calls
        input.focus?.();
        input.dispatchEvent?.(new Event('focus', { bubbles: true, composed: true }));
        input.click?.();
        await wait(200);

        // Type value char by char to simulate real user input (triggers autocomplete API)
        await replayTypingForDropdown(input, value);
        await wait(1500); // Wait for autocomplete API response

        // Search for autocomplete options in multiple places
        let options = [];
        const menuId = host.getAttribute?.('aria-controls') || input.getAttribute?.('aria-controls');

        const findAutocompleteOptions = () => {
            let found = [];
            // 1. Via aria-controls menu ID
            if (menuId) {
                const menu = document.getElementById(menuId);
                if (menu) {
                    found = [...menu.querySelectorAll('spl-autocomplete-option, [role="option"]')];
                }
            }
            // 2. In host shadow root
            if (found.length === 0 && host.shadowRoot) {
                found = [...host.shadowRoot.querySelectorAll('spl-autocomplete-option, [role="option"]')];
            }
            // 3. Deep search from host
            if (found.length === 0) {
                found = querySelectorAllDeep(host, 'spl-autocomplete-option, [role="option"]');
            }
            // Filter to visible only
            return found.filter(o => {
                const rect = o.getBoundingClientRect?.();
                return rect && rect.width > 0 && rect.height > 0;
            });
        };

        options = findAutocompleteOptions();

        // Retry with ArrowDown if no options yet
        if (options.length === 0) {
            input.dispatchEvent?.(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, composed: true }));
            input.dispatchEvent?.(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, composed: true }));
            await wait(2000);
            options = findAutocompleteOptions();
        }

        debugLog('[SR-Exp] Autocomplete options found:', options.length);

        if (options.length > 0) {
            // Find best matching option
            const normalizedValue = normalizeMatchValue(value);
            let bestOption = null;
            for (const option of options) {
                const text = extractDropdownOptionText(option);
                if (normalizeMatchValue(text) === normalizedValue) {
                    bestOption = option;
                    break;
                }
            }
            if (!bestOption) bestOption = options[0];

            const optionText = extractDropdownOptionText(bestOption);
            debugLog('[SR-Exp] Selecting autocomplete option:', optionText);

            // Click the option with full event sequence
            const target = getDropdownClickableTarget(bestOption);
            if (target) {
                target.dispatchEvent?.(new PointerEvent('pointerover', { bubbles: true, composed: true }));
                target.dispatchEvent?.(new PointerEvent('pointerenter', { bubbles: false, composed: true }));
                target.dispatchEvent?.(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
                target.dispatchEvent?.(new MouseEvent('mouseover', { bubbles: true, composed: true }));
                target.dispatchEvent?.(new MouseEvent('mouseenter', { bubbles: false, composed: true }));
                target.dispatchEvent?.(new MouseEvent('mousedown', { bubbles: true, composed: true }));
                target.click?.();
                if (optionText) setNativeValue(input, optionText);
                target.dispatchEvent?.(new MouseEvent('mouseup', { bubbles: true, composed: true }));
                target.dispatchEvent?.(new PointerEvent('pointerup', { bubbles: true, composed: true }));
                await wait(500);
            }
        } else {
            debugLog('[SR-Exp] No autocomplete options, committing custom value');
            // If allowcustomvalues, press Escape then Enter to commit
            if (host.hasAttribute('allowcustomvalues')) {
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, composed: true }));
                await wait(200);
            }
        }

        // Confirm with Enter + change events
        input.dispatchEvent?.(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true }));
        input.dispatchEvent?.(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true }));
        input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
        if (host !== input) {
            host.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
            host.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
        }

        debugLog('[SR-Exp] After autocomplete fill:', {
            inputValue: input.value,
            hostValue: host.getAttribute?.('value')
        });
    } else {
        // For regular text fields / textareas
        input.focus?.();
        await wait(100);
        setNativeValue(input, value);
        // Use InputEvent (not generic Event) for proper input simulation - Stencil/Lit frameworks
        // check instanceof InputEvent to distinguish real typing from programmatic changes
        input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: value, bubbles: true, composed: true, cancelable: true }));
        input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        // Also try execCommand insertText which triggers Angular model updates
        try {
            input.select?.();
            document.execCommand('selectAll', false);
            document.execCommand('insertText', false, value);
        } catch (e) { /* ignore */ }
        if (host !== input) {
            // OC-TEXTAREA specific: set Stencil .value prop and trigger SPL-TEXTAREA chain
            if (host.tagName === 'OC-TEXTAREA') {
                try { host.value = value; } catch (e) { /* ignore */ }
                const splTA = querySelectorDeep(host, 'spl-textarea');
                if (splTA) {
                    debugLog('[SR-Exp] Found SPL-TEXTAREA, dispatching events');
                    try { splTA.value = value; } catch (e) { /* ignore */ }
                    splTA.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: value, bubbles: true, composed: true, cancelable: true }));
                    splTA.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    // Try custom events that Stencil/Lit SPL-TEXTAREA might emit internally
                    splTA.dispatchEvent(new CustomEvent('spl-textarea-change', { detail: { value }, bubbles: true, composed: true }));
                    splTA.dispatchEvent(new CustomEvent('valueChange', { detail: value, bubbles: true, composed: true }));
                    splTA.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
                    splTA.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
                }
            }
            host.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: value, bubbles: true, composed: true, cancelable: true }));
            host.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            host.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
            host.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
            // Also dispatch on shadow root host (e.g. OC-TEXTAREA parent of SPL-TEXTAREA)
            const shadowHost = host.getRootNode?.()?.host;
            if (shadowHost && shadowHost !== host) {
                shadowHost.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: value, bubbles: true, composed: true, cancelable: true }));
                shadowHost.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                shadowHost.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
                shadowHost.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
            }
        }
        input.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
        input.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
        debugLog('[SR-Exp] Text field after fill:', { hostTag: host?.tagName, hostClass: host?.className, inputVal: input?.value?.substring(0, 50) });
    }

    await wait(300);
    return true;
}

function isSectionRequired(sectionHost) {
    if (!sectionHost) return false;

    // Direct check: look for data-test="section-required-mark" within the section
    const requiredMark = sectionHost.querySelector?.('[data-test="section-required-mark"]');
    if (requiredMark) {
        debugLog('[SR] Section required: found section-required-mark element');
        return true;
    }

    // Also check via querySelectorDeep in case it's in shadow DOM
    const deepRequiredMark = querySelectorDeep(sectionHost, '[data-test="section-required-mark"]');
    if (deepRequiredMark) {
        debugLog('[SR] Section required: found section-required-mark via deep search');
        return true;
    }

    // Check attributes
    if (sectionHost.hasAttribute?.('required')) return true;
    if (sectionHost.getAttribute?.('aria-required') === 'true') return true;

    // Check for asterisk in section title
    const titleEl = sectionHost.querySelector?.('[data-test="section-title"]');
    if (titleEl && (titleEl.textContent || '').includes('*')) return true;

    return false;
}

function findSectionByKeyword(formRoot, keyword) {
    const selectors = [
        `sr-question-field-experience`,
        `sr-question-field-education`,
        `[data-test*="${keyword}"]`,
        `[data-test*="${keyword.toLowerCase()}"]`
    ];

    for (const sel of selectors) {
        const el = querySelectorDeep(formRoot, sel);
        if (el) return el;
    }

    // Fallback: search all question fields by label text
    const allQuestionFields = querySelectorAllDeep(formRoot,
        'sr-question-field-experience, sr-question-field-education, [data-test*="question-field"]');

    for (const qf of allQuestionFields) {
        const text = getElementDeepText(qf).toLowerCase();
        if (text.includes(keyword.toLowerCase())) return qf;
    }

    return null;
}

async function fillExperienceSection(formRoot, experiences) {
    if (!Array.isArray(experiences) || experiences.length === 0) {
        debugLog('[SR-Exp] No experiences to fill');
        return;
    }

    debugLog('[SR-Exp] Looking for Experience section in DOM');

    const sectionHost = findSectionByKeyword(formRoot, 'experience');
    if (!sectionHost) {
        debugLog('[SR-Exp] Experience section not found in DOM');
        // Dump all custom elements for debugging
        const allSections = querySelectorAllDeep(formRoot, '[data-test]');
        const dataTests = Array.from(allSections).slice(0, 30).map(el => ({
            tag: el.tagName,
            dataTest: el.getAttribute('data-test'),
            text: (el.textContent || '').trim().substring(0, 50)
        }));
        debugLog('[SR-Exp] Available data-test elements:', dataTests);
        return;
    }

    debugLog('[SR-Exp] Experience section found:', {
        tag: sectionHost.tagName,
        dataTest: sectionHost.getAttribute?.('data-test'),
        hasShadow: !!sectionHost.shadowRoot,
        innerHTML: sectionHost.innerHTML?.substring(0, 1000)
    });

    const required = isSectionRequired(sectionHost);
    debugLog('[SR-Exp] Experience section required:', required);
    
    // Also dump the deep text for debugging required detection
    const sectionDeepText = getElementDeepText(sectionHost);
    debugLog('[SR-Exp] Section deep text:', sectionDeepText.substring(0, 300));

    if (!required) {
        debugLog('[SR-Exp] Experience section not required, skipping');
        return;
    }

    // Take up to 3 most recent entries (array is sorted descending by date)
    const recentExperiences = experiences.slice(0, 3);
    debugLog('[SR-Exp] Filling', recentExperiences.length, 'of', experiences.length, 'experience entries (oldest first)');

    for (let i = recentExperiences.length - 1; i >= 0; i--) {
        const exp = recentExperiences[i];
        debugLog('[SR-Exp] Filling experience entry', i, {
            title: exp.title,
            company: exp.companyName,
            location: exp.location,
            startDate: exp.startDate,
            endDate: exp.endDate,
            workingHereNow: exp.workingHereNow
        });

        // Click Add button
        const addButton = querySelectorDeep(sectionHost, 'oc-button[data-test="add-experience"], [data-test="add-experience"], [data-test="experience-add"]');
        if (!addButton) {
            debugLog('[SR-Exp] Add button not found for experience entry', i);
            // Dump section children for debugging
            const children = Array.from(sectionHost.children || []);
            debugLog('[SR-Exp] Section children:', children.map(c => ({
                tag: c.tagName,
                dataTest: c.getAttribute?.('data-test'),
                text: c.textContent?.trim()?.substring(0, 80)
            })));
            break;
        }

        debugLog('[SR-Exp] Clicking Add button:', {
            tag: addButton.tagName,
            text: addButton.textContent?.trim()?.substring(0, 50),
            dataTest: addButton.getAttribute?.('data-test')
        });
        addButton.click();
        await wait(2000);

        // Find the newly opened experience edit form
        const editForms = querySelectorAllDeep(sectionHost, '[data-test="experience-edit-form"]');
        let entryForm;
        if (editForms.length > 0) {
            entryForm = editForms[editForms.length - 1];
        } else {
            // Fallback: look for oc-experience-edit-form tag
            const ocForms = querySelectorAllDeep(sectionHost, 'oc-experience-edit-form');
            entryForm = ocForms.length > 0 ? ocForms[ocForms.length - 1] : sectionHost;
        }

        debugLog('[SR-Exp] Entry form found:', {
            tag: entryForm.tagName,
            dataTest: entryForm.getAttribute?.('data-test'),
            formsCount: editForms.length
        });

        // Find the parent oc-experience-entry for save button search
        const entryHost = querySelectorAllDeep(sectionHost, 'oc-experience-entry');
        const lastEntryHost = entryHost.length > 0 ? entryHost[entryHost.length - 1] : sectionHost;

        // Fill Title (spl-autocomplete with data-test="job-title-autocomplete" and label="Title")
        await fillTextFieldInSection(entryForm, '[data-test="job-title-autocomplete"]', exp.title);
        
        // Fill Company (spl-autocomplete with data-test="company-autocomplete")
        await fillTextFieldInSection(entryForm, '[data-test="company-autocomplete"]', exp.companyName);

        // Fill Location (spl-autocomplete with data-test="location-autocomplete")
        if (exp.location) {
            await fillTextFieldInSection(entryForm, '[data-test="location-autocomplete"]', exp.location);
        }

        // Fill Description
        await fillTextFieldInSection(entryForm, 'spl-textarea, textarea, [data-test*="description"]', exp.description || exp.brief);

        // Check "I currently work here" checkbox FIRST (before dates, so "To" date is hidden)
        if (exp.workingHereNow) {
            const checkboxHost = querySelectorDeep(entryForm, '[data-test="experience-current"]');
            if (checkboxHost) {
                // Find the actual <input type="checkbox"> deep inside oc-checkbox → spl-checkbox → shadow → input
                const innerInput = querySelectorDeep(checkboxHost, 'input[type="checkbox"]');
                const splCheckbox = querySelectorDeep(checkboxHost, 'spl-checkbox');

                debugLog('[SR-Exp] Checkbox found:', {
                    outerTag: checkboxHost.tagName,
                    splCheckbox: !!splCheckbox,
                    innerInput: !!innerInput,
                    inputChecked: innerInput?.checked,
                    splSelected: splCheckbox?.hasAttribute('selected')
                });

                if (innerInput && !innerInput.checked) {
                    // Click the actual checkbox input
                    innerInput.click();
                    await wait(800);
                    debugLog('[SR-Exp] Clicked inner checkbox input, now checked:', innerInput.checked);
                } else if (splCheckbox && !splCheckbox.hasAttribute('selected')) {
                    // Fallback: click spl-checkbox
                    splCheckbox.click();
                    await wait(800);
                } else if (!innerInput && !splCheckbox) {
                    // Last resort: click the host
                    checkboxHost.click();
                    await wait(800);
                }
                debugLog('[SR-Exp] Set currently working checkbox');
            } else {
                debugLog('[SR-Exp] Checkbox not found');
            }
        }

        // Fill dates - use actual data-test from DOM: experience-date-from, experience-date-to
        const startDate = formatDateForSmartRecruiters(exp.startDate);
        const endDate = formatDateForSmartRecruiters(exp.endDate);

        await fillDateField(entryForm, '[data-test="experience-date-from"]', startDate);

        if (!exp.workingHereNow) {
            await fillDateField(entryForm, '[data-test="experience-date-to"]', endDate);
        }

        await wait(2000); // Wait for Angular to process all field changes before Save

        // Click Save button - search in entry form and parent oc-experience-entry
        let saveButton = querySelectorDeep(entryForm, '[data-test*="save"], button[type="submit"]');
        if (!saveButton) {
            // Search in parent oc-experience-entry
            saveButton = querySelectorDeep(lastEntryHost, '[data-test*="save"], oc-button[data-test*="save"]');
        }
        if (!saveButton) {
            // Try finding any button with "Save" text
            const allBtnsInEntry = querySelectorAllDeep(lastEntryHost, 'button, oc-button, spl-button');
            for (const btn of allBtnsInEntry) {
                if ((btn.textContent || '').trim().toLowerCase().includes('save')) {
                    saveButton = btn;
                    break;
                }
            }
        }

        if (saveButton) {
            // Find the actual inner <button> element (oc-button → spl-button → shadow → button)
            const innerButton = querySelectorDeep(saveButton, 'button') || saveButton;

            // Diagnostic: check ALL ng-invalid elements right before Save click
            const ocPickersBeforeSave = querySelectorAllDeep(entryForm, 'oc-datepicker');
            const invalidBeforeSave = querySelectorAllDeep(entryForm, '.ng-invalid');
            debugLog('[SR-Exp] OC-DATEPICKER state before Save:', ocPickersBeforeSave.map(p => ({ class: p.className, value: p.value })));
            debugLog('[SR-Exp] All ng-invalid before Save:', invalidBeforeSave.map(el => ({ tag: el.tagName, class: el.className.substring(0, 80), text: (el.textContent || '').substring(0, 60) })));
            debugLog('[SR-Exp] Clicking Save button:', {
                outerTag: saveButton.tagName,
                innerTag: innerButton.tagName,
                dataTest: saveButton.getAttribute?.('data-test')
            });
            innerButton.click();
            await wait(2000);

            // Check if form closed (save succeeded)
            const remainingForms = querySelectorAllDeep(sectionHost, '[data-test="experience-edit-form"]');
            if (remainingForms.length > 0) {
                debugLog('[SR-Exp] Form still open after Save click, retrying description fill');
                // Retry: re-fill the description textarea and click Save again
                const retryForm = remainingForms[remainingForms.length - 1];
                const descHost = querySelectorDeep(retryForm, 'oc-textarea, spl-textarea, textarea');
                if (descHost) {
                    const descInput = getInnerFormControl(descHost) || descHost;
                    const descValue = exp.description || exp.brief || '';
                    debugLog('[SR-Exp] Retrying description fill, value length:', descValue.length);
                    descInput.focus?.();
                    await wait(200);
                    setNativeValue(descInput, descValue);
                    descInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    descInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                    // Dispatch on each ancestor up through shadow DOM
                    let el = descInput;
                    while (el) {
                        const shadowHost = el.getRootNode?.()?.host;
                        if (shadowHost && shadowHost !== el) {
                            shadowHost.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                            shadowHost.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                            el = shadowHost;
                        } else {
                            break;
                        }
                    }
                    descInput.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
                    await wait(800);
                    // Click Save again
                    innerButton.click();
                    await wait(2000);
                    const formsAfterRetry = querySelectorAllDeep(sectionHost, '[data-test="experience-edit-form"]');
                    if (formsAfterRetry.length > 0) {
                        debugLog('[SR-Exp] Form still open after retry, clicking Cancel to close');
                        // Find cancel button: look for oc-button/spl-button with data-test*="cancel",
                        // then click the inner <button> element for it to register
                        const cancelHost = querySelectorDeep(formsAfterRetry[formsAfterRetry.length - 1], '[data-test*="cancel"]');
                        const cancelBtn = cancelHost ? (querySelectorDeep(cancelHost, 'button') || cancelHost) : null;
                        debugLog('[SR-Exp] Cancel button found:', { host: cancelHost?.tagName, hostDataTest: cancelHost?.getAttribute?.('data-test'), inner: cancelBtn?.tagName });
                        if (cancelBtn) { cancelBtn.click(); await wait(1000); }
                    } else {
                        debugLog('[SR-Exp] Form closed after retry Save');
                    }
                }
            } else {
                debugLog('[SR-Exp] Form closed successfully after Save');
            }
        } else {
            debugLog('[SR-Exp] Save button not found');
        }
    }

    debugLog('[SR-Exp] Experience section fill completed');
}

async function fillEducationSection(formRoot, educations) {
    if (!Array.isArray(educations) || educations.length === 0) {
        debugLog('[SR-Edu] No educations to fill');
        return;
    }

    debugLog('[SR-Edu] Looking for Education section in DOM');

    const sectionHost = findSectionByKeyword(formRoot, 'education');
    if (!sectionHost) {
        debugLog('[SR-Edu] Education section not found in DOM');
        return;
    }

    debugLog('[SR-Edu] Education section found:', {
        tag: sectionHost.tagName,
        dataTest: sectionHost.getAttribute?.('data-test')
    });

    const required = isSectionRequired(sectionHost);
    debugLog('[SR-Edu] Education section required:', required);

    if (!required) {
        debugLog('[SR-Edu] Education section not required, skipping');
        return;
    }

    // Take up to 3 most recent entries (array is sorted descending by date)
    const recentEducations = educations.slice(0, 3);
    debugLog('[SR-Edu] Filling', recentEducations.length, 'of', educations.length, 'education entries (oldest first)');

    for (let i = recentEducations.length - 1; i >= 0; i--) {
        const edu = recentEducations[i];
        debugLog('[SR-Edu] Filling education entry', i, {
            school: edu.school,
            degree: edu.degree,
            fieldOfStudy: edu.fieldOfStudy,
            startDate: edu.startDate,
            endDate: edu.endDate
        });

        const addButton = querySelectorDeep(sectionHost, 'oc-button[data-test="add-education"], [data-test="add-education"], [data-test="education-add"]');
        if (!addButton) {
            debugLog('[SR-Edu] Add button not found');
            break;
        }

        addButton.click();
        await wait(2000);

        // Find the newly opened education edit form
        const editForms = querySelectorAllDeep(sectionHost, '[data-test="education-edit-form"]');
        let entryForm;
        if (editForms.length > 0) {
            entryForm = editForms[editForms.length - 1];
        } else {
            const ocForms = querySelectorAllDeep(sectionHost, 'oc-education-edit-form');
            entryForm = ocForms.length > 0 ? ocForms[ocForms.length - 1] : sectionHost;
        }

        // Find parent oc-education-entry for save button search
        const entryHosts = querySelectorAllDeep(sectionHost, 'oc-education-entry');
        const lastEntryHost = entryHosts.length > 0 ? entryHosts[entryHosts.length - 1] : sectionHost;

        debugLog('[SR-Edu] Entry form found:', {
            tag: entryForm.tagName,
            dataTest: entryForm.getAttribute?.('data-test'),
            formsCount: editForms.length
        });

        // Fill Institution (spl-autocomplete with data-test="school-autocomplete")
        await fillTextFieldInSection(entryForm, '[data-test="school-autocomplete"], [label*="Institution"], [label*="School"]', edu.school);

        // Fill Major / Field of Study (spl-autocomplete or spl-input)
        await fillTextFieldInSection(entryForm, '[data-test="major-autocomplete"], [data-test*="major"], [label*="Major"]', edu.fieldOfStudy);

        // Fill Degree (spl-autocomplete or spl-dropdown)
        await fillTextFieldInSection(entryForm, '[data-test="degree-autocomplete"], [data-test*="degree"], [label*="Degree"]', edu.degree);

        // Fill Description
        await fillTextFieldInSection(entryForm, 'spl-textarea, textarea, [data-test*="description"]', null);

        // Fill dates
        const startDate = formatDateForSmartRecruiters(edu.startDate);
        const endDate = formatDateForSmartRecruiters(edu.endDate);

        await fillDateField(entryForm, '[data-test="education-date-from"], [data-test*="start-date"], [label*="From"]', startDate);
        await fillDateField(entryForm, '[data-test="education-date-to"], [data-test*="end-date"], [label*="To"]', endDate);

        await wait(2000);

        // Click Save button - search in entry form and parent oc-education-entry
        let saveButton = querySelectorDeep(entryForm, '[data-test*="save"], button[type="submit"]');
        if (!saveButton) {
            saveButton = querySelectorDeep(lastEntryHost, '[data-test*="save"], oc-button[data-test*="save"]');
        }
        if (!saveButton) {
            const allBtnsInEntry = querySelectorAllDeep(lastEntryHost, 'button, oc-button, spl-button');
            for (const btn of allBtnsInEntry) {
                if ((btn.textContent || '').trim().toLowerCase().includes('save')) {
                    saveButton = btn;
                    break;
                }
            }
        }

        if (saveButton) {
            const innerButton = querySelectorDeep(saveButton, 'button') || saveButton;
            debugLog('[SR-Edu] Clicking Save:', {
                outerTag: saveButton.tagName,
                innerTag: innerButton.tagName,
                dataTest: saveButton.getAttribute?.('data-test')
            });
            innerButton.click();
            await wait(2000);
        } else {
            debugLog('[SR-Edu] Save button not found');
            const allButtons = querySelectorAllDeep(lastEntryHost, 'button, [role="button"], oc-button');
            debugLog('[SR-Edu] All buttons:', allButtons.map(b => ({
                tag: b.tagName,
                text: b.textContent?.trim()?.substring(0, 50),
                dataTest: b.getAttribute?.('data-test')
            })));
        }
    }

    debugLog('[SR-Edu] Education section fill completed');
}

// ===================== End Experience & Education =====================

function isPlaceholderDropdownValue(value) {
    const lower = String(value || '').toLowerCase().trim();
    return !lower
        || lower === 'select one'
        || lower === 'select'
        || lower === 'choose one'
        || lower.includes('select an option')
        || lower.includes('search by')
        || lower.includes('value is required');
}

function isVoluntarySelfIdDropdownLabel(label) {
    const normalized = String(label || '').toLowerCase();
    return /disability|veteran|ethnic|race|gender identity|self.identif|ofccp|eeo|protected veteran|lgbtq|sexual orientation|hispanic|latino|decline to self|public burden/i.test(normalized);
}

async function scrollToRevealLazySections() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
    await wait(2000);
    window.scrollTo({ top: 0, behavior: 'instant' });
    await wait(400);
}

const DECLINE_DROPDOWN_PATTERNS = [
    /do not wish to disclose/i,
    /don't wish to answer/i,
    /do not wish to answer/i,
    /choose not to answer/i,
    /prefer not to (say|disclose)/i,
    /decline to self[- ]?identify/i,
    /^decline$/i,
    /no, i do not have a disability/i,
    /no, i don't have a disability/i,
];

async function openSmartRecruitersDropdown(inputElement) {
    const dropdownHost = getSmartRecruitersDropdownHost(inputElement);
    const menuId = inputElement.getAttribute?.('aria-controls') || dropdownHost?.getAttribute?.('aria-controls');

    inputElement.focus?.();
    inputElement.dispatchEvent?.(new Event('focus', {bubbles: true, composed: true}));
    inputElement.click?.();
    await wait(400);

    const arrowInit = {key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, composed: true};
    inputElement.dispatchEvent?.(new KeyboardEvent('keydown', arrowInit));
    inputElement.dispatchEvent?.(new KeyboardEvent('keyup', arrowInit));
    await wait(600);

    const options = await waitForDropdownOptions(dropdownHost, menuId, 8000);
    return { dropdownHost, menuId, options };
}

async function clickDropdownOption(inputElement, selectedOption, selectedOptionText, dropdownHost) {
    const target = getDropdownClickableTarget(selectedOption);
    if (!target) {
        return false;
    }

    target.dispatchEvent?.(new PointerEvent('pointerover', {bubbles: true, composed: true}));
    target.dispatchEvent?.(new PointerEvent('pointerenter', {bubbles: false, composed: true}));
    target.dispatchEvent?.(new PointerEvent('pointerdown', {bubbles: true, composed: true}));
    target.dispatchEvent?.(new MouseEvent('mouseover', {bubbles: true, composed: true}));
    target.dispatchEvent?.(new MouseEvent('mouseenter', {bubbles: false, composed: true}));
    target.dispatchEvent?.(new MouseEvent('mousedown', {bubbles: true, composed: true}));
    target.click?.();
    if (selectedOptionText) {
        setNativeValue(inputElement, selectedOptionText);
    }
    target.dispatchEvent?.(new MouseEvent('mouseup', {bubbles: true, composed: true}));
    target.dispatchEvent?.(new PointerEvent('pointerup', {bubbles: true, composed: true}));

    await wait(200);
    const enterInit = {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true};
    inputElement.dispatchEvent?.(new KeyboardEvent('keydown', enterInit));
    inputElement.dispatchEvent?.(new KeyboardEvent('keyup', enterInit));
    inputElement.dispatchEvent?.(new Event('change', {bubbles: true, composed: true}));

    if (dropdownHost?.hasAttribute?.('open')) {
        dropdownHost.removeAttribute('open');
    }
    if (inputElement.getAttribute?.('aria-expanded') === 'true') {
        const escapeInit = {key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, composed: true};
        inputElement.dispatchEvent?.(new KeyboardEvent('keydown', escapeInit));
        inputElement.dispatchEvent?.(new KeyboardEvent('keyup', escapeInit));
    }

    return true;
}

/**
 * Open dropdown once and pick the best decline / prefer-not-to-answer option.
 * Returns selected option text or null.
 */
async function selectBestDeclineDropdownOption(inputElement) {
    if (!inputElement) {
        return null;
    }

    const { dropdownHost, options } = await openSmartRecruitersDropdown(inputElement);
    if (!options.length) {
        debugLog('[SR] Decline dropdown: no options found', { label: extractFieldLabelData(inputElement).label });
        return null;
    }

    const optionEntries = options.map((option) => {
        const text = extractDropdownOptionText(option) || option.textContent?.trim() || '';
        return { option, text };
    }).filter((entry) => entry.text);

    for (const pattern of DECLINE_DROPDOWN_PATTERNS) {
        const match = optionEntries.find((entry) => pattern.test(entry.text));
        if (match) {
            debugLog('[SR] Decline dropdown: selecting option', {
                label: extractFieldLabelData(inputElement).label,
                selectedText: match.text,
                pattern: String(pattern)
            });
            const clicked = await clickDropdownOption(inputElement, match.option, match.text, dropdownHost);
            return clicked ? match.text : null;
        }
    }

    debugLog('[SR] Decline dropdown: no matching option', {
        label: extractFieldLabelData(inputElement).label,
        options: optionEntries.map((entry) => entry.text)
    });
    return null;
}

/**
 * Try to select a "decline / prefer not to answer" option from a dropdown.
 * Tries several common phrasings used for voluntary EEO/disability fields.
 * Returns the selected option text or null if nothing matched.
 */
async function selectDeclineDropdownOption(inputElement) {
    const best = await selectBestDeclineDropdownOption(inputElement);
    if (best) {
        return best;
    }

    const declinePhrases = [
        "I Do Not Wish to Disclose",
        "I Don't Wish To Answer",
        "I Do Not Wish To Answer",
        "I Do Not Wish To Disclose",
        "I Choose Not To Answer",
        "Prefer Not To Say",
        "Prefer Not To Disclose",
        "Decline To Self-Identify",
        "Decline",
        "No, I Don't Have A Disability",
        "No, I Do Not Have A Disability",
    ];
    for (const phrase of declinePhrases) {
        const matched = await selectFirstDropdownOption(inputElement, phrase);
        if (matched) {
            return phrase;
        }
    }
    return null;
}

function isLabelAlreadyFilled(label, alreadyFilledLabels) {
    if (!label || !alreadyFilledLabels) {
        return false;
    }
    const trimmed = label.trim();
    if (alreadyFilledLabels.has(trimmed)) {
        return true;
    }
    const normalized = normalizeMatchValue(trimmed);
    for (const filledLabel of alreadyFilledLabels) {
        if (normalizeMatchValue(filledLabel) === normalized) {
            return true;
        }
    }
    return false;
}

function getSmartRecruitersDropdownDisplayValue(element) {
    const inner = getInnerFormControl(element) || element;
    const rawValue = String(inner.value || '').trim();
    if (rawValue && !isPlaceholderDropdownValue(rawValue)) {
        return rawValue;
    }

    const dropdownHost = getSmartRecruitersDropdownHost(inner) || element;
    const questionHost = findHostAncestor(inner, 'sr-question-field-radio, sr-question-field-checkbox, sr-question-field-select, sr-question-field-text, oc-question-field, [data-test^="question-"]');

    const searchRoots = [dropdownHost, questionHost, element].filter(Boolean);
    for (const root of searchRoots) {
        const buttons = querySelectorAllDeep(root, 'button[aria-expanded="false"], [role="combobox"]');
        for (const button of buttons) {
            const text = cleanLabelText(getElementDeepText(button));
            if (text && text.length <= 80 && !isPlaceholderDropdownValue(text)) {
                return text;
            }
        }

        const hostText = cleanLabelText(getElementDeepText(root));
        if (hostText && hostText.length <= 80 && !isPlaceholderDropdownValue(hostText)) {
            const labelInfo = extractFieldLabelData(inner);
            if (labelInfo?.label) {
                const labelNorm = normalizeMatchValue(labelInfo.label);
                const hostNorm = normalizeMatchValue(hostText);
                if (hostNorm.startsWith(labelNorm)) {
                    const remainder = hostText.slice(labelInfo.label.length).replace(/^[*:\s]+/, '').trim();
                    if (remainder && !isPlaceholderDropdownValue(remainder)) {
                        return remainder;
                    }
                }
                if (!hostNorm.includes(labelNorm) && hostText.length <= 50) {
                    return hostText;
                }
            } else if (hostText.length <= 50) {
                return hostText;
            }
        }
    }

    return rawValue;
}

function isSmartRecruitersDropdownFilled(element) {
    const display = getSmartRecruitersDropdownDisplayValue(element);
    return !!(display && !isPlaceholderDropdownValue(display));
}

function isNoticePeriodLabel(label) {
    return /notice period|availability to join|availability.*join|join.*availability/i.test(String(label || ''));
}

function parseNoticePeriodDays(profile) {
    const raw = profile?.noticePeriodDays ?? profile?.general?.noticePeriodDays ?? '';
    const parsed = parseInt(String(raw).trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function matchNoticePeriodOption(days, optionTexts) {
    const options = optionTexts.filter(Boolean);
    const rules = [
        { max: 0, test: (text) => /immediate/i.test(text) },
        { max: 15, test: (text) => /0[\s-]*15|within 15|15 days or less/i.test(text) },
        { max: 30, test: (text) => /15[\s-]*30/i.test(text) },
        { max: 45, test: (text) => /30[\s-]*45/i.test(text) },
        { max: 60, test: (text) => /45[\s-]*60/i.test(text) },
        { max: 90, test: (text) => /60[\s-]*90/i.test(text) },
        { max: Infinity, test: (text) => /more than 90|90\+|>\s*90/i.test(text) }
    ];

    for (const rule of rules) {
        if (days <= rule.max) {
            const match = options.find(rule.test);
            if (match) {
                return match;
            }
        }
    }

    return null;
}

async function pickNoticePeriodDropdown(inputElement, profile) {
    const days = parseNoticePeriodDays(profile);
    if (days === null || !inputElement) {
        return false;
    }

    const dropdownHost = getSmartRecruitersDropdownHost(inputElement);
    const menuId = inputElement.getAttribute?.('aria-controls') || dropdownHost?.getAttribute?.('aria-controls');
    inputElement.focus?.();
    inputElement.click?.();
    await wait(400);

    const options = await waitForDropdownOptions(dropdownHost, menuId, 5000);
    const optionTexts = options.map((option) => extractDropdownOptionText(option) || option.textContent?.trim() || '').filter(Boolean);
    const targetText = matchNoticePeriodOption(days, optionTexts);
    if (!targetText) {
        debugLog('[SR] Notice period: no option matched profile days', { days, optionTexts });
        return false;
    }

    debugLog('[SR] Notice period: selecting matched option', { days, targetText });
    return selectFirstDropdownOption(inputElement, targetText);
}

/**
 * After a submit attempt produces "Value is required" errors, look for any newly-visible
 * required fields (e.g. the OFCCP Voluntary Self-ID of Disability section that SmartRecruiters
 * renders only after the first submit). Fill each one with the first available option and
 * return true if anything was filled so the caller can re-submit.
 */
async function fillMissedEmptyDropdowns(alreadyFilledLabels) {
    // Scan the full page for voluntary self-ID dropdowns that were missed (e.g. disability section).
    const allInputs = querySelectorAllDeep(document.body, 'spl-input, spl-autocomplete');
    let filled = false;

    for (const el of allInputs) {
        const rect = el.getBoundingClientRect?.();
        if (!rect || (rect.width === 0 && rect.height === 0)) continue;

        const rootNode = el.getRootNode?.();
        if (rootNode && rootNode.host) {
            const hostTag = (rootNode.host.tagName || '').toLowerCase();
            if (hostTag === 'spl-input' || hostTag === 'spl-autocomplete') continue;
        }

        const dataTest = el.getAttribute?.('data-test') || '';
        if (dataTest.includes('language')) continue;

        const inner = getInnerFormControl(el) || el;
        const labelInfo = extractFieldLabelData(el);
        const lbl = (labelInfo?.label || '').trim();
        if (!lbl) continue;

        if (lbl.toLowerCase().includes('language')) continue;
        if (!isVoluntarySelfIdDropdownLabel(lbl)) continue;
        if (isLabelAlreadyFilled(lbl, alreadyFilledLabels)) {
            debugLog('[SR] Pre-submit: skipping already-filled dropdown', { label: lbl });
            continue;
        }
        if (isSmartRecruitersDropdownFilled(el)) {
            debugLog('[SR] Pre-submit: skipping filled dropdown', { label: lbl, display: getSmartRecruitersDropdownDisplayValue(el) });
            continue;
        }

        debugLog('[SR] Pre-submit: found unfilled voluntary dropdown', { label: lbl });
        scrollToTargetAdjusted(el, getHeaderHeight());
        try {
            const selectedPhrase = await selectDeclineDropdownOption(inner);
            if (selectedPhrase) {
                filled = true;
                debugLog('[SR] Pre-submit: dropdown filled', { label: lbl, value: inner.value, phrase: selectedPhrase });
            } else {
                debugLog('[SR] Pre-submit: no decline option matched', { label: lbl });
            }
        } catch (err) {
            console.warn('[SmartRecruiters] Pre-submit fill error', { label: lbl, err: err?.message });
        }
        await wait(600);
    }

    if (!filled) {
        debugLog('[SR] Pre-submit: no missed empty dropdowns found');
    }
    return filled;
}

async function fillPostSubmitRequiredFields(alreadyFilledLabels) {
    let filled = false;

    // Strategy 1: find "Value is required" error elements and walk up to find the nearby input
    const errorEls = [...querySelectorAllDeep(document.body, '[class*="error"], [data-test*="error"], .alert-danger, [role="alert"]')]
        .filter(el => {
            const txt = (el.textContent || '').trim().toLowerCase();
            return txt.includes('value is required') || txt.includes('required');
        });

    debugLog('[SR] Post-submit: error elements found', { count: errorEls.length });

    for (const errEl of errorEls) {
        // Walk up to find a question container, then find an input within it
        let container = errEl;
        for (let i = 0; i < 8; i++) {
            container = container.parentElement;
            if (!container) break;

            // Look for an spl-input, spl-autocomplete, or input inside this container
            const inputs = querySelectorAllDeep(container, 'spl-input, spl-autocomplete, input[type="text"], input[type="search"]');
            if (inputs.length > 0) {
                const el = inputs[0];
                const innerEl = getInnerFormControl(el) || el;

                const labelInfo = extractFieldLabelData(el);
                const lbl = (labelInfo?.label || '').trim();
                if (!lbl || !isVoluntarySelfIdDropdownLabel(lbl)) continue;
                if (isLabelAlreadyFilled(lbl, alreadyFilledLabels)) continue;
                if (isSmartRecruitersDropdownFilled(el)) continue;

                debugLog('[SR] Post-submit: filling empty voluntary field near error', { label: lbl, tag: el.tagName });
                scrollToTargetAdjusted(el, getHeaderHeight());
                try {
                    const selectedPhrase = await selectDeclineDropdownOption(innerEl);
                    if (selectedPhrase) {
                        filled = true;
                        debugLog('[SR] Post-submit: dropdown filled', { label: lbl, phrase: selectedPhrase });
                    }
                } catch (err) {
                    console.warn('[SmartRecruiters] Post-submit fill error', { label: lbl, err: err?.message });
                }
                await wait(600);
                break;
            }
        }
    }

    // Strategy 2: if no error elements, scan for visible empty required dropdowns in document.body
    if (!filled) {
        const allInputs = querySelectorAllDeep(document.body, 'spl-input, spl-autocomplete');
        for (const el of allInputs) {
            const rect = el.getBoundingClientRect?.();
            if (!rect || (rect.width === 0 && rect.height === 0)) continue;

            // Skip inner shadow-DOM implementation details
            const rootNode = el.getRootNode?.();
            if (rootNode && rootNode.host) {
                const hostTag = (rootNode.host.tagName || '').toLowerCase();
                if (hostTag === 'spl-input' || hostTag === 'spl-autocomplete') continue;
            }

            // Skip language fields by data-test
            const dataTest = el.getAttribute?.('data-test') || '';
            if (dataTest.includes('language')) continue;

            const inner = getInnerFormControl(el) || el;

            const labelInfo = extractFieldLabelData(el);
            const lbl = (labelInfo?.label || '').trim();
            if (!lbl) continue;
            if (lbl.toLowerCase().includes('language')) continue;
            if (!isVoluntarySelfIdDropdownLabel(lbl)) continue;
            if (isLabelAlreadyFilled(lbl, alreadyFilledLabels)) continue;
            if (isSmartRecruitersDropdownFilled(el)) continue;

            debugLog('[SR] Post-submit: filling visible empty voluntary dropdown', { label: lbl });
            scrollToTargetAdjusted(el, getHeaderHeight());
            try {
                const selectedPhrase = await selectDeclineDropdownOption(inner);
                if (selectedPhrase) {
                    filled = true;
                    debugLog('[SR] Post-submit: dropdown filled', { label: lbl, phrase: selectedPhrase });
                }
            } catch (err) {
                console.warn('[SmartRecruiters] Post-submit fill error', { label: lbl, err: err?.message });
            }
            await wait(600);
        }
    }

    if (!filled) {
        debugLog('[SR] Post-submit: no new fields could be filled');
    }

    return filled;
}

async function processSmartRecruitersStep({devMode, showStatusMessage = false, languages = [], profile = null}) {
    console.log('[SmartRecruiters] Processing application step', languages)
    if (showStatusMessage) {
        appendStatusMessage('Collecting fields and application questions...');
    }

    const formRoot = document.querySelector('oc-application-form') || document.querySelector('form') || document.body;

    // Scroll to bottom to trigger lazy-loaded sections (e.g. Voluntary Self-ID of Disability)
    await scrollToRevealLazySections();

    if (Array.isArray(languages) && languages.length > 0) {
        try {
            await fillLanguageEntries(languages, formRoot);
        } catch (err) {
            console.warn('[SmartRecruiters] Unable to prefill language entries', err);
        }
    }

    const controls = collectFormControls(formRoot);

    // Also scan the full document body to catch controls outside formRoot
    // (e.g. the "Voluntary Self-ID of Disability" section rendered as a sibling component)
    if (formRoot !== document.body) {
        const bodyControls = collectFormControls(document.body);
        for (const ctrl of bodyControls) {
            if (!controls.includes(ctrl)) {
                controls.push(ctrl);
            }
        }
    }

    // Collect spl-radio and spl-checkbox elements that might have been missed
    console.log('[SmartRecruiters] ========== STARTING CUSTOM ELEMENT SEARCH ==========');
    console.log('[SmartRecruiters] Searching for additional spl-radio and spl-checkbox elements');
    
    // Search for both direct elements and elements inside sr-question-field-* containers
    // Use document.body to catch sections (e.g. disability) rendered outside formRoot
    const srSearchRoot = document.body;
    const questionFieldRadios = querySelectorAllDeep(srSearchRoot, 'sr-question-field-radio');
    const questionFieldCheckboxes = querySelectorAllDeep(srSearchRoot, 'sr-question-field-checkbox');
    
    console.log('[SmartRecruiters] Found question field containers:', {
        questionFieldRadios: questionFieldRadios.length,
        questionFieldCheckboxes: questionFieldCheckboxes.length
    });
    
    // Detailed logging for each question field
    questionFieldRadios.forEach((qf, idx) => {
        console.log(`[SmartRecruiters] Question field radio ${idx}:`, {
            tagName: qf.tagName,
            hasShadowRoot: !!qf.shadowRoot,
            innerHTML: qf.innerHTML.substring(0, 200)
        });
        
        // Log what's inside shadow root
        if (qf.shadowRoot) {
            const shadowChildren = qf.shadowRoot.querySelectorAll('*');
            console.log(`[SmartRecruiters]   Shadow root has ${shadowChildren.length} elements`);
            shadowChildren.forEach((child, childIdx) => {
                if (childIdx < 10) { // Only log first 10
                    console.log(`[SmartRecruiters]     - ${child.tagName}`, {
                        hasShadowRoot: !!child.shadowRoot
                    });
                }
            });
        }
    });
    
    // Find all spl-radio and spl-checkbox elements globally first
    const allSplRadios = querySelectorAllDeep(formRoot, 'spl-radio');
    const allSplCheckboxes = querySelectorAllDeep(formRoot, 'spl-checkbox');
    
    console.log('[SmartRecruiters] Found spl elements globally:', {
        splRadios: allSplRadios.length,
        splCheckboxes: allSplCheckboxes.length
    });
    
    // Log details of first few spl-radio elements
    allSplRadios.slice(0, 5).forEach((radio, idx) => {
        console.log(`[SmartRecruiters] spl-radio ${idx}:`, {
            tagName: radio.tagName,
            id: radio.id,
            label: radio.getAttribute('label'),
            value: radio.getAttribute('value'),
            hasShadowRoot: !!radio.shadowRoot
        });
        
        if (radio.shadowRoot) {
            const input = radio.shadowRoot.querySelector('input');
            console.log(`[SmartRecruiters]   Input in shadow root:`, {
                found: !!input,
                type: input?.type,
                name: input?.name,
                value: input?.value
            });
        }
    });
    
    // Collect unique elements
    const splRadios = [...allSplRadios];
    const splCheckboxes = [...allSplCheckboxes];
    
    const allCustomElements = [...new Set([...splRadios, ...splCheckboxes])];
    console.log('[SmartRecruiters] Total unique custom elements to process:', allCustomElements.length);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const splElement of allCustomElements) {
        console.log('[SmartRecruiters] Processing custom element:', {
            tagName: splElement.tagName,
            id: splElement.id,
            label: splElement.getAttribute('label'),
            value: splElement.getAttribute('value')
        });
        
        // Enable debug logging for first failed element
        const shouldDebug = failCount === 0;
        const innerControl = getInnerFormControl(splElement, 10, new Set(), shouldDebug);
        
        if (innerControl) {
            console.log('[SmartRecruiters]   ✓ Found inner control:', {
                type: innerControl.type,
                id: innerControl.id,
                name: innerControl.name,
                value: innerControl.value,
                alreadyInList: controls.includes(innerControl)
            });
            
            if (!controls.includes(innerControl) && isSupportedControl(innerControl)) {
                controls.push(innerControl);
                successCount++;
                console.log('[SmartRecruiters]   ✓ Added to controls list');
            }
        } else {
            failCount++;
            console.warn('[SmartRecruiters]   ✗ Failed to extract inner control from:', {
                tagName: splElement.tagName,
                id: splElement.id,
                hasShadowRoot: !!splElement.shadowRoot
            });
            
            // Add detailed inspection for failed element
            if (failCount === 1) {
                console.log('[SmartRecruiters] Detailed inspection of failed element:');
                if (splElement.shadowRoot) {
                    const shadowChildren = Array.from(splElement.shadowRoot.children);
                    console.log('[SmartRecruiters] Shadow root children:', shadowChildren.map(c => ({
                        tag: c.tagName,
                        hasShadow: !!c.shadowRoot,
                        id: c.id
                    })));
                }
            }
        }
    }

    console.log('[SmartRecruiters] ========== CUSTOM ELEMENT SEARCH COMPLETE ==========');
    console.log('[SmartRecruiters] Results:', {
        successCount,
        failCount,
        totalControls: controls.length
    });

    const fields = [];
    const groupedMultiChoice = new Map();

    for (const control of controls) {
        if (!control || !control.isConnected) {
            continue;
        }

        const type = getControlType(control);
        if (!type) {
            continue;
        }

        const labelInfo = extractFieldLabelData(control);
        const {label, requiredHint} = labelInfo;
        let normalizedLabel = label ? label.trim() : '';
        let questionInfo = null;

        if (type === 'radio' || type === 'checkbox') {
            questionInfo = findQuestionGroupInfo(control, labelInfo);
            if (questionInfo?.label) {
                normalizedLabel = questionInfo.label;
            }
        }

        normalizedLabel = augmentFieldLabel(normalizedLabel);
        if (questionInfo?.label) {
            questionInfo.label = augmentFieldLabel(questionInfo.label);
        }

        const labelsToCheck = [normalizedLabel, labelInfo.label, questionInfo?.label];
        if (labelsToCheck.some((label) => shouldIgnoreLanguageLabel(label))) {
            console.log('[SmartRecruiters] Skipping language field from server payload', {
                label: normalizedLabel,
                controlId: control.id
            });
            continue;
        }

        if (!normalizedLabel) {
            console.warn('[SmartRecruiters] Skipping control without label', control);
            continue;
        }

        const shouldSkip = SKIP_WORDS.some((skipWord) => normalizedLabel.toLowerCase().includes(skipWord.toLowerCase()));
        if (shouldSkip) {
            continue;
        }

        const required = isControlRequired(control) || requiredHint || questionInfo?.requiredHint;

        if (type === 'radio' || type === 'checkbox') {
            const key = questionInfo?.host || (control.name ? `name::${control.name}` : `${type}::${normalizedLabel}`);
            let field = groupedMultiChoice.get(key);
            if (!field) {
                field = {
                    element: [],
                    type,
                    label: normalizedLabel,
                    required,
                    options: []
                };
                groupedMultiChoice.set(key, field);
                fields.push(field);
                console.log('[SmartRecruiters] Created multi-choice field', {
                    key: key instanceof Element ? key.tagName : key,
                    label: normalizedLabel,
                    controlId: control.id,
                    name: control.name,
                    questionLabel: questionInfo?.label
                });
            }

            field.element.push(control);
            if (!field.required && required) {
                field.required = true;
            }

            if (questionInfo?.label && field.label !== questionInfo.label) {
                console.log('[SmartRecruiters] Updating field label from question info', {
                    previous: field.label,
                    next: questionInfo.label
                });
                field.label = questionInfo.label;
            }

            const optionLabel = findOptionLabel(control);
            if (optionLabel && !field.options.includes(optionLabel)) {
                field.options.push(optionLabel);
                console.log('[SmartRecruiters] Added option to multi-choice field', {
                    fieldLabel: field.label,
                    optionLabel
                });
            }
        } else {
            let effectiveType = type;
            let options = null;

            if (type === 'select') {
                options = [...control.options || []]
                    .filter((option) => option.value && option.value.length > 0)
                    .map((option) => cleanLabelText(option.text));
            } else if (isSmartRecruitersDropdownInput(control)) {
                try {
                    const dropdownOptions = await collectSmartRecruitersDropdownOptions(control);
                    if (dropdownOptions && dropdownOptions.length > 0) {
                        effectiveType = 'select';
                        options = dropdownOptions;
                    }
                } catch (err) {
                    console.warn('[SmartRecruiters] Failed to inspect dropdown options', {
                        label: normalizedLabel,
                        error: err
                    });
                }
            }

            const field = {
                element: control,
                type: effectiveType,
                label: normalizedLabel,
                required
            };

            if (options && options.length > 0) {
                field.options = options;
                console.log('[SmartRecruiters] Field options prepared', {
                    label: normalizedLabel,
                    type: effectiveType,
                    optionCount: options.length
                });
            }

            fields.push(field);
        }
    }

    if (fields.length <= 0) {
        debugLog('[SR] No form fields found on page');
        throw new SendCvError('Fields not found');
    }
    debugLog('[SR] Collected fields', { count: fields.length, labels: fields.map(f => f.label) });

    mergeSmartRecruitersPhoneFields(fields);

    // Fill Experience and Education sections from profile data AFTER collecting fields
    // but BEFORE sending them to AI. This ensures exp/edu form fields don't leak into streamVacancyFields.
    if (profile) {
        debugLog('[SR] Profile data available for section fill:', {
            experiencesCount: profile.experiences?.length,
            educationsCount: profile.educations?.length
        });

        try {
            await fillExperienceSection(formRoot, profile.experiences);
        } catch (err) {
            debugLog('[SR-Exp] Error filling Experience section:', err?.message, err?.stack);
            console.error('[SmartRecruiters] Error filling Experience section', err);
        }

        try {
            await fillEducationSection(formRoot, profile.educations);
        } catch (err) {
            debugLog('[SR-Edu] Error filling Education section:', err?.message, err?.stack);
            console.error('[SmartRecruiters] Error filling Education section', err);
        }

        // Filter out any fields that belong to experience/education entry forms
        // (safety measure in case some were collected before Add was clicked or forms stayed open)
        for (let i = fields.length - 1; i >= 0; i--) {
            const el = Array.isArray(fields[i].element) ? fields[i].element[0] : fields[i].element;
            if (el && el.closest && (
                el.closest('[data-test="experience-edit-form"]') ||
                el.closest('oc-experience-edit-form') ||
                el.closest('oc-experience-entry') ||
                el.closest('[data-test="education-edit-form"]') ||
                el.closest('oc-education-edit-form') ||
                el.closest('oc-education-entry')
            )) {
                debugLog('[SR] Filtering out exp/edu field from fields array:', fields[i].label);
                fields.splice(i, 1);
            }
        }
    }

    await wait(1000);
    await pause();

    streamVacancyFields(fields);
    await wait(2000);

    let fieldNum = 0;
    let field;
    while (fieldNum < fields.length) {
        field = fields[fieldNum];

        try {

            let {value, completed} = await getFieldValueByFieldName(field.label);

            if (completed) {
                fieldNum += 1;
            } else {
                if (field.type != 'text' && field.type != 'textarea') {
                    continue;
                }
            }

            console.log(field, field.label, value);
            debugLog('[SR] Filling field', { label: field.label, type: field.type, value });

            if (!value && value !== 0) {
                if (field.type === 'phone' && profile?.phone) {
                    value = profile.phone;
                } else if (!Array.isArray(field.element)) {
                    // For text/textarea/dropdown, skip if no value
                    debugLog('[SR] Skipping field (no value)', { label: field.label });
                    console.log('skip');
                    continue;
                } else {
                    // For multi-choice (radio/checkbox), fall through to try N/A/decline default
                    debugLog('[SR] No value for multi-choice field, will try decline/no default', { label: field.label });
                    value = '';
                }
            }

            if (field.type === 'phone') {
                await fillSmartRecruitersPhoneField(field, value, profile);
                if (completed) {
                    fieldNum += 1;
                }
                await wait(1000);
                continue;
            }

            if (Array.isArray(field.element)) {
                if (agentStatus.resumed) {
                    field.element.forEach((el) => {
                        if (el.checked) {
                            throw new Error('filled by user');
                        }
                    });
                }

                scrollToTargetAdjusted(field.element[0], getHeaderHeight());
                const desiredPairs = (Array.isArray(value) ? value : [value])
                    .map((val) => ({original: val, normalized: normalizeMatchValue(val)}))
                    .filter((item) => item.normalized.length > 0);

                if (desiredPairs.length === 0) {
                    console.warn('[SmartRecruiters] No usable values provided for multi-choice field', {
                        label: field.label,
                        rawValue: value
                    });
                    // No value: try to select a decline/no/prefer-not-to-answer option
                    const allSummaries = field.element.map((el) => {
                        const cands = collectOptionCandidates(el);
                        const normCands = cands.map(c => normalizeMatchValue(c)).filter(c => c.length > 0);
                        return { element: el, candidates: cands, normalizedCandidates: normCands };
                    });
                    const declineOpt = allSummaries.find(s =>
                        s.normalizedCandidates.some(c =>
                            c.includes('not wish') || c.includes('decline') ||
                            c.includes('prefer not') || c.includes('choose not') ||
                            c.includes('not disclose') || c.includes('not applicable')
                        )
                    ) || allSummaries.find(s =>
                        s.normalizedCandidates.some(c => c === 'no' || c === 'none')
                    ) || allSummaries[allSummaries.length - 1];
                    if (declineOpt) {
                        const decEl = declineOpt.element;
                        const decTag = decEl.tagName?.toLowerCase();
                        debugLog('[SR] No value: selecting decline/no option', { label: field.label, option: declineOpt.candidates[0] });
                        if (decTag === 'spl-radio' || decTag === 'spl-checkbox') {
                            if (!decEl.hasAttribute('selected')) { decEl.click(); await wait(500); }
                        } else if (!decEl.checked) { decEl.click(); await wait(500); }
                    }
                } else {
                    const desiredSet = new Set(desiredPairs.map((item) => item.normalized));

                    const optionSummaries = field.element.map((el) => {
                        const candidates = collectOptionCandidates(el);
                        const normalizedCandidates = candidates
                            .map((candidate) => normalizeMatchValue(candidate))
                            .filter((candidate) => candidate.length > 0);
                        return {
                            element: el,
                            candidates,
                            normalizedCandidates
                        };
                    });

                    debugLog('[SR] Multi-choice options available', { label: field.label, desired: desiredPairs.map(i => i.original), options: optionSummaries.map(s => s.candidates[0] || '') });

                    let matchFound = false;

                    for (const summary of optionSummaries) {
                        const matches = summary.normalizedCandidates.some((candidate) => desiredSet.has(candidate));
                        if (matches) {
                            matchFound = true;
                            const el = summary.element;
                            const tagName = el.tagName?.toLowerCase();
                            debugLog('[SR] Multi-choice exact match selected', { label: field.label, selected: summary.candidates[0] || '' });
                            // For SmartRecruiters web components, check 'selected' attribute
                            if (tagName === 'spl-radio' || tagName === 'spl-checkbox') {
                                if (!el.hasAttribute('selected')) {
                                    console.log('[SmartRecruiters] Clicking spl element:', {
                                        tag: tagName,
                                        id: el.id,
                                        value: el.getAttribute('value')
                                    });
                                    el.click();
                                    await wait(500);
                                }
                            } else if (!el.checked) {
                                el.click();
                                await wait(500);
                            }
                        } else {
                            const el = summary.element;
                            const tagName = el.tagName?.toLowerCase();
                            
                            if (tagName === 'spl-checkbox' && el.hasAttribute('selected')) {
                                console.log('[SmartRecruiters] Unchecking spl-checkbox:', el.id);
                                el.click();
                                await wait(500);
                            } else if (el.type === 'checkbox' && el.checked) {
                                el.click();
                                await wait(500);
                            }
                        }
                    }

                    if (!matchFound) {
                        debugLog('[SR] No exact match for multi-choice, trying fuzzy', { label: field.label, desired: desiredPairs.map(i => i.original), available: optionSummaries.map(s => s.candidates) });

                        // Fuzzy match: partial substring match
                        for (const summary of optionSummaries) {
                            const isPartial = summary.normalizedCandidates.some(c =>
                                Array.from(desiredSet).some(d => c.includes(d) || d.includes(c))
                            );
                            if (isPartial) {
                                matchFound = true;
                                const el = summary.element;
                                const tagName = el.tagName?.toLowerCase();
                                debugLog('[SR] Fuzzy match found', { label: field.label, candidate: summary.candidates[0] });
                                if (tagName === 'spl-radio' || tagName === 'spl-checkbox') {
                                    if (!el.hasAttribute('selected')) { el.click(); await wait(500); }
                                } else if (!el.checked) { el.click(); await wait(500); }
                                break;
                            }
                        }

                        // For N/A / null / not applicable answers on Yes/No fields: default to "No"
                        if (!matchFound) {
                            const firstDesired = Array.from(desiredSet)[0] || '';
                            const isNaLike = firstDesired === 'n/a' || firstDesired === '' || firstDesired === 'null' || firstDesired === 'none' || firstDesired === 'not applicable';
                            if (isNaLike) {
                                const noOption = optionSummaries.find(s =>
                                    s.normalizedCandidates.some(c => c === 'no' || c === '0' || c === 'false')
                                );
                                if (noOption) {
                                    matchFound = true;
                                    const el = noOption.element;
                                    const tagName = el.tagName?.toLowerCase();
                                    debugLog('[SR] N/A answer defaulting to No option', { label: field.label });
                                    if (tagName === 'spl-radio' || tagName === 'spl-checkbox') {
                                        if (!el.hasAttribute('selected')) { el.click(); await wait(500); }
                                    } else if (!el.checked) { el.click(); await wait(500); }
                                }
                            }
                        }

                        if (!matchFound) {
                            debugLog('[SR] No matching option for multi-choice', { label: field.label, desired: desiredPairs.map(i => i.original), available: optionSummaries.map(s => s.candidates) });
                            console.warn('[SmartRecruiters] No matching option found for field', {
                                label: field.label,
                                desiredValues: desiredPairs.map((item) => item.original),
                                normalizedDesired: Array.from(desiredSet),
                                availableOptions: optionSummaries.map((summary) => ({
                                    valueAttribute: summary.element.value,
                                    candidates: summary.candidates
                                }))
                            });
                        }
                    }
                }

            } else {
                if (Array.isArray(value)) {
                    value = value[0];
                }

                if (agentStatus.resumed && field.element.value) {
                    console.log('filled by user');
                    continue;
                }
                scrollToTargetAdjusted(field.element, getHeaderHeight());
                try {
                    if (field.type == 'select') {
                        const opt = [...field.element.querySelectorAll('option')].filter(option => option.innerText == value)[0];
                        if (opt && opt.value) {
                            value = opt.value;
                        }
                    }
                } catch {}

                // Strip non-numeric characters for number inputs or number-like values with currency symbols
                if (typeof value === 'string') {
                    const looksNumeric = /^\s*[\d.,]+\s*[a-zA-Z$€£₹¥%]*\s*$/.test(value) || /^\s*[a-zA-Z$€£₹¥%]*\s*[\d.,]+\s*$/.test(value);
                    if (field.element.type === 'number' || (looksNumeric && field.element.type !== 'text')) {
                        const numericOnly = value.replace(/[^\d.]/g, '');
                        const parsed = parseFloat(numericOnly);
                        if (!isNaN(parsed)) {
                            value = String(Math.round(parsed));
                            debugLog('[SR] Cleaned numeric value', { label: field.label, cleaned: value });
                        }
                    }
                }

                if (field.type == 'textarea') {
                    setNativeValue(field.element, value);
                    await wait(100);
                    field.element.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
                    field.element.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
                    field.element.dispatchEvent(new Event('blur', {bubbles: true, composed: true}));
                    field.element.dispatchEvent(new Event('focusout', {bubbles: true, composed: true}));
                } else if (isSmartRecruitersDropdownInput(field.element)) {
                    debugLog('[SR] Filling dropdown field', { label: field.label, value });
                    let suggestionSelected = false;
                    if (isNoticePeriodLabel(field.label)) {
                        const profileDays = parseNoticePeriodDays(profile);
                        debugLog('[SR] Notice period: resolving from profile', { aiValue: value, profileDays });
                        if (profileDays !== null) {
                            suggestionSelected = await pickNoticePeriodDropdown(field.element, profile);
                        }
                    }
                    if (!suggestionSelected) {
                        suggestionSelected = await selectFirstDropdownOption(field.element, String(value));
                    }
                    if (!suggestionSelected && isNoticePeriodLabel(field.label)) {
                        const profileDays = parseNoticePeriodDays(profile);
                        if (profileDays !== null) {
                            debugLog('[SR] Notice period: retrying with profile day mapping', { aiValue: value, profileDays });
                            suggestionSelected = await pickNoticePeriodDropdown(field.element, profile);
                        }
                    }
                    if (!suggestionSelected) {
                        debugLog('[SR] Dropdown selection failed, falling back to direct value', { label: field.label, value });
                        setNativeValue(field.element, value);
                        field.element.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
                        field.element.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
                        field.element.dispatchEvent(new Event('blur', {bubbles: true, composed: true}));
                        field.element.dispatchEvent(new Event('focusout', {bubbles: true, composed: true}));
                    } else {
                        debugLog('[SR] Dropdown selected', { label: field.label, resultValue: field.element.value });
                    }
                } else {
                    setNativeValue(field.element, value);
                    field.element.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
                    field.element.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
                    // Dispatch blur/focusout so Angular marks the control as touched/dirty
                    field.element.dispatchEvent(new Event('blur', {bubbles: true, composed: true}));
                    field.element.dispatchEvent(new Event('focusout', {bubbles: true, composed: true}));
                    // Also trigger on parent host if inside shadow DOM
                    const hostEl = field.element.getRootNode?.()?.host;
                    if (hostEl) {
                        hostEl.dispatchEvent(new Event('blur', {bubbles: true, composed: true}));
                        hostEl.dispatchEvent(new Event('focusout', {bubbles: true, composed: true}));
                    }
                }
            }

        } catch (e) {
            console.error(e);
        }

        await wait(1000);

    }

    await pause();

    document.querySelectorAll('input[type="checkbox"][required]').forEach((itm) => {
        if (!itm.checked) {
            itm.click();
        }
    });

    // Close any open experience/education entry forms that failed to save.
    // Open forms block Next navigation (Angular marks the step as invalid).
    const openEntryForms = querySelectorAllDeep(document.body, '[data-test="experience-edit-form"], [data-test="education-edit-form"]');
    if (openEntryForms.length > 0) {
        debugLog('[SR] Closing', openEntryForms.length, 'open entry form(s) before Next');
        for (const openForm of openEntryForms) {
            const cancelHost = querySelectorDeep(openForm, '[data-test*="cancel"]');
            const cancelBtn = cancelHost ? (querySelectorDeep(cancelHost, 'button') || cancelHost) : null;
            debugLog('[SR] Closing open form, cancel button found:', !!cancelBtn, cancelHost?.getAttribute?.('data-test'));
            if (cancelBtn) {
                cancelBtn.click();
                await wait(800);
            }
        }
        await wait(500);
    }

    const nextButton = document.querySelector('oc-button[data-test="footer-next"]');
    if (nextButton) {
        debugLog('[SR] Clicking Next button');
        const initialUrl = window.location.href;
        const initialSignature = getSmartRecruitersStepSignature();
        await fullPageScreenshot();
        await waitForClickableButton('oc-button[data-test="footer-next"]');
        nextButton.click();
        const navigationSucceeded = await waitForSmartRecruitersStepAdvance(initialUrl, initialSignature);
        if (!navigationSucceeded) {
            // Log all invalid/error fields to help diagnose
            const invalidFields = [...document.querySelectorAll('[aria-invalid="true"], .ng-invalid:not(.ng-pristine), [class*="error"]:not([class*="form-field-error-icon"])')].filter(el => el.offsetParent !== null).slice(0, 10).map(el => ({tag: el.tagName, text: el.textContent?.trim()?.substring(0, 80), class: el.className?.substring(0, 60)}));
            const errorMessages = [...document.querySelectorAll('[class*="error-text"], [class*="form-field-error"] spl-typography-body, oc-field-error, .validation-error')].filter(el => el.offsetParent !== null && el.textContent?.trim()).map(el => el.textContent?.trim()?.substring(0, 100));
            debugLog('[SR] Next step navigation failed, URL unchanged', { url: initialUrl, invalidFields, errorMessages });
            console.warn('[SmartRecruiters] Next step navigation did not change URL', {
                initialUrl,
                currentUrl: window.location.href
            });
        } else {
            debugLog('[SR] Navigated to next step', { from: initialUrl, to: window.location.href });
        }
        return {proceededToNext: true, navigationSucceeded};
    }

    if (!devMode) {
        debugLog('[SR] Ready to submit application');

        // Pre-submit: scroll to reveal lazy sections, then fill any missed voluntary dropdowns
        await scrollToRevealLazySections();
        await fillMissedEmptyDropdowns(new Set(fields.map(f => (f.label || '').trim())));

        await readyToSubmit();
        await fullPageScreenshot();

        await waitForClickableButton('oc-button[data-test="footer-submit"]');
        const submitButton = document.querySelector('oc-button[data-test="footer-submit"]');
        if (submitButton) {
            debugLog('[SR] Clicking Submit button');
            submitButton.click();
            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 6000);
            });
        }
    }

    return {proceededToNext: false, navigationSucceeded: true};
}

async function apply(data) {

    const {devMode, session: {city, country, workplace}} = data;
    const languagesProfile = Array.isArray(data?.profile?.languages) ? data.profile.languages : [];
    debugLog('[SR] apply() started', { url: window.location.href, devMode, city, country, workplace, languagesCount: languagesProfile.length });
    debugLog('[SR] Profile experiences:', data.profile?.experiences);
    debugLog('[SR] Profile educations:', data.profile?.educations);

    if (!data.successfulSubmissions && !data.failedSubmissions) {
        appendStatusMessage('Found relevant job openings. Starting auto-apply with the first one...');
        await wait(3000);
    }

    cv = await getResume(data);

    await pause();
    appendStatusMessage('Uploading your CV. Please hang on...');

    if ((!cv || !cv.url) && document.querySelector('[data-test="resume-upload"]') !== null) {
        debugLog('[SR] CV not found but resume upload required');
        throw new SendCvError('CV not found. It required');
    }

    // Find file input in SmartRecruiters dropzone
    const fileInput = await waitForResumeFileInput();

    if (!fileInput) {
        debugLog('[SR] CV file input not found on page');
        throw new SendCvError('CV input not found');
    }

    console.log('[SmartRecruiters] Resume input ready', fileInput);

    const dropzoneHost = getDropzoneHostForInput(fileInput);
    const initialDropzoneState = getDropzoneStateSnapshot(dropzoneHost, fileInput);
    console.log('[SmartRecruiters] Dropzone initial state', {
        filesCount: initialDropzoneState.filesCount,
        filesAttr: initialDropzoneState.filesAttr,
        labelTexts: [...initialDropzoneState.labelTexts]
    });

    await wait(3000);

    const blob = await fetch(cv.url, {method: 'GET'}).then(res => res.blob());
    console.log('[SmartRecruiters] Resume fetched', {
        fileName: cv.originalFilename,
        size: blob.size,
        type: blob.type
    });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([blob], cv.originalFilename, {type: blob.type, lastModified: new Date()}));
    console.log('[SmartRecruiters] Assigning resume to input', {fileName: cv.originalFilename});
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    fileInput.dispatchEvent(new Event('change', {bubbles: true, composed: true}));

    const uploadConfirmed = await waitForDropzoneUploadConfirmation(dropzoneHost, fileInput, initialDropzoneState);
    if (!uploadConfirmed) {
        debugLog('[SR] Resume upload confirmation failed');
        throw new SendCvError('Failed to confirm CV upload');
    }
    console.log('[SmartRecruiters] Resume upload completed');
    debugLog('[SR] Resume uploaded successfully', { fileName: cv.originalFilename });

    await wait(3000);

    await pause();

    let stepIndex = 0;
    while (true) {
        debugLog('[SR] Processing step', { stepIndex });
        const result = await processSmartRecruitersStep({
            devMode,
            showStatusMessage: stepIndex === 0,
            languages: languagesProfile,
            profile: data.profile
        });

        if (result.proceededToNext) {
            if (!result.navigationSucceeded) {
                debugLog('[SR] Failed to load next step', { stepIndex });
                throw new SendCvError('Failed to load next step of the application');
            }
            stepIndex += 1;
            await wait(1000);
            continue;
        }

        break;
    }

}

window.addEventListener('load', () => {

    chrome.runtime.sendMessage({type: "GET-SEND-CV-TASK"}).then(async (value) => {

        value = await startApplyOne(value);

        const {type, data, message} = value;

        switch (type) {
            case 'ERROR':
                
                
                break;
            case 'SUCCESS':
                try {

                    warmingUp(data.agentGeometry, data.agentMessages, data.agentMode);

                    if (document.body.innerText.includes('Cannot GET') || document.body.innerText.includes('Job not found')) {
                        debugLog('[SR] Job not found on page');
                        throw new SendCvSkipError('Job not found')
                    }

                    // Check if we're on the application form
                    if (!window.location.href.includes('/oneclick-ui')) {
                        // We're on job description page, need to click "I'm interested"
                        const applyButton = document.querySelector('.js-oneclick[data-sr-track="apply"]');
                        if (applyButton) {

                            const {devMode, profile: {cv}, session: {city, country, workplace}} = data;

                            if (workplace !== 'ANY') {
                                // Check for remote work indicator
                                let jobWorkplace = 'ON_SITE'; // default
                                
                                // Check for specific remote tag or icon
                                const jobLocationHost = document.querySelector('spl-job-location');
                                const remoteTag = querySelectorDeep(jobLocationHost, '.c-spl-job-location__description') ||
                                                  document.querySelector('.c-spl-job-location__description');
                                const remoteIcon = 'M17.9,17.39C17.64,16.59 16.89,16 16,16H15V13A1,1 0 0,0 14,12H8V10H10A1,1 0 0,0 11,9V7H13A2,2 0 0,0 15,5V4.59C17.93,5.77 20,8.64 20,12C20,14.08 19.2,15.97 17.9,17.39M11,19.93C7.05,19.44 4,16.08 4,12C4,11.38 4.08,10.78 4.21,10.21L9,15V16A2,2 0 0,0 11,18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z';
                                
                                if (remoteTag) {
                                    const tagText = remoteTag.innerText?.toLowerCase() || '';
                                    const iconSrc = remoteTag.querySelector('spl-icon')?.getAttribute('src') || '';
                                    
                                    if (tagText.includes('employees can work remotely') || iconSrc === remoteIcon) {
                                        jobWorkplace = 'REMOTE';
                                    }
                                }
                                
                                // Check description for remote/hybrid keywords if not found in tag
                                if (jobWorkplace === 'ON_SITE') {
                                    const remoteKeywords = ['remote work', 'work remotely', 'fully remote', '100% remote', 'remote position', 'work from home', 'working from home', 'wfh'];
                                    const hybridKeywords = ['hybrid', 'hybrid work', 'hybrid model', 'partly remote', 'flexible location'];
                                    const titleText = (document.title || '').toLowerCase();
                                    const textSources = [];

                                    if (titleText) {
                                        textSources.push(titleText);
                                    }

                                    const descElement = document.querySelector('div[itemprop="description"]');
                                    if (descElement) {
                                        const descText = descElement.textContent.toLowerCase();
                                        if (descText) {
                                            textSources.push(descText);
                                        }
                                    }

                                    const matchesKeyword = (keywords) =>
                                        textSources.some((text) => keywords.some((keyword) => text.includes(keyword)));

                                    if (titleText.includes('remote')) {
                                        jobWorkplace = 'REMOTE';
                                    } else if (matchesKeyword(remoteKeywords)) {
                                        jobWorkplace = 'REMOTE';
                                    } else if (matchesKeyword(hybridKeywords)) {
                                        jobWorkplace = 'HYBRID';
                                    }
                                }
                                
                                // Compare with required workplace
                                if (workplace === 'REMOTE' && jobWorkplace !== 'REMOTE') {
                                    throw new SendCvSkipError('Wrong workplace type: not remote');
                                }
                                if (workplace === 'ON_SITE' && jobWorkplace === 'REMOTE') {
                                    throw new SendCvSkipError('Wrong workplace type: remote only');
                                }
                                if (workplace === 'HYBRID' && jobWorkplace !== 'HYBRID') {
                                    throw new SendCvSkipError('Wrong workplace type: not hybrid');
                                }
                            }

                            if (country || city) {
                                const locationElement = document.querySelector('spl-job-location');
                                let locationText = '';
                                if (locationElement) {
                                    const placeNode = querySelectorDeep(locationElement, '.c-spl-job-location__place');
                                    locationText = placeNode?.textContent?.trim() || '';
                                    if (!locationText) {
                                        locationText = getElementDeepText(placeNode || locationElement) || '';
                                    }
                                }
                                if (!locationText) {
                                    locationText = document.querySelector('.job-location, [class*="location"]')?.innerText?.trim() || '';
                                }
                                
                                const {cities, countries} = await parseCountriesAndCities(locationText);

                                if (country && (!countries.length || !countries.includes(country))) {
                                    throw new SendCvSkipError('Wrong country');
                                }

                                if (city && (!cities.length || !cities.includes(city))) {
                                    throw new SendCvSkipError('Wrong city');
                                }
                            }

                            // Extract role and company from SmartRecruiters DOM
                            const roleElement = document.querySelector('h1.job-title[itemprop="title"]');
                            if (roleElement?.innerText) {
                                role = roleElement.innerText.trim();
                            } else {
                                role = document.title;
                            }

                            const companyWrapper = document.querySelector('.header-logo.logo');
                            const companyLink = companyWrapper?.querySelector('a');
                            const companyImg = companyWrapper?.querySelector('img');
                            const linkTitle = companyLink?.getAttribute('title')?.trim();
                            const linkText = companyLink?.innerText?.trim();
                            const wrapperText = companyWrapper?.textContent?.trim();
                            const imgAlt = companyImg?.getAttribute('alt')?.trim();

                            company = linkTitle || linkText || imgAlt || wrapperText || document.title;
                            if (company?.toLowerCase().endsWith(' logo')) {
                                company = company.replace(/ logo$/i, '').trim();
                            }

                            description = '';
                            try {
                                const descElement = document.querySelector('div[itemprop="description"]');
                                if (descElement) {
                                    description = descElement.innerHTML.trim();

                                    const prefixes = ['Smartrecruiters', 'Company Description', 'Job Description'];
                                    let prefixesRemoved = true;
                                    while (prefixesRemoved && description.length) {
                                        prefixesRemoved = false;
                                        for (const prefix of prefixes) {
                                            const pattern = new RegExp(`^${prefix.replace(/\s+/g, '\\s*')}[\\s:,-]*`, 'i');
                                            if (pattern.test(description)) {
                                                description = description.replace(pattern, '').trimStart();
                                                prefixesRemoved = true;
                                                break;
                                            }
                                        }
                                    }
                                    description = description.replace(/^[:\s-]+/, '');
                                }
                            } catch {}

                            // Parse location
                            let location = null;
                            try {
                                const locationElement = document.querySelector('spl-job-location');
                                if (locationElement) {
                                    const placeNode = querySelectorDeep(locationElement, '.c-spl-job-location__place');
                                    location = placeNode?.textContent?.trim() || '';
                                    if (!location) {
                                        location = getElementDeepText(placeNode || locationElement) || '';
                                    }
                                }
                                if (!location) {
                                    location = document.querySelector('.job-location, [class*="location"]')?.innerText?.trim() || null;
                                }
                            } catch {}

                            // Parse workplaceType
                            let workplaceType = null;
                            try {
                                const titleElement = document.querySelector('h1.job-title[itemprop="title"]');
                                const titleText = titleElement?.innerText?.trim().toLowerCase() || '';
                                const descriptionText = document.querySelector('div[itemprop="description"]')?.innerText?.trim().toLowerCase() || '';
                                const additionalInfoElement = document.querySelector('.job-details__additional-info');
                                const additionalInfoText = additionalInfoElement?.innerText?.trim().toLowerCase() || '';
                                
                                if (titleText.includes('remote')) {
                                    workplaceType = 'REMOTE';
                                } else if ([titleText, descriptionText, additionalInfoText].some(text => ['remote work', 'work remotely', 'fully remote', '100% remote'].some(keyword => text.includes(keyword)))) {
                                    workplaceType = 'REMOTE';
                                } else if ([titleText, descriptionText, additionalInfoText].some(text => ['hybrid', 'partly remote'].some(keyword => text.includes(keyword)))) {
                                    workplaceType = 'HYBRID';
                                } else if ([titleText, descriptionText, additionalInfoText].some(text => ['on-site', 'onsite', 'on site', 'office-based'].some(keyword => text.includes(keyword)))) {
                                    workplaceType = 'ON_SITE';
                                }
                            } catch {}

                            // Parse logoUrl
                            let logoUrl = null;
                            try {
                                const ogImage = document.querySelector('meta[property="og:image"]')?.content;
                                if (ogImage && ogImage.startsWith('http')) {
                                    logoUrl = ogImage;
                                } else {
                                    const imgElement = document.querySelector('.header-logo.logo img');
                                    if (imgElement && imgElement.src && imgElement.src.startsWith('http')) {
                                        logoUrl = imgElement.src;
                                    }
                                }
                            } catch {}

                            await setHistoryDetails({company, role, description, location, workplaceType, logoUrl});

                            debugLog('[SR] On job description page, clicking Apply', { company, role, location, workplaceType });
                            await wait(Math.round(2000 + (Math.random() * 1000)));
                            applyButton.click();
                            await new Promise((resolve, reject) => {
                                setTimeout(() => {
                                    resolve();
                                }, 15000)
                            });
                            throw new SendCvSkipError('a timeout')
                        } else {
                            throw new SendCvSkipError('Apply button not found')
                        }
                    }

                    countDown = startCountDownInStatusBlock(60 * 5, () => {
                        chrome.runtime.sendMessage({
                            type: "SEND-CV-TAB-TIMER-ENDED", data: {
                                url: window.location.href
                            }
                        });
                    });

                    debugLog('[SR] Starting application form processing', { url: window.location.href });
                    successOnSelectorShadow('[data-test="success-page-confirmation"]');

                    await new Promise((resolve, reject) => {
                        setTimeout(async () => {
                            try {
                                await apply(data);
                                resolve();
                            } catch (e) {
                                reject(e);
                            }
                        }, 3000);
                    });

                    await new Promise((resolve, reject) => {
                        setTimeout(() => {
                            resolve();
                        }, 15000)
                    });

                    try {
                        const form = document.querySelector('form, oc-application-form');
                        if (form) {
                            const invalidFields = [...form.querySelectorAll('input, textarea, select')].filter(field => !field.checkValidity());

                            const errorsList = invalidFields
                                .map(field => `Field "${field.name || field.id || 'Unknown field'}": ${field.validationMessage}`)
                                .join('\n');

                            console.log(errorsList);
                            
                            if (errorsList.trim()) {
                                debugLog('[SR] Form validation errors', errorsList);
                                await fillingErrors(errorsList);
                                break;
                            }
                        }
                    } catch {}

                    // Check if submission already succeeded (detected by background selector poll)
                    if (agentStatus.success) {
                        debugLog('[SR] Application already marked successful, not throwing error');
                        break;
                    }
                    // Check if success confirmation element is now in DOM
                    if (querySelectorDeep(document, '[data-test="success-page-confirmation"]')) {
                        debugLog('[SR] Success page confirmation found after submit wait');
                        break;
                    }
                    // Check if URL left the application form
                    if (!window.location.href.includes('/oneclick-ui/')) {
                        debugLog('[SR] URL left application form, assuming success', { url: window.location.href });
                        break;
                    }

                    // Look for server-side error messages in the DOM
                    const serverErrors = [...querySelectorAllDeep(document, '[class*="error"], [data-test*="error"], .alert-danger, [role="alert"]')]
                        .map(el => (el.textContent || '').trim())
                        .filter(t => t && t.length > 3 && t.length < 500);
                    if (serverErrors.length > 0) {
                        debugLog('[SR] Server-side errors detected after submit', { errors: serverErrors.slice(0, 5) });

                        // If "Value is required" appeared, new sections may have rendered post-submit
                        // (e.g. OFCCP Voluntary Self-ID of Disability). Try to fill them and re-submit.
                        const hasValueRequired = serverErrors.some(e => e.toLowerCase().includes('value is required'));
                        if (hasValueRequired) {
                            debugLog('[SR] Attempting post-submit field fill for newly-rendered sections');
                            try {
                                await scrollToRevealLazySections();
                                const filled = await fillPostSubmitRequiredFields(new Set());
                                if (filled) {
                                    debugLog('[SR] Post-submit fields filled, re-submitting');
                                    const resubmitBtn = document.querySelector('oc-button[data-test="footer-submit"]');
                                    if (resubmitBtn) {
                                        resubmitBtn.click();
                                        await new Promise(r => setTimeout(r, 8000));

                                        // Re-check success
                                        if (agentStatus.success || querySelectorDeep(document, '[data-test="success-page-confirmation"]')) {
                                            debugLog('[SR] Success after re-submit');
                                            break;
                                        }
                                        // Re-check errors
                                        const reErrors = [...querySelectorAllDeep(document, '[class*="error"], [data-test*="error"], .alert-danger, [role="alert"]')]
                                            .map(el => (el.textContent || '').trim())
                                            .filter(t => t && t.length > 3 && t.length < 500);
                                        if (reErrors.length > 0) {
                                            debugLog('[SR] Server-side errors after re-submit', { errors: reErrors.slice(0, 5) });
                                            await fillingErrors('Server error after submit: ' + reErrors.slice(0, 3).join('; '));
                                            break;
                                        }
                                    }
                                }
                            } catch (retryErr) {
                                console.warn('[SmartRecruiters] Post-submit retry error', retryErr?.message);
                            }
                        }

                        await fillingErrors('Server error after submit: ' + serverErrors.slice(0, 3).join('; '));
                        break;
                    }

                    debugLog('[SR] Unknown application error, no fields submitted');
                    throw new SendCvError('Unknown application error');

                } catch (e) {
                    debugLog('[SR] Application error', { type: e.constructor.name, message: e.message, details: e.details });
                    if (e instanceof SendCvSkipError) {
                        
                        chrome.runtime.sendMessage({type: "SEND-CV-TASK-SKIP", data: e.message}).catch((e) => {
                            console.error(e)
                        });
                    } else {
                        await fillingErrors(e);
                    }
                }
                break;
        }

    });

});
