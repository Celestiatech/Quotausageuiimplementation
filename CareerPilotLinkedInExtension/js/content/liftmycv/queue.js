// Queue processing for auto-apply queue page
// Works with window.queuedJobs, window.queueLoaded, window.removeJobFromQueue

const MAX_TRIES = 2;

const SEARCH_DATA = {
    tabId: null,
    limit: null,
    current: null,
    submittedLinks: [],
    processedUrls: [] // URLs we already processed
};

let sendCvPageNotRespondTimeout;

// Wait for queue to load via DOM
async function waitForQueueLoaded(timeoutMs = 60000) {
    const startTime = Date.now();
    
    console.log('Waiting for queue to load via DOM...');
    
    while (true) {
        const queueDataElement = document.getElementById('lcv-queue-data');
        const queueLoaded = queueDataElement?.getAttribute('data-queue-loaded') === 'true';
        
        if (queueLoaded && queueDataElement) {
            // Also verify that jobs data is available
            const jobsJson = queueDataElement.getAttribute('data-queue-jobs');
            if (jobsJson) {
                try {
                    const jobs = JSON.parse(jobsJson);
                    console.log('Queue loaded successfully with', jobs.length, 'jobs');
                    return jobs; // Return jobs directly
                } catch (error) {
                    console.error('Failed to parse queue jobs:', error);
                }
            }
        }
        
        console.log('Queue loaded status:', queueLoaded, 'element exists:', !!queueDataElement);
        
        if (Date.now() - startTime > timeoutMs) {
            console.error('Queue loading timeout, reloading page...');
            location.reload();
            throw new Error('Queue loading timeout');
        }
        
        await wait(500);
    }
}

// Get queue jobs from DOM
function getQueueJobs() {
    const queueDataElement = document.getElementById('lcv-queue-data');
    if (!queueDataElement) {
        console.warn('Queue data element not found');
        return [];
    }
    
    const jobsJson = queueDataElement.getAttribute('data-queue-jobs');
    if (!jobsJson) {
        console.warn('Queue jobs data attribute not found');
        return [];
    }
    
    try {
        const jobs = JSON.parse(jobsJson);
        console.log('getQueueJobs: parsed', jobs.length, 'jobs from DOM');
        return jobs;
    } catch (error) {
        console.error('Failed to parse queue jobs:', error);
        return [];
    }
}

// Remove job from queue via DOM event
async function removeJobFromQueue(jobId) {
    console.log('Requesting removal of job', jobId);
    return new Promise((resolve) => {
        const handleResponse = (event) => {
            if (event.detail.jobId === jobId) {
                document.removeEventListener('lcv-queue-job-removed', handleResponse);
                console.log('Job', jobId, 'removal result:', event.detail.success);
                resolve(event.detail.success);
            }
        };
        
        document.addEventListener('lcv-queue-job-removed', handleResponse);
        
        // Dispatch remove request
        document.dispatchEvent(new CustomEvent('lcv-queue-remove-job', {
            detail: { jobId: Number(jobId) }
        }));
        
        // Timeout after 5 seconds
        setTimeout(() => {
            document.removeEventListener('lcv-queue-job-removed', handleResponse);
            console.warn('Job', jobId, 'removal timeout');
            resolve(false);
        }, 5000);
    });
}

async function searchNext() {
    chrome.runtime.sendMessage({type: "GET-SEARCH-TASK"}) // do not remove!
    const jobs = getQueueJobs();
    
    console.log('searchNext called, jobs from DOM:', jobs.length, 'processed:', SEARCH_DATA.processedUrls.length);
    
    if (!jobs || jobs.length === 0) {
        console.log('Queue is empty');
        searchTaskDone();
        return;
    }

    // Find first unprocessed job
    for (const job of jobs) {
        console.log('Checking job:', job?.id, 'jobUrl:', job?.jobUrl?.substring(0, 50));
        
        if (!job || !job.jobUrl) {
            console.log('  ❌ Skip: invalid job or no jobUrl');
            continue;
        }

        let url = normalizeUrl(job.jobUrl);
        console.log('  Normalized URL:', url.substring(0, 80));

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

        // Skip if already processed
        if (SEARCH_DATA.processedUrls.includes(url)) {
            console.log('  ⏭️ Skip: already in processedUrls');
            continue;
        }

        // Check if already visited
        if (SEARCH_DATA.submittedLinks.some(link => link.url === url || url.includes(link.url))) {
            console.log('  🔗 Skip: already in submittedLinks, removing from queue');
            
            // Remove from queue using DOM event
            if (job.id) {
                await removeJobFromQueue(Number(job.id));
            }
            
            SEARCH_DATA.processedUrls.push(url);
            continue;
        }

        console.log('  ✅ Processing this job:', url);
        
        // Mark as processed immediately
        SEARCH_DATA.processedUrls.push(url);

        const response = await chrome.runtime.sendMessage({
            type: "SEND-CV-TASK",
            data: {
                url: url
            }
        });

        if (response.type === 'ERROR') {
            console.log('ERROR', response);
            continue;
        }

        console.log('WAIT UNTIL SEND CV TASK WILL BE COMPLETE');

        sendCvPageNotRespondTimeout = setTimeout(() => {
            chrome.runtime.sendMessage({
                type: "SEND-CV-TAB-NOT-RESPOND",
            });
            clearTimeout(sendCvPageNotRespondTimeout);
        }, 60_000 * 8);

        return; // Stop here, wait for SEARCH-NEXT
    }

    console.log('All jobs in queue processed');
    searchTaskDone();
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {

    console.log('INCOMING MESSAGE', request, sender);

    const {type, data} = request;

    switch (type) {
        case 'SEARCH-NEXT':
            clearTimeout(sendCvPageNotRespondTimeout);
            SEARCH_DATA.submittedLinks.push({...data});

            await movingOn(data);

            // Find job by URL in current queue
            const currentJobs = getQueueJobs();
            const job = currentJobs?.find(j => {
                if (!j || !j.jobUrl) return false;
                const normalizedUrl = normalizeUrl(j.jobUrl);
                return normalizedUrl === data.url || data.url.includes(normalizedUrl) || normalizedUrl.includes(data.url);
            });
            
            if (job && job.id) {
                await removeJobFromQueue(Number(job.id));
            }
            

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
                break;
                
            case 'SUCCESS':
                agentStatus.search = true;
                warmingUp(data.agentGeometry, data.agentMessages, data.agentMode);

                // Wait for queue to load after agent is initialized
                appendStatusMessage('Loading your auto-apply queue...');
                const jobs = await waitForQueueLoaded();

                const {tabId, limit, current, submittedLinks} = data;

                SEARCH_DATA.tabId = tabId;
                SEARCH_DATA.limit = limit;
                SEARCH_DATA.current = current;
                SEARCH_DATA.submittedLinks = submittedLinks.map((submittedLink) => ({...submittedLink, tries: 0}));
                
                console.log('Initial queue loaded with', jobs.length, 'jobs');
                getQueueJobs().length
                console.log('Current queue size:', window.queuedJobs?.length || 0);

                let ts = 3000;
                if (!data.agentMessages || !data.agentMessages.length) {
                    ts = 3000;
                    agentStatus.searchDisplayed = true;
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
        console.error('Error in queue initialization:', error);
        appendStatusMessage('Error loading queue: ' + String(error));
    }
});
