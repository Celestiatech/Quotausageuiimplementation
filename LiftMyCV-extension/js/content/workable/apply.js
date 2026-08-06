

let countDown;

const FIELDS_SELECTOR = 'main fieldset[aria-labelledby],main div[role="group"][aria-labelledby], main input[aria-labelledby]:not([aria-hidden="true"],[type="file"]), main textarea[aria-labelledby], main input[texts]:not([aria-hidden="true"],[type="file"]), main input[placeholder][inputmode="tel"]:not([aria-hidden="true"],[type="file"]), dialog fieldset[aria-labelledby],dialog div[role="group"][aria-labelledby], dialog input[aria-labelledby]:not([aria-hidden="true"],[type="file"]), dialog textarea[aria-labelledby], dialog input[texts]:not([aria-hidden="true"],[type="file"]), dialog input[placeholder][inputmode="tel"]:not([aria-hidden="true"],[type="file"])';

function getHeaderHeight() {
    return document.querySelector('nav[role="navigation"]')?.clientHeight + 100 || 250;
}

function scrollToIf(element, offsetDec) {
    const container = document.querySelector('[data-role="dialog-content"]');
    if (container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const offset = elementRect.top - containerRect.top;
    
        container.scrollTop += offset - offsetDec;

        const scrollEvent = new Event('scroll', {
            bubbles: true,
            cancelable: true,
        });
        
        container.dispatchEvent(scrollEvent);
    } else {
        scrollToTargetAdjusted(element, offsetDec);
    }
};

function isRequired(labelEl) {
    return labelEl?.parentNode?.parentNode?.querySelector('strong')?.innerText?.trim() === '*'
}

function isFileInputRequired(inputEl) {
    return inputEl.parentElement.parentElement.querySelector('& > span').innerText.trim().startsWith('*');
}

function getWorkableRequiredFallback(field, data) {
    const profile = data.profile || {};
    const label = field.label.toLowerCase();
    if (label.includes('github')) {
        return profile.githubUrl || profile.github || profile.websiteUrl || profile.linkedinUrl || '';
    }
    if (label.includes('linkedin')) {
        return profile.linkedinUrl || profile.linkedin || '';
    }
    if (label.includes('project') || label.includes('sample') || label.includes('portfolio') || label.includes('research')) {
        return profile.githubUrl || profile.websiteUrl || profile.linkedinUrl
            || 'Please refer to my attached resume/CV for representative work samples.';
    }
    if (label.includes('compensation') || label.includes('salary')) {
        return '120000';
    }
    return '';
}

async function apply(data) {

    document.querySelector('[data-ui="cookie-consent-accept"]')?.click();

    const {devMode, profile: {phone, phoneCountryCode}, session: {city, country, workplace}, avatarUrl} = data;

    //StatusMessage('Check workplace type');

    if (workplace !== 'ANY' && !document.querySelector('[data-ui="job-workplace"],[data-ui="overview-workplace"]').innerText.trim().toLowerCase().includes(workplace.toLowerCase().replace('_', '-'))) {
        throw new SendCvSkipError('wrong workplace type');
    }

    if ((country || city) && document.querySelector('[data-ui="job-location"],[data-ui="overview-location"]')) {

        //StatusMessage('Check country and city');

        const {cities, countries} = await parseCountriesAndCities(document.querySelector('[data-ui="job-location"],[data-ui="overview-location"]').innerText.trim());

        if (country && (!countries.length || !countries.includes(country))) {
            throw new SendCvSkipError('Wrong country');
        }

        if (city && (!cities.length || !cities.includes(city))) {
            throw new SendCvSkipError('Wrong city');
        }

    } else {
        //StatusMessage('Country and city not specified or job location not specified. skip');
    }

    company = document.querySelector('a[data-ui=company-logo] img')?.alt || document.querySelector('a[data-ui=company-logo]')?.textContent || document.querySelector('[data-ui="overview-company"] a')?.textContent;
    role = document.querySelector('[data-ui=job-title]')?.innerText || document.querySelector('[data-ui=overview-title]')?.innerText;

    description = '';
    try {
        description = document.querySelector('[data-ui=job-description]')?.parentElement.innerHTML.trim().replaceAll('Share this job SVGs not supported by this browser.Description', '') || document.querySelector('div[class^="jobBreakdown"]')?.innerHTML.trim()
    } catch {}

    // Parse location
    let location = null;
    try {
        location = document.querySelector('[data-ui="job-location"],[data-ui="overview-location"]')?.innerText.trim();
    } catch {}

    // Parse workplaceType
    let workplaceType = null;
    try {
        const workplaceText = document.querySelector('[data-ui="job-workplace"],[data-ui="overview-workplace"]')?.innerText.trim().toLowerCase() || '';
        if (workplaceText.includes('remote')) {
            workplaceType = 'REMOTE';
        } else if (workplaceText.includes('hybrid')) {
            workplaceType = 'HYBRID';
        } else if (workplaceText.includes('on-site') || workplaceText.includes('onsite') || workplaceText.includes('on site')) {
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
            const imgElement = document.querySelector('a[data-ui=company-logo] img');
            if (imgElement && imgElement.src && imgElement.src.startsWith('http')) {
                logoUrl = imgElement.src;
            }
        }
    } catch {}

    await setHistoryDetails({company, role, description, location, workplaceType, logoUrl});

    await wait(Math.round(2000 + (Math.random() * 1000)));
    if (!data.successfulSubmissions && !data.failedSubmissions) {
        appendStatusMessage('Found relevant job openings. Starting auto-apply with the first one...');
    }

    if (document.querySelector('[data-ui="overview-apply-now"]')) {
        document.querySelector('[data-ui="overview-apply-now"]').click();
        await wait(5000);
    } else {
        document.querySelector('[data-ui=application-form-tab]')?.click();
    }
    await wait(Math.round(2000 + (Math.random() * 1000)));

    [...document.querySelectorAll('a[data-ui^="clear-section-"]')].forEach(el => el.click());

    //StatusMessage('Check and upload CV');

    cv = await getResume(data);

    await pause();

    appendStatusMessage('Uploading your CV. Please hang on...');

    const resumeInput = document.querySelector('input[data-ui="resume"][type=file]');

    if ((!cv || !cv.url) && isFileInputRequired(resumeInput)) {
        throw new SendCvError('CV not found. It required');
    }

    await uploadFile(cv.url, cv.originalFilename, resumeInput);

    await wait(1000);

    const photoInput = document.querySelector('input[data-ui="avatar"][type=file]');

    if (photoInput) {

        //StatusMessage('Upload Avatar if required');

        const photoRequired = isFileInputRequired(photoInput);

        if (!avatarUrl && photoRequired) {
            throw new SendCvError('Photo not found. It required');
        }

        if (photoRequired) {

            //StatusMessage('Check and upload avatar');

            await uploadFile(avatarUrl, 'avatar.png', photoInput);

            await new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 1500);
            });

            document.querySelector('div[data-role="modal-wrapper"] div[data-role="dialog-container"] button[data-ui="crop-image"]')?.click();

            await new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 5000);
            });

        }

    }

    //StatusMessage('Grab fields...');
    await pause();

    appendStatusMessage('Collecting fields and application questions...');

    const fields = [...document.querySelectorAll(FIELDS_SELECTOR)].map(el => {

        console.log(el.nodeName);

        const result = {
            element: el,
            type: '',
            label: '',
            required: false
        };

        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const labelEl = ariaLabelledBy ? document.getElementById(ariaLabelledBy) : el.closest('label');

        result.label = labelEl.innerText;
        result.required = isRequired(labelEl);

        if (el.parentElement.querySelector('[data-ui="calendar-icon"]')) {
            if (el.getAttribute('placeholder')) {
                result.label += ' ' + el.getAttribute('placeholder');
            }
        }

        if (result.label.startsWith('*\n')) {
            result.required = true;
            result.label = result.label.replace('*\n', '');
        }

        if (result.label.includes('alary')) {
            result.label += ' (input digits only)';
        }

        switch(el.nodeName) {
            case 'INPUT':
            case 'TEXTAREA':
                result.type = el.type;
                if (el.nodeName === 'INPUT' && el.getAttribute('role') === 'combobox') {
                    result.type = 'select';
                    el.click();
                    const containerOpts = [...el.closest('div[data-input-type="select"]').querySelectorAll('dialog ul li')].map(el => el.innerText.trim());
                    const docOpts = [...document.querySelectorAll('dialog[open] ul li, ul[role="listbox"] li')]
                        .filter(el => !el.closest('.iti__dropdown-content') && !el.classList.contains('iti__country'))
                        .map(el => el.innerText.trim());
                    result.options = containerOpts.length > 0 ? containerOpts : (docOpts.length > 0 ? docOpts : []);
                    console.log(`[Workable] collect select "${result.label}": containerOpts=${containerOpts.length} docOpts=${docOpts.length} opts=${JSON.stringify(result.options.slice(0,5))}`);
                    // Close dropdown
                    document.body.click();
                }
                break;
            case 'DIV':
                result.type = el.querySelector('input').type;
                result.element = [...el.querySelectorAll('input')];
                result.options = [...el.querySelectorAll('label')].map(l => l.innerText);
                break;
            case 'FIELDSET':
                result.type = el.querySelector('input').type;
                result.element = [...el.querySelectorAll('input')];
                result.options = [...el.querySelectorAll('input')].map(input => input.closest('label').innerText);
                break;
        }

        return result;

    });

    if (fields.length <= 0) {
        throw new SendCvSkipError('Fields not found');
    }

    if (document.querySelector('input[name="phone"]')) {
        fields.splice(3, 0, {
            element: document.querySelector('input[name="phone"]'),
            type: 'tel',
            label: document.getElementById('phone_label').innerText,
            required: isRequired(document.getElementById('phone_label'))
        });
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

            console.log(field, field.label, value)

            if ((value === null || value === undefined || value === '') && value !== 0) {
                if (field.required) {
                    value = getWorkableRequiredFallback(field, data);
                    if (!value && value !== 0) {
                        debugLog(`[Workable] required field empty after fallback: ${field.label}`);
                        continue;
                    }
                } else {
                    console.log('skip')
                    continue;
                }
            }

            if (Array.isArray(field.element)) {
                if (agentStatus.resumed) {
                    field.element.forEach((el) => {
                        if (el.checked) {
                            throw new Error('filled by user')
                        }
                    });
                }

                scrollToIf(field.element[0], getHeaderHeight());
                if (!Array.isArray(value)) {
                    value = [value]
                }

                for (let ne = 0; ne < field.element.length; ne++) {
                    const el = field.element[ne];
                    if (el.type === 'checkbox') {
                        if (value.includes(el.parentNode?.parentNode?.innerText)) {
                            el.click();
                            await wait(500);
                        }
                    } else if (el.type === 'radio') {
                        const labelText = el.closest('label')?.innerText?.trim() || '';
                        const matchValues = Array.isArray(value) ? value : [value];
                        if (matchValues.some(v => String(v).trim().toLowerCase() === labelText.toLowerCase())) {
                            el.click();
                            await wait(500);
                        }
                    } else {
                        if (value.includes(el.value)) {
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
                if (field.type === 'select') {
                    scrollToIf(field.element, getHeaderHeight());
                    field.element.focus();
                    field.element.click();
                    await wait(1200);

                    // Log DOM structure to diagnose select issues
                    const selectContainer = field.element.closest('div[data-input-type="select"]');
                    const hiddenInputs = selectContainer ? [...selectContainer.querySelectorAll('input[type="hidden"]')].map(i => `name=${i.name} val=${i.value}`) : [];
                    debugLog(`[Workable] select "${field.label}": input.value="${field.element.value}" hidden=${JSON.stringify(hiddenInputs)} container=${selectContainer?.outerHTML?.slice(0,300)}`);

                    // Find open dropdown items from document (handles portal rendering)
                    const selectors = [
                        'dialog[open] ul li',
                        'ul[role="listbox"] li',
                        '[data-input-type="select"] dialog ul li',
                        '[data-ui*="dropdown"] li',
                    ];
                    const allItems = [...new Set(selectors.flatMap(sel => [...document.querySelectorAll(sel)]))]
                        .filter(el => !el.closest('.iti__dropdown-content') && !el.classList.contains('iti__country'));
                    debugLog(`[Workable] select fill "${field.label}": value="${value}" docItems=${allItems.length} opts=${JSON.stringify(allItems.slice(0,15).map(e=>e.innerText.trim()))}`);

                    let selectedEl = null;
                    for (const el of allItems) {
                        if (el.innerText.trim() === value) { selectedEl = el; break; }
                    }
                    if (!selectedEl) {
                        for (const el of allItems) {
                            if (el.innerText.trim().toLowerCase().includes(value.toLowerCase())) {
                                debugLog(`[Workable] select "${field.label}": partial fallback -> "${el.innerText.trim()}"`);
                                selectedEl = el;
                                break;
                            }
                        }
                    }

                    if (selectedEl) {
                        selectedEl.click();
                        await wait(600);
                        debugLog(`[Workable] select "${field.label}": after li.click input.value="${field.element.value}" hiddenAfter=${JSON.stringify([...( selectContainer?.querySelectorAll('input[type="hidden"]') || [])].map(i=>`${i.name}=${i.value}`))}`);

                        // Force React state update via native setter + events
                        const currentVal = field.element.value;
                        if (currentVal) {
                            setNativeValue(field.element, currentVal);
                        }
                        field.element.dispatchEvent(new Event('change', { bubbles: true }));
                        field.element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
                        await wait(400);
                        debugLog(`[Workable] select "${field.label}": after events input.value="${field.element.value}"`);
                    } else {
                        debugLog(`[Workable] select "${field.label}": NO MATCH for value="${value}"`);
                    }

                } else {

                    if (field.label.toLowerCase() === 'phone') {
                        field.element.parentElement.querySelector('[role="combobox"]').click();
                        [...field.element.parentElement.querySelectorAll('.iti__dropdown-content li.iti__country')].forEach((countryEl) => {
                            if (countryEl.querySelector('.iti__dial-code').innerText === phoneCountryCode) {
                                countryEl.click();
                            }
                        });
                        value = value.replaceAll(phoneCountryCode, '');
                    }

                    scrollToIf(field.element, getHeaderHeight());

                    if (field.element.parentElement.querySelector('[data-ui="calendar-icon"]')) {
                        field.element.click();
                        await wait(1000);
                        field.element.dispatchEvent(new Event('keydown', {bubbles: true}));
                        await wait(1000);
                    }

                    setNativeValue(field.element, value);

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

    if (document.querySelector('input[name="gdpr"]:not(:checked)')) {
        document.querySelector('input[name="gdpr"]:not(:checked)').click();
        await wait(500);
    }

    const pendingFileInputs = [...document.querySelectorAll('main input[type=file], dialog input[type=file]')]
        .filter(inp => inp.id !== 'resume' && inp.id !== 'avatar' && !inp.files?.length);
    for (const inp of pendingFileInputs) {
        try {
            if (isFileInputRequired(inp) && cv?.url) {
                debugLog(`[Workable] uploading CV to required file field id=${inp.id}`);
                await uploadFile(cv.url, cv.originalFilename, inp);
                await wait(1500);
            }
        } catch (e) {
            debugLog(`[Workable] file upload fallback failed id=${inp.id}: ${e.message}`);
        }
    }

    if (!devMode) {
        await readyToSubmit();
        if (document.querySelector('[data-role="dialog-content"]')) {
            await linkedinModalScreenshot();
        } else {
            await fullPageScreenshot();
        }
        //StatusMessage('Submit');

        await waitForSuccess('button[data-ui="apply-button"], div[data-ui="successful-submit"], [data-ui="application-form-success-subtitle"]')

        document.querySelector('button[data-ui="apply-button"]')?.click();

        await wait(1500);
        const errorEls = [...document.querySelectorAll('[id$="_error"], [data-ui="error"], .error-message, [role="alert"]')]
            .filter(el => el.offsetParent !== null && el.innerText.trim());
        const invalidInputs = [...document.querySelectorAll('main input:invalid, main textarea:invalid, dialog input:invalid, dialog textarea:invalid')];
        if (errorEls.length || invalidInputs.length) {
            errorEls.forEach(el => {
                const parentLabel = el.closest('[data-input-type]')?.querySelector('label')?.innerText?.trim()
                    || el.closest('[aria-labelledby]') && document.getElementById(el.closest('[aria-labelledby]').getAttribute('aria-labelledby'))?.innerText?.trim()
                    || '';
                debugLog(`[Workable] error field id="${el.id}" text="${el.innerText.trim().slice(0,120)}" label="${parentLabel.slice(0,80)}"`);
            });
            invalidInputs.forEach(el => {
                debugLog(`[Workable] invalid input name="${el.name}" id="${el.id}" validationMessage="${el.validationMessage?.slice(0,120)}"`);
            });
            throw new Error('Found fields with errors');
        }
    }
    
    await waitForSuccess('div[data-ui="successful-submit"], [data-ui="application-form-success-subtitle"], [data-ui="application-success"]', 60000);

}

window.addEventListener('load', () => {

    

    chrome.runtime.sendMessage({type: "GET-SEND-CV-TASK"}).then(async (value) => {

        const {type, data, message} = value;

        switch (type) {
            case 'ERROR':
                
                if (!data?.applyOneEnabled) {
                    return;
                }

                let o = false;

                while (true) {
                    if (location.href !== o) {
                        startApplyOne(value);
                    }
                    o = location.href;
                    await wait(2000);
                }
                
                break;
            case 'SUCCESS':
                try {

                    warmingUp(data.agentGeometry, data.agentMessages, data.agentMode);

                    if (document.body.innerText.includes('Cannot GET') || document.location.search.includes('not_found=true') || document.querySelector('[data-ui=job-unavailable]')) {
                        throw new SendCvSkipError('Job not found')
                    }

                    countDown = startCountDownInStatusBlock(60 * 5, () => {
                        chrome.runtime.sendMessage({
                            type: "SEND-CV-TAB-TIMER-ENDED", data: {
                                url: window.location.href
                            }
                        });
                    });

                    successOnSelector('div[data-ui="successful-submit"], [data-ui="application-form-success-subtitle"], [data-ui="application-success"]');
                    
                    await new Promise((resolve, reject) => {
                        setTimeout(async () => {
                            try {
                                if (document.querySelector('[data-ui="job-unavailable"]')) {
                                    throw new SendCvSkipError('Job not found');
                                }
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