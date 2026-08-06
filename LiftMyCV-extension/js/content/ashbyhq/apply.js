

let countDown;

function getHeaderHeight() {
    return document.querySelector('.ashby-job-posting-header').clientHeight * 2;
}

async function apply(data) {

    const {devMode, session: {city, country, workplace}} = data;

    const leftPaneData = {};
    const leftPaneBlocks = document.querySelector('.ashby-job-posting-left-pane')?.querySelectorAll('div');

    if (leftPaneBlocks) {
        [... leftPaneBlocks ].forEach(block => {
            leftPaneData[block?.querySelector('h2')?.innerText] = block?.querySelector('p')?.innerText;
        })
    } 

    console.log(leftPaneData)

    //StatusMessage('Check workplace type');

    if (workplace !== 'ANY' && !leftPaneData['Location Type']?.trim().toLowerCase().includes(workplace.toLowerCase().replace('_', '-'))) {
        throw new SendCvSkipError('Wrong workplace type');
    }

    if (country || city) {

        //StatusMessage('Check country and city');

        const {cities, countries} = await parseCountriesAndCities(leftPaneData['Location']?.trim());

        if (country && (!countries.length || !countries.includes(country))) {
            throw new SendCvSkipError('Wrong country');
        }

        if (city && (!cities.length || !cities.includes(city))) {
            throw new SendCvSkipError('Wrong city');
        }

    }

    company = document.querySelector('.ashby-job-posting-header ul img')?.alt || document.querySelector('.ashby-job-posting-header ul')?.textContent
    role = document.querySelector('h1.ashby-job-posting-heading')?.innerText

    description = '';
    try {
        description = document.querySelector('#overview')?.innerHTML.trim();
    } catch {}

    // Parse location
    const location = leftPaneData['Location']?.trim() || null;

    // Parse workplaceType
    let workplaceType = null;
    const locationType = leftPaneData['Location Type']?.trim().toLowerCase();
    if (locationType) {
        if (locationType.includes('remote')) {
            workplaceType = 'REMOTE';
        } else if (locationType.includes('hybrid')) {
            workplaceType = 'HYBRID';
        } else if (locationType.includes('on-site') || locationType.includes('onsite') || locationType.includes('on site')) {
            workplaceType = 'ON_SITE';
        }
    }

    // Parse logoUrl from og:image
    let logoUrl = null;
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.content && ogImage.content.trim()) {
        logoUrl = ogImage.content.trim();
    }

    await setHistoryDetails({company, role, description, location, workplaceType, logoUrl});

    document.querySelector('.ashby-job-posting-right-pane-application-tab')?.click()

    try {
        await waitForClickableButton('.ashby-application-form-submit-button', 2000)
    } catch {
        throw new SendCvSkipError('No submit button');
    }

    //StatusMessage('Check and upload CV');

    if (!data.successfulSubmissions && !data.failedSubmissions) {
        appendStatusMessage('Found relevant job openings. Starting auto-apply with the first one...');
        await wait(3000);
    }

    cv = await getResume(data);

    await pause();
    appendStatusMessage('Uploading your CV. Please hang on...');

    if ((!cv || !cv.url) && document.querySelector("#_systemfield_resume")?.required) {
        throw new SendCvError('CV not found. It required');
    }

    const fileInput = document.querySelector("#_systemfield_resume");

    if (fileInput) {
        const blob = await fetch(cv.url, {method: 'GET'}).then(res => res.blob());

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([blob], cv.originalFilename, {type: blob.type, lastModified: new Date()}));
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', {bubbles: true}));
    }

    //StatusMessage('Grab fields...');

    await pause();

    appendStatusMessage('Collecting fields and application questions...');

    // Helper: check if an element is visible in the DOM
    function isElementVisible(el) {
        if (!el) return false;
        if (el.offsetParent === null) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return true;
    }

    debugLog('[Ashby] Starting field collection');
    debugLog('[Ashby] data.profile keys:', Object.keys(data.profile || {}));
    debugLog('[Ashby] data.profile:', JSON.stringify(data.profile || {}));

    const allLabels = [...document.querySelectorAll('label')];
    debugLog('[Ashby] Total labels found:', allLabels.length);
    allLabels.forEach((lbl, i) => {
        debugLog(`[Ashby] Label[${i}]: for="${lbl.getAttribute('for')}" text="${lbl.innerText.trim().slice(0,80)}" visible=${isElementVisible(lbl)} class="${lbl.className}"`);
    });

    const fields = [];
    // Consent checkboxes that should be auto-checked without sending to backend
    const consentCheckboxes = [];
    // Track processed input IDs to avoid duplicates
    const processedInputIds = new Set();

    for (const label of allLabels) {
        let element = document.getElementById(label.getAttribute('for'))

        if (label.getAttribute('for')?.includes('_systemfield_data_consent_ack')) {
            continue;
        }

        if (!element) {
            element = label.parentElement.querySelectorAll('input')
            if (element.length == 1) {
                element = element[0]
            } else {
                continue;
            }
        }

        // Skip hidden labels (prevents duplicates from hidden/visible copies)
        if (!isElementVisible(label)) {
            debugLog(`[Ashby] Skipping hidden label: for="${label.getAttribute('for')}" text="${label.innerText.trim().slice(0,80)}"`);
            continue;
        }

        // Skip duplicate inputs (same input processed via multiple labels)
        const elementId = element.id || null;
        if (elementId && processedInputIds.has(elementId)) {
            debugLog(`[Ashby] Skipping duplicate input id="${elementId}"`);
            continue;
        }
        if (elementId) {
            processedInputIds.add(elementId);
        }

        let required = element.required;

        let labelText = label.innerText.trim()

        if (element.id == '_systemfield_resume') {
            continue;
        }

        if (labelText.toLowerCase().includes('phone')) {
            labelText += ' (with country code)'
        }

        debugLog(`[Ashby] Processing label: text="${labelText.slice(0,80)}" element=${element.tagName} type=${element.type || ''} id="${element.id}" required=${required} visible=${isElementVisible(element)}`);

        if (element.tagName == 'INPUT') {
            if (element.type == 'file') {
                if (required) {
                    throw new SendCvSkipError('Files required: '+labelText)
                }
                continue;
            }

            if (element.type == 'radio' || element.type == 'checkbox') {
                const fieldset = element.closest('fieldset')
                debugLog(`[Ashby] checkbox/radio: labelText="${labelText.slice(0,80)}" hasFieldset=${!!fieldset}`);
                if (!fieldset) {
                    required = label.className?.includes('required')
                    const ret = {
                        element: element,
                        type: element.type,
                        label: labelText,
                        required
                    }
                    const parentButtons = element.parentElement.querySelectorAll('button');
                    debugLog(`[Ashby] checkbox no-fieldset: parentButtons.length=${parentButtons.length} labelText="${labelText.slice(0,80)}"`);
                    if (element.type == 'checkbox' && parentButtons?.length == 2) {
                        ret.options = [...parentButtons].map(button => button.innerText)
                    }
                    // If checkbox has empty label and no yes/no buttons, treat as consent → auto-check
                    if (element.type == 'checkbox' && !labelText) {
                        debugLog(`[Ashby] Auto-consent checkbox (no-fieldset, empty label): id="${element.id}" required=${element.required}`);
                        debugLog(`[Ashby] Consent checkbox parent HTML: ${element.parentElement?.outerHTML?.slice(0, 500)}`);
                        consentCheckboxes.push(element);
                        continue;
                    }
                    fields.push(ret);
                    continue;
                }
                const legend = fieldset.querySelector('label')
                if (!legend) {
                    console.warn('radio without legend')
                    continue;
                }

                const options = [...fieldset.querySelectorAll('label:not(.ashby-application-form-question-title)')].map(option => option.innerText.trim())
                const elements = [...fieldset.querySelectorAll('label:not(.ashby-application-form-question-title)')].map(option => document.getElementById(option.getAttribute('for')))

                debugLog(`[Ashby] fieldset radio/checkbox: legend="${legend.innerText.trim().slice(0,80)}" options=${JSON.stringify(options.map(o=>o.slice(0,50)))} elements[0]==element: ${elements[0] == element}`);

                if (!elements || elements[0] != element) {
                    continue;
                }

                labelText = legend.innerText.trim()
                required = legend.className?.includes('required')

                // If legend label is empty (no question title), try to derive label from context
                if (!labelText) {
                    debugLog(`[Ashby] Fieldset legend is empty. options=${JSON.stringify(options.map(o=>o.slice(0,80)))}`);
                    debugLog(`[Ashby] Fieldset outerHTML: ${fieldset.outerHTML?.slice(0,800)}`);
                    // For single-option (consent) checkboxes with empty title: auto-check
                    if (elements[0].type == 'checkbox' && options.length === 1) {
                        debugLog(`[Ashby] Auto-consent checkbox (fieldset, empty legend, single option): id="${elements[0].id}"`);
                        consentCheckboxes.push(elements[0]);
                        // Register all element IDs so we skip their duplicate labels
                        elements.forEach(el => el?.id && processedInputIds.add(el.id));
                        continue;
                    }
                    // For multi-option (yes/no) with empty title, use a generic label
                    if (options.length > 1) {
                        labelText = options[0].slice(0, 80) + '...';
                    }
                }

                fields.push({
                    element: elements,
                    type: elements[0].type,
                    label: labelText,
                    required,
                    options: options,
                });
                continue;

            }

            if (element.getAttribute('aria-haspopup') == 'listbox' && element.parentElement.querySelector('button')) {
                scrollToTargetAdjusted(element.parentElement, getHeaderHeight());
                element.parentElement.querySelector('button').click();
                let options;
                for (let _t = 0; _t < 7; _t++) {
                    await wait(1000);
                    const listbox = document.getElementById(element.getAttribute('aria-controls'));
                    if (listbox) {
                        const listboxItems = listbox.querySelectorAll('div[role=option]');
                        if (listboxItems.length) {
                            options = [...listboxItems].map(option => option.innerText)
                            break;
                        }
                        if (listbox.querySelector('p')?.parentElement.className.includes('_noResults')) {
                            break;
                        }
                    }
                }
                element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
                element.blur();
                await wait(1000);

                required = label.className?.includes('required')

                if (options) {
                    fields.push({
                        element: element,
                        type: 'select',
                        label: labelText,
                        required,
                        options: options,
                    });
                    continue;
                }

            }

            fields.push({
                element: element,
                type: element.type,
                label: labelText,
                required
            });
            continue;
        } else if (element.tagName == 'TEXTAREA') {
            fields.push({
                element: element,
                type: 'textarea',
                label: labelText,
                required
            });
            continue;
        }
        console.warn('Unknown field', labelText, element);
    }

    

    debugLog('[Ashby] Fields collected:', fields.length, 'Consent auto-check:', consentCheckboxes.length);
    fields.forEach((f, i) => {
        debugLog(`[Ashby] Field[${i}]: type=${f.type} label="${(f.label||'').slice(0,80)}" required=${f.required} options=${JSON.stringify((f.options||[]).map(o=>(o||'').slice(0,50)))}`);
    });

    if (fields.length <= 0) {
        throw new SendCvError('Fields not found');
    }

    //StatusMessage('Send fields to server. Wait for response...');
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

            debugLog(`[Ashby] Field value: label="${field.label.slice(0,60)}" value=${JSON.stringify(value)} completed=${completed}`);

            if (completed) {
                fieldNum += 1;
            } else {
                if (field.type != 'text' && field.type != 'textarea') {
                    continue;
                }
            }

            console.log(field, field.label, value)

            if (!value && value !== 0) {
                debugLog(`[Ashby] Skipping field (no value): label="${field.label.slice(0,60)}"`);
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
                scrollToTargetAdjusted(field.element[0], getHeaderHeight());
                if (!Array.isArray(value)) {
                    value = [value]
                }
                
                for (let ne = 0; ne < field.element.length; ne++) {
                    const el = field.element[ne];
                    if (!el.checked && value.includes(field.options[ne])) {
                        el.click();
                        await wait(500);
                    } else {
                        if (el.type == 'checkbox' && el.checked && !value.includes(field.options[ne])) {
                            el.click();
                            await wait(500);
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

                if (field.element.type == 'checkbox' && field.element.parentElement.querySelectorAll('button')?.length == 2) {
                    scrollToTargetAdjusted(field.element.parentElement, getHeaderHeight());
                    field.element.parentElement.querySelectorAll('button').forEach((el, index) => {
                        if (field.options[index] == value) {
                            el.click();
                        }
                    });
                } else {
                    scrollToTargetAdjusted(field.element, getHeaderHeight());

                    if (field.element.type == 'number') {
                        const numValue = Number(String(value).replace(/\D/g,''));
                        setNativeValue(field.element, numValue ? numValue : 1);
                    } else {
                        setNativeValue(field.element, value);
                    }

                    if (field.element.getAttribute('aria-haspopup') == 'listbox') {
                        for (let _t = 0; _t < 7; _t++) {
                            await wait(1000);
                            const listbox = document.getElementById(field.element.getAttribute('aria-controls'));
                            if (listbox) {
                                const listboxFirstItem = listbox.querySelector('div[role=option]');
                                if (listboxFirstItem) {
                                    listboxFirstItem.click();
                                    break;
                                }
                            }
                        }
                    }
                    if (field.type == 'textarea') {
                        await wait(100);
                        textareaGrow();
                    }
                }
            }

        } catch (e) {
            console.error(e)
        }

        await wait(1000);
    }

    await pause();

    // Auto-check consent checkboxes (required checkboxes with empty labels)
    debugLog('[Ashby] Auto-checking consent checkboxes:', consentCheckboxes.length);
    for (const checkbox of consentCheckboxes) {
        if (!checkbox.checked) {
            debugLog(`[Ashby] Clicking consent checkbox id="${checkbox.id}" checked=${checkbox.checked}`);
            // Prefer clicking the visible label that points to this checkbox
            const visibleLabel = document.querySelector(`label[for="${CSS.escape(checkbox.id)}"]`);
            if (visibleLabel) {
                debugLog(`[Ashby] Clicking label for consent checkbox: text="${visibleLabel.innerText.slice(0,60)}"`);
                scrollToTargetAdjusted(visibleLabel, getHeaderHeight());
                await wait(500);
                visibleLabel.click();
            } else {
                // Fallback: click the checkbox span container or input directly
                const spanContainer = checkbox.closest('span') || checkbox.parentElement;
                debugLog(`[Ashby] Clicking span/parent for consent checkbox: tag=${spanContainer?.tagName}`);
                scrollToTargetAdjusted(spanContainer || checkbox, getHeaderHeight());
                await wait(500);
                (spanContainer || checkbox).click();
            }
            await wait(500);
            debugLog(`[Ashby] Consent checkbox checked state after click: ${checkbox.checked}`);
        } else {
            debugLog(`[Ashby] Consent checkbox already checked: id="${checkbox.id}"`);
        }
    }

    document.querySelectorAll('input[type="checkbox"][id*="systemfield_data_consent_ack"]').forEach(async checkbox => {
        await wait(1000);
        if (!checkbox.checked) checkbox.click()
    })

    await wait(2000)

    if (!devMode) {
        await readyToSubmit();
        await fullPageScreenshot();
        await wait(500);
        scrollToTargetAdjusted(document.querySelector('.ashby-application-form-submit-button'), getHeaderHeight());
        await wait(500);
        //StatusMessage('Submit');
        document.querySelector('.ashby-application-form-submit-button')?.click()
        await waitForSuccess('.ashby-application-form-success-container')
    }

    //StatusMessage('Done');

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

                    if (!document.querySelector('.ashby-job-posting-right-pane-application-tab') && !document.querySelector('.ashby-application-form-submit-button')) {
                        throw new SendCvSkipError('Job not found')
                    }

                    countDown = startCountDownInStatusBlock(60 * 5, () => {
                        chrome.runtime.sendMessage({
                            type: "SEND-CV-TAB-TIMER-ENDED", data: {
                                url: window.location.href
                            }
                        });
                    });

                    successOnSelector('.ashby-application-form-success-container');

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