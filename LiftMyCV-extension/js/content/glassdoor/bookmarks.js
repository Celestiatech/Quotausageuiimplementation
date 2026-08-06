

let processedLinksCount = 0;

const SEARCH_DATA = {
    city: null,
    tabId: null,
    limit: null,
    domain: null,
    current: null,
    country: null,
    submittedLinks: []
};

let sendCvPageNotRespondTimeout;

setInterval(() => document.querySelector('[data-test="job-alert-modal-close"]')?.click(), 1000);

async function prepare(data) {
    const session = data.session;

    appendStatusMessage(`Checking if you're signed in to ${location.hostname} in this browser...`);
    await wait(1500);

    loginAsked = false;

    for (nt = 0; 1; nt ++ ) {
        if (!document.getElementById('SignInButton')) {
            break;
        }
        if (!loginAsked && nt > 5) {
            appendStatusMessage(`You're not signed in to ${location.hostname}. I need your help – please log in so I can continue.`);
            loginAsked = true;
        }
        if (data?.nonstop && nt > 10) {
            throw new NotAuthorizedError();
        }
        await wait(1000);
    }

    appendStatusMessage('Login confirmed!');
    await wait(5000);

    
    chrome.runtime.sendMessage({
        type: "ENABLE-WRONG-RETURN",
    });

}

async function searchNext() {

    let links = [...document.querySelectorAll('[data-test="job-card-wrapper"]')];

    for (let i = 0; i < 100000; i++) {

        // handle scroll
        if (!links[i]) {
            await wait(5000);
            chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}) // do not remove!
            links = [...document.querySelectorAll('[data-test="job-card-wrapper"]')];
            if (!links[i]) {
                await wait(6000);
                links = [...document.querySelectorAll('[data-test="job-card-wrapper"]')];
                if (!links[i]) {
                    break;
                }
            }
        }

        links[i].scrollIntoView();

        if (!links[i].querySelector('[class^="JobCard_easyApplyTag"]')) {
            await wait(500);
            
            console.log('SKIP', i, 'NO EASY APPLY');
            continue;
        }

        const linkEl = links[i].querySelector('[data-test="job-link"]');
        if (!linkEl) {
            links[i].style.background = '#f7bcbc';
            console.log('SKIP', i, 'NO LINK ELEMENT');
            continue;
        }

        const url = linkEl.href;

        let jobListingId;
        try {
            const params = new URL(url).searchParams;
            jobListingId = 'jobListingId=' + params.get('jobListingId');
        } catch {
            console.log('Error parsing URL:', url);
            jobListingId = url;
        }

        if (SEARCH_DATA.submittedLinks.some(link => link.url.includes('glassdoor') && link.url.includes(jobListingId))) {
            links[i].style.background = '#a8f2c0';
            console.log('LINK', url, 'ALREADY VISITED');
            continue;
        }

        if (!processedLinksCount) {
            appendStatusMessage('Found relevant job openings. Starting auto-apply with the first one...');
            await wait(3000);
        }

        const response = await chrome.runtime.sendMessage({
            type: "SEND-CV-TASK",
            data: {
                url: url
            }
        });

        if (response.type === 'ERROR') {
            console.log('ERROR', response);
            links[i].style.background = '#f7bcbc';
            processedLinksCount++;
            continue;
        }

        links[i].style.background = '#ffdd9a';

        console.log('WAIT UNTIL SEND CV TASK WILL BE COMPLETE');

        sendCvPageNotRespondTimeout = setTimeout(() => {
            chrome.runtime.sendMessage({
                type: "SEND-CV-TAB-NOT-RESPOND",
            });
            clearTimeout(sendCvPageNotRespondTimeout);
        }, 60_000 * 8);

        return;

    }

    searchTaskDone();
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {

    console.log('INCOMING MESSAGE', request, sender);

    const {type, data} = request;

    switch (type) {
        case 'SEARCH-NEXT':
            clearTimeout(sendCvPageNotRespondTimeout);
            processedLinksCount++;
            SEARCH_DATA.submittedLinks.push({...data});

            await movingOn(data);

            setTimeout(() => {
                searchNext().catch((reason) => {
                    chrome.runtime.sendMessage({type: "SEARCH-TASK-ERROR", data: errorToString(reason)});
                });
            }, 7000)
            break;

        case 'AGENT-MESSAGE':
            appendStatusMessage(data.message, true);

            break;
    }

});



window.addEventListener('load', () => {

    

    chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}).then(value => {

        

        const {type, data, message} = value;

        switch (type) {
            case 'ERROR':
                
                
                break;
            case 'SUCCESS':
                agentStatus.search = true;
                if (checkWrongReturned(data.agentGeometry)) {
                    return;
                }
                
                warmingUp(data.agentGeometry, data.agentMessages, data.agentMode);

                const {tabId, limit, current, domain, city, country, submittedLinks} = data;

                SEARCH_DATA.city = city;
                SEARCH_DATA.country = country;

                SEARCH_DATA.tabId = tabId;
                SEARCH_DATA.limit = limit;
                SEARCH_DATA.domain = domain;
                SEARCH_DATA.current = current;
                SEARCH_DATA.submittedLinks = submittedLinks;
                SEARCH_DATA.platform = data.session.platform;
                SEARCH_DATA.session = data.session;

                setTimeout(() => {
                    prepare(data).then(() => {
                        searchNext().catch((reason) => {
                            appendStatusMessage(String(reason));
                            setTimeout(() => {
                                chrome.runtime.sendMessage({type: "SEARCH-TASK-ERROR", data: errorToString(reason)});
                            }, 15000)
                        });
                    }).catch((error) => {
                        if (error instanceof NotAuthorizedError) {
                            //StatusMessage('Not authorized');
                            setTimeout(() => {
                                chrome.runtime.sendMessage({type: "NOT-AUTHORIZED-ERROR", data: error.name});
                            }, 3000)
                        } else {
                            appendStatusMessage(String(error));
                            setTimeout(() => {
                                chrome.runtime.sendMessage({type: "SEARCH-TASK-ERROR", data: errorToString(error)});
                            }, 15000)
                        }
                    });
                }, 5)

                break;
        }

    });

});
