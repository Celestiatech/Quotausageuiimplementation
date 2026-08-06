

let countDown;

let currentElement;

async function apply(data) {

    const {devMode, session: {city, country, workplace}} = data;

    const jobLocation = document.querySelector('.job__location')?.innerText?.trim();

    if (workplace !== 'ANY' && !jobLocation?.toLowerCase()?.includes(workplace?.toLowerCase()?.replace('_', '-'))) {
        throw new SendCvSkipError('Wrong workplace type');
    }

    if (country || city) {

        const {cities, countries} = await parseCountriesAndCities(jobLocation);

        if (country && (!countries.length || !countries.includes(country))) {
            throw new SendCvSkipError('Wrong country');
        }

        if (city && (!cities.length || !cities.includes(city))) {
            throw new SendCvSkipError('Wrong city');
        }

    }

    company = document.title.split('at ').pop().trim();
    role = document.title.split('for ').pop().trim().split('at ').shift().trim();

    description = '';
    try {
        description = document.querySelector('.job__description').innerHTML.trim();
    } catch {}

    // Parse location
    const location = jobLocation || null;

    // Parse workplaceType from jobLocation
    let workplaceType = null;
    if (jobLocation) {
        const locLower = jobLocation.toLowerCase();
        if (locLower.includes('remote')) {
            workplaceType = 'REMOTE';
        } else if (locLower.includes('hybrid')) {
            workplaceType = 'HYBRID';
        } else if (locLower.includes('on-site') || locLower.includes('onsite') || locLower.includes('on site')) {
            workplaceType = 'ON_SITE';
        }
    }

    // Parse logoUrl
    let logoUrl = null;
    // Try og:image first
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.content && ogImage.content.trim()) {
        logoUrl = ogImage.content.trim();
    } else {
        // Try .image-container img
        const containerImg = document.querySelector('.image-container img');
        if (containerImg && containerImg.src) {
            logoUrl = containerImg.src;
        }
    }

    await setHistoryDetails({company, role, description, location, workplaceType, logoUrl});

    await wait(1000);

    //StatusMessage('Check and upload CV');
    if (!data.successfulSubmissions && !data.failedSubmissions) {
        appendStatusMessage('Found relevant job openings. Starting auto-apply with the first one...');
        await wait(2000);
    }

    scrollToTargetAdjusted(document.querySelector('.application--container'), 500);

    cv = await getResume(data);

    await pause();

    document.querySelector('[data-testid="cover_letter-text"]')?.click();
    await wait(500);

    if ((!cv || !cv.url) && document.querySelector('#upload-label-resume .required')) {
        throw new SendCvError('CV not found. It required');
    }

    const fileInput = document.getElementById('resume');

    if (fileInput) {
        appendStatusMessage('Uploading your CV. Please hang on...');
        const blob = await fetch(cv.url, {method: 'GET'}).then(res => res.blob());
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([blob], cv.originalFilename, {type: blob.type, lastModified: new Date()}));
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', {bubbles: true}));
        await wait(1000);
    }
    
    await pause();

    appendStatusMessage('Collecting fields and application questions...');

    const fields = [];
    const labelSeen = {};

    for (const label of [...document.querySelectorAll('label')]) {
        let element = document.getElementById(label.getAttribute('for'));

        if (!element) {
            continue;
        }

        let required = element.getAttribute('aria-required');

        let labelText = label.innerText.trim();

        if (labelText.endsWith('*')) {
            labelText = labelText.slice(0, -1).trim();
            required = true;
        }

        if (labelSeen[labelText]) {
            labelSeen[labelText] += 1;
            labelText = `${labelText} (#${labelSeen[labelText]})`;
        } else {
            labelSeen[labelText] = 1;
        }

        if (element.id == 'resume' || element.id == 'cover_letter') {
            continue;
        }

        if (element.id == 'cover_letter_text') {
            labelText = "Cover letter";
        }

        if (labelText.toLowerCase().includes('phone')) {
            labelText += ' (with country code)'
        }


        if (element.tagName == 'INPUT') {
            if (element.type == 'file') {
                if (required) {
                    throw new SendCvSkipError('Files required: '+labelText)
                }
                continue;
            }

            if (element.type == 'radio' || element.type == 'checkbox') {
                const fieldset = element.closest('fieldset')
                if (!fieldset) {
                    continue;
                }
                const legend = fieldset.querySelector('legend')
                if (!legend) {
                    console.warn('radio without legend')
                    continue;
                }

                const options = [...fieldset.querySelectorAll('label:not(.ashby-application-form-question-title)')].map(option => option.innerText)
                const elements = [...fieldset.querySelectorAll('label:not(.ashby-application-form-question-title)')].map(option => document.getElementById(option.getAttribute('for')))

                if (!elements || elements[0] != element) {
                    continue;
                }

                labelText = legend.innerText.trim()
                if (labelText.endsWith('*')) {
                    labelText = labelText.slice(0, -1).trim() + '(you need to select at least one option)';
                    required = true;
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

            if (element.getAttribute('role') == 'combobox') {
                let options;
                if (!labelText.toLowerCase().startsWith('location') && !labelText.toLowerCase().includes('school')) {
                    scrollToTargetAdjusted(element.parentElement, 500);
                    element.dispatchEvent(new Event('mouseup', { bubbles: true }));
                    for (let _t = 0; _t < 7; _t++) {
                        await wait(300);
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
                    element.dispatchEvent(new Event('focusout', { bubbles: true }));
                    element.blur();
                    await wait(300);
                }

                if (labelText.toLowerCase().startsWith('location')) {
                    labelText += ` - Please fill in this field in the following language code: ${navigator.language}`
                }
                
                fields.push({
                    element: element,
                    type: 'select',
                    label: labelText,
                    required,
                    options: options,
                });
                continue;
                
                

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


    if (fields.length <= 0) {
        throw new SendCvSkipError('Fields not found');
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

            if (!value && value !== 0) {
                console.log('skip')
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
                scrollToTargetAdjusted(field.element[0], 500);
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

                if (currentElement != field.element) {
                    scrollToTargetAdjusted(field.element, field.type != 'textarea' ? 500 : 50);
                    currentElement = field.element;
                }

                if (field.type == 'select') {
                    field.element.dispatchEvent(new Event('mouseup', {bubbles: true}));
                    await wait(100);
                }

                setNativeValue(field.element, value);
                if (field.type == 'select') {
                    const targetValue = String(value).trim();
                    const targetLower = targetValue.toLowerCase();
                    for (let nt = 0; nt < 30; nt++) {
                        if (nt > 10 && targetValue.length > 2) {
                            setNativeValue(field.element, targetValue.substring(0, Math.floor(targetValue.length / 2)));
                        }
                        await wait(500);
                        const listbox = document.getElementById(field.element.getAttribute('aria-controls'));
                        if (listbox) {
                            const listboxItems = [...listbox.querySelectorAll('div[role=option]')];
                            if (listboxItems.length) {
                                let matched = listboxItems.find(opt => opt.innerText.trim().toLowerCase() === targetLower);
                                if (!matched) {
                                    matched = listboxItems.find(opt => {
                                        const t = opt.innerText.trim().toLowerCase();
                                        return t.includes(targetLower) || targetLower.includes(t);
                                    });
                                }
                                if (matched) {
                                    matched.click();
                                    debugLog(`[Greenhouse] select "${field.label}": matched "${matched.innerText.trim()}" for value="${targetValue}"`);
                                } else {
                                    debugLog(`[Greenhouse] select "${field.label}": NO MATCH for value="${targetValue}" opts=${JSON.stringify(listboxItems.slice(0, 12).map(o => o.innerText.trim()))}`);
                                }
                                await wait(100);
                                break;
                            }
                        }
                    }
                    field.element.dispatchEvent(new Event('focusout', {bubbles: true}));   
                }
                if (field.type == 'textarea') {
                    await wait(100);
                    textareaGrow();
                }
            }
        } catch (e) {
            console.error(e)
        }

        await wait(1000);
    }

    await pause();

    for (const box of [...document.querySelectorAll('input[type="checkbox"][aria-required="true"]:not(:checked):not(fieldset *)')]) {
        box.click();
        await wait(300);
        await pause();
    }

    for (const box of [...document.querySelectorAll('input[type="checkbox"][required]:not(:checked):not(fieldset *)')]) {
        box.click();
        await wait(300);
        await pause();
    }


    if (!devMode) {
        debugLog('[Greenhouse] readyToSubmit starting');
        await readyToSubmit();
        await fullPageScreenshot();
        await wait(500);
        scrollToTargetAdjusted(document.querySelector('.application--submit button'), 500);
        await wait(500);
        debugLog('[Greenhouse] clicking submit');
        document.querySelector('.application--submit button').click();
    }
    
    
    for (let _t = 0; _t < 6; _t++) {
        await wait(3000);
        await pause();

        if (document.getElementById('email-verification')) {
            scrollToTargetAdjusted(document.getElementById('email-verification'), 500);

            allowed = await chrome.runtime.sendMessage({type: "EMAIL-ACCESS-ENABLED"});
            agentStatus.emailAccess = allowed?.data
            if (agentStatus.emailAccess.includes('UNKNOWN')) {
                askEmailAccess();
                agentStatus.paused = true;
                await pause();
            }

            if (agentStatus.emailAccess.includes('DISABLED')) {
                agentStatus.setButtons(2);
                agentStatus.paused = true;
                appendStatusMessage('Hey! I’m stuck. Since you didn’t allow access to your Gmail, you’ll need to copy and paste the verification code manually. Once you’re done, click CONTINUE and I’ll keep going.');
                await pause();
                break;
            }

            if (agentStatus.emailAccess.includes('ENABLED')) {

            agentStatus.confirmationCode = null;
            chrome.runtime.sendMessage({type: "SEARCH-EMAIL", data: {
                query: `in:all Greenhouse ${company} paste this code into the security code field on your application `,
                begin: 'paste this code into the security code field on your application: ',
                len: 8,
            }});
            
            const email = document.getElementById('email')?.value;
            let msg = '';
            if (!email.endsWith('@gmail.com')) {
                msg = `\n\nI can’t automate Greenhouse verification because your email isn’t Gmail. I can only grab codes from Gmail. Change it to a Gmail address on your profile page for smoother automation.`;   }

            appendStatusMessage(`Hey! This Greenhouse job needs a confirmation code from your inbox. I’ll open Gmail and grab it for you – just make sure you’re logged in as ${email} in this browser.${msg}`);

            while (!agentStatus.confirmationCode) {
                await wait(500);
            }

            for (let n = 0; n <= 7; n++) {
                setNativeValue(document.getElementById(`security-input-${n}`), agentStatus.confirmationCode[n]);
                await wait(50);
            }
            await wait(300);
            document.querySelector('.application--submit button').click();
            await wait(3000);

            }
        }

        const errorMessage = Array.from(document.querySelectorAll('.helper-text--error'))
            .map(el => el.innerText.trim())
            .filter(Boolean)
            .join('\n');
        if (errorMessage && errorMessage != 'Incorrect security code') {
            await fillingErrors(errorMessage);
        }
    }

}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    console.log('INCOMING MESSAGE', request, sender);

    const {type, data} = request;

    switch (type) {
        case 'EMAIL-FINISHED':
            agentStatus.confirmationCode = data.code;
            if (data != 'timeout') {
                appendStatusMessage("Found confirmation code in email. Submitting the application...");
            } else {
                appendStatusMessage("Oops… I can’t grab the code because you’re not logged into Gmail. Log in, then hit CONTINUE and I’ll keep going.");
                agentStatus.setButtons(2);
                agentStatus.paused = true;
                if (!agentStatus.confirmationCode) {
                    agentStatus.confirmationCode = '111111';
                }
            }
            break;
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

                    if (window.location.pathname.includes('/confirmation')) {
                        cvTaskDone();
                        return;
                    }

                     if (!document.querySelector('.application--submit')) {
                        throw new SendCvSkipError('Job not found');
                    }
                    
                    countDown = startCountDownInStatusBlock(data.applyOneEnabled == 'QUICK' ? 60 * 15 : 60 * 5, () => {
                        chrome.runtime.sendMessage({
                            type: "SEND-CV-TAB-TIMER-ENDED", data: {
                                url: window.location.href
                            }
                        });
                    });

                    successOnURL('/confirmation');
                    successOnSelector('#application_confirmation, .confirmation-page, [data-qa="confirmation-message"]');

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


                    await fillingErrors('timeout after submit');
                    
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