

let countDown;

function getHeaderHeight() {
    return document.querySelector('[data-cy="section-background-wrapper"]').clientHeight;
}

async function apply(data) {

    document.querySelector('[data-cy="agree-to-all-cookies"]')?.click();

    const {devMode, session: {city, country, workplace}} = data;

    //StatusMessage('Check workplace type');

    if (workplace !== 'ANY' && !document.querySelector('[data-cy=section-wrapper-padder] ul li:nth-child(1)')?.innerText.trim().toLowerCase().includes(workplace.toLowerCase().replace('_', '-'))) {
        throw new SendCvSkipError('Wrong workplace type');
    }

    if (country || city) {

        //StatusMessage('Check country and city');

        const {cities, countries} = await parseCountriesAndCities(document.querySelector('[data-cy=section-wrapper-padder] ul li:nth-child(2)')?.innerText.trim());

        if (country && (!countries.length || !countries.includes(country))) {
            throw new SendCvSkipError('Wrong country');
        }

        if (city && (!cities.length || !cities.includes(city))) {
            throw new SendCvSkipError('Wrong city');
        }

    }

    company = document.querySelector('[data-cy=navigation-section-grid-container] a span')?.innerText;
    role = document.querySelector('main h1')?.innerText;

    description = '';
    try {
        description = document.querySelector('h2.custom-css-style-job-description')?.parentElement.innerHTML.trim().replaceAll('Job description', '');
    } catch {}

    // Parse location
    let location = null;
    try {
        location = document.querySelector('[data-cy=section-wrapper-padder] ul li:nth-child(2)')?.innerText.trim();
    } catch {}

    // Parse workplaceType
    let workplaceType = null;
    try {
        const workplaceText = document.querySelector('[data-cy=section-wrapper-padder] ul li:nth-child(1)')?.innerText.trim().toLowerCase() || '';
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
            const imgElement = document.querySelector('[data-cy=navigation-section-grid-container] a img');
            if (imgElement && imgElement.src && imgElement.src.startsWith('http')) {
                logoUrl = imgElement.src;
            }
        }
    } catch {}

    await setHistoryDetails({company, role, description, location, workplaceType, logoUrl});

    document.querySelector('[data-cy=apply-button-nav]')?.click()

    try {
        await waitForClickableButton('[data-testid=submit-application-form-button]', 2000)
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

    if ((!cv || !cv.url) && document.querySelector("[data-cy=fileInputField]").closest('section').querySelector('label span').textContent.trim() == '*') {
        throw new SendCvError('CV not found. It required');
    }

    const fileInput = document.querySelector("[data-cy=fileInputField]");

    if (!fileInput) {
        throw new SendCvError('CV input not found');
    }

    const blob = await fetch(cv.url, {method: 'GET'}).then(res => res.blob());

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([blob], cv.originalFilename, {type: blob.type, lastModified: new Date()}));
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', {bubbles: true}));

    await waitForSuccess('div:has([data-cy=fileInputField]) button[aria-label]')

    //StatusMessage('Grab fields...');
    await pause();

    appendStatusMessage('Collecting fields and application questions...');

    await wait(500);
    if (document.querySelector('[data-cy="cover-letter-switch-button"]')?.textContent == 'Write it here instead') {
        document.querySelector('[data-cy="cover-letter-switch-button"]')?.click();
        await wait(500);
    }

    const fields = [...document.querySelectorAll('label')].map((label) => {

        const element = document.getElementById(label.getAttribute('for'))

        if (!element) {
            return null;
        }

        let required = label.querySelector('span')?.textContent.trim() == '*';

        let labelText = label.innerText.trim()

        if (labelText.endsWith('*')) {
            labelText = labelText.slice(0, -1).trim();
        }

        if (element.id.startsWith('input-candidate.cv')) {
            return null;
        }

        if (labelText.startsWith('Phone number')) {
            labelText += ' (with + and country code)'
        }


        if (element.tagName == 'INPUT') {
            if (element.type == 'file') {
                if (required) {
                    throw new SendCvSkipError('Files required: '+labelText)
                }
                return null;
            }

            if (element.type == 'radio' || element.type == 'checkbox') {
                const fieldset = element.closest('fieldset')
                if (!fieldset) {
                    console.warn('radio without fieldset')
                    return null;
                }
                const legend = fieldset.querySelector('legend')
                if (!legend) {
                    console.warn('radio without legend')
                    return null;
                }

                const options = [...fieldset.querySelectorAll('label')].map(option => option.innerText)
                const elements = [...fieldset.querySelectorAll('label')].map(option => document.getElementById(option.getAttribute('for')))

                if (!elements || elements[0] != element) {
                    return null
                }

                labelText = legend.innerText.trim()
                required = legend.querySelector('span')?.textContent.trim() == '*'

                if (labelText.endsWith('*')) {
                    labelText = labelText.slice(0, -1).trim();
                }

                return {
                    element: elements,
                    type: elements[0].type,
                    label: labelText,
                    required,
                    options: options,
                }

            }

            return {
                element: element,
                type: element.type,
                label: labelText,
                required
            }
        } else if (element.tagName == 'TEXTAREA') {
            return {
                element: element,
                type: 'textarea',
                label: labelText,
                required
            }
        }
        console.warn('Unknown field', labelText, element);
        return null;
    }).filter(value => value !== null)

    

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
                scrollToTargetAdjusted(field.element, field.type != 'textarea' ? getHeaderHeight() : 50);
                setNativeValue(field.element, value);

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
    await wait(2000);

    document.querySelectorAll('section[data-cy=segment-legal-agreements]').forEach(section => {
        section.querySelectorAll('input[type=checkbox]').forEach(checkbox => {
            if (!checkbox.checked) checkbox.click()
        })
    })

    if (!devMode) {
        await readyToSubmit();
        await fullPageScreenshot();
        await wait(500);
        scrollToTargetAdjusted(document.querySelector('[data-testid=submit-application-form-button]'), getHeaderHeight());
        await wait(500);
        //StatusMessage('Submit');
        document.querySelector('[data-testid=submit-application-form-button]')?.click()
        await waitForURLUpdate('/applied', 75000)
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

                    if (!document.querySelector('[data-cy=apply-button-nav]') && !document.querySelector('[data-testid=submit-application-form-button]')) {
                        throw new SendCvSkipError('Job not found')
                    }

                    countDown = startCountDownInStatusBlock(60 * 5, () => {
                        chrome.runtime.sendMessage({
                            type: "SEND-CV-TAB-TIMER-ENDED", data: {
                                url: window.location.href
                            }
                        });
                    });

                    successOnURL('/applied');

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