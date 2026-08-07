

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

async function setSearchOption(wrapper, value, last=false) {
    try {
        wrapper.querySelector('button')?.click();
        for (let t = 0; t < 50; t ++) {
            if (wrapper.querySelector('input')) { break; }
            wrapper.querySelector('button')?.click();
            await wait(500);
        }

        for (let t = 0; t < 50; t ++) {
            const rm = wrapper.querySelector('.select__multi-value__remove');
            if (!rm) {
                break;
            }
            rm.click();
            await wait(500);
        }

        if (!value) { return; } 
        setNativeValue(wrapper.querySelector('input'), value);
        await wait(500);

        for (let t = 0; t < 10; t ++) {
            let opt;
            if (last) {
                if (document.querySelector('.select__option').innerText.toLowerCase().replace(/[^a-z]/g, '') == value.toLowerCase().replace(/[^a-z]/g, '')) {
                    opt = document.querySelector('.select__option');
                } else {
                    opt = [...document.querySelectorAll('.select__option')].pop();
                }
            } else {
                opt = document.querySelector('.select__option');
            }
            if (opt) {
                opt.click();
                await wait(500);
                return true;
            }
            await wait(500);
        }
        
    } catch (e) {
        console.error('Error setting search option:', e, value);
    }
}

async function prepare(data) {
    await wait(5000);

    appendStatusMessage(`Checking if you're signed in to Wellfound in this browser...`);
    await wait(1500);

    loginAsked = false;

    for (nt = 0; 1; nt ++ ) {
        if (document.querySelector('div[data-test=SearchBar]') || document.querySelector('div[data-test=SavedStartups]')) {
            break;
        }
        if (!loginAsked) {
            appendStatusMessage(`You're not signed in to Wellfound. I need your help – please log in so I can continue.`);
            loginAsked = true;
        }
        if (data?.nonstop && nt > 5) {
            throw new NotAuthorizedError();
        }
        await wait(1000);
    }

    appendStatusMessage('Login confirmed! Opening the Wellfound job search filter.');
    await wait(1500);

    if (document.querySelector('.ReactModal__Overlay')) {
        document.querySelector('.ReactModal__Overlay .right-0.top-0 img')?.click();
        await wait(1500);
    }

    const session = data.session;

    if (session.platform == 'WELLFOUND_SEARCH') {
        await customApplyWait();

        if (!agentStatus.searchDisplayed) {
            try {
            appendStatusMessage(`Saving your job search preferences:

                Search accuracy: ${session.searchAccuracy}
                Date posted: ${session.datePosted}`);
            } catch {}
            agentStatus.searchDisplayed = true;
            await wait(6000);
        }
        return;
    } else {
        chrome.runtime.sendMessage({
            type: "ENABLE-WRONG-RETURN",
        });
    }

    if (session.platform == 'WELLFOUND_BOOKMARKS') {
        return;
    }

    if (!agentStatus.searchDisplayed) {
        appendStatusMessage(`Picking your Profile ${data.profile.num}: ${data.profile.title} for auto-apply.`);
        await wait(2000);
        appendStatusMessage(`Resume AI generator per job is ${data.resumePerJob ? 'not supported on this platform' : 'OFF'}...`)
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

    const searchParts = []
    if (SEARCH_DATA.city) {
        searchParts.push(SEARCH_DATA.city);
    }
    if (SEARCH_DATA.country) {
        searchParts.push(SEARCH_DATA.country);
    }
    if (SEARCH_DATA.country == 'United States' && SEARCH_DATA.city) {
        searchParts.pop();
    }

    await setSearchOption(document.querySelector('div[data-test=RoleSelectWrapper]'), session.role, true);

    try {
        await wait(500);

        document.querySelector('svg[class^=styles_remoteIcon]').parentElement.click();
        await wait(500);
        await waitForSuccess('#RemotePrefereceSelectField-menu');

        switch(session.workplace) {
            case "ANY":
            case "HYBRID":
                document.getElementById('Include remote jobs').click();
                break;
            case "REMOTE":
                document.getElementById('Only remote jobs').click();
                break;
            case "ON_SITE":
                document.getElementById('No remote jobs').click();
                break;
        }

        await wait(500);

        const removeLocation = document.getElementById('RemotePrefereceSelectField-menu').children[1]

        if (session.workplace != 'ON_SITE') {
            if (SEARCH_DATA.country || SEARCH_DATA.city) {
                if (!await setSearchOption(removeLocation, searchParts.join(', '))) {
                    if (searchParts.length > 1) {
                        searchParts.pop();
                        await setSearchOption(removeLocation, searchParts.join(', '));
                    } else {
                        searchParts[0] = searchParts[0].slice(0, -1);
                    }
                }
            } else {
                await setSearchOption(removeLocation, '');
            }
        }

        await wait(500);

        document.querySelector('svg[class^=styles_remoteIcon]').parentElement.click();
        await wait(500);
    } catch (e) {
        console.error('Error set remote:', e);
    }

    if (session.workplace != 'REMOTE') {
        if (SEARCH_DATA.country || SEARCH_DATA.city) {
            if (!await setSearchOption(document.querySelector('div[class^=styles_locationWrapper]'), searchParts.join(', '))) {
                if (searchParts.length > 1) {
                    searchParts.pop();
                } else {
                    searchParts[0] = searchParts[0].slice(0, -1);
                }
                await setSearchOption(document.querySelector('div[class^=styles_locationWrapper]'), searchParts.join(', '));
            }
        } else {
            await setSearchOption(document.querySelector('div[class^=styles_locationWrapper]'), '');
        }
    }

    for (clr of [...document.querySelectorAll('div[data-test="SearchBar"] button[aria-label^="Clear"]')]) {
        clr.click();
        await wait(500);
    }

    await wait(3000);

    
    /*
    const remote = document.querySelector('button[aria-label="Clear Distributed teams"]');
    if (session.workplace != 'REMOTE' && remote) {
        remote?.click();
        await wait(1500);
    }

    if (session.workplace == 'REMOTE' && !remote) {
        document.querySelector('[data-test="SearchBar-ToggleFilterControlPanelButton"]')?.click();
        await wait(1500);
        document.getElementById('mostlyOrFullyRemote').checked || document.getElementById('mostlyOrFullyRemote').click();
        await wait(1500);
        document.querySelector('[data-test="SearchBar-ViewResultsButton"]')?.click();
        await wait(500);
    }
    */


}

async function searchNext() {

    let links = [...document.querySelectorAll('div[data-test="StartupResult"] a[href^="/jobs"]')];

    for (let i = 0; i < 100000; i++) {
        // handle infinite scroll
        if (!links[i]) {
            await wait(5000);
            chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}) // do not remove!
            links = [...document.querySelectorAll('div[data-test="StartupResult"] a[href^="/jobs"]')];
            if (!links[i]) {
                await wait(6000);
                links = [...document.querySelectorAll('div[data-test="StartupResult"] a[href^="/jobs"]')];
                if (!links[i]) {
                    break;
                }
            }
        }

        if (document.querySelector('h4')?.innerText == '0 results') {
            break;
        }

        links[i].scrollIntoView();

        const linkEl = links[i];
        const url = normalizeUrl(linkEl.href);

        if (SEARCH_DATA.submittedLinks.some(link => link.url === url || url.includes(link.url))) {
            links[i].style.background = '#a8f2c0';
            console.log('LINK', url, 'ALREADY VISITED');
            continue;
        }

        /*
        if (SEARCH_DATA.session.workplace == 'ON_SITE' && linkEl.innerText.includes('Remote only')) {
            continue;
        }
        */

        try {
            let days = -1;
            let posted = linkEl.querySelector('div[class^=styles_tags]').innerText.split('POSTED')[1].trim().toLowerCase();
            if (posted.startsWith('today')) {
                days = 0;
            }
            if (posted.startsWith('yesterday')) {
                days = 1;
            }
            if (days < 0) {
                const postedArr = posted.split('ago')[0].trim().split(' ');
                const dateUnit = postedArr.pop();
                const dateValue = Number(postedArr[0])
                switch (dateUnit) {
                    case 'day':
                    case 'days':
                        days = dateValue;
                        break;
                    case 'week':
                    case 'weeks':
                        days = dateValue * 7;
                        break;
                    case 'month':
                    case 'months':
                        days = dateValue * 30;
                        break;
                }
            }
            let wantedDays = -1;
            switch (SEARCH_DATA.session.datePosted) {
                case 'Past 24 hours':
                    wantedDays = 1;
                    break;
                case 'Past week':
                    wantedDays = 7;
                    break;
                case 'Past month':
                    wantedDays = 30;
                    break;
            }
            if (wantedDays > 0 && SEARCH_DATA.session.platform != 'WELLFOUND_BOOKMARKS') {
                if (days < 0) {
                    console.error('Could not parse date for link:', url, 'Posted:', posted);
                    continue;
                }
                if (days > wantedDays) {
                    console.info('Link is older than wanted date:', url, 'Posted:', posted, 'Wanted:', SEARCH_DATA.session.datePosted);
                    continue;
                }
            }
        } catch (e) {
            console.error('Error processing date:', e, links[i]);
            continue;
        }

        if (!processedLinksCount) {
            appendStatusMessage('Found relevant job openings. Starting auto-apply with the first one...');
            await wait(3000);
        }

        try {
                clearInterval(agentStatus.intervalId);
        } catch {}
        let se = Math.round(10 + (Math.random() * 20));
        startCountDownInStatusBlock(se);
        await wait(se * 1000);

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

        //StatusMessage('Link found: ' + url);

        //StatusMessage('Wait for send cv task result');

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
                while (true) {
                    const href = location.href;
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
