

let countDown;

const SKIP_WORDS = ['Diversity', 'diversity', 'DIVERSITY', 'Survey', 'survey', 'SURVEY'];

let localAnswersCache = null;
let localAnswersCacheTs = 0;

function normalizeAnswerKey(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[\t\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function getLocalAnswers() {
    const now = Date.now();
    if (localAnswersCache && now - localAnswersCacheTs < 15000) return localAnswersCache;
    let settings = {};
    try {
        const res = await chrome.runtime.sendMessage({type: "CP_LOAD_SETTINGS"});
        if (res && res.ok && res.settings && typeof res.settings === 'object') {
            settings = res.settings;
        }
    } catch (e) {
        console.error('getLocalAnswers:', e);
    }
    localAnswersCache = settings;
    localAnswersCacheTs = now;
    return settings;
}

function findSavedAnswer(settings, ...keys) {
    const sa = (settings && settings.screeningAnswers && typeof settings.screeningAnswers === 'object') ? settings.screeningAnswers : {};
    const candidates = [];
    for (const key of keys) {
        candidates.push(key);
        candidates.push(normalizeAnswerKey(key));
    }
    for (const candidate of candidates) {
        const direct = sa[candidate];
        if (direct !== undefined && direct !== null && String(direct).trim() !== '') return String(direct).trim();
    }
    for (const [k, v] of Object.entries(sa)) {
        if (!v || String(v).trim() === '') continue;
        for (const key of keys) {
            if (normalizeAnswerKey(k) === normalizeAnswerKey(key)) return String(v).trim();
        }
    }
    return '';
}

function parseNumeric(value) {
    const cleaned = String(value || '').replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

function toLpaString(value) {
    const num = parseNumeric(value);
    if (num === null) return '';
    const lpa = num >= 100000 ? num / 100000 : num;
    return String(Math.round(lpa * 10) / 10);
}

function matchOption(options, value) {
    const list = Array.isArray(options) ? options : [];
    if (!list.length) return '';
    const valueNorm = normalizeAnswerKey(value);
    const num = parseNumeric(value);

    let exact = list.find(o => normalizeAnswerKey(o) === valueNorm);
    if (exact) return exact;

    if (num !== null) {
        for (const o of list) {
            const nums = String(o || '').match(/\d+(\.\d+)?/g);
            if (!nums || !nums.length) continue;
            const parsed = nums.map(Number);
            if (parsed.length >= 2) {
                const lo = Math.min(...parsed);
                const hi = Math.max(...parsed);
                if (num >= lo && num <= hi) return o;
            } else if (parsed.length === 1) {
                if (Math.abs(parsed[0] - num) <= 0.01) return o;
            }
        }
    }

    let contains = list.find(o => valueNorm && normalizeAnswerKey(o).includes(valueNorm));
    if (contains) return contains;
    contains = list.find(o => valueNorm && valueNorm.includes(normalizeAnswerKey(o)) && normalizeAnswerKey(o).length > 2);
    return contains || '';
}

function resolveLocalAnswer(field, settings) {
    const label = normalizeAnswerKey(field.label || '');
    if (!label) return '';

    if (label.includes('english')) {
        const eng = findSavedAnswer(settings, 'english_proficiency', 'English Proficiency', 'What is your English Proficiency?', 'englishProficiency');
        if (eng) {
            const e = normalizeAnswerKey(eng);
            if (/professional|advanced|fluent|native/.test(e)) return 'Fluent/Native-like or Advanced';
            if (/intermediate|beginner|basic/.test(e)) return 'Intermediate or Beginner';
            return eng;
        }
    }

    const isSalary = /salary|ctc|compensation|lpa|\bpay\b/.test(label);
    if (isSalary) {
        const isCurrent = /current|existing|present/.test(label);
        const isExpected = /expected|minimum|min|desired|target|asking/.test(label);
        let raw = '';
        if (isCurrent) {
            raw = findSavedAnswer(settings, 'what_is_your_current_ctc', 'What is your Current CTC?', 'What is your current salary?', 'current_ctc', 'currentCtc', 'Current CTC', 'current salary', 'current_salary');
        }
        if (isExpected) {
            raw = findSavedAnswer(settings, 'what_is_your_expected_ctc', 'What is your Expected CTC?', 'What is your Expected Salary?', 'expected_ctc', 'expectedCtc', 'Expected CTC', 'Desired Salary', 'desired_salary', 'expected_salary');
        }
        if (raw) {
            const lpa = toLpaString(raw);
            if (lpa) {
                if (Array.isArray(field.options) && field.options.length) {
                    const matched = matchOption(field.options, lpa);
                    if (matched) return matched;
                }
                return lpa;
            }
        }
    }

    if (label.includes('start date') || label.includes('available to start') || label.includes('earliest start')) {
        const notice = findSavedAnswer(settings, 'what_is_your_notice_period', 'What Is Your Notice Period', 'What is your Notice Period?', 'notice_period_days', 'noticePeriodDays', 'notice period', 'Notice Period');
        const days = parseNumeric(notice);
        if (days !== null) {
            const option = days <= 0 ? 'I am available immediately' : days <= 30 ? 'In 30 days' : days <= 45 ? 'In 45 days' : 'More than 45 days';
            if (Array.isArray(field.options) && field.options.length) {
                const matched = matchOption(field.options, option);
                if (matched) return matched;
            }
            return option;
        }
    }

    if (label.includes('notice') && label.includes('period')) {
        const notice = findSavedAnswer(settings, 'what_is_your_notice_period', 'What Is Your Notice Period', 'What is your Notice Period?', 'notice_period_days', 'noticePeriodDays', 'notice period', 'Notice Period');
        const days = parseNumeric(notice);
        if (days !== null) {
            const asText = days <= 0 ? '0' : String(days);
            if (Array.isArray(field.options) && field.options.length) {
                const matched = matchOption(field.options, asText);
                if (matched) return matched;
            }
            return asText;
        }
    }

    if (label.includes('experience')) {
        const techs = ['golang', 'go', 'python', 'react', 'node', 'java', 'javascript', 'typescript', 'aws', 'sql', 'docker', 'kubernetes', 'system design', 'ai', 'api', 'graphql'];
        for (const tech of techs) {
            if (label.includes(tech)) {
                const saved = findSavedAnswer(
                    settings,
                    `what_is_your_experience_with_${tech.replace(/[^a-z]/g, '')}`,
                    `What is your experience with ${tech}?`,
                    `What is your experience with ${tech}`,
                    `experience with ${tech}`,
                    `${tech} experience`
                );
                if (saved) {
                    if (Array.isArray(field.options) && field.options.length) {
                        const matched = matchOption(field.options, saved);
                        if (matched) return matched;
                    }
                    return String(saved).trim();
                }
            }
        }
    }

    if (label.includes('acknowledge') || label.includes('read and understand') || label.includes('confirm')) {
        if (Array.isArray(field.options) && field.options.length) {
            const yes = field.options.find(o => normalizeAnswerKey(o) === 'yes') || field.options.find(o => /^yes$/i.test(o));
            if (yes) return yes;
        }
        return 'Yes';
    }

    if (label.includes('negotiation')) {
        const saved = findSavedAnswer(settings, 'open to negotiation', 'open_to_negotiation', 'negotiable');
        if (saved) {
            if (Array.isArray(field.options) && field.options.length) {
                const matched = matchOption(field.options, saved);
                if (matched) return matched;
            }
            return String(saved).trim();
        }
        return '';
    }

    return '';
}

function isLocalAnswerable(field) {
    const label = normalizeAnswerKey(field.label || '');
    if (!label) return false;
    return (
        label.includes('english') ||
        /salary|ctc|compensation|lpa|\bpay\b/.test(label) ||
        label.includes('start date') ||
        (label.includes('notice') && label.includes('period')) ||
        label.includes('experience') ||
        label.includes('acknowledge') ||
        label.includes('read and understand') ||
        label.includes('confirm') ||
        label.includes('negotiation')
    );
}

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
    const localSettings = await getLocalAnswers();
    while (fieldNum < fields.length) {
        field = fields[fieldNum];

        try {

            let value = null;
            let completed = false;

            if (isLocalAnswerable(field)) {
                value = resolveLocalAnswer(field, localSettings);
                if (value) {
                    completed = true;
                    console.log('Lever local answer applied:', field.label, value);
                }
            }

            if (!value) {
                const result = await getFieldValueByFieldName(field.label);
                value = result.value;
                completed = result.completed;
            }


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