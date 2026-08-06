// Board processing for job board search with AI matching
// Works with JobBoard.tsx page

const SEARCH_DATA = {
    tabId: null,
    limit: null,
    current: null,
    submittedLinks: [],
    processedUrls: [], // URLs we already processed
    searchAccuracyThreshold: null, // Numeric threshold or null
    currentPage: 1,
    totalPages: 1,
    consecutivePagesWithoutMatches: 0
};

let sendCvPageNotRespondTimeout;
const STORAGE_KEY_NO_MATCHES = 'lcv_board_pages_no_matches';

// Send event to page (JobBoard component)
function dispatchBoardEvent(eventType, data) {
    try {
        const event = new CustomEvent(eventType, { detail: data });
        window.dispatchEvent(event);
        console.log(`📤 Dispatched event: ${eventType}`, data);
    } catch (error) {
        console.error(`Failed to dispatch event ${eventType}:`, error);
    }
}

// Wait for board jobs to load via DOM
async function waitForBoardLoaded(timeoutMs = 60000) {
    const startTime = Date.now();
    
    console.log('Waiting for board to load via DOM...');
    
    while (true) {
        const boardDataElement = document.getElementById('lcv-board-data');
        const boardLoaded = boardDataElement?.getAttribute('data-board-loaded') === 'true';
        const boardNoJobs = boardDataElement?.getAttribute('data-board-no-jobs') === 'true';
        
        if (boardNoJobs) {
            console.log('Board loaded with no jobs ("No jobs found" state detected)');
            return { noJobs: true };
        }
        
        if (boardLoaded && boardDataElement) {
            const jobsJson = boardDataElement?.getAttribute('data-board-jobs');
            if (jobsJson) {
                try {
                    const data = JSON.parse(jobsJson);
                    console.log('Board loaded successfully with', data.jobs?.length || 0, 'jobs');
                    return data;
                } catch (error) {
                    console.error('Failed to parse board jobs:', error);
                }
            }
        }
        
        console.log('Board loaded status:', boardLoaded, 'element exists:', !!boardDataElement);
        
        if (Date.now() - startTime > timeoutMs) {
            console.error('Board loading timeout, reloading page...');
            location.reload();
            throw new Error('Board loading timeout');
        }
        
        await wait(2000);
    }
}

// Get board data from DOM
function getBoardData() {
    const boardDataElement = document.getElementById('lcv-board-data');
    if (!boardDataElement) {
        console.warn('Board data element not found');
        return null;
    }
    
    const jobsJson = boardDataElement.getAttribute('data-board-jobs');
    if (!jobsJson) {
        console.warn('Board jobs data attribute not found');
        return null;
    }
    
    try {
        const data = JSON.parse(jobsJson);
        console.log('getBoardData: parsed', data.jobs?.length || 0, 'jobs from DOM');
        return data;
    } catch (error) {
        console.error('Failed to parse board jobs:', error);
        return null;
    }
}

// Extract numeric threshold from searchAccuracy string
function extractThreshold(searchAccuracy) {
    if (!searchAccuracy) return null;
    
    // Match patterns like "≥50%", "≥60%", etc.
    const match = searchAccuracy.match(/≥?(\d+)%?/);
    if (match) {
        return parseInt(match[1], 10);
    }
    
    // If it's "Broad match" or "Exact match" - no threshold
    return null;
}

// Get pages without matches from localStorage
function getPagesWithoutMatches() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_NO_MATCHES);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Failed to parse pages without matches:', error);
        return [];
    }
}

// Save page without matches to localStorage
function markPageWithoutMatches(page) {
    try {
        const pages = getPagesWithoutMatches();
        if (!pages.includes(page)) {
            pages.push(page);
            localStorage.setItem(STORAGE_KEY_NO_MATCHES, JSON.stringify(pages));
        }
        return pages.length;
    } catch (error) {
        console.error('Failed to save page without matches:', error);
        return 0;
    }
}

// Clear pages without matches history
function clearPagesWithoutMatches() {
    try {
        localStorage.removeItem(STORAGE_KEY_NO_MATCHES);
    } catch (error) {
        console.error('Failed to clear pages without matches:', error);
    }
}

// Check if we've had too many consecutive pages without matches
function shouldStopDueToNoMatches() {
    const pages = getPagesWithoutMatches();
    
    // Check if last 5 pages had no matches
    if (pages.length >= 5) {
        const lastFive = pages.slice(-5);
        // Check if they are consecutive
        const isConsecutive = lastFive.every((page, index) => {
            if (index === 0) return true;
            return page === lastFive[index - 1] + 1;
        });
        
        if (isConsecutive) {
            return true;
        }
    }
    
    return false;
}

// Build next page URL
function buildNextPageUrl(currentUrl, nextPage) {
    try {
        const url = new URL(currentUrl);
        const pathParts = url.pathname.split('/').filter(p => p);
        
        // Remove existing pageN if present
        const filteredParts = pathParts.filter(p => !p.match(/^page\d+$/i));
        
        // Add new page number
        filteredParts.push(`page${nextPage}`);
        
        url.pathname = '/' + filteredParts.join('/');
        return url.toString();
    } catch (error) {
        console.error('Failed to build next page URL:', error);
        return null;
    }
}

// Extract current page number from URL
function getCurrentPageFromUrl(url) {
    try {
        const match = url.match(/\/page(\d+)/i);
        return match ? parseInt(match[1], 10) : 1;
    } catch (error) {
        console.error('Failed to extract page from URL:', error);
        return 1;
    }
}

async function searchNext(matchingInProgress) {
    const boardData = getBoardData();
    
    if (!boardData) {
        console.log('No board data available, waiting...');
        await wait(2000);
        return searchNext();
    }
    
    const { jobs, aiMatchingInProgress, currentPage, totalPages } = boardData;
    
    console.log('searchNext called, jobs:', jobs?.length || 0, 'aiMatchingInProgress:', aiMatchingInProgress, 'page:', currentPage, '/', totalPages);
    
    SEARCH_DATA.currentPage = currentPage || 1;
    SEARCH_DATA.totalPages = totalPages || 1;
    
    if (!jobs || jobs.length === 0) {
        console.log('No jobs on page, waiting...');
        await wait(2000);
        return searchNext();
    }

    chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}) // do not remove!

    // Filter jobs based on threshold and already processed
    const threshold = SEARCH_DATA.searchAccuracyThreshold;
    let eligibleJobs = [];
    
    for (const job of jobs) {
        if (!job || !job.url) {
            console.log('  ❌ Skip: invalid job or no url');
            continue;
        }

        let url = normalizeUrl(job.url);
        console.log('Checking job:', url.substring(0, 80), 'score:', job.score);

        // Normalize URLs for specific platforms
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

        if (/myworkdayjobs\.com/.test(url)) {
            try {
                const wd = new URL(url);
                let path = wd.pathname.replace(/\/apply\/.*$/, '');
                const jobMatch = path.match(/^(.*\/job\/)(?:[^/]+\/)?([^/]+)$/);
                if (jobMatch) {
                    path = `${jobMatch[1]}${jobMatch[2]}`;
                }
                url = `${wd.origin}${path}`.replace(/\/$/, '');
            } catch (e) {
                console.error('Workday URL normalize error', e);
            }
        }

        // Skip if already processed
        if (SEARCH_DATA.processedUrls.includes(url)) {
            console.log('  ⏭️ Skip: already in processedUrls');
            continue;
        }

        // Check if already visited
        if (SEARCH_DATA.submittedLinks.some(link => link.url === url || url.includes(link.url))) {
            console.log('  🔗 Skip: already in submittedLinks');
            dispatchBoardEvent('board-job-submitted', { url: job.url });
            SEARCH_DATA.processedUrls.push(url);
            continue;
        }

        // Check threshold if set
        if (threshold !== null) {
            if (job.score === undefined || job.score === null) {
                console.log('  ⏳ Skip for now: no score yet (AI matching in progress)');
                continue; // Skip jobs without score when threshold is set
            }
            
            if (job.score < threshold) {
                console.log(`  ❌ Skip: score ${job.score} below threshold ${threshold}`);
                dispatchBoardEvent('board-job-skipped-threshold', { url: job.url });
                SEARCH_DATA.processedUrls.push(url);
                continue;
            }
            
            console.log(`  ✅ Score ${job.score} meets threshold ${threshold}`);
        }
        
        eligibleJobs.push({ ...job, url });
    }
    
    console.log('Found', eligibleJobs.length, 'eligible jobs');
    
    // If we have eligible jobs, process the first one
    if (eligibleJobs.length > 0) {
        const job = eligibleJobs[0];
        const url = job.url;
        
        console.log('  ✅ Processing this job:', url);
        
        // Notify page about selected job
        dispatchBoardEvent('board-job-selected', { url: url });
        
        // Mark as processed immediately
        SEARCH_DATA.processedUrls.push(url);

        await wait(2000); // Small delay before sending to extension

        const response = await chrome.runtime.sendMessage({
            type: "SEND-CV-TASK",
            data: {
                url: url
            }
        });

        if (response.type === 'ERROR') {
            console.log('ERROR', response);
            // Try next job
            return searchNext();
        }

        console.log('WAIT UNTIL SEND CV TASK WILL BE COMPLETE');
        
        // Notify page that job is being processed
        dispatchBoardEvent('board-job-processing', { url: url });

        sendCvPageNotRespondTimeout = setTimeout(() => {
            chrome.runtime.sendMessage({
                type: "SEND-CV-TAB-NOT-RESPOND",
            });
            clearTimeout(sendCvPageNotRespondTimeout);
        }, 60_000 * 8);

        return; // Stop here, wait for SEARCH-NEXT
    }
    
    // No eligible jobs found
    console.log('No eligible jobs on current page');
    
    // If threshold is set and AI matching is in progress, wait
    if (threshold !== null && aiMatchingInProgress) {
        if (!matchingInProgress) {
            appendStatusMessage('Scanning jobs and matching them with your profile...');
        }
        console.log('AI matching in progress, waiting 5 seconds...');
        await wait(5000);
        return searchNext(true);
    }
    
    // AI matching complete or no threshold set - move to next page
    const nextPage = SEARCH_DATA.currentPage + 1;
    
    if (nextPage > SEARCH_DATA.totalPages) {
        console.log('Reached last page, search complete');
        appendStatusMessage('Search complete! Processed all pages.');
        searchTaskDone();
        return;
    }
    
    // Mark current page as having no matches (only if threshold is set)
    if (threshold !== null) {
        const consecutiveNoMatches = markPageWithoutMatches(SEARCH_DATA.currentPage);
        
        if (shouldStopDueToNoMatches()) {
            console.log('5 consecutive pages without matches, stopping search');
            appendStatusMessage('Search complete! No more matching jobs found in the last 5 pages.');
            searchTaskDone();
            return;
        }
    }
    
    // Navigate to next page
    const nextPageUrl = buildNextPageUrl(location.href, nextPage);
    if (nextPageUrl) {
        console.log('Moving to next page:', nextPageUrl);
        appendStatusMessage(`Moving to page ${nextPage}...`);
        
        // Small delay before navigation
        await wait(1000);
        location.href = nextPageUrl;
    } else {
        console.error('Failed to build next page URL');
        searchTaskDone();
    }
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {

    console.log('INCOMING MESSAGE', request, sender);

    const {type, data} = request;

    switch (type) {
        case 'SEARCH-NEXT':
            clearTimeout(sendCvPageNotRespondTimeout);
            SEARCH_DATA.submittedLinks.push({...data});

            if (data.status !== 'ERROR') {
                // Successful submission
                dispatchBoardEvent('board-job-completed', { url: data.url });
            } else {
                // Failed submission
                dispatchBoardEvent('board-job-failed', { url: data.url });
            }

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

window.addEventListener('load', async () => {
    try {
        // Get search task from extension first
        const value = await chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"});

        const {type, data, message} = value;

        switch (type) {
            case 'ERROR':
                console.error('Error getting search task:', message);
                // Do not proceed if no search task
                return;
                
            case 'SUCCESS':
                agentStatus.search = true;
                warmingUp(data.agentGeometry, data.agentMessages, data.agentMode);

                const session = data.session;
                let ts = 3000;
                if (!data.agentMessages || !data.agentMessages.length) {
                    await wait(5000);
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
                    ts = 5000;
                    agentStatus.searchDisplayed = true;
                }

                // Extract and store threshold
                SEARCH_DATA.searchAccuracyThreshold = extractThreshold(session.searchAccuracy);
                console.log('Search accuracy threshold:', SEARCH_DATA.searchAccuracyThreshold);

                const {tabId, limit, current, submittedLinks} = data;

                SEARCH_DATA.tabId = tabId;
                SEARCH_DATA.limit = limit;
                SEARCH_DATA.current = current;
                SEARCH_DATA.submittedLinks = submittedLinks.map((submittedLink) => ({...submittedLink, tries: 0}));
                
                // Clear previous pages without matches history
                clearPagesWithoutMatches();
                
                // Get current page from URL
                SEARCH_DATA.currentPage = getCurrentPageFromUrl(location.href);
                console.log('Starting from page:', SEARCH_DATA.currentPage);

                // Wait for board to load
                //appendStatusMessage('Loading job board...');
                const boardResult = await waitForBoardLoaded();

                if (boardResult && boardResult.noJobs) {
                    appendStatusMessage('No jobs matched your filters. Moving to the next job board...');
                    searchTaskDone(true);
                    return;
                }

                setTimeout(() => {
                    searchNext().catch((reason) => {
                        appendStatusMessage(String(reason));
                        chrome.runtime.sendMessage({type: "SEARCH-TASK-ERROR", data: errorToString(reason)});
                    });
                }, ts);

                break;
        }
    } catch (error) {
        console.error('Error in board initialization:', error);
        appendStatusMessage('Error loading board: ' + String(error));
    }
});
