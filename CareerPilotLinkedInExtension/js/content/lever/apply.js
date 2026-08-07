

let countDown;

const SKIP_WORDS = ['Diversity', 'diversity', 'DIVERSITY', 'Survey', 'survey', 'SURVEY'];

function getHeaderHeight() {
    return document.querySelector('.main-header').clientHeight;
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

async function apply(data) {

    document.querySelector('.momentum-body .cc-dismiss')?.click();
    //StatusMessage('Apply');

    const {devMode, session: {city, country, workplace}} = data;

    if (!data.successfulSubmissions && !data.failedSubmissions) {
        appendStatusMessage('Found relevant job openings. Starting auto-apply with the first one...');
        await wait(3000);
    }

    cv = await getResume(data);

    await pause();
    appendStatusMessage('Uploading your CV. Please hang on...');

    if ((!cv || !cv.url) && document.querySelector('.application-question.resume .application-label .required') !== null) {
        throw new SendCvError('CV not found. It required');
    }

    const fileInput = document.getElementById('resume-upload-input');

    if (!fileInput) {
        throw new SendCvError('CV input not found');
    }

    const blob = await fetch(cv.url, {method: 'GET'}).then(res => res.blob());

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([blob], cv.originalFilename, {type: blob.type, lastModified: new Date()}));
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', {bubbles: true}));

    await new Promise(resolve => {
        const check = setInterval(() => {
            console.log('check cv loading end')
            //StatusMessage('CV uploading...');
            if (document.querySelector('.resume-upload-success')?.style?.display === 'inline') {
                console.log('check cv loading end', 'DONE')
                //StatusMessage('CV uploading done');
                clearInterval(check);
                resolve();
            }
        }, 5000);
    });

    await pause();

    appendStatusMessage('Collecting fields and application questions...');

    const fields = [...document.querySelectorAll('.application-form')].flatMap((form) => {

        const formText = form.innerText;

        if (SKIP_WORDS.some(skipWord => formText.includes(skipWord))) {
            console.log('skip form: contains skip word(s)')
            return null;
        }

        return [...form.querySelectorAll('.application-question .application-label')].map((value) => {

            const required = value.querySelector('.required') !== null;

            const labelText = value.innerText.replace('\n✱', '').replaceAll('"', '\'');

            if (labelText.includes('Resume/CV') || labelText.trim().startsWith('LinkedIn profile')) {
                return null;
            }

            const question = value.closest('.application-question');

            const field = question.querySelector('.application-field');

            if (field.querySelector('& > input')) {
                return {
                    element: field.querySelector('& > input'),
                    type: field.querySelector('& > input').type,
                    label: labelText,
                    required
                }
            } else if (field.querySelector('& > textarea')) {
                return {
                    element: field.querySelector('& > textarea'),
                    type: 'textarea',
                    label: labelText,
                    required
                }
            } else if (field.querySelector('.application-dropdown select')) {
                const select = field.querySelector('.application-dropdown select');
                return {
                    element: select,
                    type: 'select',
                    label: labelText,
                    required,
                    options: [...select.querySelectorAll('option')].filter(option => option.value.length > 0).map(option => option.innerText),
                }
            } else if (field.querySelector('& > ul')) {
                const elements = [...field.querySelectorAll('& > ul input')];
                return {
                    element: elements,
                    type: elements[0].type,
                    label: labelText,
                    required,
                    options: elements.map(input => input.value).filter(value => value.length > 0),
                }
            }
            console.warn('Unknown field', labelText, question, field);
            return null;
        }).filter(value => value !== null)

    }).filter(value => value !== null);

    if (fields.length <= 0) {
        throw new SendCvError('Fields not found');
    }

    fields.push({
        element: document.getElementById('additional-information'),
        type: 'textarea',
        label: 'Add a cover letter or anything else you want to share.',
        required: false,
    });

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
                    if (!el.checked && value.includes(el.value)) {
                        el.click();
                        await wait(500);
                    } else {
                        if (el.type == 'checkbox' && el.checked && !value.includes(el.value)) {
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
                scrollToTargetAdjusted(field.element, getHeaderHeight());
                try {
                    if (field.type == 'select') {
                        const opt = [...field.element.querySelectorAll('option')].filter(option => option.innerText == value)[0];
                        if (opt && opt.value) {
                            value = opt.value;
                        }
                    }
                } catch {} 
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

    document.querySelectorAll('.consent-required').forEach((itm) => (itm.click()));

    if (!devMode) {
        await readyToSubmit();
        await fullPageScreenshot();
        //StatusMessage('Submit');
        await waitForClickableButton('#btn-submit')
        document.getElementById('btn-submit').click();
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, 6000)
        });
    }

    //StatusMessage('Done');

    /*
    setTimeout(() => {
        chrome.runtime.sendMessage({
            type: "SEND-CV-TAB-DONE-AND-HANG", data: {
                url: window.location.href,
                lastError: chrome.runtime.lastError
            }
        });
    }, 30_000);
    */

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

                    if (document.body.innerText.includes('Cannot GET') || document.body.innerText.includes('Sorry, we couldn\'t')) {
                        throw new SendCvSkipError('Job not found')
                    }

                    if (window.location.pathname.split('/').length < 3) {
                        throw new SendCvSkipError('Not job url')
                    }

                    if (window.location.pathname.includes('/thanks')) {
                        await waitForSuccess('h3[data-qa="msg-submit-success"]');
                        cvTaskDone();
                        return;
                    }

                    if (window.location.pathname.includes('/already-received')) {
                        cvTaskDone();
                        return;
                    }

                    if (!window.location.pathname.endsWith('/apply')) {
                        const button = document.querySelector('.posting-header a.template-btn-submit');
                        if (button) {

                            const {devMode, profile: {cv}, session: {city, country, workplace}} = data;

                            if (workplace !== 'ANY' && !document.querySelector('.workplaceTypes').innerText.trim().toLowerCase().includes(workplace.toLowerCase().replace('_', '-'))) {
                                throw new SendCvSkipError('Wrong workplace type');
                            }

                            if (country || city) {

                                const {cities, countries} = await parseCountriesAndCities(document.querySelector('.location').innerText.trim());

                                if (country && (!countries.length || !countries.includes(country))) {
                                    throw new SendCvSkipError('Wrong country');
                                }

                                if (city && (!cities.length || !cities.includes(city))) {
                                    throw new SendCvSkipError('Wrong city');
                                }

                            }

                            company = document.querySelector('.main-header-logo img')?.alt?.replace(/ logo$/, "") || document.querySelector('.main-header-logo')?.innerText.trim() || document.title.split(' - ')[0]
                            role = document.querySelector('.posting-headline h2')?.innerText

                            description = '';
                            try {
                                description = document.querySelector('[data-qa=job-description')?.parentElement.innerHTML.trim();
                            } catch {}

                            // Parse location
                            let location = null;
                            try {
                                location = document.querySelector('.location')?.innerText.trim();
                            } catch {}

                            // Parse workplaceType from .workplaceTypes element
                            let workplaceType = null;
                            try {
                                const workplaceText = document.querySelector('.workplaceTypes')?.innerText.trim().toLowerCase() || '';
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
                                    const imgElement = document.querySelector('.main-header-logo img');
                                    if (imgElement && imgElement.src && imgElement.src.startsWith('http')) {
                                        logoUrl = imgElement.src;
                                    }
                                }
                            } catch {}

                            await setHistoryDetails({company, role, description, location, workplaceType, logoUrl});

                            await wait(Math.round(2000 + (Math.random() * 1000)));
                            button.click();
                            await new Promise((resolve, reject) => {
                                setTimeout(() => {
                                    resolve();
                                }, 15000)
                            });
                            throw new SendCvSkipError('a timeout')
                        } else {
                            throw new SendCvSkipError('Job not found')
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

                    await new Promise((resolve, reject) => {
                        setTimeout(() => {
                            resolve();
                        }, 15000)
                    });

                    try {
                        const form = document.querySelector('#application-form');
                        const invalidFields = [...form.elements].filter(field => !field.checkValidity());

                        const errorsList = invalidFields
                            .map(field => `Field "${field.name || field.id || 'Unknown field'}": ${field.validationMessage}`)
                            .join('\n');

                        console.log(errorsList);
                        
                        if (errorsList.trim()) {
                            await fillingErrors(errorsList);
                            break;
                        }

                    } catch {}

                    if (isAnyIframeVisible()) {
                        await challengeFound();
                        document.getElementById('btn-submit')?.click();
                    } else {
                        //StatusMessage('Waiting up to 125 seconds...');

                        await new Promise((resolve, reject) => {
                            setTimeout(() => {
                                resolve();
                            }, 125000)
                        });

                        cvTaskDone();
                    }

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