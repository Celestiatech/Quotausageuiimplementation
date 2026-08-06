

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

async function setSearchOption(input, suggester, value) {
    try {
        input.dispatchEvent(new Event('focusin', {bubbles: true}));
        await wait(500);
        setNativeValue(input, value);
        await wait(500);

        for (let t = 0; t < 10; t ++) {
            console.log(suggester)
            const opt = suggester?.querySelector('li');
            console.log('opt', opt);
            if (opt) {
                opt.click();
                return;
            } else {
                const li = document.querySelector('div[data-radix-popper-content-wrapper] li');
                if (li) {
                    li.click();
                    return;
                }
            }
            await wait(500);
        }
        
    } catch (e) {
        console.error('Error setting search option:', e, value);
    }
}

async function prepare(data) {
    const session = data.session;

    if (session.platform == 'GLASSDOOR_BOOKMARKS') {
        location.assign('/member/profile/savedJobActivity');
        return;
    }

    if (location.pathname.endsWith('/index.htm')) {
        await wait(5000);

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

        appendStatusMessage('Login confirmed! Opening the Glassdoor job search filter.');
        await wait(1500);

        if (session.platform == 'GLASSDOOR_SEARCH') {
            await customApplyWait();

            if (!agentStatus.searchDisplayed) {
                try {
                appendStatusMessage(`Saving your job search preferences:

                    Search accuracy: ${session.searchAccuracy}`);
                } catch {}
                agentStatus.searchDisplayed = true;
                await wait(1000);
            }
            return;
        } else {
            chrome.runtime.sendMessage({
                type: "ENABLE-WRONG-RETURN",
            });
        }

        if (!agentStatus.searchDisplayed) {
            appendStatusMessage(`Picking your Profile ${data.profile.num}: ${data.profile.title} for auto-apply.`);
            await wait(2000);
            appendStatusMessage(`Resume AI generator per job is ${data.resumePerJob ? 'ON' : 'OFF'}...`)
            await wait(2000);

            appendStatusMessage(`Looking for jobs based on your search preferences:

                Role: ${session.role}
                Search accuracy: ${session.searchAccuracy}
                Date posted: ${session.datePosted}
                Employment type: ${formatWorkplace(session.workplace)}
                Country: ${session.country || 'Any'}
                City: ${session.city || 'Any'}`);
            
            agentStatus.searchDisplayed = true;
        }

        await waitForSuccess('#searchBar-jobTitle');

        setNativeValue(document.getElementById('searchBar-jobTitle'), session.role);

        const searchParts = []
        if (SEARCH_DATA.city) {
            searchParts.push(SEARCH_DATA.city);
        }
        if (SEARCH_DATA.country) {
            searchParts.push(SEARCH_DATA.country);
        }

        await setSearchOption(document.getElementById('searchBar-location'), document.getElementById('searchBar-location-search-suggestions'), searchParts.join(', '));

        await wait(15000);

    } else {
        if (session.platform == 'GLASSDOOR_SEARCH') {
            await customApplyWait(true);
            if (!agentStatus.searchDisplayed) {
                try {
                appendStatusMessage(`Saving your job search preferences:

                    Search accuracy: ${session.searchAccuracy}`);
                } catch {}
                agentStatus.searchDisplayed = true;
                await wait(1000);
            }
            document.querySelector('[data-test="applicationType"]:not([aria-pressed="true"])')?.click();
            await wait(5000);
            return;
        } else {
            chrome.runtime.sendMessage({
                type: "ENABLE-WRONG-RETURN",
            });
        }

        try {
            await waitForSuccess('[data-test="applicationType"]');
        } catch {
            if (document.querySelector('img[src="/job-search-next/assets/talking-cactus.png"]')) {
                return;
            }
        }
        document.querySelector('[data-test="applicationType"]:not([aria-pressed="true"])')?.click();
        await wait(500);
        if (session.workplace == 'REMOTE') {
            document.querySelector('[data-test="remoteWorkType"]:not([aria-pressed="true"])')?.click();
        } else {
            document.querySelector('[data-test="remoteWorkType"][aria-pressed="true"]')?.click();
        }
        await wait(500);
        if (!SEARCH_DATA.session.datePosted || SEARCH_DATA.session.datePosted == 'Any time') {
            document.querySelector('[data-test="fromAge-clear"]')?.click();
        } else {
            try {
                let wanted = null;
                switch (SEARCH_DATA.session.datePosted) {
                    case 'Past 24 hours':
                        wanted = 1;
                        break;
                    case 'Past week':
                        wanted = 3;
                        break;
                    case 'Past month':
                        wanted = 5;
                        break;
                }
                if (!wanted) {
                    throw new Error('Unknown date posted value: ' + SEARCH_DATA.session.datePosted);
                }
                document.querySelector('[data-test="fromAge"]').click();
                await wait(500);
                await waitForSuccess('[data-test="fromAge-dropdown"]');
                document.querySelectorAll('[data-test="fromAge-dropdown"] li button')[wanted].click();

            } catch (e) {
                console.error('Error clicking fromAge:', e);
            }
        }

        await wait(5000);
    }

}

async function searchNext() {

    let links = [...document.querySelectorAll('[data-test="jobListing"]')];

    for (let i = 0; i < 100000; i++) {
        if (document.querySelector('img[src="/job-search-next/assets/talking-cactus.png"]')) {
            break;
        }

        if (document.querySelector('[data-test="search-title"]') && document.querySelector('[data-test="search-title"]').innerText.split(' ')[0] == '0') {
             await wait(11000);
             if (document.querySelector('[data-test="search-title"]').innerText.split(' ')[0] == '0') {
                break;
             }
        }

        // handle scroll
        if (!links[i]) {
            const moreBtn = document.querySelector('[data-test="load-more"]');
            moreBtn?.click();
            await wait(5000);
            chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}) // do not remove!
            links = [...document.querySelectorAll('[data-test="jobListing"]')];
            if (!links[i]) {
                moreBtn?.click();
                await wait(6000);
                links = [...document.querySelectorAll('[data-test="jobListing"]')];
                if (!links[i]) {
                    break;
                }
            }
        }

        if (links[i].closest('[data-test="related-jobs-list"]')) {
            console.log('SKIP', i, 'RELATED JOBS');
            continue;
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

    

    chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}).then(async value => {

        const {type, data, message} = value;

        switch (type) {
            case 'ERROR':
                
                if (!data?.applyOneEnabled) {
                    return;
                }

                let o = false;

                if (location.search.includes('smart-apply-action=POST_APPLY')) {
                    const v = await chrome.runtime.sendMessage({type: "GET-SEND-CV-TASK"});
                    if (v.type == "SUCCESS") {
                        cvTaskDone();
                        o = document.querySelector('[data-test="job-card-wrapper"][data-selected="true"] [data-test="job-link"]')?.href;
                    }
                }

                while (true) {
                    const href = document.querySelector('[data-test="job-card-wrapper"][data-selected="true"] [data-test="job-link"]')?.href
                    if (href !== o) {
                        startApplyOne(value, true);
                    }
                    o = href;
                    await wait(2000);
                }
                
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
