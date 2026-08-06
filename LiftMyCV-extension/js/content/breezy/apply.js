

let countDown;

function getHeaderHeight() {
    return (document.querySelector('.header')?.clientHeight || 10) * 2;
}

async function apply(data) {

    //StatusMessage('Apply');

    const {devMode, session: {city, country, workplace}} = data;

    try {
        await waitForClickableButton('button[ng-disabled$="isSubmitting"]', 2000)
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

    if ((!cv || !cv.url) && document.getElementById('main-attachment').required) {
        throw new SendCvError('CV not found. It required');
    }

    const fileInput = document.getElementById('main-attachment');

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

    const labelCounts = {}

    const fields = [...document.querySelectorAll('input[type=text], input[type=email], select, textarea, ul:has(input[type=radio]), ul:has(input[type=checkbox])')].map((element) => {

        let label = element;
        let required = !!element.required;
        while(label) {
            label = label.previousElementSibling || label.parentElement;
            if (label?.tagName == 'LI' && label?.hasAttribute('ng-repeat')) {
                return null;
            }
            if (label?.tagName == 'H3' || label?.className.includes('section-header')) {
                if (label.querySelector('.required')) {
                    required = true;
                }
                break;
            }
        }

        if (!label) {
            console.warn('no label', element);
            element.querySelectorAll('input[type=checkbox][required]').forEach(checkbox => {
                if (!checkbox.checked) {
                    checkbox.click();
                }
            });
            return null;
        }

        let labelText = label.querySelector('span h2')?.innerText.trim() || label.innerText.trim();

        if (!labelCounts[labelText]) {
            labelCounts[labelText] = 1;
        } else {
            labelCounts[labelText] ++;
        }

        if (labelCounts[labelText] > 1) {
            labelText += ' ' + labelCounts[labelText]
        }


        if (element.tagName == 'INPUT') {
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
        } else if (element.tagName == 'SELECT') {
            const select = element;
            return {
                element: select,
                type: 'select',
                label: labelText,
                required,
                options: [...select.querySelectorAll('option')].filter(option => !!option.textContent).map(option => option.value)
            }
        } else if (element.tagName == 'UL') {

            
            const options = [...element.querySelectorAll('li span, li strong')].map(option => option.innerText)
            const elements = [...element.querySelectorAll('li input')]

            if (!elements || elements.length < 2) {
                console.log('ignore', element)
                return null
            }

            if (elements[0].required || element.querySelector('li strong')) {
                required = true;
            }

            return {
                element: elements,
                type: elements[0].type,
                label: labelText,
                required,
                options: options,
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
                scrollToTargetAdjusted(field.element, getHeaderHeight());
                setNativeValue(field.element, value);
                if (field.type == 'select') {
                    field.element.dispatchEvent(new Event('change', {bubbles: true}));
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

    document.querySelectorAll('.gdpr-accept input[type=checkbox][required]').forEach(checkbox => {
        if (!checkbox.checked) {
            checkbox.click();
        }
    });

    if (!devMode) {
        await readyToSubmit();
        await fullPageScreenshot();
        document.querySelector('button[ng-disabled$="isSubmitting"]').click()
    }

    await wait(5000);

    const errorMessage = document.querySelector('[ng-if="errorMessage"]')?.innerText;

    if (errorMessage) {

        if (errorMessage == "It looks like maybe you've already applied to this job?") {
            //StatusMessage('Already applied');
            cvTaskDone();
            return;
        } else {
            await fillingErrors(errorMessage);
        }
    }  else {
        //StatusMessage('Done');
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

                    if (window.location.pathname.includes('/submitted')) {
                        cvTaskDone();
                        return;
                    }


                    if (!window.location.pathname.endsWith('/apply')) {
                        const button = document.querySelector('.actions a.apply') || document.querySelector('.apply-container .apply-button a');
                        if (button) {

                            const {devMode, profile: {cv}, session: {city, country, workplace}} = data;

                            const jobWorkplace = document.querySelector('i[class="fa fa-wifi"]') ? 'remote': 'hybrid'
    
                            if (workplace !== 'ANY' && !jobWorkplace.trim().toLowerCase().includes(workplace.toLowerCase().replace('_', '-'))) {
                                throw new SendCvSkipError('Wrong workplace type');
                            }

                            if (country || city) {

                                let found = false;
                                for (loc of document.querySelector('li[class=location] span, .location span')?.innerText.split('|')) {
                                    const {cities, countries} = await parseCountriesAndCities(loc.trim());

                                    if (country && (!countries.length || !countries.includes(country))) {
                                        continue;
                                    }

                                    if (city && (!cities.length || !cities.includes(city))) {
                                        continue;
                                    }

                                    found = true;
                                }

                                if (!found) {
                                    throw new SendCvSkipError('Wrong country city');
                                }

                            }

                            company = document.querySelector('.header .brand img')?.alt || document.querySelector('.header .brand')?.innerText.trim() || document.querySelector('.company-name')?.innerText.trim()
                            role = document.querySelector('.banner h1')?.innerText || document.title

                            description = '';
                            try {
                                description = document.querySelector('.description')?.innerHTML.trim();
                            } catch {}

                            // Parse location
                            let location = null;
                            try {
                                location = document.querySelector('li[class=location] span, .location span')?.innerText.trim();
                            } catch {}

                            // Parse workplaceType (breezy uses icon check)
                            let workplaceType = null;
                            try {
                                const jobWorkplace = document.querySelector('i[class="fa fa-wifi"]') ? 'remote': 'hybrid';
                                if (jobWorkplace === 'remote') {
                                    workplaceType = 'REMOTE';
                                } else if (jobWorkplace === 'hybrid') {
                                    workplaceType = 'HYBRID';
                                }
                            } catch {}

                            // Parse logoUrl
                            let logoUrl = null;
                            try {
                                const ogImage = document.querySelector('meta[property="og:image"]')?.content;
                                if (ogImage && ogImage.startsWith('http')) {
                                    logoUrl = ogImage;
                                } else {
                                    const imgElement = document.querySelector('.header .brand img');
                                    if (imgElement && imgElement.src && imgElement.src.startsWith('http')) {
                                        logoUrl = imgElement.src;
                                    }
                                }
                            } catch {}

                            await setHistoryDetails({company, role, description, location, workplaceType, logoUrl});

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