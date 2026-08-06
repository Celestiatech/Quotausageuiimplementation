

let countDown;


async function grabFields() {
    const results = [];
    for (const label of [...document.querySelectorAll('div[data-test="JobApplication-Modal"] form label.block')]) {

        const result = {
            element: null,
            type: '',
            label: label.firstChild.innerText.trim(),
            required: false
        };

        if (result.label.endsWith('*')) {
            result.label = result.label.slice(0, -1).trim();
            result.required = true;
        }

        if (result.label.startsWith('What interests you about working')) {
            result.label = 'Cover letter - ' + result.label;
        }

        const container = label.children[1];
        if (!container) { continue; }

        if (container.querySelector('input[type=radio]')) {
            result.type = 'radio';
            result.element = [...container.querySelectorAll('input[type=radio]')];
            result.options = result.element.map(input => input.parentElement.querySelector('label').innerText);
        } else if (label.querySelector('input[type=checkbox]')) {
            result.type = 'checkbox';
            result.element = [...label.querySelectorAll('input[type=checkbox]')];
            result.options = result.element.map(input => input.parentElement.querySelector('label').innerText);
        } else if (container.querySelector('.select__control')) {
            result.type = 'select';
            result.element = container.querySelector('.select__control');
            if (!container.querySelector('.select__menu .select__option')) {
                result.element.querySelector('input').dispatchEvent(new Event('mousedown', {bubbles: true}));
                result.element.querySelector('input').dispatchEvent(new Event('focusin', {bubbles: true}));
                await wait(1000);
            }

            result.options = [ ...container.querySelectorAll('.select__menu .select__option') ].map(input => input.innerText.trim());
            result.element.querySelector('input').dispatchEvent(new Event('focusout', {bubbles: true}));
        } else {
            result.element = container.firstChild;
            result.type = result.element.type;
        }

        
        if (result.element && result.type) {
            results.push(result);
        }

    }


    const cover = document.getElementById('form-input--userNote');
    if (cover) {
        results.push({
            element: cover,
            type: cover.type,
            label: 'Cover letter - ' + cover.placeholder,
            required: true
        });
    }

    return results;
}

function scrollToElement(container, element) {
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const offset = elementRect.top - containerRect.top;
  
    container.scrollTop += offset;

    const scrollEvent = new Event('scroll', {
        bubbles: true,
        cancelable: true,
    });
    
    container.dispatchEvent(scrollEvent);
};

async function uploadCv() {
    await pause();
    const fileInput = document.querySelector('div[data-test="JobApplication-Modal"] form input[type=file]');
    if (fileInput) {
        const cv = await getResume(data);
        appendStatusMessage('Uploading your CV. Please hang on...');
        await uploadFile(cv.url, cv.originalFilename, fileInput);
    }

}

async function fillFields(fields) {
    let fieldNum = 0;
    let field;
    while (fieldNum < fields.length) {
        field = fields[fieldNum];
        

        try {
            scrollToElement(document.querySelector('.ReactModal__Content'), field.element);
        } catch {}

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
                if (field.required && Array.isArray(field.element) && field.element[0]) {
                    field.element[0].click()
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
                if (!Array.isArray(value)) {
                    value = [value]
                }
                for (let ne = 0; ne < field.element.length; ne++) {
                    const el = field.element[ne];
                    if (value.includes(el.id && el.parentElement.querySelector('label').innerText || el.value)) {
                        el.click();
                        await wait(500);
                    }
                }
            } else if (field.type === 'select') {
                if (Array.isArray(value)) {
                    value = value[0];
                }
                if (agentStatus.resumed && field.element.querySelector('.select__value-container--has-value')) {
                    console.log('filled by user')
                    continue;
                }

                const container = field.element.parentElement;
                if (!container.querySelector('.select__menu .select__option')) {
                    field.element.querySelector('input').dispatchEvent(new Event('mousedown', {bubbles: true}));
                    field.element.querySelector('input').dispatchEvent(new Event('focusin', {bubbles: true}));
                    await wait(1000);
                }

                [...container.querySelectorAll('.select__menu .select__option')].forEach((el) => {
                    if (el.innerText.trim() === value) {
                        el.click();
                    }
                });

                await wait(1000);
                field.element.querySelector('input').dispatchEvent(new Event('focusout', {bubbles: true}));
            } else {
                if (Array.isArray(value)) {
                    value = value[0];
                }
                if (agentStatus.resumed && field.element.value) {
                    console.log('filled by user')
                    continue;
                }
                setNativeValue(field.element, value);
                if (field.type == 'textarea') {
                    await wait(100);
                    textareaGrow();
                }
            }

        } catch (e) {
            console.error(e);
            sendErrorToServerFromPage(e);
        }

        await wait(1000);

    }

}


async function apply(data) {

    const {devMode, profile} = data;

    try {
        await waitForSuccess('button[class*=styles_applyButton]:not([disabled])');
    } catch {
        console.log('No apply button');
        throw new SendCvSkipError('Easy apply button not found');
    }

    document.querySelector('button[class*=styles_applyButton]')?.click();

    try {
        await waitForSuccess('div[data-test="JobApplication-Modal"]');
    } catch {
        console.log('No modal');
        throw new SendCvSkipError('Apply button is external link, skipped');
    }

    try {
        await waitForSuccess('button[data-test=JobApplicationModal--SubmitButton]', 3000);
    } catch {
        console.log('No submit button');
        throw new SendCvSkipError('Apply button is external link, skipped');
    }

    if (document.querySelector('button[data-test=JobApplicationModal--SubmitButton]')?.disabled) {
        if (!agentStatus.isApplyOne) {
            await wait(3000);
            throw new SendCvSkipError('Submit button disabled');
        }
    }

    company = document.title.split(' • ')[0].split(' at ') [1];
    role = document.title.split(' • ')[0].split(' at ') [0];
    description = document.querySelector('div[class^=styles_description]')?.innerHTML;

    await setHistoryDetails({company, role, description});

    await wait(2000);
    await pause();

    await uploadCv();

    appendStatusMessage('Collecting fields and application questions...');

    const fields = await grabFields();

    await wait(1000);
    await pause();

    successOnSelectorAndSubString('button[class*=styles_applyButton][disabled]', 'Applied');

    streamVacancyFields(fields);
    await wait(2000);


    await fillFields(fields);

    if (!devMode) {
        await readyToSubmit();
        await linkedinModalScreenshot();
        document.querySelector('button[data-test=JobApplicationModal--SubmitButton]')?.click();
        await waitForSuccess('button[class*=styles_applyButton][disabled]');
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
