

// LIKE TS
/*const SUBMITTED_LINK = {
    url: '',
    status: '',
    details: '',
    triesCount: 0,
};*/

const MAX_TRIES = 2;

const SEARCH_DATA = {
    tabId: null,
    limit: null,
    domain: null,
    current: null,
    submittedLinks: [],
    searchLinkPattern: null
};

let processedLinksCount = 0;

let sendCvPageNotRespondTimeout;

function findAllLinksElements() {
    const domains = Array.isArray(SEARCH_DATA.domain) ? SEARCH_DATA.domain : [SEARCH_DATA.domain];
    if (domains.some(url => extractWildcardAndDomain(url) !== null)) {
        const allLinks = [
            ...document.querySelectorAll('#rso span > a'),
            ...document.querySelectorAll('#botstuff span > a')
        ];
        
        return allLinks.filter(link => 
            domains.some(domain => {
                const extracted = extractWildcardAndDomain(domain);
                return new URL(link.href).hostname.endsWith(extracted ? extracted.domain : domain);
            })
        );

    } else {
        return [
            ...document.querySelectorAll(domains.map(domain => `#rso span > a[href^='${domain}']`).join(',')),
            ...document.querySelectorAll( domains.map(domain => `#botstuff span > a[href^='${domain}']`).join(','))
        ];
    }
}

function findLoadMoreElement() {
    if (document.getElementById('pnprev') && !document.getElementById('pnnext')) {
        return null;
    }

    const links = [...document.querySelectorAll("#botstuff table a[href^='/search?q=site:']")];
    return links[links.length - 1];
}

function markLinkAsColor(linkEl, color) {
    if (!linkEl) {
        return;
    }
    const linkWrapperEl = linkEl.closest('div[jscontroller]');
    if (linkWrapperEl) {
        linkWrapperEl.style.border=`2px ${color} solid`;
    }
}

async function searchNext() {

    //StatusMessage('Search link');

    let links = findAllLinksElements();

    console.log('links', links)

    if (links.length <= processedLinksCount) {
        console.log('load more links')

        links[links.length - 1]?.scrollIntoView();

        const loadMore = findLoadMoreElement();
        if (loadMore) {
            appendStatusMessage('Done with this page! Moving on to the next one...');
            let se = Math.round(1 + (Math.random() * 2));
            startCountDownInStatusBlock(se);
            await wait(se * 1000);
            loadMore?.click();
            chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}) // do not remove!
    
            await new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, 2000);
            });
    
            links = findAllLinksElements();
        }
    }

    let forStopped = false;
    let haveVisited = false;
    for (let i = 0; i < links.length; i++) {

        let url = normalizeUrl(links[i].href);

        scrollToTargetAdjusted(links[i], 72);

        if (SEARCH_DATA.searchLinkPattern && !SEARCH_DATA.searchLinkPattern.test(url)) {
            console.log('LINK', url, 'DO NOT MATCH PATTERN', SEARCH_DATA.searchLinkPattern);
            markLinkAsColor(links[i], 'red');
            continue;
        }

        if (/^https:\/\/jobs\.(eu\.)?lever\.co\/([^\/]*)\/([^\/]*)\/?(.*)?$/.test(url)) {
            url = url.replace(/\/apply$/, "");
        }

        if (/^https:\/\/apply\.workable\.com\/([^\/]*)\/([^\/]*)\/([^\/]*)\/?(.*\/)?$/.test(url)) {
            url = url.replace(/\/apply\/$/, "");
        }

        if (/^https:\/\/[^.]+\.recruitee\.com\/o\/.+$/.test(url)) {
            url = url.replace(/\/c\/new$/, "");
        }

        if (/^https:\/\/jobs\.ashbyhq\.com\/[^\/]+\/.+$/.test(url)) {
            url = url.replace(/\/application$/, "");
        }

        if (/^https:\/\/[^.]+\.breezy\.hr\/p\/.+$/.test(url)) {
            url = url.replace(/\/apply$/, "");
        }

        if (SEARCH_DATA.submittedLinks.some(link => link.url === url || url.includes(link.url))) {
            console.log('LINK', url, 'ALREADY VISITED');
            markLinkAsColor(links[i], 'orange');
            if (SEARCH_DATA.submittedLinksOriginal.some(link => link.url === url || url.includes(link.url))) {
                haveVisited = true;
            }
            continue;
        }

        

        //StatusMessage('Link found: ' + url);

        //StatusMessage('Wait for send cv task result');

        const response = await chrome.runtime.sendMessage({
            type: "SEND-CV-TASK",
            data: {
                url: url
            }
        });

        // UNUSED
        if (response.type === 'ERROR') {
            console.log('ERROR', response);
            processedLinksCount++;
            continue;
        }

        console.log('WAIT UNTIL SEND CV TASK WILL BE COMPLETE');

        markLinkAsColor(links[i], 'green');

        sendCvPageNotRespondTimeout = setTimeout(() => {
            chrome.runtime.sendMessage({
                type: "SEND-CV-TAB-NOT-RESPOND",
            });
            clearTimeout(sendCvPageNotRespondTimeout);
        }, 60_000 * 8);

        forStopped = true;

        break;

    }

    if (forStopped) {
        return;
    }

    if (haveVisited) {
        appendStatusMessage('I’ve already applied to these jobs for you. To save your Lifts, I’m skipping them and looking for new ones...');
        await wait(5000);
    }

    console.log('all links on page are visited. move to next page');

    try {
        links[links.length - 1]?.scrollIntoView();
    } catch (e) {}

    const loadMoreBtn = findLoadMoreElement();

    if (!loadMoreBtn) {
        searchTaskDone();
        return;
    }

    //StatusMessage('Moving to next page...');
    appendStatusMessage('Done with this page! Moving on to the next one...');
    let sec = Math.round(1 + (Math.random() * 2));
    startCountDownInStatusBlock(sec);
    await wait(sec * 1000);
    loadMoreBtn?.click();

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
            }, 2000);

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
            warmingUp(data.agentGeometry, data.agentMessages, data.agentMode);

            const session = data.session;
            let ts = 3000;
            if (!data.agentMessages || !data.agentMessages.length) {
                appendStatusMessage(`Looking for jobs based on your search preferences:

                    Role: ${session.role}
                    Search accuracy: ${session.searchAccuracy}
                    Date posted: ${session.datePosted}
                    Employment type: ${formatWorkplace(session.workplace)}
                    Country: ${session.country || 'Any'}
                    City: ${session.city || 'Any'}`);
                ts = 9000;
                agentStatus.searchDisplayed = true;
            }

            const {tabId, limit, current, domain, submittedLinks, searchLinkPattern} = data;

            SEARCH_DATA.tabId = tabId;
            SEARCH_DATA.limit = limit;
            SEARCH_DATA.domain = domain;
            SEARCH_DATA.current = current;
            SEARCH_DATA.submittedLinks = submittedLinks.map((submittedLink) => ({...submittedLink, tries: 0}));
            SEARCH_DATA.submittedLinksOriginal = submittedLinks.map((submittedLink) => ({...submittedLink, tries: 0}));
            if (searchLinkPattern) {
                SEARCH_DATA.searchLinkPattern = new RegExp(
                    searchLinkPattern.slice(1, searchLinkPattern.lastIndexOf('/')),
                    searchLinkPattern.slice(searchLinkPattern.lastIndexOf('/') + 1)
                );
            } else {
                SEARCH_DATA.searchLinkPattern = null;
            }

            //console.log('deserialized searchLinkPattern', SEARCH_DATA.searchLinkPattern);

            setTimeout(() => {
                searchNext().catch((reason) => {
                    appendStatusMessage(String(reason));
                    chrome.runtime.sendMessage({type: "SEARCH-TASK-ERROR", data: errorToString(reason)});
                });
            }, ts)

            break;
    }

});
});