

let countDown;

// Local enhanced functions for Glassdoor to work in minimized windows
function dispatchInputEventGlassdoor(element) {
    // Ensure element is focused and visible for background tab compatibility
    try {
        element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        element.focus();
    } catch (e) {
        console.warn('Could not scroll/focus element:', e);
    }
    
    // Comprehensive event sequence for better compatibility in minimized windows
    const eventOptions = { bubbles: true, cancelable: true, composed: true };
    
    element.dispatchEvent(new FocusEvent('focusin', eventOptions));
    element.dispatchEvent(new FocusEvent('focus', eventOptions));
    element.dispatchEvent(new InputEvent('beforeinput', eventOptions));
    element.dispatchEvent(new InputEvent('input', eventOptions));
    element.dispatchEvent(new Event('change', eventOptions));
    element.dispatchEvent(new FocusEvent('blur', eventOptions));
    element.dispatchEvent(new FocusEvent('focusout', eventOptions));
}

function setNativeValueGlassdoor(element, value) {
    // Ensure element is interactable even in minimized windows
    try {
        element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        element.focus();
    } catch (e) {
        console.warn('Could not scroll/focus element:', e);
    }

    const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(element, 'value');

    if (!ownPropertyDescriptor) {
        element.value = value;
        dispatchInputEventGlassdoor(element);
        return;
    }

    const valueSetter = ownPropertyDescriptor.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

    if (valueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter.call(element, value);
    } else {
        valueSetter.call(element, value);
    }

    dispatchInputEventGlassdoor(element);
}

function normalizeGdEeoLabel(label) {
    try {
        return normalizeWhitespace(label || '')
            .toLowerCase()
            .replace(/[\u2018\u2019\u2032`´]/g, "'");
    } catch {
        return String(label || '').toLowerCase();
    }
}

function isGdLocalEeoField(label) {
    try {
        const n = normalizeGdEeoLabel(label);
        return /today'?s?\s*date/.test(n) || /type your full name/.test(n);
    } catch {
        return false;
    }
}

function isGdHearAboutUsField(label) {
    try {
        return /how did you hear about us/.test(normalizeGdEeoLabel(label));
    } catch {
        return false;
    }
}

function gdResolveHearAboutUsValue(field, value) {
    if (!isGdHearAboutUsField(field.label) || !Array.isArray(field.options) || !field.options.length) {
        return value;
    }
    const requested = (Array.isArray(value) ? value : [value]).map(v => String(v).trim()).filter(Boolean);
    const valid = requested.filter(v =>
        field.options.some(o => o === v || String(o).trim().toLowerCase() === v.toLowerCase())
    );
    if (valid.length) return Array.isArray(value) ? valid : valid[0];
    const preferLinkedIn = field.options.find(o => /^linkedin$/i.test(String(o).trim()));
    const fallback = preferLinkedIn || field.options[0];
    debugLog('glassdoor hear-about-us invalid AI value, fallback', requested.join(' | '), '->', fallback);
    return Array.isArray(value) ? [fallback] : fallback;
}

function isGdLocalAttestationCheckboxField(label, field) {
    try {
        if (field?.type !== 'checkbox' || field?.__gdMultiSelectCheckboxDropdown) return false;
        const elements = field.element;
        if (!Array.isArray(elements) || elements.length !== 1 || !field.required) return false;
        const n = normalizeGdEeoLabel(label);
        if (/how did you hear about us/.test(n)) return false;
        if (/type your full name/.test(n) || /today'?s?\s*date/.test(n)) return false;
        if (n.length >= 60) return true;
        if (/certif|consent|attest|i agree|sign electronically|lie detector|by selecting yes/i.test(n)) return true;
        if (Array.isArray(field.options) && field.options.length === 1) return true;
        return false;
    } catch {
        return false;
    }
}

function isGdLocalOnlyField(field) {
    return isGdLocalEeoField(field?.label)
        || field?.__gdFileUpload
        || isGdLocalAttestationCheckboxField(field?.label, field);
}

function gdNormalizeYesNoOption(text) {
    const t = String(text || '').trim();
    if (/^yes$/i.test(t)) return 'Yes';
    if (/^no$/i.test(t)) return 'No';
    const match = t.match(/\b(yes|no)\b/i);
    if (match) return match[1].toLowerCase() === 'yes' ? 'Yes' : 'No';
    return t;
}

function isGdExclusiveYesNoOptions(options) {
    if (!Array.isArray(options) || options.length !== 2) return false;
    const norms = options.map(gdNormalizeYesNoOption);
    return norms.includes('Yes') && norms.includes('No');
}

function isGdExclusiveYesNoField(field) {
    return field?.__gdExclusiveYesNo || isGdExclusiveYesNoOptions(field?.options);
}

function gdGetYesNoOptionLabel(el) {
    try {
        if (!el) return '';
        if (el.id) {
            const byFor = document.querySelector(`label[for="${el.id.replace(/"/g, '\\"')}"]`);
            if (byFor) {
                const t = byFor.innerText.trim();
                if (t.length <= 20) return gdNormalizeYesNoOption(t) || t;
            }
        }
        const labelEl = el.closest('label');
        if (labelEl) {
            const t = labelEl.innerText.trim();
            if (t.length <= 20) return gdNormalizeYesNoOption(t) || t;
        }
        for (const sib of [el.nextElementSibling, el.previousElementSibling]) {
            if (!sib) continue;
            const t = (sib.innerText || sib.textContent || '').trim();
            if (t && t.length <= 20 && /^(yes|no)$/i.test(t)) return gdNormalizeYesNoOption(t);
        }
        const aria = el.getAttribute('aria-label');
        if (aria) return gdNormalizeYesNoOption(aria) || aria;
        return '';
    } catch {
        return '';
    }
}

function gdGetRadioOptionLabel(el) {
    try {
        if (!el) return '';
        if (el.id) {
            const byFor = document.querySelector(`label[for="${el.id.replace(/"/g, '\\"')}"]`);
            if (byFor) {
                const t = byFor.innerText.trim();
                if (t) return t;
            }
        }
        const labelEl = el.closest('label');
        if (labelEl) {
            const t = labelEl.innerText.trim();
            if (t) return t;
        }
        for (const sib of [el.nextElementSibling, el.previousElementSibling]) {
            if (!sib) continue;
            const t = (sib.innerText || sib.textContent || '').trim();
            if (t) return t;
        }
        const aria = el.getAttribute('aria-label');
        if (aria) return aria.trim();
        return '';
    } catch {
        return '';
    }
}

function gdOptionsMatch(a, b) {
    const na = normalizeGdEeoLabel(String(a || '').trim());
    const nb = normalizeGdEeoLabel(String(b || '').trim());
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    return false;
}

function gdOptionValuesMatch(field, optionText, wanted) {
    if (field && isGdExclusiveYesNoField(field)) {
        return gdNormalizeYesNoOption(optionText) === gdNormalizeYesNoOption(wanted);
    }
    return gdOptionsMatch(optionText, wanted);
}

function gdResolveRadioOptionValue(field, value) {
    const requested = String(Array.isArray(value) ? value[0] : value || '').trim();
    if (!requested) return value;
    gdRefreshYesNoFieldElements(field);
    const options = (field.options || []).filter(Boolean);
    if (!options.length) return value;

    const exact = options.find(o => o === requested || gdOptionsMatch(o, requested));
    if (exact) return exact;

    const n = normalizeGdEeoLabel(field.label);
    const req = normalizeGdEeoLabel(requested);

    if (/disability/.test(n)) {
        if (/(do not want|do not wish|decline|prefer not)/.test(req)) {
            const decline = options.find(o => /(do not want|do not wish|decline|prefer not)/i.test(o));
            if (decline) {
                debugLog('glassdoor radio resolve disability decline', requested, '->', decline.slice(0, 50));
                return decline;
            }
        }
        if (/^no\b/.test(req) || req === 'no') {
            const noOpt = options.find(o => /^no,?\s/i.test(o));
            if (noOpt) return noOpt;
        }
        if (/^yes\b/.test(req) || req === 'yes') {
            const yesOpt = options.find(o => /^yes,?\s/i.test(o));
            if (yesOpt) return yesOpt;
        }
    }

    if (/veteran/.test(n)) {
        if (/(do not want|do not wish|decline|prefer not)/.test(req)) {
            const decline = options.find(o => /(do not wish|do not want|decline|prefer not)/i.test(o));
            if (decline) {
                debugLog('glassdoor radio resolve veteran decline', requested, '->', decline.slice(0, 50));
                return decline;
            }
        }
        if (/(not a veteran|not.*protected veteran|i am not|i'm not)/.test(req)) {
            const notVet = options.find(o =>
                /(not a protected veteran|not a veteran|i am not a protected)/i.test(o)
                && !/(do not wish|do not want|decline)/i.test(o)
            );
            if (notVet) {
                debugLog('glassdoor radio resolve veteran not', requested, '->', notVet.slice(0, 50));
                return notVet;
            }
        }
    }

    const partial = options.find(o => gdOptionsMatch(o, requested));
    if (partial) {
        debugLog('glassdoor radio option fuzzy match', requested.slice(0, 40), '->', partial.slice(0, 60));
        return partial;
    }

    debugLog('glassdoor radio option unresolved', (field.label || '').slice(0, 50), requested,
        'options=', options.map(o => o.slice(0, 40)).join(' | '));
    return value;
}

function gdNormalizeRadioWanted(field, value) {
    if (Array.isArray(value)) value = value[0];
    value = gdResolveRadioOptionValue(field, value);
    if (isGdExclusiveYesNoField(field)) return gdNormalizeYesNoOption(value);
    return String(value || '').trim();
}

function gdIsControlChecked(el) {
    try {
        if (!el) return false;
        if (el.matches?.('[role=checkbox], [role=radio]')) {
            return el.getAttribute('aria-checked') === 'true';
        }
        return !!el.checked;
    } catch {
        return false;
    }
}

function gdGetControlClickTarget(el) {
    try {
        if (!el) return null;
        if (el.id) {
            const byFor = document.querySelector(`label[for="${el.id.replace(/"/g, '\\"')}"]`);
            if (byFor) return byFor;
        }
        return el.closest('label') || el;
    } catch {
        return el;
    }
}

function setNativeCheckedGlassdoor(el, checked) {
    try {
        if (!el) return;
        if (el.matches?.('[role=checkbox], [role=radio]')) {
            el.setAttribute('aria-checked', checked ? 'true' : 'false');
            el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
            return;
        }
        if (el.type !== 'checkbox' && el.type !== 'radio') return;
        const proto = Object.getPrototypeOf(el);
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'checked');
        if (descriptor?.set) {
            descriptor.set.call(el, checked);
        } else {
            el.checked = checked;
        }
        el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } catch (e) {
        debugLog('glassdoor setNativeChecked error', String(e));
    }
}

async function gdForceControlChecked(el, shouldCheck) {
    if (!el) return false;
    if (gdIsControlChecked(el) === shouldCheck) return true;
    if (!shouldCheck) {
        debugLog('glassdoor checkbox skip uncheck', gdGetYesNoOptionLabel(el));
        return gdIsControlChecked(el) === false;
    }
    await gdClickGlassdoorElement(gdGetControlClickTarget(el));
    await waitImmediate(150);
    if (gdIsControlChecked(el) === shouldCheck) return true;
    if (gdIsIndeedMultiSelectYesNoInput(el)) {
        return await gdClickIndeedCheckboxOption(el, null);
    }
    await gdClickGlassdoorElement(el);
    await waitImmediate(150);
    return gdIsControlChecked(el) === shouldCheck;
}

async function gdSetCheckboxChecked(el, shouldCheck) {
    if (!el) return;
    if (gdIsControlChecked(el) === shouldCheck) return;
    const ok = await gdForceControlChecked(el, shouldCheck);
    debugLog('glassdoor checkbox', shouldCheck ? 'checked' : 'unchecked',
        gdGetYesNoOptionLabel(el), 'ok=', ok);
}

function gdRefreshYesNoFieldElements(field) {
    try {
        const item = field.__gdQuestionItem || field.element?.[0]?.closest?.('.ia-Questions-item');
        if (!item) return field.element;
        field.__gdQuestionItem = item;
        const root = item.querySelector('fieldset') || item;
        const radios = [...root.querySelectorAll('input[type=radio]')];
        if (radios.length >= 2) {
            field.type = 'radio';
            field.element = radios;
            field.options = radios.map(gdGetRadioOptionLabel);
            field.__gdExclusiveYesNo = isGdExclusiveYesNoOptions(field.options);
            return field.element;
        }
        const checkboxes = [...root.querySelectorAll('input[type=checkbox]')];
        if (checkboxes.length >= 2) {
            const options = checkboxes.map(gdGetRadioOptionLabel);
            if (isGdExclusiveYesNoOptions(options)) {
                field.type = 'checkbox';
                field.element = checkboxes;
                field.options = options;
                field.__gdExclusiveYesNo = true;
                return field.element;
            }
        }
    } catch (e) {
        debugLog('glassdoor yes/no refresh error', String(e));
    }
    return field.element;
}

function gdIsIndeedMultiSelectYesNoInput(el) {
    try {
        return !!(el?.id && String(el.id).startsWith('multi-select-question-'));
    } catch {
        return false;
    }
}

function gdIsIndeedMultiSelectYesNoField(field) {
    try {
        return !!(field?.element?.some?.(gdIsIndeedMultiSelectYesNoInput)
            || field.__gdQuestionItem?.querySelector('[id^="multi-select-question-"]'));
    } catch {
        return false;
    }
}

function gdFindYesNoInputInField(field, wanted) {
    const w = gdNormalizeRadioWanted(field, wanted);
    if (!w) return null;
    gdRefreshYesNoFieldElements(field);
    const elements = field.element || [];
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const opt = field.options?.[i] || gdGetRadioOptionLabel(el);
        if (gdOptionValuesMatch(field, opt, w)) return el;
    }
    const item = field.__gdQuestionItem;
    if (item) {
        for (const el of item.querySelectorAll('input[type=checkbox], input[type=radio], [role=checkbox], [role=radio]')) {
            if (gdOptionValuesMatch(field, gdGetRadioOptionLabel(el), w)) return el;
        }
    }
    return null;
}

async function gdClickYesNoInput(input, field, wanted) {
    if (!input) return false;
    const item = field.__gdQuestionItem || input.closest?.('.ia-Questions-item');
    const w = gdNormalizeRadioWanted(field, wanted);
    if (gdIsYesNoOptionSelectedInItem(item, w, field)) return true;

    const targets = [];
    if (input.id) {
        const byFor = document.querySelector(`label[for="${input.id.replace(/"/g, '\\"')}"]`);
        if (byFor) targets.push(byFor);
    }
    if (input.closest('label')) targets.push(input.closest('label'));
    targets.push(input.parentElement, input);

    debugLog('glassdoor yes/no click try', (field.label || '').slice(0, 60), w,
        'input=', input.id, 'targets=', targets.filter(Boolean).map(t => t.tagName).join('/'));

    for (const target of targets.filter(Boolean)) {
        await gdClickGlassdoorElement(target);
        await waitImmediate(350);
        if (gdIsYesNoOptionSelectedInItem(item, w, field) || gdIsControlChecked(input)) {
            debugLog('glassdoor yes/no click OK via', target.tagName, w.slice(0, 40));
            return true;
        }
    }
    return gdIsYesNoOptionSelectedInItem(item, w, field) || gdIsControlChecked(input);
}

async function gdClickIndeedMultiSelectYesNoField(field, wanted) {
    const item = field.__gdQuestionItem || field.element?.[0]?.closest?.('.ia-Questions-item');
    if (!item) return false;
    const w = gdNormalizeYesNoOption(wanted);
    const inputs = [...item.querySelectorAll('input[id^="multi-select-question-"]')];
    if (!inputs.length) {
        const input = gdFindYesNoInputInField(field, w);
        return input ? await gdClickYesNoInput(input, field, w) : false;
    }
    debugLog('glassdoor indeed-multi-select DOM', (field.label || '').slice(0, 60),
        inputs.map(i => `${i.id}:${i.checked}:${gdGetYesNoOptionLabel(i)}`).join('; '));
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const opt = gdNormalizeYesNoOption(field.options?.[i] || gdGetYesNoOptionLabel(input));
        if (opt !== w) continue;
        return await gdClickIndeedCheckboxOption(input, field);
    }
    return false;
}

function gdIsYesNoOptionSelectedInItem(item, wanted, field) {
    try {
        if (!item || !wanted) return false;
        const w = Array.isArray(wanted) ? wanted[0] : wanted;
        const checked = item.querySelector('input[type=checkbox]:checked, input[type=radio]:checked');
        if (checked && gdOptionValuesMatch(field, gdGetRadioOptionLabel(checked), w)) return true;
        for (const el of item.querySelectorAll('input[id^="multi-select-question-"], input[type=checkbox], input[type=radio], [role=checkbox], [role=radio]')) {
            const opt = gdGetRadioOptionLabel(el);
            if (!gdOptionValuesMatch(field, opt, w)) continue;
            if (gdIsIndeedMultiSelectYesNoInput(el)) {
                if (gdIsIndeedMultiSelectOptionSelected(el, item)) return true;
            } else if (gdIsControlChecked(el)) {
                return true;
            }
        }
    } catch {}
    return false;
}

function gdCssEscapeId(id) {
    try {
        if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(id);
    } catch {}
    return String(id).replace(/"/g, '\\"');
}

function gdFindLabelForControl(el) {
    try {
        if (!el?.id) return null;
        return document.querySelector(`label[for="${gdCssEscapeId(el.id)}"]`);
    } catch {
        return null;
    }
}

function gdIsIndeedMultiSelectOptionSelected(input, item) {
    try {
        if (!input) return false;
        if (gdIsControlChecked(input)) return true;
        if (input.getAttribute('aria-checked') === 'true') return true;
        const label = gdFindLabelForControl(input) || input.closest('label');
        if (label) {
            if (label.getAttribute('aria-checked') === 'true') return true;
            if (label.getAttribute('aria-pressed') === 'true') return true;
            const cls = label.className || '';
            if (/\b(checked|selected|active|is-checked|is-selected)\b/i.test(cls)) return true;
            if (label.querySelector('[aria-checked="true"], [data-checked="true"], [data-state="checked"]')) return true;
        }
        const row = input.closest('[data-testid*="option"], [role="checkbox"], li');
        if (row && row !== input) {
            if (row.getAttribute('aria-checked') === 'true') return true;
            if (row.querySelector?.('input:checked, [aria-checked="true"]') === input) return true;
        }
        if (item) {
            const w = gdNormalizeYesNoOption(gdGetYesNoOptionLabel(input));
            if (!w) return false;
            for (const el of item.querySelectorAll('input[id^="multi-select-question-"]')) {
                if (el === input) continue;
                const other = gdNormalizeYesNoOption(gdGetYesNoOptionLabel(el));
                if (other !== w && gdIsControlChecked(el)) return false;
            }
        }
    } catch {}
    return false;
}

function gdCollectIndeedMultiSelectClickTargets(input) {
    const targets = [];
    const seen = new Set();
    const add = (el) => {
        if (!el || seen.has(el)) return;
        seen.add(el);
        targets.push(el);
    };

    const label = gdFindLabelForControl(input) || input.closest('label');
    if (label) {
        for (const el of label.querySelectorAll('span, div, svg, button')) {
            if (el === input || el.contains(input)) continue;
            if (gdIsVisibleElement(el)) add(el);
        }
        add(label);
    }

    const row = input.closest('[data-testid*="option"], [role="checkbox"], li');
    if (row && row !== input && row.querySelector(`#${gdCssEscapeId(input.id)}`) === input) {
        add(row);
    }
    add(input.parentElement);
    add(input);

    return targets.sort((a, b) => {
        const score = (el) => {
            if (!gdIsVisibleElement(el)) return 0;
            const tag = el.tagName;
            if (tag === 'SPAN' || tag === 'DIV') return 4;
            if (tag === 'LABEL') return 3;
            if (tag === 'INPUT') return 1;
            return 2;
        };
        return score(b) - score(a);
    });
}

async function gdClickIndeedCheckboxOption(el, field) {
    if (!el) return false;
    const item = field?.__gdQuestionItem || el.closest?.('.ia-Questions-item');
    const wanted = gdGetYesNoOptionLabel(el);
    if (gdIsIndeedMultiSelectOptionSelected(el, item)) return true;

    const targets = gdCollectIndeedMultiSelectClickTargets(el);
    debugLog('glassdoor indeed-multi-select click targets', (field?.label || '').slice(0, 50), wanted,
        targets.slice(0, 6).map(t => `${t.tagName}:${(t.className || '').slice(0, 30)}`).join(' | '));

    for (const target of targets) {
        try { target.click(); } catch {}
        await waitImmediate(200);
        if (gdIsIndeedMultiSelectOptionSelected(el, item)) {
            debugLog('glassdoor indeed-multi-select click OK native', target.tagName, wanted);
            return true;
        }
        await gdClickGlassdoorElement(target);
        await waitImmediate(350);
        if (gdIsIndeedMultiSelectOptionSelected(el, item)) {
            debugLog('glassdoor indeed-multi-select click OK', target.tagName, wanted);
            return true;
        }
    }

    const label = gdFindLabelForControl(el) || el.closest('label');
    if (label) {
        try {
            label.focus();
            label.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
            label.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
            await waitImmediate(250);
        } catch {}
        if (gdIsIndeedMultiSelectOptionSelected(el, item)) return true;
    }

    if (!gdIsControlChecked(el)) {
        setNativeCheckedGlassdoor(el, true);
        await waitImmediate(200);
    }
    return gdIsIndeedMultiSelectOptionSelected(el, item) || gdIsControlChecked(el);
}

async function gdSelectYesNoOption(el, field, wanted) {
    const item = field?.__gdQuestionItem || el?.closest?.('.ia-Questions-item');
    const w = gdNormalizeRadioWanted(field, wanted);
    if (gdIsYesNoOptionSelectedInItem(item, w, field)) return true;
    if (gdIsControlChecked(el)) return true;
    if (gdIsIndeedMultiSelectYesNoInput(el)) {
        return await gdClickIndeedCheckboxOption(el, field);
    }
    await gdClickGlassdoorElement(gdGetControlClickTarget(el));
    await waitImmediate(250);
    return gdIsControlChecked(el) || gdIsYesNoOptionSelectedInItem(item, w, field);
}

function gdIsYesNoFieldFilled(field, value) {
    const wanted = gdNormalizeRadioWanted(field, value);
    if (!wanted) return false;
    gdRefreshYesNoFieldElements(field);
    if (gdIsYesNoOptionSelectedInItem(field.__gdQuestionItem, wanted, field)) return true;
    const elements = field.element || [];
    for (let i = 0; i < elements.length; i++) {
        const opt = field.options?.[i] || gdGetRadioOptionLabel(elements[i]);
        if (gdOptionValuesMatch(field, opt, wanted)) {
            const el = elements[i];
            if (gdIsIndeedMultiSelectYesNoInput(el)) {
                return gdIsIndeedMultiSelectOptionSelected(el, field.__gdQuestionItem);
            }
            return gdIsControlChecked(el);
        }
    }
    return false;
}

async function fillGdYesNoField(field, value) {
    try {
        const wanted = gdNormalizeRadioWanted(field, value);
        if (!wanted) return false;
        gdRefreshYesNoFieldElements(field);

        if (gdIsYesNoFieldFilled(field, wanted)) {
            debugLog('glassdoor yes/no fill skip already correct', (field.label || '').slice(0, 70), wanted);
            field.value = wanted;
            field.__gdYesNoCommitted = true;
            return true;
        }

        if (field.__gdYesNoCommitted) {
            debugLog('glassdoor yes/no fill skip committed-no-reclick', (field.label || '').slice(0, 70), wanted);
            return gdIsYesNoFieldFilled(field, wanted);
        }

        let ok = false;
        if (gdIsIndeedMultiSelectYesNoField(field)) {
            ok = await gdClickIndeedMultiSelectYesNoField(field, wanted);
        } else {
            const input = gdFindYesNoInputInField(field, wanted);
            ok = input ? await gdClickYesNoInput(input, field, wanted) : false;
        }

        if (!ok) {
            debugLog('glassdoor yes/no fill failed', (field.label || '').slice(0, 70), wanted);
            if (gdIsIndeedMultiSelectYesNoField(field) && field.__gdQuestionItem) {
                debugLog('glassdoor indeed-multi-select HTML', field.__gdQuestionItem.outerHTML?.slice(0, 1500));
            }
        } else {
            debugLog('glassdoor yes/no fill OK', (field.label || '').slice(0, 70), wanted);
        }
        field.value = wanted;
        if (ok) field.__gdYesNoCommitted = true;
        return ok;
    } catch (e) {
        debugLog('glassdoor yes/no fill error', String(e));
        console.error(e);
    }
    return false;
}

async function fillGdDeferredYesNoFields(fields) {
    if (!fields?.length) return;
    for (const field of fields) {
        if (field.type !== 'radio' && !isGdExclusiveYesNoField(field)) continue;
        if (!field.value && field.value !== 0) continue;
        if (field.__gdYesNoCommitted && gdIsYesNoFieldFilled(field, field.value)) {
            debugLog('glassdoor yes/no deferred skip committed', (field.label || '').slice(0, 70));
            continue;
        }
        try {
            await fillGdYesNoField(field, field.value);
        } catch (e) {
            debugLog('glassdoor yes/no deferred fill error', String(e));
        }
        await waitImmediate(200);
    }
}

function gdLogVisibleFieldErrors() {
    try {
        const errors = [...document.querySelectorAll('[role="alert"], [class*="error"]')]
            .filter(el => el.offsetParent !== null)
            .map(el => el.innerText.trim())
            .filter(Boolean);
        if (errors.length) {
            debugLog('glassdoor visible validation errors', errors.slice(0, 6).join(' | '));
        }
    } catch {}
}

async function fillGdLocalAttestationCheckbox(field) {
    try {
        const el = field.element?.[0];
        if (!el) return false;
        await gdSetCheckboxChecked(el, true);
        field.value = field.options?.[0] || field.label;
        debugLog('glassdoor attestation checkbox OK', (field.label || '').slice(0, 80));
        return true;
    } catch (e) {
        debugLog('glassdoor attestation checkbox error', String(e));
    }
    return false;
}

async function fillGdLocalAttestationCheckboxes(fields) {
    if (!fields?.length) return;
    for (const field of fields) {
        if (!isGdLocalAttestationCheckboxField(field.label, field)) continue;
        try {
            await fillGdLocalAttestationCheckbox(field);
        } catch (e) {
            debugLog('glassdoor attestation checkboxes error', String(e));
        }
    }
}

function getGdProfileFullName(profile) {
    try {
        return [profile?.firstName, profile?.lastName].map(s => s?.trim()).filter(Boolean).join(' ');
    } catch {
        return '';
    }
}

function formatGdLocalDate(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}

function getGdTodaysDateCandidates() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return [today, tomorrow, yesterday].map(formatGdLocalDate);
}

function gdFieldHasVisibleError(element) {
    try {
        if (!element) return false;
        if (element.getAttribute('aria-invalid') === 'true') return true;
        const item = element.closest('.ia-Questions-item') || element.parentElement;
        return !!item?.querySelector('[class*="error"], [role="alert"]');
    } catch {
        return false;
    }
}

async function fillGdLocalEeoField(field, profile, rotateDate) {
    try {
        const labelNorm = normalizeGdEeoLabel(field.label);
        if (/type your full name/.test(labelNorm)) {
            const fullName = getGdProfileFullName(profile);
            if (!fullName) {
                debugLog('glassdoor EEO: profile full name missing');
                return false;
            }
            setNativeValueGlassdoor(field.element, fullName);
            field.value = fullName;
            debugLog('glassdoor EEO: filled full name', fullName);
            return true;
        }
        if (/today'?s?\s*date/.test(labelNorm)) {
            const candidates = getGdTodaysDateCandidates();
            let startIdx = field.__gdDateCandidateIndex || 0;
            if (rotateDate) {
                startIdx = (startIdx + 1) % candidates.length;
            }
            for (let i = 0; i < candidates.length; i++) {
                const idx = (startIdx + i) % candidates.length;
                const dateStr = candidates[idx];
                setNativeValueGlassdoor(field.element, dateStr);
                await waitImmediate(300);
                if (field.element?.value === dateStr && !gdFieldHasVisibleError(field.element)) {
                    field.value = dateStr;
                    field.__gdDateCandidateIndex = idx;
                    debugLog('glassdoor EEO: filled today date', dateStr, 'candidate', idx);
                    return true;
                }
                debugLog('glassdoor EEO: date candidate rejected', dateStr, 'candidate', idx);
            }
            const fallback = candidates[startIdx];
            setNativeValueGlassdoor(field.element, fallback);
            field.value = fallback;
            field.__gdDateCandidateIndex = startIdx;
            debugLog('glassdoor EEO: filled today date fallback', fallback);
            return true;
        }
    } catch (e) {
        debugLog('glassdoor EEO: fillGdLocalEeoField error', String(e));
        console.error(e);
    }
    return false;
}

async function fillGdLocalEeoFields(fields, profile, rotateDate) {
    if (!profile || !fields?.length) return;
    for (const field of fields) {
        if (!isGdLocalEeoField(field.label)) continue;
        try {
            await fillGdLocalEeoField(field, profile, rotateDate);
        } catch (e) {
            debugLog('glassdoor EEO: fillGdLocalEeoFields error', String(e));
            console.error(e);
        }
    }
}

async function fillGdEeoSignatureFieldsFromDom(profile, rotateDate) {
    if (!profile) return;
    try {
        debugLog('glassdoor EEO: DOM scan start', location.pathname);
        const seen = new Set();
        const candidates = [
            ...document.querySelectorAll('.ia-Questions-item'),
            ...document.querySelectorAll('label, legend')
        ];
        for (const item of candidates) {
            if (!item.offsetParent) continue;
            const container = item.closest?.('.ia-Questions-item') || (item.matches?.('.ia-Questions-item') ? item : item.parentElement);
            if (!container || seen.has(container)) continue;
            const labelText = (container.querySelector('legend, label')?.innerText || item.innerText || '').trim();
            const labelNorm = normalizeGdEeoLabel(labelText);
            if (!/today'?s?\s*date/.test(labelNorm) && !/type your full name/.test(labelNorm)) continue;
            seen.add(container);
            let input = container.querySelector('input:not([type=radio]):not([type=checkbox]), textarea');
            if (!input && item.tagName === 'LABEL' && item.getAttribute('for')) {
                input = document.getElementById(item.getAttribute('for'));
            }
            if (!input) {
                debugLog('glassdoor EEO: input not found for', labelText);
                continue;
            }
            const field = { element: input, label: labelText, type: input.type || 'text' };
            await fillGdLocalEeoField(field, profile, rotateDate);
        }
    } catch (e) {
        debugLog('glassdoor EEO: DOM scan error', String(e));
        console.error(e);
    }
}

function cleanGdFieldLabel(label) {
    try {
        return normalizeWhitespace(label || '')
            .replace(/\s*\*?\s*search to select an option\s*/gi, '')
            .replace(/\s+\*\s*$/, '')
            .trim();
    } catch {
        return String(label || '').trim();
    }
}

function isGdResumeUploadLabel(label) {
    try {
        return /upload.*(resume|résumé|cv)|attach.*(resume|cv)|copy of your resume/i.test(cleanGdFieldLabel(label || ''));
    } catch {
        return false;
    }
}

function findGdFileInputInItem(item) {
    try {
        return item?.querySelector('input[type=file]')
            || item?.closest?.('.ia-Questions-item')?.querySelector('input[type=file]')
            || item?.parentElement?.querySelector('input[type=file]');
    } catch {
        return null;
    }
}

async function fillGdResumeUploadField(field, data) {
    try {
        const item = field.__gdComboboxContainer || field.element?.closest?.('.ia-Questions-item');
        let input = field.element || findGdFileInputInItem(item);
        if (!input) {
            const btn = [...(item || document).querySelectorAll('button, [role=button], label')].find(el =>
                /upload|browse|choose file|select file|attach/i.test((el.innerText || '').trim())
            );
            if (btn) {
                await gdClickGlassdoorElement(btn);
                await waitImmediate(600);
            }
            input = findGdFileInputInItem(item) || document.querySelector('input[type=file]');
        }
        if (!input) {
            debugLog('glassdoor resume upload: file input not found', field.label);
            return false;
        }
        field.element = input;
        if (input.files?.length) {
            debugLog('glassdoor resume upload: already present', field.label);
            return true;
        }
        const cv = await getResume(data);
        appendStatusMessage('Uploading your CV. Please hang on...');
        await uploadFile(cv.url, cv.originalFilename, input);
        await wait(3000);
        debugLog('glassdoor resume upload OK', field.label, cv.originalFilename);
        return true;
    } catch (e) {
        debugLog('glassdoor resume upload error', String(e));
        console.error(e);
    }
    return false;
}

function isGdIndeedLocationComboboxItem(item) {
    try {
        return !!item?.querySelector(
            'input[role="combobox"][autocomplete="address-level2"], [data-testid*="locality-input"]'
        );
    } catch {
        return false;
    }
}

function isGdMultiSelectCheckboxDropdownItem(item) {
    try {
        const fieldset = item?.querySelector('fieldset[name^="q_"]');
        if (!fieldset) return false;
        return !!fieldset.querySelector('[data-testid*="select-list"]');
    } catch {
        return false;
    }
}

function gdIsVisibleElement(el) {
    try {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    } catch {
        return !!el?.offsetParent;
    }
}

function gdCollectSelectListOptions(scope) {
    try {
        const root = scope || document;
        const nodes = [...root.querySelectorAll('[role="listbox"] [role="option"], li[role="option"]')]
            .filter(gdIsVisibleElement);
        const seen = new Set();
        const entries = [];
        for (const el of nodes) {
            const text = gdGetMultiSelectOptionLabel(el);
            if (!text || seen.has(text)) continue;
            seen.add(text);
            entries.push({
                node: el,
                text,
                id: el.id,
                value: el.getAttribute('data-testid') || el.id || text,
                role: 'option'
            });
        }
        return entries;
    } catch {
        return [];
    }
}

async function gdOpenIndeedSelectListDropdown(item, { closeFirst } = {}) {
    if (closeFirst) {
        await gdCloseMultiSelectDropdown();
        await waitImmediate(300);
    }
    const { trigger, searchInput } = findGdSearchComboboxParts(item);
    if (!trigger) return { popupRoot: null, entries: [] };
    await gdClickGlassdoorElement(trigger);
    await waitImmediate(600);
    let popupRoot = null;
    let entries = [];
    for (let attempt = 0; attempt < 12; attempt++) {
        const popupId = gdGetMultiSelectDropdownListboxId(item);
        popupRoot = gdFindMultiSelectPopupRoot(item, popupId);
        const scopes = [popupRoot, item, document].filter(Boolean);
        for (const scope of scopes) {
            entries = gdCollectSelectListOptions(scope);
            if (entries.length) break;
        }
        if (entries.length) break;
        if (attempt === 3 && searchInput && searchInput !== trigger) {
            await gdClickGlassdoorElement(searchInput);
        }
        await waitImmediate(300);
    }
    return { popupRoot, entries, trigger, searchInput };
}

function gdFindOptionEntry(entries, field, value) {
    const v = String(value).trim();
    if (!v) return null;
    const vl = v.toLowerCase();
    if (Array.isArray(field.options)) {
        const idx = field.options.findIndex(o => o === v || String(o).trim().toLowerCase() === vl);
        if (idx >= 0 && entries[idx]) return entries[idx];
    }
    if (Array.isArray(field.__gdSelectListOptionIds)) {
        const idx = field.__gdSelectListOptionIds.findIndex(id => id === v || String(id).toLowerCase() === vl);
        if (idx >= 0 && entries[idx]) return entries[idx];
    }
    return entries.find(e => e.text === v)
        || entries.find(e => e.text.toLowerCase() === vl)
        || entries.find(e => String(e.value || '').toLowerCase() === vl);
}

function isGdSearchComboboxItem(item) {
    try {
        if (isGdIndeedLocationComboboxItem(item)) return false;
        if (isGdMultiSelectCheckboxDropdownItem(item)) return false;
        return !!(
            item?.querySelector('input[placeholder*="Search to select" i]') ||
            item?.querySelector('button[aria-haspopup="listbox"]') ||
            item?.querySelector('button[aria-haspopup="dialog"]') ||
            item?.querySelector('[role="combobox"][aria-haspopup]') ||
            item?.querySelector('[data-testid*="select-list"]')
        );
    } catch {
        return false;
    }
}

function gdGetMultiSelectDropdownListboxId(item) {
    try {
        const trigger = item?.querySelector('[role="combobox"][aria-haspopup]')
            || item?.querySelector('button[aria-haspopup="listbox"]')
            || item?.querySelector('button[aria-haspopup="dialog"]');
        const controls = trigger?.getAttribute('aria-controls');
        if (controls) return controls;
        const owns = trigger?.getAttribute('aria-owns');
        if (owns) return owns;
        return null;
    } catch {
        return null;
    }
}

function gdFindMultiSelectPopupRoot(item, popupId) {
    try {
        if (popupId) {
            const byId = document.getElementById(popupId);
            if (byId) return byId;
        }
        const inItem = item?.querySelector('[role="dialog"], [role="listbox"], [role="menu"]');
        if (inItem) return inItem;
        const trigger = item?.querySelector('[role="combobox"][aria-haspopup]')
            || item?.querySelector('button[aria-haspopup]');
        const controls = trigger?.getAttribute('aria-controls');
        if (controls) {
            const el = document.getElementById(controls);
            if (el) return el;
        }
        return null;
    } catch {
        return null;
    }
}

function gdGetMultiSelectOptionLabel(el) {
    try {
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
            const parts = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.innerText?.trim()).filter(Boolean);
            if (parts.length) return parts.join(' ');
        }
        const text = (el.innerText || el.textContent || '').trim();
        if (text) return text;
        return (el.getAttribute('data-testid') || el.id || '').trim();
    } catch {
        return '';
    }
}

function gdIsMultiSelectOptionChecked(el) {
    try {
        if (el.matches?.('input[type=checkbox]')) return !!el.checked;
        return el.getAttribute('aria-checked') === 'true';
    } catch {
        return false;
    }
}

function gdCollectMultiSelectCheckboxes(scope) {
    try {
        const root = scope || document;
        const entries = [];
        const menuItems = [...root.querySelectorAll('[role="menuitemcheckbox"]')].filter(el => el.offsetParent !== null);
        for (const el of menuItems) {
            const text = gdGetMultiSelectOptionLabel(el);
            if (!text) continue;
            entries.push({
                checkbox: el,
                text,
                id: el.id,
                name: el.getAttribute('name') || '',
                value: el.getAttribute('data-testid') || el.id || text,
                role: 'menuitemcheckbox'
            });
        }
        const checkboxes = [...root.querySelectorAll('input[type=checkbox]')].filter(cb => cb.offsetParent !== null);
        for (const cb of checkboxes) {
            const labelEl = cb.closest('label')
                || (cb.id ? root.querySelector(`label[for="${cb.id.replace(/"/g, '\\"')}"]`) : null)
                || cb.closest('[role="option"], li, [data-testid*="option"]');
            const text = (labelEl?.innerText || cb.parentElement?.innerText || cb.value || '').trim();
            if (!text) continue;
            entries.push({
                checkbox: cb,
                text,
                id: cb.id,
                name: cb.name,
                value: cb.value,
                role: 'checkbox'
            });
        }
        return entries;
    } catch {
        return [];
    }
}

function dumpGdMultiSelectDropdownDom(item, label, popupRoot, entries) {
    try {
        const trigger = item?.querySelector('[role="combobox"][aria-haspopup]')
            || item?.querySelector('button[aria-haspopup]');
        debugLog('glassdoor multiselect DOM item', (label || '').slice(0, 80), item?.outerHTML?.slice(0, 1200));
        debugLog('glassdoor multiselect DOM trigger', trigger?.tagName, trigger?.getAttribute?.('role'),
            'aria-haspopup', trigger?.getAttribute?.('aria-haspopup'),
            'aria-controls', trigger?.getAttribute?.('aria-controls'),
            'aria-expanded', trigger?.getAttribute?.('aria-expanded'));
        if (popupRoot) {
            debugLog('glassdoor multiselect DOM popup', popupRoot.tagName, popupRoot.id,
                popupRoot.getAttribute?.('role'), popupRoot.outerHTML?.slice(0, 2500));
        }
        debugLog('glassdoor multiselect DOM options', entries.length,
            entries.map(e => `${e.role || 'option'}:${e.id || e.name || '?'}=${e.text.slice(0, 60)}`).join(' | '));
    } catch (e) {
        debugLog('glassdoor multiselect DOM dump error', String(e));
    }
}

async function gdOpenMultiSelectDropdown(item, { closeFirst } = {}) {
    if (closeFirst) {
        await gdCloseMultiSelectDropdown();
        await waitImmediate(300);
    }
    const { trigger, searchInput } = findGdSearchComboboxParts(item);
    if (!trigger) return { popupRoot: null, entries: [] };
    await gdClickGlassdoorElement(trigger);
    await waitImmediate(600);
    if (searchInput && searchInput !== trigger) {
        await gdClickGlassdoorElement(searchInput);
        await waitImmediate(300);
    }
    let popupRoot = null;
    let entries = [];
    for (let attempt = 0; attempt < 12; attempt++) {
        const popupId = gdGetMultiSelectDropdownListboxId(item);
        popupRoot = gdFindMultiSelectPopupRoot(item, popupId);
        const scopes = [popupRoot, item, document].filter(Boolean);
        for (const scope of scopes) {
            entries = gdCollectMultiSelectCheckboxes(scope);
            if (entries.length) break;
        }
        if (entries.length) break;
        if (attempt === 3 && searchInput && searchInput !== trigger) {
            await gdClickGlassdoorElement(searchInput);
        }
        await waitImmediate(300);
    }
    return { popupRoot, entries, trigger, searchInput };
}

function gdFindMultiSelectEntry(entries, field, value) {
    const v = String(value).trim();
    if (!v) return null;
    const vl = v.toLowerCase();
    if (Array.isArray(field.options)) {
        const idx = field.options.findIndex(o => o === v || String(o).trim().toLowerCase() === vl);
        if (idx >= 0 && entries[idx]) return entries[idx];
    }
    if (Array.isArray(field.__gdMultiSelectOptionIds)) {
        const idx = field.__gdMultiSelectOptionIds.findIndex(id => id === v || String(id).toLowerCase() === vl);
        if (idx >= 0 && entries[idx]) return entries[idx];
    }
    return entries.find(e => e.text === v)
        || entries.find(e => e.text.toLowerCase() === vl)
        || entries.find(e => String(e.value || '').toLowerCase() === vl);
}

async function gdCloseMultiSelectDropdown() {
    try {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await waitImmediate(200);
    } catch {}
}

function isGdIndeedTypeaheadComboboxItem(item) {
    try {
        if (isGdIndeedLocationComboboxItem(item)) return false;
        const input = item?.querySelector('input[role="combobox"]');
        if (!input) return false;
        if (/search to select/i.test(input.placeholder || '')) return false;
        if (item.querySelector('button[aria-haspopup="listbox"]')) return false;
        return true;
    } catch {
        return false;
    }
}

function findGdSearchComboboxParts(item) {
    try {
        const searchInput = item.querySelector('input[placeholder*="Search to select" i]')
            || item.querySelector('[data-testid*="select-list-filter-input"]');
        let trigger = item.querySelector('[role="combobox"][aria-haspopup]')
            || item.querySelector('button[aria-haspopup="listbox"]')
            || item.querySelector('button[aria-haspopup="dialog"]');
        if (!trigger) {
            const inputs = [...item.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=hidden])')];
            trigger = inputs.find(inp => inp !== searchInput && !/search to select/i.test(inp.placeholder || ''))
                || item.querySelector('button')
                || item.querySelector('[data-testid*="select-list"] [tabindex="0"]')
                || searchInput;
        }
        return { searchInput, trigger, container: item };
    } catch {
        return { searchInput: null, trigger: null, container: item };
    }
}

function gdCollectVisibleOptions(scope) {
    try {
        const root = scope || document;
        const nodes = [
            ...root.querySelectorAll('[role="option"]'),
            ...root.querySelectorAll('[role="listbox"] li'),
            ...root.querySelectorAll('[data-testid*="option"]')
        ].filter(el => el.offsetParent !== null);
        const texts = [...new Set(nodes.map(el => el.innerText.trim()))].filter(Boolean);
        return { nodes, texts };
    } catch {
        return { nodes: [], texts: [] };
    }
}

const GD_PHONE_DIAL_TO_ISO = {
    '+93': ['AF'], '+358': ['FI', 'AX'], '+355': ['AL'], '+213': ['DZ'], '+1684': ['AS'], '+376': ['AD'],
    '+244': ['AO'], '+1264': ['AI'], '+672': ['AQ', 'NF'], '+1268': ['AG'], '+54': ['AR'], '+374': ['AM'],
    '+297': ['AW'], '+61': ['AU', 'CX', 'CC'], '+43': ['AT'], '+994': ['AZ'], '+1242': ['BS'], '+973': ['BH'],
    '+880': ['BD'], '+1246': ['BB'], '+375': ['BY'], '+32': ['BE'], '+501': ['BZ'], '+229': ['BJ'],
    '+1441': ['BM'], '+975': ['BT'], '+591': ['BO'], '+387': ['BA'], '+267': ['BW'], '+55': ['BR'],
    '+246': ['IO'], '+673': ['BN'], '+359': ['BG'], '+226': ['BF'], '+257': ['BI'], '+855': ['KH'],
    '+237': ['CM'], '+1': ['US', 'CA'], '+238': ['CV'], '+345': ['KY'], '+236': ['CF'], '+235': ['TD'],
    '+56': ['CL'], '+86': ['CN'], '+57': ['CO'], '+269': ['KM'], '+242': ['CG'], '+243': ['CD'],
    '+682': ['CK'], '+506': ['CR'], '+225': ['CI'], '+385': ['HR'], '+53': ['CU'], '+357': ['CY'],
    '+420': ['CZ'], '+45': ['DK'], '+253': ['DJ'], '+1767': ['DM'], '+1849': ['DO'], '+593': ['EC'],
    '+20': ['EG'], '+503': ['SV'], '+240': ['GQ'], '+291': ['ER'], '+372': ['EE'], '+251': ['ET'],
    '+500': ['FK', 'GS'], '+298': ['FO'], '+679': ['FJ'], '+33': ['FR'], '+594': ['GF'], '+689': ['PF'],
    '+241': ['GA'], '+220': ['GM'], '+995': ['GE'], '+49': ['DE'], '+233': ['GH'], '+350': ['GI'],
    '+30': ['GR'], '+299': ['GL'], '+1473': ['GD'], '+590': ['GP', 'BL', 'MF'], '+1671': ['GU'],
    '+502': ['GT'], '+44': ['GB', 'GG', 'IM', 'JE'], '+224': ['GN'], '+245': ['GW'], '+595': ['PY', 'GY'],
    '+509': ['HT'], '+379': ['VA'], '+504': ['HN'], '+852': ['HK'], '+36': ['HU'], '+354': ['IS'],
    '+91': ['IN'], '+62': ['ID'], '+98': ['IR'], '+964': ['IQ'], '+353': ['IE'], '+972': ['IL'],
    '+39': ['IT'], '+1876': ['JM'], '+81': ['JP'], '+962': ['JO'], '+77': ['KZ'], '+254': ['KE'],
    '+686': ['KI'], '+850': ['KP'], '+82': ['KR'], '+965': ['KW'], '+996': ['KG'], '+856': ['LA'],
    '+371': ['LV'], '+961': ['LB'], '+266': ['LS'], '+231': ['LR'], '+218': ['LY'], '+423': ['LI'],
    '+370': ['LT'], '+352': ['LU'], '+853': ['MO'], '+389': ['MK'], '+261': ['MG'], '+265': ['MW'],
    '+60': ['MY'], '+960': ['MV'], '+223': ['ML'], '+356': ['MT'], '+692': ['MH'], '+596': ['MQ'],
    '+222': ['MR'], '+230': ['MU'], '+262': ['RE', 'YT'], '+52': ['MX'], '+691': ['FM'], '+373': ['MD'],
    '+377': ['MC'], '+976': ['MN'], '+382': ['ME'], '+1664': ['MS'], '+212': ['MA'], '+258': ['MZ'],
    '+95': ['MM'], '+264': ['NA'], '+674': ['NR'], '+977': ['NP'], '+31': ['NL'], '+599': ['AN'],
    '+687': ['NC'], '+64': ['NZ'], '+505': ['NI'], '+227': ['NE'], '+234': ['NG'], '+683': ['NU'],
    '+1670': ['MP'], '+47': ['NO', 'SJ'], '+968': ['OM'], '+92': ['PK'], '+680': ['PW'], '+970': ['PS'],
    '+507': ['PA'], '+675': ['PG'], '+51': ['PE'], '+63': ['PH'], '+872': ['PN'], '+48': ['PL'],
    '+351': ['PT'], '+1939': ['PR'], '+974': ['QA'], '+40': ['RO'], '+7': ['RU', 'KZ'], '+250': ['RW'],
    '+290': ['SH'], '+1869': ['KN'], '+1758': ['LC'], '+508': ['PM'], '+1784': ['VC'], '+685': ['WS'],
    '+378': ['SM'], '+239': ['ST'], '+966': ['SA'], '+221': ['SN'], '+381': ['RS'], '+248': ['SC'],
    '+232': ['SL'], '+65': ['SG'], '+421': ['SK'], '+386': ['SI'], '+677': ['SB'], '+252': ['SO'],
    '+27': ['ZA'], '+211': ['SS'], '+34': ['ES'], '+94': ['LK'], '+249': ['SD'], '+597': ['SR'],
    '+268': ['SZ'], '+46': ['SE'], '+41': ['CH'], '+963': ['SY'], '+886': ['TW'], '+992': ['TJ'],
    '+255': ['TZ'], '+66': ['TH'], '+670': ['TL'], '+228': ['TG'], '+690': ['TK'], '+676': ['TO'],
    '+1868': ['TT'], '+216': ['TN'], '+90': ['TR'], '+993': ['TM'], '+1649': ['TC'], '+688': ['TV'],
    '+256': ['UG'], '+380': ['UA'], '+971': ['AE'], '+598': ['UY'], '+998': ['UZ'], '+678': ['VU'],
    '+58': ['VE'], '+84': ['VN'], '+1284': ['VG'], '+1340': ['VI'], '+681': ['WF'], '+967': ['YE'],
    '+260': ['ZM'], '+263': ['ZW']
};

function gdPhoneDialCodeIsoCandidates(dialCode) {
    const raw = String(dialCode || '').trim();
    if (!raw) return [];
    const normalized = raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
    return GD_PHONE_DIAL_TO_ISO[normalized] || [];
}

// Fallback only: drives Glassdoor's phone country `div[role=combobox]` (backed by a
// non-virtualized 245-option `ul[role=listbox]`) directly via keyboard navigation + click.
// Neither a real click nor Enter on the correctly-scrolled-into-view option reliably commits
// the selection from a content script (the option's click handler runs but the widget's
// `data-value` never updates, even momentarily — see extension-debug.log history for this
// function). The primary, reliable path is `fillGdContactInfoPhone` below, which types the
// full E.164 number (dial code + digits) into the phone text input and lets the widget's own
// libphonenumber-style parsing auto-select the country. This function is kept only as a
// best-effort fallback for dial codes that auto-detect ambiguously (e.g. +1 -> US or CA).
async function gdSelectGlassdoorPhoneCountry(combo, dialCode) {
    try {
        const isoCandidates = gdPhoneDialCodeIsoCandidates(dialCode);
        if (!isoCandidates.length) {
            debugLog('glassdoor phone country: no ISO candidates for dial code', dialCode);
            return false;
        }
        debugLog('glassdoor phone country start', 'dial=', dialCode, 'iso=', isoCandidates.join(','),
            'data-value=', combo.getAttribute('data-value'));

        if (isoCandidates.includes(combo.getAttribute('data-value'))) {
            debugLog('glassdoor phone country already correct', combo.getAttribute('data-value'));
            return true;
        }

        combo.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        combo.focus();
        combo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true }));
        await waitImmediate(400);

        const listboxId = combo.getAttribute('aria-controls');
        const listbox = listboxId ? document.getElementById(listboxId) : null;
        const expanded = combo.getAttribute('aria-expanded') === 'true';
        debugLog('glassdoor phone country dropdown state', 'expanded=', expanded, 'listboxId=', listboxId, 'found=', !!listbox);

        if (!expanded || !listbox) {
            debugLog('glassdoor phone country: dropdown did not open');
            return false;
        }

        const options = [...listbox.querySelectorAll('[role="option"]')];
        debugLog('glassdoor phone country options count', options.length,
            'first=', options[0]?.getAttribute('data-testid'), 'last=', options[options.length - 1]?.getAttribute('data-testid'));

        let target = null;
        for (const iso of isoCandidates) {
            target = options.find((o) => o.getAttribute('data-testid') === `country-select-${iso}`);
            if (target) break;
        }
        if (!target) {
            debugLog('glassdoor phone country: target option not found for', isoCandidates.join(','));
            return false;
        }

        const targetIndex = options.indexOf(target);
        const activeIdBefore = combo.getAttribute('aria-activedescendant');
        let currentIndex = options.findIndex((o) => o.id === activeIdBefore);
        if (currentIndex < 0) currentIndex = 0;
        const steps = targetIndex - currentIndex;
        const navKey = steps > 0 ? 'ArrowDown' : 'ArrowUp';
        debugLog('glassdoor phone country navigate', 'activeIdBefore=', activeIdBefore,
            'from=', currentIndex, 'to=', targetIndex, 'steps=', steps);

        // The widget's highlighted-index state only advances once React has committed the
        // previous keydown's state update; firing all ArrowDown/Up presses back-to-back in the
        // same tick only moves the highlight by one step regardless of press count. Each press
        // must be followed by a short real wait so the commit lands before the next press.
        for (let i = 0; i < Math.abs(steps); i++) {
            combo.dispatchEvent(new KeyboardEvent('keydown', { key: navKey, code: navKey, bubbles: true, cancelable: true }));
            await waitImmediate(20);
        }
        await waitImmediate(200);

        const activeIdAfter = combo.getAttribute('aria-activedescendant');
        debugLog('glassdoor phone country active after nav', 'activeIdAfter=', activeIdAfter,
            'targetId=', target.id, 'match=', activeIdAfter === target.id,
            'connected=', target.isConnected, 'rect=', JSON.stringify(target.getBoundingClientRect()));

        // Give the widget's own auto-scroll (keeping the highlighted item in view while we
        // navigated) time to fully settle before committing — clicking/pressing Enter while it
        // is still settling is silently ignored by this widget.
        await waitImmediate(800);
        let rect = target.getBoundingClientRect();
        debugLog('glassdoor phone country pre-click state', 'expanded=', combo.getAttribute('aria-expanded'),
            'connected=', target.isConnected, 'rect=', JSON.stringify(rect));

        let committedValue = combo.getAttribute('data-value');
        let committed = false;

        if (rect.width > 0 && rect.height > 0) {
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const hit = document.elementFromPoint(cx, cy);
            const clickTarget = hit && target.contains(hit) ? hit : target;
            debugLog('glassdoor phone country click', 'hit=', hit?.tagName, 'clickTarget=', clickTarget?.tagName);
            // Deliberately skip scrollIntoView()/focus() here (unlike gdClickGlassdoorElement) —
            // the option is already scrolled into view by the keyboard navigation above, and
            // re-triggering a scroll or moving focus off the combobox right before the click
            // re-arms the same scroll-settle guard we just waited out, or blurs the trigger and
            // closes the popup before the click is processed.
            const opts = { bubbles: true, cancelable: true, composed: true, view: window };
            clickTarget.dispatchEvent(new PointerEvent('pointerover', { ...opts, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
            clickTarget.dispatchEvent(new MouseEvent('mouseover', { ...opts, clientX: cx, clientY: cy }));
            clickTarget.dispatchEvent(new PointerEvent('pointerenter', { ...opts, bubbles: false, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
            clickTarget.dispatchEvent(new MouseEvent('mouseenter', { ...opts, bubbles: false, clientX: cx, clientY: cy }));
            clickTarget.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
            clickTarget.dispatchEvent(new MouseEvent('mousemove', { ...opts, clientX: cx, clientY: cy }));
            await waitImmediate(60);
            clickTarget.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 }));
            clickTarget.dispatchEvent(new MouseEvent('mousedown', { ...opts, clientX: cx, clientY: cy, button: 0 }));
            await waitImmediate(80);
            clickTarget.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 }));
            clickTarget.dispatchEvent(new MouseEvent('mouseup', { ...opts, clientX: cx, clientY: cy, button: 0 }));
            clickTarget.dispatchEvent(new MouseEvent('click', { ...opts, clientX: cx, clientY: cy, button: 0 }));
            const poll = [];
            for (let i = 0; i < 10; i++) {
                await waitImmediate(80);
                poll.push(combo.getAttribute('data-value'));
            }
            debugLog('glassdoor phone country poll after click (80ms steps)', poll.join(','));
            committedValue = combo.getAttribute('data-value');
            committed = isoCandidates.includes(committedValue);
            debugLog('glassdoor phone country after click', 'data-value=', committedValue, 'committed=', committed,
                'expanded=', combo.getAttribute('aria-expanded'));
        } else {
            debugLog('glassdoor phone country: target not visible, skipping click', JSON.stringify(rect));
        }

        if (!committed && combo.getAttribute('aria-expanded') === 'true') {
            combo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
            await waitImmediate(400);
            committedValue = combo.getAttribute('data-value');
            committed = isoCandidates.includes(committedValue);
            debugLog('glassdoor phone country after enter fallback', 'data-value=', committedValue, 'committed=', committed,
                'expanded=', combo.getAttribute('aria-expanded'));
        }

        if (!committed) {
            const popup = listbox.closest('[id^="Popup-"]') || listbox.parentElement;
            debugLog('glassdoor phone country FAILED', 'wanted=', isoCandidates.join(','), 'final data-value=', committedValue,
                'listboxConnected=', listbox.isConnected, 'listboxRect=', JSON.stringify(listbox.getBoundingClientRect()),
                'popupRect=', popup ? JSON.stringify(popup.getBoundingClientRect()) : null,
                'popupStyle=', popup ? popup.getAttribute('style') : null);
        }
        return committed;
    } catch (e) {
        debugLog('glassdoor phone country error', String(e));
        console.error(e);
        return false;
    }
}

// This phone field auto-detects the country from a full E.164-style number typed into the tel
// input itself (e.g. typing "+1 5714732129" flips the country combobox to United States and
// reformats the input down to the local digits) — far more reliable than driving the 245-option
// country dropdown directly. The dropdown fallback (gdSelectGlassdoorPhoneCountry) only runs if
// auto-detect doesn't land on one of the expected ISO codes (e.g. an ambiguous dial code).
async function fillGdContactInfoPhone(profile) {
    try {
        const combo = document.querySelector('[data-testid="phone-number-field"] [role=combobox]');
        const input = document.querySelector('[data-testid="phone-number-field"] input[type=tel]');
        debugLog('glassdoor phone combobox tag=', combo?.tagName, 'data-value=', combo?.getAttribute?.('data-value'),
            'expanded=', combo?.getAttribute?.('aria-expanded'), 'input found=', !!input);

        if (!input || !profile.phone) {
            debugLog('glassdoor phone: tel input not found or no profile phone');
            return;
        }

        const isoCandidates = gdPhoneDialCodeIsoCandidates(profile.phoneCountryCode);
        const dialDigits = String(profile.phoneCountryCode || '').replace(/\D/g, '');
        const e164 = dialDigits ? `+${dialDigits} ${profile.phone}` : profile.phone;

        input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        await waitImmediate(200);
        setNativeValueGlassdoor(input, e164);
        input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: e164 }));
        await waitImmediate(500);
        debugLog('glassdoor phone fill via e164', 'typed=', e164, 'data-value=', combo?.getAttribute?.('data-value'), 'tel value=', input.value);

        if (combo && isoCandidates.length && !isoCandidates.includes(combo.getAttribute('data-value'))) {
            debugLog('glassdoor phone country: e164 auto-detect did not land on expected country, trying dropdown fallback');
            const ok = await gdSelectGlassdoorPhoneCountry(combo, profile.phoneCountryCode);
            if (ok) {
                await waitImmediate(300);
                setNativeValueGlassdoor(input, profile.phone);
                input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: profile.phone }));
                await waitImmediate(300);
            }
            debugLog('glassdoor phone country dropdown fallback result', ok, 'data-value=', combo.getAttribute('data-value'));
        }

        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, cancelable: true, composed: true }));
    } catch (e) {
        debugLog('glassdoor phone fill error', String(e));
        console.error(e);
    }
}

async function gdClickGlassdoorElement(element) {
    if (!element) return;
    try {
        element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        element.focus();
    } catch {}
    const opts = { bubbles: true, cancelable: true, composed: true, view: window };
    element.dispatchEvent(new PointerEvent('pointerdown', opts));
    element.dispatchEvent(new MouseEvent('mousedown', opts));
    element.dispatchEvent(new PointerEvent('pointerup', opts));
    element.dispatchEvent(new MouseEvent('mouseup', opts));
    element.dispatchEvent(new MouseEvent('click', opts));
    element.click();
}

async function gdOpenSearchCombobox(item, logDom) {
    try {
        const { trigger, searchInput } = findGdSearchComboboxParts(item);
        if (logDom) {
            debugLog('glassdoor combobox DOM', item.outerHTML?.slice(0, 800));
            debugLog('glassdoor combobox trigger', trigger?.tagName, trigger?.getAttribute?.('role'),
                trigger?.getAttribute?.('aria-haspopup'), 'searchInput', !!searchInput);
        }
        if (!trigger) {
            debugLog('glassdoor combobox: trigger not found');
            return [];
        }
        let opened = await gdOpenIndeedSelectListDropdown(item, { closeFirst: true });
        for (let retry = 0; !opened.entries.length && retry < 4; retry++) {
            await gdCloseMultiSelectDropdown();
            await waitImmediate(400);
            opened = await gdOpenIndeedSelectListDropdown(item, { closeFirst: true });
        }
        if (opened.entries.length) {
            debugLog('glassdoor combobox OPEN options', opened.entries.length,
                opened.entries.map(e => e.text.slice(0, 40)).join(' | '));
            if (logDom && opened.popupRoot) {
                debugLog('glassdoor combobox DOM popup', opened.popupRoot.id,
                    opened.popupRoot.getAttribute?.('role'), opened.popupRoot.outerHTML?.slice(0, 2000));
            }
            await gdCloseMultiSelectDropdown();
            return opened.entries.map(e => e.text);
        }
        debugLog('glassdoor combobox: options not found after open');
    } catch (e) {
        debugLog('glassdoor combobox open error', String(e));
        console.error(e);
    }
    return [];
}

async function fillGdIndeedLocationCombobox(field, value) {
    try {
        if (Array.isArray(value)) value = value[0];
        if (!value) return false;
        const item = field.__gdComboboxContainer || field.element?.parentElement || field.element;
        const input = field.element?.matches?.('input')
            ? field.element
            : item?.querySelector('input[role="combobox"], [data-testid*="locality-input"]');
        if (!input) {
            debugLog('glassdoor location combobox fill: input not found', field.label);
            return false;
        }
        const cityOnly = String(value).split(',')[0].trim();
        const variants = [...new Set([value, cityOnly].filter(Boolean))];

        await gdClickGlassdoorElement(input);
        await waitImmediate(200);
        for (const typed of variants) {
            setNativeValueGlassdoor(input, typed);
            input.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                composed: true,
                inputType: 'insertText',
                data: typed
            }));
            await waitImmediate(700);
            for (let attempt = 0; attempt < 12; attempt++) {
                const { nodes } = gdCollectVisibleOptions(document);
                for (const el of nodes) {
                    const text = el.innerText.trim();
                    if (!text) continue;
                    const tl = text.toLowerCase();
                    if (variants.some(v => tl.includes(String(v).toLowerCase()) || tl.startsWith(cityOnly.toLowerCase()))) {
                        await gdClickGlassdoorElement(el);
                        debugLog('glassdoor location combobox fill OK', field.label, text);
                        await waitImmediate(400);
                        return true;
                    }
                }
                await waitImmediate(250);
            }
        }
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        await waitImmediate(150);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await waitImmediate(400);
        if ((input.value || '').trim() && !gdFieldHasVisibleError(input)) {
            debugLog('glassdoor location combobox fill OK via enter', field.label, input.value);
            return true;
        }
        debugLog('glassdoor location combobox fill: option not found', field.label, value);
    } catch (e) {
        debugLog('glassdoor location combobox fill error', String(e));
        console.error(e);
    }
    return false;
}

async function fillGdIndeedTypeaheadCombobox(field, value) {
    try {
        if (Array.isArray(value)) value = value[0];
        if (!value) return false;
        const item = field.__gdComboboxContainer || field.element?.closest?.('.ia-Questions-item') || field.element?.parentElement;
        const input = field.element?.matches?.('input')
            ? field.element
            : item?.querySelector('input[role="combobox"]');
        if (!input) {
            debugLog('glassdoor typeahead combobox fill: input not found', field.label);
            return false;
        }
        const typed = String(value).trim();
        const variants = [...new Set([typed, typed.split(',')[0].trim()].filter(Boolean))];

        await gdClickGlassdoorElement(input);
        await waitImmediate(200);
        for (const text of variants) {
            setNativeValueGlassdoor(input, text);
            input.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                composed: true,
                inputType: 'insertText',
                data: text
            }));
            await waitImmediate(700);
            for (let attempt = 0; attempt < 12; attempt++) {
                const { nodes } = gdCollectVisibleOptions(document);
                let exact = null;
                let partial = null;
                for (const el of nodes) {
                    const optionText = el.innerText.trim();
                    if (!optionText) continue;
                    const ol = optionText.toLowerCase();
                    const vl = text.toLowerCase();
                    if (ol === vl) {
                        exact = el;
                        break;
                    }
                    if (!partial && (ol.includes(vl) || vl.includes(ol))) {
                        partial = el;
                    }
                }
                const pick = exact || partial;
                if (pick) {
                    await gdClickGlassdoorElement(pick);
                    debugLog('glassdoor typeahead combobox fill OK', field.label, pick.innerText.trim());
                    await waitImmediate(400);
                    return true;
                }
                await waitImmediate(250);
            }
        }
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        await waitImmediate(150);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await waitImmediate(400);
        if ((input.value || '').trim() && !gdFieldHasVisibleError(input)) {
            debugLog('glassdoor typeahead combobox fill OK via enter', field.label, input.value);
            return true;
        }
        debugLog('glassdoor typeahead combobox fill: option not found', field.label, value);
    } catch (e) {
        debugLog('glassdoor typeahead combobox fill error', String(e));
        console.error(e);
    }
    return false;
}

async function fillGdMultiSelectCheckboxDropdown(field, value) {
    try {
        value = gdResolveHearAboutUsValue(field, value);
        if (!Array.isArray(value)) {
            value = value ? [value] : [];
        }
        const item = field.__gdComboboxContainer || field.element?.[0]?.closest?.('.ia-Questions-item');
        if (!item) {
            debugLog('glassdoor multiselect fill: container not found', field.label);
            return false;
        }
        let opened = await gdOpenMultiSelectDropdown(item, { closeFirst: true });
        for (let retry = 0; !opened.entries.length && retry < 3; retry++) {
            await gdCloseMultiSelectDropdown();
            await waitImmediate(400);
            opened = await gdOpenMultiSelectDropdown(item, { closeFirst: true });
        }
        debugLog('glassdoor multiselect fill open', field.label, 'checkboxes', opened.entries.length,
            'values', value.join(' | '));
        if (!opened.entries.length) {
            await gdCloseMultiSelectDropdown();
            debugLog('glassdoor multiselect fill: no checkboxes in open dropdown', field.label);
            return false;
        }
        let picked = 0;
        for (const v of value) {
            const entry = gdFindMultiSelectEntry(opened.entries, field, v);
            if (entry && !gdIsMultiSelectOptionChecked(entry.checkbox)) {
                await gdClickGlassdoorElement(entry.checkbox);
                picked += 1;
                debugLog('glassdoor multiselect fill checked', field.label, entry.text, entry.value || entry.id);
                await waitImmediate(300);
            } else if (entry && gdIsMultiSelectOptionChecked(entry.checkbox)) {
                picked += 1;
                debugLog('glassdoor multiselect fill already checked', field.label, entry.text);
            } else {
                debugLog('glassdoor multiselect fill option not found', field.label, v);
            }
        }
        await gdCloseMultiSelectDropdown();
        debugLog('glassdoor multiselect fill OK', field.label, picked, 'of', value.length);
        return picked > 0;
    } catch (e) {
        debugLog('glassdoor multiselect fill error', String(e));
        console.error(e);
    }
    return false;
}

async function fillGdSearchCombobox(field, value) {
    try {
        if (Array.isArray(value)) value = value[0];
        if (!value) return false;
        const item = field.__gdComboboxContainer || field.element?.closest?.('.ia-Questions-item') || field.element;
        let opened = await gdOpenIndeedSelectListDropdown(item, { closeFirst: true });
        for (let retry = 0; !opened.entries.length && retry < 3; retry++) {
            await gdCloseMultiSelectDropdown();
            await waitImmediate(400);
            opened = await gdOpenIndeedSelectListDropdown(item, { closeFirst: true });
        }
        debugLog('glassdoor combobox fill open', field.label, 'options', opened.entries.length, 'value', value);
        if (!opened.entries.length) {
            debugLog('glassdoor combobox fill: no options in open dropdown', field.label);
            return false;
        }
        const entry = gdFindOptionEntry(opened.entries, field, value);
        if (entry) {
            await gdClickGlassdoorElement(entry.node);
            debugLog('glassdoor combobox fill OK', field.label, entry.text, entry.value || entry.id);
            await gdCloseMultiSelectDropdown();
            await waitImmediate(400);
            return true;
        }
        await gdCloseMultiSelectDropdown();
        debugLog('glassdoor combobox fill: option not found', field.label, value);
    } catch (e) {
        debugLog('glassdoor combobox fill error', String(e));
        console.error(e);
    }
    return false;
}

async function grabFields(noSetText) {
    const results = [];
    for (let item of [...document.querySelectorAll('.ia-Questions-item, label')]) {
        let extraLabel = '';
        if (item.tagName == 'LABEL') {
            if (item.closest('.ia-Questions-item')) {
                continue;
            }
            item = item.parentElement;
            if (document.querySelector('h2')?.innerText) {
                extraLabel = ' (' + document.querySelector('h2')?.innerText + ')';
            }
        }

        if (!item.offsetParent) {
            console.warn('Skipping hidden item', item);
            continue;
        }

        const result = {
            element: null,
            type: '',
            label: '',
            required: false
        };

        const legend = item.querySelector('legend');
        if (legend) {
            result.label = legend?.innerText.trim();
        } else {
            result.label  = item.querySelector('label')?.innerText.trim();
        }

        if (!result.label) {
            console.warn('No label found for field', item);
            continue;
        }

        if (!result.label.endsWith('(optional)')) {
            result.required = true;
        } else {
            result.label = result.label.replace(/\(optional\)$/, '').trim();
        }

        result.__gdQuestionItem = item;
        const yesNoRoot = item.querySelector('fieldset') || item;

        if (yesNoRoot.querySelector('input[type=radio]')) {
            result.type = 'radio';
            result.element = [...yesNoRoot.querySelectorAll('input[type=radio]')];
            result.options = result.element.map(input => gdGetRadioOptionLabel(input));
            if (isGdExclusiveYesNoOptions(result.options)) {
                result.__gdExclusiveYesNo = true;
                if (result.element.some(gdIsIndeedMultiSelectYesNoInput)) {
                    result.__gdIndeedMultiSelectYesNo = true;
                }
                if (!noSetText) {
                    debugLog('glassdoor yes/no field', (result.label || '').slice(0, 70), result.type,
                        result.options.join('|'),
                        result.element.map(e => `${e.tagName}:${e.type || e.getAttribute?.('role')}:${gdGetRadioOptionLabel(e).slice(0, 30)}`).join('; '));
                }
            } else if (!noSetText && result.options.some(Boolean)) {
                debugLog('glassdoor radio field', (result.label || '').slice(0, 70), result.type,
                    result.options.map(o => o.slice(0, 50)).join(' | '));
            }
        } else if (yesNoRoot.querySelector('input[type=checkbox]')) {
            result.type = 'checkbox';
            result.element = [...yesNoRoot.querySelectorAll('input[type=checkbox]')];
            result.options = result.element.map(input => gdGetRadioOptionLabel(input));
            if (isGdExclusiveYesNoOptions(result.options)) {
                result.__gdExclusiveYesNo = true;
                if (result.element.some(gdIsIndeedMultiSelectYesNoInput)) {
                    result.__gdIndeedMultiSelectYesNo = true;
                }
                if (!noSetText) {
                    debugLog('glassdoor yes/no field', (result.label || '').slice(0, 70), result.type,
                        result.options.join('|'),
                        result.element.map(e => `${e.tagName}:${e.type || e.getAttribute?.('role')}:${gdGetRadioOptionLabel(e).slice(0, 30)}`).join('; '));
                }
            } else if (!noSetText && result.options.some(Boolean)) {
                debugLog('glassdoor radio field', (result.label || '').slice(0, 70), result.type,
                    result.options.map(o => o.slice(0, 50)).join(' | '));
            }
        } else if (item.querySelector('[role="radiogroup"] [role="radio"], [role="radiogroup"] [role="checkbox"]')) {
            const group = item.querySelector('[role="radiogroup"]');
            const roleEls = [...group.querySelectorAll('[role="radio"], [role="checkbox"]')]
                .filter(el => gdIsVisibleElement(el) || el.offsetParent);
            if (roleEls.length >= 2) {
                result.type = roleEls[0].getAttribute('role') === 'radio' ? 'radio' : 'checkbox';
                result.element = roleEls;
                result.options = roleEls.map(gdGetRadioOptionLabel);
                if (isGdExclusiveYesNoOptions(result.options)) {
                    result.__gdExclusiveYesNo = true;
                }
            }
        } else if (item.querySelector('select')) {
            result.type = 'select';
            result.element = item.querySelector('select')
            result.options = [ ...item.querySelectorAll('option') ].map(option => option.innerText.trim());
        } else if (isGdIndeedLocationComboboxItem(item)) {
            const input = item.querySelector('input[role="combobox"], [data-testid*="locality-input"]');
            result.type = 'select';
            result.__gdIndeedLocationCombobox = true;
            result.__gdComboboxContainer = item;
            result.element = input;
            result.label = cleanGdFieldLabel(result.label);
            if (!noSetText) {
                debugLog('glassdoor location combobox detected', result.label);
            }
            result.options = [];
        } else if (isGdMultiSelectCheckboxDropdownItem(item)) {
            result.label = cleanGdFieldLabel(result.label);
            result.__gdComboboxContainer = item;
            result.type = 'checkbox';
            result.__gdMultiSelectCheckboxDropdown = true;
            if (!noSetText) {
                let opened = await gdOpenMultiSelectDropdown(item, { closeFirst: true });
                for (let retry = 0; !opened.entries.length && retry < 4; retry++) {
                    await gdCloseMultiSelectDropdown();
                    await waitImmediate(400);
                    opened = await gdOpenMultiSelectDropdown(item, { closeFirst: true });
                }
                dumpGdMultiSelectDropdownDom(item, result.label, opened.popupRoot, opened.entries);
                result.__gdListboxId = opened.popupRoot?.id || gdGetMultiSelectDropdownListboxId(item);
                result.element = opened.entries.map(e => e.checkbox);
                result.options = opened.entries.map(e => e.text);
                result.__gdMultiSelectOptionIds = opened.entries.map(e => e.value);
                debugLog('glassdoor multiselect checkbox dropdown detected', result.label, result.options.length);
                await gdCloseMultiSelectDropdown();
            } else {
                result.element = [];
                result.options = [];
            }
        } else if (isGdSearchComboboxItem(item)) {
            const parts = findGdSearchComboboxParts(item);
            result.label = cleanGdFieldLabel(result.label);
            result.__gdComboboxContainer = item;
            result.type = 'select';
            result.__gdSearchCombobox = true;
            result.element = parts.trigger;
            if (!noSetText) {
                let opened = await gdOpenIndeedSelectListDropdown(item, { closeFirst: true });
                for (let retry = 0; !opened.entries.length && retry < 4; retry++) {
                    await gdCloseMultiSelectDropdown();
                    await waitImmediate(400);
                    opened = await gdOpenIndeedSelectListDropdown(item, { closeFirst: true });
                }
                debugLog('glassdoor select-list dropdown detected', result.label, opened.entries.length,
                    opened.entries.map(e => e.text.slice(0, 40)).join(' | '));
                if (opened.popupRoot) {
                    debugLog('glassdoor select-list DOM popup', opened.popupRoot.id,
                        opened.popupRoot.getAttribute?.('role'), opened.popupRoot.outerHTML?.slice(0, 2000));
                }
                result.options = opened.entries.map(e => e.text);
                result.__gdSelectListOptionIds = opened.entries.map(e => e.value);
                await gdCloseMultiSelectDropdown();
            } else {
                result.options = [];
            }
        } else if (isGdIndeedTypeaheadComboboxItem(item)) {
            const input = item.querySelector('input[role="combobox"]');
            result.type = 'select';
            result.__gdIndeedTypeaheadCombobox = true;
            result.__gdComboboxContainer = item;
            result.element = input;
            result.label = cleanGdFieldLabel(result.label);
            if (!noSetText) {
                debugLog('glassdoor typeahead combobox detected', result.label);
            }
            result.options = [];
        } else if (item.querySelector('input[type=file]') || isGdResumeUploadLabel(result.label)) {
            const fileInput = findGdFileInputInItem(item) || document.querySelector('input[type=file]');
            result.type = 'file';
            result.__gdFileUpload = true;
            result.__gdComboboxContainer = item;
            result.element = fileInput;
            result.label = cleanGdFieldLabel(result.label);
            if (!noSetText) {
                debugLog('glassdoor resume upload field detected', result.label, !!fileInput);
            }
        } else {
            result.element = item.querySelector('input, textarea');
            result.type = result.element?.type;
            if (result.element?.placeholder) {
                result.label += ' ' + result.element.placeholder;
            }
            // if (result.element?.parentElement?.querySelector('button[aria-haspopup], button[aria-controls*="date"]')) {
            //     result.label += ' (use date format MM/DD/YYYY)';
            // }
            try {
                if (result.element.getAttribute('aria-describedby')?.includes('number')) {
                    result.type = 'number';
                    result.label += ' (input digits only)';
                }
            } catch {}
        }

        if (!noSetText) {
            if (
                result.type === 'radio' &&
                Array.isArray(result.options) &&
                result.options.includes('Upload a file') &&
                result.options.includes('Enter text') &&
                result.options.length === 2
            ) {
                const value = isGdResumeUploadLabel(result.label) ? 'Upload a file' : 'Enter text';
                console.log('auto select radio option', value, result.label);

                result.element.forEach((el) => {
                    if ((el.id && el.parentElement?.innerText.trim() || el.value) === value) {
                        el.click();
                    }
                });

                await waitImmediate(1500);
                return grabFields(true);
            }
        }

        
        if (
            result.type === 'checkbox' &&
            Array.isArray(result.options) &&
            result.options.includes('Yes, I agree to sign electronically.') &&
            result.options.length === 1
        ) {
            if (!noSetText) {
                console.log('auto select "Yes, I agree to sign electronically." option');
                const value = 'Yes, I agree to sign electronically.';
                for (const el of result.element) {
                    const matchVal = (el.id && el.parentElement?.innerText.trim()) || el.value;
                    if (matchVal === value) {
                        await gdSetCheckboxChecked(el, true);
                    }
                }

                await waitImmediate(1500);
                return grabFields(true);
            } else {
                continue;
            }
        }
        
        
        if ((result.element || result.__gdFileUpload) && result.type && result.element?.name != 'phoneNumberCountry') {
            result.label += extraLabel
            results.push(result);
        }

    }

    if (document.querySelector('[data-testid="cover-letter-radio-card-text-area"]')) {
        results.push({
            element: document.querySelector('[data-testid="cover-letter-radio-card-text-area"]'),
            type: 'textarea',
            label: 'Cover Letter',
            required: true
        });
    }

    return results;
}

async function fillFields(fields, profile, applyData) {
    let fieldNum = 0;
    let field;
    while (fieldNum < fields.length) {
            field = fields[fieldNum];

            try {
                scrollToTargetAdjusted(field.element, 100);
            } catch {}

            try {
                if (field.__gdFileUpload && applyData) {
                    await fillGdResumeUploadField(field, applyData);
                    fieldNum += 1;
                    await waitImmediate(500);
                    continue;
                }

                if (profile && isGdLocalEeoField(field.label)) {
                    const filled = await fillGdLocalEeoField(field, profile);
                    if (filled) {
                        fieldNum += 1;
                        await waitImmediate(500);
                        continue;
                    }
                }

                if (isGdLocalAttestationCheckboxField(field.label, field)) {
                    await fillGdLocalAttestationCheckbox(field);
                    fieldNum += 1;
                    await waitImmediate(500);
                    continue;
                }

                let {value, completed} = await getFieldValueByFieldName(field.label);

                if (completed) {
                    fieldNum += 1;
                    field.value = value;
                } else {
                    if (field.type != 'textarea') {
                        continue;
                    }
                }

                console.log(field, field.label, value)

                if (!value && value !== 0) {
                    if (field.required && Array.isArray(field.element) && field.element[0]) {
                        await gdSetCheckboxChecked(field.element[0], true);
                    }
                    console.log('skip')
                    continue;
                }

                if (Array.isArray(field.element)) {
                    if (agentStatus.resumed) {
                        field.element.forEach((el) => {
                            if (el.checked) {
                                throw new Error('filled by user')
                            }
                        });
                    }
                    if (field.type === 'radio' || isGdExclusiveYesNoField(field)) {
                        continue;
                    }
                    if (field.__gdMultiSelectCheckboxDropdown) {
                        await fillGdMultiSelectCheckboxDropdown(field, value);
                        continue;
                    }
                    if (isGdExclusiveYesNoField(field)) {
                        continue;
                    }
                    if (!Array.isArray(value)) {
                        value = [value]
                    }
                    for (let ne = 0; ne < field.element.length; ne++) {
                        const el = field.element[ne];
                        const optionText = field.options?.[ne];
                        const matchVal = optionText || gdGetYesNoOptionLabel(el) || el.value;
                        const shouldCheck = value.some(v =>
                            gdNormalizeYesNoOption(v) === gdNormalizeYesNoOption(matchVal)
                            || String(v).trim().toLowerCase() === String(matchVal).trim().toLowerCase()
                        );
                        if (shouldCheck) {
                            await gdSetCheckboxChecked(el, true);
                        }
                    }
                } else if (field.type === 'select') {
                    if (Array.isArray(value)) {
                        value = value[0];
                    }
                    if (agentStatus.resumed && field.element.value) {
                        console.log('filled by user')
                        continue;
                    }

                    if (field.__gdIndeedLocationCombobox) {
                        await fillGdIndeedLocationCombobox(field, value);
                        continue;
                    }

                    if (field.__gdIndeedTypeaheadCombobox) {
                        await fillGdIndeedTypeaheadCombobox(field, value);
                        continue;
                    }

                    if (field.__gdSearchCombobox) {
                        await fillGdSearchCombobox(field, value);
                        continue;
                    }

                    [...field.element.querySelectorAll('option')].forEach((el) => {
                        if (el.innerText.trim() === value) {
                            el.selected = true;
                        }
                    });
                    await waitImmediate(500);
                    
                    // Trigger change with focus for background tab compatibility
                    field.element.focus();
                    field.element.dispatchEvent(new Event('change', {bubbles: true, cancelable: true, composed: true}));
                    field.element.dispatchEvent(new Event('input', {bubbles: true, cancelable: true, composed: true}));

                } else {
                    if (Array.isArray(value)) {
                        value = value[0];
                    }

                    // Detect date format in label and convert value if needed
                    let skipDateField = false;
                    try {
                        const dateFormatMatch = field.label.match(/(MM\/DD\/YYYY|DD\/MM\/YYYY|YYYY\/MM\/DD)/);
                        if (dateFormatMatch && value) {
                            const targetFormat = dateFormatMatch[1];
                            let year, month, day;
                            const isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
                            const slashMatch = String(value).match(/^(\d{2,4})\/(\d{2})\/(\d{2,4})$/);
                            if (isoMatch) {
                                year = isoMatch[1]; month = isoMatch[2]; day = isoMatch[3];
                            } else if (slashMatch) {
                                if (slashMatch[1].length === 4) {
                                    year = slashMatch[1]; month = slashMatch[2]; day = slashMatch[3];
                                } else if (slashMatch[3].length === 4) {
                                    if (targetFormat === 'DD/MM/YYYY') {
                                        day = slashMatch[1]; month = slashMatch[2]; year = slashMatch[3];
                                    } else {
                                        month = slashMatch[1]; day = slashMatch[2]; year = slashMatch[3];
                                    }
                                }
                            }
                            if (year && month && day) {
                                if (targetFormat === 'MM/DD/YYYY') {
                                    value = `${month}/${day}/${year}`;
                                } else if (targetFormat === 'DD/MM/YYYY') {
                                    value = `${day}/${month}/${year}`;
                                } else if (targetFormat === 'YYYY/MM/DD') {
                                    value = `${year}/${month}/${day}`;
                                }
                                console.log('Date field converted:', field.label, 'value:', value);
                            } else {
                                // Value is not a valid date (e.g. N/A) - skip this date field
                                console.log('Date field skipped - invalid date value:', field.label, 'value:', value, 'required:', field.required);
                                skipDateField = true;
                            }
                        }
                    } catch (e) {
                        console.warn('Date field parsing error:', field.label, 'value:', value, e);
                        if (field.label.match(/(MM\/DD\/YYYY|DD\/MM\/YYYY|YYYY\/MM\/DD)/)) {
                            skipDateField = true;
                        }
                    }
                    if (skipDateField) {
                        continue;
                    }
                    if (agentStatus.resumed && field.element.value) {
                        console.log('filled by user')
                        continue;
                    }
                    
                    setNativeValueGlassdoor(field.element, value);
                    
                    if (field.type == 'textarea') {
                        await waitImmediate(100);
                        textareaGrow();
                    }
                }

            } catch (e) {
                console.error(e);
                sendErrorToServerFromPage(e);
            }

            await waitImmediate(500);

    }

    try {
        await refillFields(fields, profile);
    } catch (e) {
        console.error(e);
        sendErrorToServerFromPage(e);
    }

}

async function refillFields(fields, profile) {
    let fieldNum = 0;
    let field;
    while (fieldNum < fields.length) {
            field = fields[fieldNum];
            fieldNum += 1;

            try {
                if (field.__gdIndeedLocationCombobox) {
                    if (field.value) {
                        await fillGdIndeedLocationCombobox(field, field.value);
                    }
                    continue;
                }

                if (field.__gdIndeedTypeaheadCombobox) {
                    if (field.value) {
                        await fillGdIndeedTypeaheadCombobox(field, field.value);
                    }
                    continue;
                }

                if (field.__gdMultiSelectCheckboxDropdown) {
                    if (field.value) {
                        await fillGdMultiSelectCheckboxDropdown(field, field.value);
                    }
                    continue;
                }

                if (field.__gdSearchCombobox) {
                    if (field.value) {
                        await fillGdSearchCombobox(field, field.value);
                    }
                    continue;
                }

                if (field.type === 'checkbox' && isGdLocalAttestationCheckboxField(field.label, field)) {
                    await fillGdLocalAttestationCheckbox(field);
                    continue;
                }

                if (field.type != 'text' && field.type != 'textarea') {
                    continue;
                }

                if (profile && isGdLocalEeoField(field.label)) {
                    if (!field.element.value || gdFieldHasVisibleError(field.element)) {
                        await fillGdLocalEeoField(field, profile, !!field.element.value);
                    }
                    continue;
                }

                if (field.element.value) {
                    continue;
                }

                let value = field.value;

                if (!value && value !== 0) {
                    continue;
                }

                // Skip date fields with invalid date values (e.g. N/A)
                if (field.label.match(/(MM\/DD\/YYYY|DD\/MM\/YYYY|YYYY\/MM\/DD)/) &&
                    !String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/) &&
                    !String(value).match(/^(\d{2,4})\/(\d{2})\/(\d{2,4})$/)) {
                    console.log('refillFields: skipping date field with invalid value:', field.label, value);
                    continue;
                }

                try {
                    scrollToTargetAdjusted(field.element, 100);
                } catch {}


                console.log(field, field.label, value)

                if (Array.isArray(value)) {
                    value = value[0];
                }

                setNativeValueGlassdoor(field.element, value);

                await waitImmediate(500);
            } catch (e) {
                console.error(e);
                sendErrorToServerFromPage(e);
            }

            

    }

}

function isGdReviewStep() {
    return location.pathname.endsWith('/review') || location.pathname.endsWith('/review-module');
}

function isGdAlreadyAppliedPage() {
    try {
        if (document.querySelector('main.ia-HasApplied, .ia-HasApplied')) return true;
        if (document.querySelector('.ia-HasApplied-bodyTop')) return true;
        if (document.querySelector('h1.ia-HasApplied-bodyTop--text')) return true;
    } catch (e) {
        debugLog('glassdoor already applied check error', String(e));
    }
    return false;
}

function abortIfGdAlreadyApplied() {
    if (!isGdAlreadyAppliedPage()) return false;
    if (window.__gdAlreadyAppliedAborted) return true;
    window.__gdAlreadyAppliedAborted = true;
    debugLog('glassdoor already applied detected');
    chrome.runtime.sendMessage({ type: 'SEND-CV-TASK-ERROR', data: 'Already applied' }).catch(console.error);
    return true;
}

async function clickGdPostApplyContinueIfPresent() {
    try {
        const continueBtn = document.getElementById('gdPostApplyContinue');
        if (continueBtn && continueBtn.offsetParent !== null) {
            debugLog('glassdoor post-apply SPA: clicking gdPostApplyContinue');
            continueBtn.scrollIntoView({ behavior: 'instant', block: 'nearest' });
            await gdClickGlassdoorElement(continueBtn);
            await wait(2000);
            return true;
        }
    } catch (e) {
        debugLog('glassdoor post-apply SPA click error', String(e));
    }
    return false;
}

async function waitAndClickGdPostApplyContinue(maxWaitMs = 60000) {
    const steps = Math.ceil(maxWaitMs / 1000);
    for (let i = 0; i < steps; i++) {
        if (await clickGdPostApplyContinueIfPresent()) {
            return true;
        }
        if (document.querySelector('[data-testid="finishAppHeader"]')) {
            debugLog('glassdoor post-apply SPA: finishAppHeader visible, waiting for gdPostApplyContinue');
            for (let j = 0; j < 10; j++) {
                await wait(500);
                if (await clickGdPostApplyContinueIfPresent()) {
                    return true;
                }
            }
        }
        await wait(1000);
    }
    return false;
}

function getGdPageContentRoot() {
    return document.querySelector('[data-testid="application-review"]')
        || document.querySelector('#indeedApplyForm')
        || document.querySelector('main form')
        || document.querySelector('main')
        || document.body;
}

function getGdPageSnapshotText(maxLen = 20000) {
    const root = getGdPageContentRoot();
    let text = (root?.innerText || '').replace(/\r/g, '');
    if (!text) {
        text = (document.body?.innerText || '').replace(/\r/g, '').slice(0, maxLen || 20000);
    }
    if (maxLen > 0 && text.length > maxLen) return text.slice(0, maxLen);
    return text;
}

function collectGdFilledFieldsSummary() {
    const parts = [];
    try {
        for (const inp of document.querySelectorAll('input:not([type=hidden]), textarea, select')) {
            if (!inp.offsetParent) continue;
            let val = '';
            if (inp.tagName === 'SELECT') {
                val = inp.options[inp.selectedIndex]?.text || inp.value || '';
            } else if (inp.type === 'checkbox' || inp.type === 'radio') {
                if (!inp.checked) continue;
                val = inp.parentElement?.innerText?.trim() || inp.value || 'checked';
            } else {
                val = inp.value || '';
            }
            if (!String(val).trim()) continue;
            const labelEl = inp.closest('label, .ia-Questions-item, [data-testid]');
            const label = (labelEl?.querySelector('label, legend, span[data-testid]')?.innerText
                || inp.getAttribute('aria-label')
                || inp.name
                || inp.id
                || '').trim();
            parts.push(`${label.slice(0, 60)}=${String(val).trim().slice(0, 80)}`);
        }
        for (const el of document.querySelectorAll('[data-testid="fullName"], [data-testid="phoneNumber"], [data-testid="email"]')) {
            if (!el.offsetParent) continue;
            const t = (el.innerText || '').trim();
            if (t) parts.push(`${el.getAttribute('data-testid')}=${t.slice(0, 80)}`);
        }
    } catch (e) {
        debugLog('glassdoor filled fields summary error', String(e));
    }
    return parts.join(' | ');
}

function isGdReviewPageContentReady() {
    if (!isGdReviewStep()) return false;
    const text = getGdPageSnapshotText(12000);
    if (!text || text.length < 100) return false;
    return /review|submit|application|contact|resume|experience|education|full name|phone|email/i.test(text);
}

function dumpGdPageText(stepKey = 'review', { requireReview = false } = {}) {
    const sectionText = getGdPageSnapshotText(0);
    const filledSummary = collectGdFilledFieldsSummary();
    debugLog('glassdoor review dump start', stepKey, 'chars=', sectionText.length);
    if (filledSummary) {
        debugLog('glassdoor filled fields', stepKey, filledSummary.slice(0, 4000));
    }
    if (requireReview && (!sectionText || sectionText.length < 100)) {
        debugLog('glassdoor review QA ERROR', stepKey, 'review section text missing or too short');
    }
    for (let i = 0; i < sectionText.length; i += 4000) {
        debugLog('glassdoor review dump', stepKey, sectionText.slice(i, i + 4000));
    }
    debugLog('glassdoor review dump end', stepKey);
    return sectionText;
}

function analyzeGdReviewPageText(text, profile, stepKey = 'review') {
    const issues = [];
    const reviewText = text || getGdPageSnapshotText(25000);
    const t = reviewText.toLowerCase();

    if (isGdReviewStep()) {
        if (!reviewText || reviewText.length < 100) {
            issues.push('review section text missing');
            debugLog('glassdoor review QA ERROR', stepKey, issues);
            return issues;
        }
        if (!isGdReviewPageContentReady()) {
            issues.push('review page still loading or empty');
        }
    }

    const fn = (profile?.firstName || profile?.general?.firstName || '').toLowerCase();
    const ln = (profile?.lastName || profile?.general?.lastName || '').toLowerCase();
    const email = (profile?.email || profile?.general?.email || '').toLowerCase();
    if (fn && !t.includes(fn)) issues.push('missing first name');
    if (ln && !t.includes(ln)) issues.push('missing last name');
    if (email && !t.includes(email.split('@')[0])) issues.push('missing email');

    for (const exp of (profile?.experiences || []).slice(0, 3)) {
        const title = (exp.title || '').toLowerCase();
        if (title && title.length > 4 && !t.includes(title.slice(0, Math.min(20, title.length)))) {
            issues.push(`missing experience: ${exp.title}`);
        }
    }

    const eduSectionOptional = /education[\s\S]{0,80}(no response|not provided|optional)/i.test(reviewText || '');
    for (const edu of (profile?.educations || []).slice(0, 1)) {
        if (eduSectionOptional) break;
        const school = (edu.school || '').toLowerCase();
        if (school && school.length > 4 && !t.includes(school.slice(0, Math.min(20, school.length)))) {
            issues.push(`missing education: ${edu.school}`);
        }
    }

    if (/required field|please enter|select one|invalid|error:|this field is required/i.test(reviewText || '')) {
        issues.push('unfilled or error fields on review');
    }

    debugLog('glassdoor review QA', issues.length ? 'ISSUES' : 'ok', issues.slice(0, 10));
    return issues;
}

async function runGdSubmitQa(profile, stepKey) {
    if (isGdReviewStep()) {
        const text = dumpGdPageText(stepKey, { requireReview: true });
        analyzeGdReviewPageText(text, profile, stepKey);
        return text;
    }
    dumpGdPageText(stepKey, { requireReview: false });
    analyzeGdReviewPageText(getGdPageSnapshotText(25000), profile, stepKey);
    return getGdPageSnapshotText(25000);
}

async function uploadCv(cv) {
    if (cv.resumePerJob || document.querySelector('[data-testid="FileResumeCardHeader-title"]')?.innerText != cv?.originalFilename) {
        if (document.querySelector('[data-testid="ResumeOptionsMenu-btn"]')) {
            document.querySelector('[data-testid="ResumeOptionsMenu-btn"]')?.click();
        }
        await wait(1000);
        await pause();
        appendStatusMessage('Uploading your CV. Please hang on...');
        await uploadFile(cv.url, cv.originalFilename, document.querySelector('input[type=file]'));
        await wait(5000);
    }
    await pause();
    const currentUrl = location.href;
    for  (let nt = 0; location.href == currentUrl && nt < 30; nt ++) {
        await pause();
        document.querySelector('[data-testid="FileResumeCardHeader-title"]')?.click();
        await wait(500);

        let button = Array.from(document.querySelectorAll('.ia-continueButton, [data-testid="continue-button"]')).find(btn => btn.offsetParent !== null);
        if (!button) {
            button = Array.from(document.querySelectorAll('button'))
            .find(btn => (
                btn.textContent.trim() === 'Continue' || 
                btn.textContent.trim() === 'Doorgaan' || 
                btn.textContent.trim() === 'Continuer' || 
                btn.textContent.trim() === 'Continuar' || 
                btn.textContent.trim() === 'Weiter' || 
                btn.textContent.trim() === 'Continua' || 
                btn.textContent.trim().toLowerCase().includes('your application') ||
                btn.textContent.trim().toLowerCase().includes('sollicitatie') ||
                btn.textContent.trim().toLowerCase().includes('candidature') ||
                btn.textContent.trim().toLowerCase().includes('postulación') ||
                btn.textContent.trim().toLowerCase().includes('bewerbung') ||
                btn.textContent.trim().toLowerCase().includes('solicitud') ||
                btn.textContent.trim().toLowerCase().includes('candidatura')
            ) && btn.offsetParent !== null);
        }
        button?.click();

        await wait(500);
    }
    if (location.href == currentUrl) {
        throw new SendCvError(`uploadCv: url not changed: ${currentUrl}`);
    }
}

async function apply(data) {

    const {devMode, profile} = data;

    if (abortIfGdAlreadyApplied()) return;

    await wait(2000);
    await pause();

    if (abortIfGdAlreadyApplied()) return;

    if (document.querySelector('[data-testid="resume-selection-form"]')) {
        await uploadCv(await getResume(data));
        return await apply(data);
    }

    const countryChangeButton = document.getElementById('location-fields-country-change-button')
    if (countryChangeButton) {
        const countryCurrent = document.querySelector('[data-testid="location-fields-country"] div:nth-child(2) span');
        if (!countryCurrent || !countryCurrent.innerText || (profile.residency && profile.residency.country && !countryCurrent.innerText.includes(profile.residency.country))) {
            countryChangeButton.click();
            await wait(1000);
            await pause();
        }
    }
    

    const fields = await grabFields();
    debugLog('glassdoor collected labels', fields.map(f => f.label).join(' | '));

    if (fields && fields.length) {
        if (fields.length == 1 && (fields[0]?.type == "checkbox" || fields[0]?.type == "radio" ) && Array.isArray(fields[0].element) && fields[0].element.length == 1 && fields[0].element[0]) {
            await gdSetCheckboxChecked(fields[0].element[0], true);
        } else {

            await wait(1000);
            await pause();

            await fillGdEeoSignatureFieldsFromDom(profile);
            await fillGdLocalEeoFields(fields, profile);
            await fillGdLocalAttestationCheckboxes(fields);
            for (const f of fields.filter(x => x.__gdFileUpload)) {
                await fillGdResumeUploadField(f, data);
            }
            const llmFields = fields.filter(f => !isGdLocalOnlyField(f));
            const localCount = fields.length - llmFields.length;
            debugLog('glassdoor fields total', fields.length, 'llm', llmFields.length, 'local', localCount, 'file', fields.filter(f => f.__gdFileUpload).length);
            if (llmFields.length) {
                streamVacancyFields(llmFields);
                await wait(2000);
            }

            await fillFields(fields, profile, data);

            try {

                if (fields.length == 1) {
                    const fields2 = await grabFields();

                    const fields1Labels = fields.map(f => f.label);
                    const fields2Filtered = fields2.filter(f => !fields1Labels.includes(f.label));
                    if (fields2Filtered.length > 0) {
                        await wait(1000);
                        await pause();

                        await fillGdLocalEeoFields(fields2Filtered, profile);
                        await fillGdLocalAttestationCheckboxes(fields2Filtered);
                        const llmFields2 = fields2Filtered.filter(f => !isGdLocalOnlyField(f));
                        if (llmFields2.length) {
                            streamVacancyFields(llmFields2);
                            await wait(2000);
                        }

                        await fillFields(fields2Filtered, profile, data);
                    }
                }
            } catch (e) {
                console.error(e);
                sendErrorToServerFromPage(e);
            }
        }
    }

    if (location.pathname.includes('/contact-info')) {
        await waitImmediate(1000);
        const inputPhoneNumber = document.getElementById('input-phoneNumber');
        const selectCountryCode = document.querySelector('select[name="phoneNumberCountry"]');
        if (inputPhoneNumber && selectCountryCode) {
            if (profile.phoneCountryCode) {
                [...selectCountryCode.querySelectorAll('option')].forEach((el) => {
                    if (el.innerText?.trim().includes(`(${profile.phoneCountryCode})`)) {
                        el.selected = true;
                    }
                });
                await waitImmediate(500);
                selectCountryCode.focus();
                selectCountryCode.dispatchEvent(new Event('change', {bubbles: true, cancelable: true, composed: true}));
                await waitImmediate(500);
            }
            if (profile.phone) {
                setNativeValueGlassdoor(inputPhoneNumber, profile.phone);
            }
        } else {
            await fillGdContactInfoPhone(profile);
        }
    }

    await wait(1500);
    await pause();

    if (location.pathname.includes('/questions-module/')) {
        await fillGdEeoSignatureFieldsFromDom(profile);
    }

    if (location.pathname.endsWith('/review') || location.pathname.endsWith('/review-module')) {
        await wait(5000);
        await runGdSubmitQa(profile, 'review');
    }

    let button;
    for (let attempt = 0; attempt < 60 && !button; attempt++) {
        button = Array.from(document.querySelectorAll('.ia-continueButton, [data-testid="continue-button"], [data-testid="submit-application-button"]')).find(btn => btn.offsetParent !== null);
        if (!button) {
            button = Array.from(document.querySelectorAll('button'))
            .find(btn => (
                btn.textContent.trim() === 'Update' || 
                btn.textContent.trim() === 'Actualizar' || 
                btn.textContent.trim() === 'Bijwerken' || 
                btn.textContent.trim() === 'Atualizar' || 
                btn.textContent.trim() === 'Aktualisieren' || 
                btn.textContent.trim() === 'Modifier' || 
                btn.textContent.trim() === 'Aggiorna' || 
                btn.textContent.trim() === 'Aggiorna' || 

                btn.textContent.trim() === 'Continue' || 
                btn.textContent.trim() === 'Doorgaan' || 
                btn.textContent.trim() === 'Continuer' || 
                btn.textContent.trim() === 'Continuar' || 
                btn.textContent.trim() === 'Weiter' || 
                btn.textContent.trim() === 'Continua' || 
                btn.textContent.trim().toLowerCase().includes('your application') ||
                btn.textContent.trim().toLowerCase().includes('sollicitatie') ||
                btn.textContent.trim().toLowerCase().includes('candidature') ||
                btn.textContent.trim().toLowerCase().includes('postulación') ||
                btn.textContent.trim().toLowerCase().includes('bewerbung') ||
                btn.textContent.trim().toLowerCase().includes('solicitud') ||
                btn.textContent.trim().toLowerCase().includes('candidatura')
            ) && btn.offsetParent !== null);
        }
        
        await wait(1000);
    }

    button?.scrollIntoView();
    await wait(1500);

    await fillGdDeferredYesNoFields(fields);

    if (!location.pathname.endsWith('/review') && !location.pathname.endsWith('/review-module')) {
        const currentUrl = location.href;
        button?.click();
        for  (let nt = 0; location.href == currentUrl && nt < 30; nt ++) {
            await pause();
            await wait(500);
        }
        if (location.href == currentUrl) {
            console.log('retry filling fields');
            debugLog('glassdoor retry filling fields', location.pathname);
            gdLogVisibleFieldErrors();
            const freshFields = await grabFields(true);
            for (const f of freshFields) {
                const prev = fields.find(p => p.label === f.label);
                if (prev?.value !== undefined && prev?.value !== null) {
                    f.value = prev.value;
                }
                if (prev?.__gdYesNoCommitted) {
                    f.__gdYesNoCommitted = prev.__gdYesNoCommitted;
                    if (!gdIsYesNoFieldFilled(f, f.value ?? prev.value)) {
                        f.__gdYesNoCommitted = false;
                    }
                }
                if (!f.value && f.value !== 0) {
                    try {
                        const { value } = await getFieldValueByFieldName(f.label);
                        if (value !== undefined && value !== null && value !== '') {
                            f.value = value;
                        }
                    } catch {}
                }
            }
            await fillGdEeoSignatureFieldsFromDom(profile, true);
            await fillGdLocalEeoFields(freshFields, profile, true);
            await fillGdLocalAttestationCheckboxes(freshFields);
            await fillFields(freshFields, profile, data);
            await fillGdDeferredYesNoFields(freshFields);
            await wait(1500);
            button?.scrollIntoView();
            await wait(1500);
            button?.click();
            for  (let nt = 0; location.href == currentUrl && nt < 30; nt ++) {
                await pause();
                await wait(500);
            }
            if (location.href == currentUrl) {
                if (document.getElementById('loading-indicator-label')) {
                    const prevAgentMode = agentStatus.agentMode;
                    const prevPaused = agentStatus.paused;

                    chrome.runtime.sendMessage({
                        type: "SET-COPILOT-MODE",
                    });

                    agentStatus.agentMode = 'Copilot';
                    agentStatus.setButtons(2);
                    agentStatus.paused = true;

                    appendStatusMessage('Auto-apply is paused because Glassdoor requires this window to stay in the foreground. Please bring the browser to the front — I\'ll continue automatically when loading finishes.');

                    while (document.getElementById('loading-indicator-label')) {
                        await wait(500);
                    }

                    agentStatus.agentMode = prevAgentMode;
                    agentStatus.paused = prevPaused;

                    if (!agentStatus.paused) {
                        agentStatus.setButtons(agentStatus.agentMode == 'Copilot' ? 1 : 0);
                    }

                    chrome.runtime.sendMessage({
                        type: "UNSET-COPILOT-MODE",
                    });

                    return await apply(data);
                }
                throw new SendCvError(`apply: url not changed: ${currentUrl}`);
            }
        }
        return await apply(data);
    }

    try {
        updateContactInfo = false;
        phone = document.querySelector('[data-testid="phoneNumber"]')?.innerText?.replace(/\D/g, "");
        profilePhone = (profile.phoneCountryCode + profile.phone)?.replace(/\D/g, "");
        if (phone && profilePhone && phone != profilePhone) {
            console.log('phone', phone, profilePhone);
            updateContactInfo = true;
        }
        fullName = document.querySelector('[data-testid="fullName"]')?.innerText?.trim()
        profileFullName = profile.firstName?.trim() + ' ' + profile.lastName?.trim()
        if (fullName && profileFullName && fullName != profileFullName) {
            console.log('fullName', fullName, profileFullName);
            updateContactInfo = true;
        }
        if (updateContactInfo && document.querySelector('#additional_links_section_contact-info a')) {
            const currentUrl = location.href;
            document.querySelector('#additional_links_section_contact-info a')?.click();
            for (let nt = 0; location.href == currentUrl && nt < 30; nt ++) {
                await pause();
                await wait(500);
            }
            if (location.href != currentUrl) {
                return await apply(data);
            }
        }
    } catch (e) {
        console.error(e);
        sendErrorToServerFromPage(e);
    }
    

    if (!devMode) {
        await runGdSubmitQa(profile, 'pre-submit');
        await readyToSubmit();
        await fullPageScreenshot();
        button?.click();
    }

    if (await waitAndClickGdPostApplyContinue(20000)) {
        return;
    }

    button?.click();
    if (await waitAndClickGdPostApplyContinue(20000)) {
        return;
    }

    if (document.getElementById('captcha-wrapper')) {
        button?.click();
        await wait(35000);
        if (document.getElementById('captcha-wrapper')) {
            button?.click();
            await wait(15000);
            if (document.getElementById('captcha-wrapper')) {
                await challengeFound();
            }
        }
    }

    if (await waitAndClickGdPostApplyContinue(45000)) {
        return;
    }

    await wait(15000);
    await runGdSubmitQa(profile, 'after-submit');
    throw new SendCvError('submit timeout');
}

window.addEventListener("message", async (event) => {
    if (event.data.type === "INTERCEPTED_URL") {
        const { url } = event.data;
        if (!url || url === "about:blank") {
            return;
        }
        console.log("INTERCEPTED_URL:", url);
        location.assign(url);
    }
});

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

                    if (location.hostname.includes('glassdoor') && location.search.includes('smart-apply-action=POST_APPLY')) {
                        cvTaskDone();
                        return;
                    }

                    if (location.pathname.includes('/post-apply')) {
                        await waitAndClickGdPostApplyContinue(15000);
                        return;
                    }

                    if (abortIfGdAlreadyApplied()) {
                        return;
                    }

                    if (location.hostname.includes('glassdoor')) {
                        try {
                            await waitForClickableButton('button[data-test="easyApply"]');
                        } catch {
                            if (agentStatus.isApplyOne) {
                                appendStatusMessage('Easy apply button not found');
                            }
                            throw new SendCvSkipError('Easy apply button not found');
                        }

                        company = document.querySelector('div[class^=EmployerProfile_employerNameHeading]')?.innerText
                        role = document.querySelector('h1')?.innerText

                        description = '';
                        try {
                            description = document.querySelector('div[class^=JobDetails_jobDescription]')?.innerHTML
                        } catch {}

                        await setHistoryDetails({company, role, description, url: data.url});

                        document.querySelector('button[data-test="easyApply"]').click();
                        await wait(25000);
                        if (!agentStatus.isApplyOne) {
                            throw new SendCvSkipError('Easy apply timeout');
                        } else {
                            return;
                        }
                    }

                    countDown = startCountDownInStatusBlock(60 * 5, () => {
                        chrome.runtime.sendMessage({
                            type: "SEND-CV-TAB-TIMER-ENDED", data: {
                                url: window.location.href
                            }
                        });
                    });

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


                } catch (e) {
                    if (e instanceof SendCvSkipError) {
                        
                        chrome.runtime.sendMessage({type: "SEND-CV-TASK-SKIP", data: e.message});
                    } else {
                        await fillingErrors(e);
                    }
                }
                break;
        }

    });

});
