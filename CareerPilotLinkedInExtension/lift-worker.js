// LIFTMYCV WORKER BODY (isolated scope)
(function(){
console.log('SERVICE WORKER')


const SERVER_PATH = '/api/v1/extension/send-cv/session';

const STORAGE_KEY = "STORE";

const SERVICE_WORKER_URL_FOR_ERROR_LOGGING = 'SERVICE-WORKER-ON-MESSAGE';

chrome.scripting
    .registerContentScripts([{
        id: "main-content",
        js: ["js/content/main.js"],
        runAt: "document_end",
        matches: ["http://localhost:*/*", "https://app.liftmycv.com/*", "https://dev.liftmycv.com:*/*"],
    }])
    .then(() => console.log("main-content: registration complete"))
    .catch(() => {})

/*interface SendCvSessionStart {
  session: {
    xurl: string;
    role: string;
    city: string;
    phone: string;
    email: string;
    apiKey: string;
    country: string;
    lastName: string;
    firstName: string;
    cvUrl: string;
    githubUrl: string;
    websiteUrl: string;
    linkedinUrl: string;
    coverLetter: string;
    cvOriginalFilename: string;
    liftsLimit: number;
    liftsCurrent: number;
    visaSponsorship: boolean;
    platform: SendCvPlatformType;
    location: SendCvLocationType;
    status: SendCvSessionStatusType;
  };
  serverBaseUrl: string;
}*/

// UNUSED
const CONFIG = {
    'LEVER': {
        domain: 'lever.co',
        searchUrl: ({role}) => {
            return `https://www.google.com/search?q=${encodeURIComponent(`site:lever.co ${role}`)}`;
        },
        applyUrl: (jobUrl) => jobUrl + '/apply',
        searchDomain: 'https://jobs.lever.co',
        parseCountryUrl: (jobUrl) => jobUrl,
        parseCountryBeforeSendCv: true
    },
    'WORKABLE': {
        domain: 'workable.com',
        searchUrl: ({role}) => {
            return `https://www.google.com/search?q=${encodeURIComponent(`site:lever.co ${role}`)}`;
        },
        searchDomain: 'https://apply.workable.com',
    }
};

const RESOLVE_COUNTRIES_CITIES_TIMEOUT = 60000;

const DEFAULT_FETCH_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

const SEND_CV_TASK_DEFAULT = {
    url: null,
    tabId: null,
    active: false,
    finalUrl: null,
    has_manual_edits: false,
    has_manual_fixes: false
};

const SEARCH_TASK_DEFAULT = {
    tabId: null,
    limit: null,
    domain: null,
    current: null,
    searchLinkPattern: null,
};

const NONSTOP_RETRY_MAX = 100;

const STORE = {
    tasks: {
        search: {
            ...SEARCH_TASK_DEFAULT
        },
        sendCv: {
            ...SEND_CV_TASK_DEFAULT
        },
    },
    devMode: false,
    profile: null,
    session: null,
    started: false,
    windowId: null,
    serverBaseUrl: 'https://app.liftmycv.com/',
    submittedLinks: [],
    platformsFlow: [],
    nonstop: false,
    nonstopRetryLimit: NONSTOP_RETRY_MAX,
    finished: false,
    loadedFromStorage: false,
    failedSubmissions: 0,
    successfulSubmissions: 0,
    historyDetails: {},
    agentMessages: [],
    setAutopilotMode: false,
    platformsChallengeSkipped: [],
    enableWrongReturn: false,
    agentGeometry: {},
    applyOne: false,
    applyOneEnabled: true,
    continuousRun: false,
    continuousRunOriginalFlow: [],
};

function clearSession() {
    STORE.tasks.sendCv = {
        ...SEND_CV_TASK_DEFAULT
    };
    STORE.tasks.search = {
        ...SEARCH_TASK_DEFAULT
    };

    STORE.started = false;

    STORE.profile = null;
    STORE.session = {apiKey: STORE.session?.apiKey, resumePerJob: STORE.session?.resumePerJob};
    STORE.windowId = null;
    STORE.searchTask = null;
    STORE.searchTabId = null;
    STORE.platformsFlow = [];
    STORE.nonstop = false;
    STORE.nonstopRetryLimit = NONSTOP_RETRY_MAX;
    STORE.finished = false;
    STORE.failedSubmissions = 0;
    STORE.successfulSubmissions = 0;
    STORE.historyDetails = {};
    STORE.agentMessages = [];
    STORE.setAutopilotMode = false;
    STORE.platformsChallengeSkipped = [];
    STORE.enableWrongReturn = false;
    STORE.applyOne = false;
    STORE.continuousRun = false;
    STORE.continuousRunOriginalFlow = [];
    STORE.reopeningWindow = false;
    STORE.noWindow = false;

    saveStoreToStorage();

    chrome.alarms.clear("heartbeat");
    chrome.power.releaseKeepAwake();
}

const PLATFORMS_FLOW_DEFAULT = [
    'ATS',
    'LINKEDIN',
    'MONSTER',
    'WELLFOUND',
    'GLASSDOOR',
]

function makePlatformsFlow(session) {
    return PLATFORMS_FLOW_DEFAULT.filter(platform => {
        switch (platform) {
            case 'LINKEDIN':
                return Boolean(session.country);
            case 'GLASSDOOR':
                return Boolean(session.country);
            case 'MONSTER':
                return Boolean(session.country) || session.workplace == 'REMOTE';
            default:
                return true;
        }
    });
}

function makePlatformsFlowEx(platformsFlow, session) {
    return platformsFlow.filter(entry => {
        // Support both old format ('PLATFORM') and new format ('PLATFORM, role')
        const platform = entry.includes(',') ? entry.split(',')[0].trim() : entry;
        switch (platform) {
            case 'LINKEDIN':
                return Boolean(session.country);
            case 'GLASSDOOR':
                return Boolean(session.country);
            case 'MONSTER':
                return Boolean(session.country) || session.workplace == 'REMOTE';
            default:
                return true;
        }
    });
}

/**
 * Parse a platformsFlow entry: supports both old ('PLATFORM') and new ('PLATFORM, role') formats.
 * Returns { platform, role } where role may be null for old-format entries.
 */
function parsePlatformFlowEntry(entry) {
    if (entry && entry.includes(',')) {
        const commaIndex = entry.indexOf(',');
        return {
            platform: entry.slice(0, commaIndex).trim(),
            role: entry.slice(commaIndex + 1).trim() || null,
        };
    }
    return { platform: entry, role: null };
}

/**
 * Shift the next entry from platformsFlow and apply it to session.
 * Supports both old ('PLATFORM') and new ('PLATFORM, role') formats.
 * Returns the platform string.
 */
function shiftPlatformAndRole(session, platformsFlow) {
    const entry = platformsFlow.shift();
    const { platform, role } = parsePlatformFlowEntry(entry);
    session.platform = platform;
    if (role !== null) {
        session.role = role;
    }
    return platform;
}

function retryCurrentPlaftormAtTheEnd() {
    if (!STORE.session.platform) {
        throw new Error('No current platform')
    }
    if (STORE.nonstopRetryLimit > 0) {
        // Preserve role in the retry entry if present
        const retryEntry = STORE.session.role
            ? `${STORE.session.platform}, ${STORE.session.role}`
            : STORE.session.platform;
        STORE.platformsFlow.push(retryEntry)
    }
    decreaseNonstopRetryLimitIfOnline()
}

function decreaseNonstopRetryLimitIfOnline() {
    // Overhead: we don't need to get stats here, just check that we are online and can communicate with the backend
    fetchWithRetry(`${buildServerUrl()}/stats`, {
        method: 'GET',
        headers: buildFetchHeaders()
    })
        .then(handleJsonFetchResponse)
        .then((data) => {
            STORE.nonstopRetryLimit --;
            console.log('nonstopRetryLimit', STORE.nonstopRetryLimit)
        })
}

function fetchWithTimeout(url, options = {}, timeout = 25000) {
    const controller = new AbortController();
    const { signal } = controller;
  
    const timeoutId = setTimeout(() => controller.abort(), timeout);
  
    return fetch (url, { ...options, signal })
      .finally(() => clearTimeout(timeoutId));
  }

  async function fetchWithRetry(url, options = {}, totalTimeout = 300000, requestTimeout = 25000, delay = 5000) {
    const startTime = Date.now();
  
    while (Date.now() - startTime < totalTimeout) {
      try {
        const response = await fetchWithTimeout(url, options, requestTimeout);
  
        if (response.ok || response.status < 500) {
          return response;
        }
        
        console.log(url, await response.text());
        throw new Error(`Server error: ${response.status}`);
      } catch (error) {
        if (error.name === 'AbortError') {
          console.error('Request timed out', url);
        } else {
          console.error('Fetch error:', error.message, url);
        }
  
        if (Date.now() - startTime + delay >= totalTimeout) {
          throw new Error(`Total timeout of ${totalTimeout} ms exceeded`);
        }
  
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  
    throw new Error(`Total timeout of ${totalTimeout} ms exceeded`);
  }

function buildServerUrl() {

    if (!STORE || !STORE.serverBaseUrl) {
        throw new Error("server base url not found");
    }

    return (STORE?.serverBaseUrl.endsWith('/') ? STORE?.serverBaseUrl.substring(0, STORE?.serverBaseUrl.lastIndexOf('/')) : STORE?.serverBaseUrl) + SERVER_PATH;
}

async function loadStoreFromStorage() {
    try {
        if (!STORE || !STORE.loadedFromStorage) {
            const result = await chrome.storage.local.get([STORAGE_KEY]);
            console.log("LOADED STORE: ", result[STORAGE_KEY]);
            if (result[STORAGE_KEY]) {
                Object.assign(STORE, result[STORAGE_KEY]);
                STORE.loadedFromStorage = true;
            }
        }
    } catch (error) {
        console.error("Error loading store from storage:", error);
        sendErrorToServer('Error loading store from storage:', errorToString(error));
    }
}

async function saveStoreToStorage() {
    try {
        await chrome.storage.local.set({ [STORAGE_KEY]: STORE });
        console.log("Store saved!");
    } catch (error) {
        console.error("Error saving store to storage:", error);
        sendErrorToServer('Error saving store to storage:', errorToString(error));
    }
}

/**
 * After browser/computer restart (or if the working window was lost without
 * windows.onRemoved firing), STORE.started can remain true in chrome.storage.local
 * even though no apply session is actually running. That blocks new starts via
 * GET-STARTED and leaves a non-functional "Stop applying" button in the popup.
 *
 * Returns true if a stale session was cleared.
 */
async function clearStaleStartedSessionIfNeeded() {
    if (!STORE.started) {
        return false;
    }

    // Nonstop is recreating the working window after an unexpected close — not stale.
    if (STORE.reopeningWindow) {
        return false;
    }

    if (!STORE.windowId) {
        console.warn('Stale session: started=true but windowId is missing — clearing');
        clearSession();
        return true;
    }

    try {
        await chrome.windows.get(STORE.windowId);
        return false;
    } catch (e) {
        console.warn('Stale session: working window gone — clearing', STORE.windowId);
        clearSession();
        return true;
    }
}

function bestEffortStopBackendSession() {
    try {
        if (!STORE.session?.apiKey || !STORE.serverBaseUrl) {
            return;
        }
        fetchWithRetry(`${buildServerUrl()}/stop`, {
            method: 'PUT',
            headers: buildFetchHeaders()
        }, 15000, 5000, 5000).catch(() => {});
    } catch (_) {}
}

loadStoreFromStorage().then(() => clearStaleStartedSessionIfNeeded());

// Browser/profile startup: apply windows never survive a full restart, so any
// persisted started=true is always stale and must not block a new session.
chrome.runtime.onStartup.addListener(async () => {
    await loadStoreFromStorage();
    if (STORE.started) {
        console.log('Browser startup: clearing leftover started session from storage');
        bestEffortStopBackendSession();
        clearSession();
    }
});

function getUiBaseUrl() {
    return 'https://app.liftmycv.com';
}

chrome.runtime.onInstalled.addListener(async ({reason}) => {
    if (reason === "install") {
        await saveStoreToStorage();
        await loadStoreFromStorage();

        chrome.tabs.query({
                url: ['https://app.liftmycv.com/*', 'https://dev.liftmycv.com:*/*', 'http://localhost:*/*']
        })
        .then((tabs) => {
            if (!tabs) {
                return;
            }
            tabs.forEach(tab => {
                // Check if tab has the marker element and close it
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        return !!document.getElementById('lcv_close_this_tab_after_extension_installed');
                    }
                }).then((results) => {
                    if (results && results[0] && results[0].result === true) {
                        console.log('Found tab with marker, closing tab:', tab.id);
                        chrome.tabs.remove(tab.id).catch(err => console.error('Error closing tab:', err));
                    }
                }).catch(err => console.error('Error checking for marker element:', err));
            });
        }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error));

        chrome.tabs.create({ url: getUiBaseUrl() + '/?installed-version=' + chrome.runtime.getManifest().version });
    }
});

function buildFetchHeaders() {

    const headers = {
        ...DEFAULT_FETCH_HEADERS
    }

    if (STORE.session?.apiKey) {
        headers['Authorization'] = 'Bearer ' + STORE.session?.apiKey;
    }

    return headers;

}

function handleTextFetchResponse(resp) {
    if (!resp.ok) {
        throw new Error(`${resp.status} ${resp.statusText}`);
    }
    return resp.text();
}

async function handleJsonFetchResponse(resp) {
    //console.dir(resp)
    if (!resp.ok) {
        throw new Error(`${resp.url}: ${resp.status} ${await resp.text()}`);
    }
    if (resp.headers.get('content-type')?.includes('application/json')) {
        return resp.json();
    }
    return resp.text();
}

function resolveDomainDependsOnPlatform(platform) {
    switch (platform) {
        case 'LEVER':
            return 'lever.co';
        case 'MONSTER':
            return 'monster.com';
        case 'WORKABLE':
            return 'workable.com';
        case 'LINKEDIN':
            return 'linkedin.com';
        case 'RECRUITEE':
            return 'recruitee.com';
        case 'ASHBYHQ':
            return 'ashbyhq.com';
        case 'BREEZY':
            return 'breezy.hr';
        case 'GREENHOUSE':
            return 'job-boards.greenhouse.io';
        case 'SMARTRECRUITERS':
            return 'jobs.smartrecruiters.com';
        case 'MYWORKDAYJOBS':
            return 'myworkdayjobs.com';
        case 'WELLFOUND':
            return 'wellfound.com';
    }
}

function resolveSearchDomainDependsOnPlatform(platform) {
    switch (platform) {
        case 'LEVER':
            return ['https://jobs.lever.co', 'https://jobs.eu.lever.co'];
        case 'WORKABLE':
            return ['https://apply.workable.com', 'https://jobs.workable.com'];
        case 'MONSTER':
            return 'https://www.monster.com';
        case 'LINKEDIN':
            return 'https://linkedin.com';
        case 'RECRUITEE':
            return 'https://*.recruitee.com';
        case 'ASHBYHQ':
            return 'https://jobs.ashbyhq.com';
        case 'BREEZY':
            return 'https://*.breezy.hr';
        case 'GREENHOUSE':
            return 'https://job-boards.greenhouse.io';
        case 'SMARTRECRUITERS':
            return 'https://jobs.smartrecruiters.com';
        case 'MYWORKDAYJOBS':
            return 'https://*.myworkdayjobs.com';
        case 'WELLFOUND':
            return 'https://wellfound.com';
    }
}

function resolveSearchLinkPatternDependsOnPlatform(platform) {
    switch (platform) {
        case 'LEVER':
            return /^https:\/\/jobs\.(eu\.)?lever\.co\/([^\/]*)\/([^\/]*)\/?(.*)?$/.toString();
        case 'WORKABLE':
            return /^(https:\/\/apply\.workable\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/?(.*\/)?|https:\/\/jobs\.workable\.com\/view\/[^\/]+\/[^\/]+)$/.toString();
        case 'RECRUITEE':
            return /^https:\/\/[^.]+\.recruitee\.com\/o\/.+$/.toString();
        case 'ASHBYHQ':
            return /^https:\/\/jobs\.ashbyhq\.com\/[^\/]+\/.+$/.toString();
        case 'BREEZY':
            return /^https:\/\/[^.]+\.breezy\.hr\/p\/.+$/.toString();
        case 'GREENHOUSE':
            return /^https:\/\/job-boards\.greenhouse\.io\/[^\/]+\/jobs\/\d+\/?$/.toString();
        case 'SMARTRECRUITERS':
            return /^https:\/\/jobs\.smartrecruiters\.com\/[^\/]+\/\d+-[^\/]+$/.toString();
        case 'MYWORKDAYJOBS':
            return /^https:\/\/[^\/]+\.myworkdayjobs\.com\/[^\/]+\/[^\/]+\/job\/.+$/.toString();
        default:
            return null;
    }
}

function resolveSendCvApplyUrlDependsOnPlatform(url, platform) {
    return url;
}

function resolveSearchUrlDependOnPlatform(session) {
    let query;
    switch (session.platform) {
        case 'LEVER':
        case 'WORKABLE':
        case 'GREENHOUSE':
        case 'RECRUITEE':
        case 'ASHBYHQ':
        case 'BREEZY':
        case 'SMARTRECRUITERS':
        case 'MYWORKDAYJOBS':
            let q = `site:${resolveDomainDependsOnPlatform(session.platform)}`;
            if (session.searchAccuracy == "Exact match") {
                q += ` intitle:"${session.role}"`;
            } else {
                q += ` ${session.role}`;
            }
            if (session.country) {
                q += ' ' + session.country;
            }
            if (session.city) {
                q += ' ' + session.city;
            }
            if (session.workplace == "REMOTE") {
                q += ' Remote'
            }
            if (session.workplace == "ON_SITE") {
                q += ' On-site'
            }
            if (session.workplace == "HYBRID") {
                q += ' Hybrid'
            }

            let gquery = `https://www.google.com/search?q=${encodeURIComponent(q)}`

            if (session.datePosted == 'Past 24 hours') {
                gquery += '&tbs=qdr:d'
            }

            if (session.datePosted == 'Past week') {
                gquery += '&tbs=qdr:w'
            }

            if (session.datePosted == 'Past month') {
                gquery += '&tbs=qdr:m'
            }

            return gquery;
        case 'MONSTER':
            query = ['q=' + encodeURIComponent(session.role)];
            let where = '';
            if (session.city) {
                where = session.city;
            } else {
                if (session.country) {
                    where = session.country;
                }
            }
            if (session.workplace == 'REMOTE') {
                where = 'remote';
            }
            if (where) {
                query.push('where=' + encodeURIComponent(where));
            }

            if (session.datePosted == 'Past 24 hours') {
                query.push('recency=today')
            }

            if (session.datePosted == 'Past week') {
                query.push('recency=last+week')
            }

            if (session.datePosted == 'Past month') {
                query.push('recency=last+month')
            }

            return 'https://www.monster.' + (session.country == 'Canada' ? 'ca': 'com') +'/jobs/search?' + query.join('&');
        case 'LINKEDIN':

            query = ['f_AL=true', 'origin=HISTORY'];

            if (session.datePosted == 'Past 24 hours') {
                query.push('f_TPR=r86400')
            }

            if (session.datePosted == 'Past week') {
                query.push('f_TPR=r604800')
            }

            if (session.datePosted == 'Past month') {
                query.push('f_TPR=r2592000')
            }

            if (session.workplace && session.workplace !== 'ANY') {
                let workPlaceType = 'f_WT=';
                switch (session.workplace) {
                    case 'REMOTE':
                        workPlaceType += '2';
                        break;
                    case 'HYBRID':
                        workPlaceType += '3';
                        break;
                    case 'ON_SITE':
                        workPlaceType += '1';
                        break;
                }
                query.push(workPlaceType);
            }

            query.push('keywords=' + encodeURIComponent(session.role));

            return 'https://www.linkedin.com/jobs/search/?' + query.join('&');

        case 'LINKEDIN_SEARCH':
            return 'https://www.linkedin.com/jobs/search/?f_AL=true&origin=HISTORY';

        case 'LINKEDIN_BOOKMARKS':
            return 'https://www.linkedin.com/my-items/saved-jobs/?cardType=SAVED';

        case 'MONSTER_SEARCH':
            return 'https://www.monster.' + (session.country == 'Canada' ? 'ca': 'com') +'/jobs/search';

        case 'WELLFOUND':
        case 'WELLFOUND_SEARCH':
            return 'https://wellfound.com/jobs';

        case 'WELLFOUND_BOOKMARKS':
            return 'https://wellfound.com/jobs/starred';

        case 'GLASSDOOR':
        case 'GLASSDOOR_SEARCH':
            return 'https://www.glassdoor.com/Job/index.htm';

        case 'GLASSDOOR_BOOKMARKS':
            return 'https://www.glassdoor.com/member/profile/savedJobActivity';

        case 'QUEUE':
            return STORE.frontendBaseUrl + '/auto-apply-queue';

        case 'ATS':
            // Helper: Replace spaces with underscores for URL
            const encodeUrlParam = (param) => {
                if (!param) return 'Any';
                const cleaned = param.trim();
                if (!cleaned || cleaned.toLowerCase() === 'any') return 'Any';
                return cleaned.replace(/\s+/g, '_');
            };
            
            // Helper: Map workplace type
            const mapWorkplace = (workplace) => {
                if (!workplace || workplace === 'ANY') return 'Any';
                switch (workplace) {
                    case 'REMOTE':
                        return 'Remote';
                    case 'ON_SITE':
                        return 'On-site';
                    case 'HYBRID':
                        return 'Hybrid';
                    default:
                        return 'Any';
                }
            };
            
            // Helper: Map date posted
            const mapDatePosted = (datePosted) => {
                if (!datePosted) return 'Any';
                switch (datePosted) {
                    case 'Past 24 hours':
                        return 'Past_24h';
                    case 'Past week':
                        return 'Past_week';
                    case 'Past month':
                        return 'Past_month';
                    default:
                        return 'Any';
                }
            };
            
            // Build URL parts
            const parts = [];
            
            // Role
            parts.push(encodeUrlParam(session.role || ''));
            
            // Employment type (workplace)
            parts.push(mapWorkplace(session.workplace));
            
            // Country
            parts.push(encodeUrlParam(session.country || ''));
            
            // City (only if country is specified)
            const hasCountry = session.country && session.country.toLowerCase() !== 'any';
            const hasCity = session.city && session.city.toLowerCase() !== 'any';
            const hasDatePosted = session.datePosted && session.datePosted !== 'any-time';
            
            if (hasCountry || hasCity || hasDatePosted) {
                parts.push(encodeUrlParam(session.city || ''));
                
                // Date posted (only if city is specified or if we need to add it)
                if (hasCity || hasDatePosted) {
                    parts.push(mapDatePosted(session.datePosted));
                }
            }
            
            if (!["OFF", "Broad match", "Exact match"].includes(session.searchAccuracy)) {
                parts.push('ai_matching');
            }
            
            return STORE.frontendBaseUrl + '/jobs/' + parts.join('/');
    }
}

function logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse) {
    const errorAsString = errorToString(error);
    console.error(errorAsString);
    sendErrorToServer(SERVICE_WORKER_URL_FOR_ERROR_LOGGING, errorAsString);
    if (typeof sendResponse === 'function') {
        sendResponse({
            type: 'ERROR',
            data: errorAsString
        });
    }
}

function startSearchTask(sendResponse) {
    console.log('startSearchTask', STORE.session.platform, STORE.platformsFlow);
    const url = resolveSearchUrlDependOnPlatform(STORE.session);
    chrome.tabs.create({
        url,
        windowId: STORE.windowId
    }).then(tab => {

        STORE.tasks.search.tabId = tab.id;
        STORE.tasks.search.limit = STORE.session?.liftsLimit ?? 100;
        STORE.tasks.search.current = STORE.session?.liftsCurrent ?? 0;
        STORE.tasks.search.domain = resolveSearchDomainDependsOnPlatform(STORE.session.platform);
        STORE.tasks.search.searchLinkPattern = resolveSearchLinkPatternDependsOnPlatform(STORE.session.platform);
        STORE.tasks.search.url = url;

        STORE.tasks.search.city = STORE.session.city;
        STORE.tasks.search.country = STORE.session.country;

        STORE.applyTabOpened = null;
        STORE.started = true;
        STORE.enableWrongReturn = false;

        chrome.tabs.query({
            active: false,
            windowId: STORE.windowId
        }).then(tabs => {
            chrome.tabs.remove(tabs.map(tab => tab.id)).then(() => console.log('other tabs closed'))
        });

        if (STORE?.agentGeometry?.wrongReturned) {
            STORE.agentGeometry.wrongReturned = false;
        }

        STORE.joinedTab = STORE.session.platform.startsWith('LINKEDIN') && STORE.session.platform !== 'LINKEDIN_BOOKMARKS';

        saveStoreToStorage();

        if (STORE.session.platform === 'MONSTER' || STORE.session.platform === 'MONSTER_SEARCH') {
            chrome.tabs.onUpdated.addListener(function(updatedTabId, changeInfo) {
                if (updatedTabId === tab.id && changeInfo.status === 'complete') {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            window.open = function(url, target, features) {
                                console.log("URL", url);
                                window.postMessage({ type: "INTERCEPTED_URL", url: url }, "*");
                            };
                        },
                        world: "MAIN"
                    }).then(() => {
                        console.log('window.open overrided');
                    }).catch(error => {
                        console.error('error override window.open', error);
                        logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);
                    });
                }
            });
        }

        if (STORE.session.platform.startsWith('LINKEDIN')) {
            chrome.tabs.onUpdated.addListener(function(updatedTabId, changeInfo) {
                if (updatedTabId === tab.id && changeInfo.status === 'complete') {
                    chrome.tabs.get(updatedTabId, (tabInfo) => {
                        if (STORE.enableWrongReturn) {
                            if (!tabInfo.url.startsWith('https://www.linkedin.com/jobs/search/') && !tabInfo.url.startsWith('https://www.linkedin.com/my-items/saved-jobs')) {
                                STORE.agentGeometry.wrongReturned = true;
                                console.warn('wrong return', tabInfo.url);
                                saveStoreToStorage();
                                chrome.tabs.update(updatedTabId, { url: STORE.tasks.search.url });
                            }
                        } else {
                            if (tabInfo.url.startsWith('https://www.linkedin.com/feed/')) {
                                chrome.tabs.update(updatedTabId, { url: STORE.tasks.search.url });
                            }
                        }
                    });
                }
            });
        }

        if (STORE.session.platform.startsWith('MONSTER')) {
            chrome.tabs.onUpdated.addListener(function(updatedTabId, changeInfo) {
                if (updatedTabId === tab.id && changeInfo.status === 'complete' && STORE.enableWrongReturn) {
                    chrome.tabs.get(updatedTabId, (tabInfo) => {
                        if (!tabInfo.url.startsWith('https://www.monster.com/jobs/search') && !tabInfo.url.startsWith('https://www.monster.ca/jobs/search')) {
                            console.log('wrong return', tabInfo.url);
                            STORE.agentGeometry.wrongReturned = true;
                            saveStoreToStorage();
                            chrome.tabs.update(updatedTabId, { url: STORE.tasks.search.url });
                        }
                    });
                }
            });
        }

        if (STORE.session.platform.startsWith('WELLFOUND')) {
            chrome.tabs.onUpdated.addListener(function(updatedTabId, changeInfo) {
                if (updatedTabId === tab.id && changeInfo.status === 'complete' && STORE.enableWrongReturn) {
                    chrome.tabs.get(updatedTabId, (tabInfo) => {
                        if (!tabInfo.url.startsWith('https://wellfound.com/jobs')) {
                            console.log('wrong return', tabInfo.url);
                            STORE.agentGeometry.wrongReturned = true;
                            saveStoreToStorage();
                            chrome.tabs.update(updatedTabId, { url: STORE.tasks.search.url });
                        }
                    });
                }
            });
        }

        if (STORE.session.platform.startsWith('GLASSDOOR')) {
            chrome.tabs.onUpdated.addListener(function(updatedTabId, changeInfo) {
                const glassdoorUrlPrefixes = [
                    "https://www.glassdoor.com.ar/Job/",
                    "https://www.glassdoor.com.ar/Empleo/",
                    "https://www.glassdoor.com.au/Job/",
                    "https://nl.glassdoor.be/Job/",
                    "https://nl.glassdoor.be/Vacature/",
                    "https://fr.glassdoor.be/Job/",
                    "https://fr.glassdoor.be/Emploi/",
                    "https://www.glassdoor.com.br/Job/",
                    "https://www.glassdoor.com.br/Vaga/",
                    "https://www.glassdoor.ca/Job/",
                    "https://fr.glassdoor.ca/Job/",
                    "https://fr.glassdoor.ca/Emploi/",
                    "https://www.glassdoor.de/Job/",
                    "https://www.glassdoor.de/Job/",
                    "https://www.glassdoor.es/Job/",
                    "https://www.glassdoor.es/Empleo/",
                    "https://www.glassdoor.fr/Job/",
                    "https://www.glassdoor.fr/Emploi/",
                    "https://www.glassdoor.com.hk/Job/",
                    "https://www.glassdoor.co.in/Job/",
                    "https://www.glassdoor.ie/Job/",
                    "https://www.glassdoor.it/Job/",
                    "https://www.glassdoor.it/Lavoro/",
                    "https://www.glassdoor.com.mx/Job/",
                    "https://www.glassdoor.com.mx/Empleo/",
                    "https://www.glassdoor.nl/Job/",
                    "https://www.glassdoor.nl/Vacature/",
                    "https://www.glassdoor.co.nz/Job/",
                    "https://www.glassdoor.at/Job/",
                    "https://de.glassdoor.ch/Job/",
                    "https://www.glassdoor.sg/Job/",
                    "https://fr.glassdoor.ch/Job/",
                    "https://fr.glassdoor.ch/Emploi/",
                    "https://www.glassdoor.co.uk/Job/",
                    "https://www.glassdoor.com/Job/",
                    "https://www.glassdoor.com.ar/member/profile/savedJobActivity",
                    "https://www.glassdoor.com.au/member/profile/savedJobActivity",
                    "https://nl.glassdoor.be/member/profile/savedJobActivity",
                    "https://fr.glassdoor.be/member/profile/savedJobActivity",
                    "https://www.glassdoor.com.br/member/profile/savedJobActivity",
                    "https://www.glassdoor.ca/member/profile/savedJobActivity",
                    "https://fr.glassdoor.ca/member/profile/savedJobActivity",
                    "https://www.glassdoor.de/member/profile/savedJobActivity",
                    "https://www.glassdoor.es/member/profile/savedJobActivity",
                    "https://www.glassdoor.fr/member/profile/savedJobActivity",
                    "https://www.glassdoor.com.hk/member/profile/savedJobActivity",
                    "https://www.glassdoor.co.in/member/profile/savedJobActivity",
                    "https://www.glassdoor.ie/member/profile/savedJobActivity",
                    "https://www.glassdoor.it/member/profile/savedJobActivity",
                    "https://www.glassdoor.com.mx/member/profile/savedJobActivity",
                    "https://www.glassdoor.nl/member/profile/savedJobActivity",
                    "https://www.glassdoor.co.nz/member/profile/savedJobActivity",
                    "https://www.glassdoor.at/member/profile/savedJobActivity",
                    "https://de.glassdoor.ch/member/profile/savedJobActivity",
                    "https://www.glassdoor.sg/member/profile/savedJobActivity",
                    "https://fr.glassdoor.ch/member/profile/savedJobActivity",
                    "https://www.glassdoor.co.uk/member/profile/savedJobActivity",
                    "https://www.glassdoor.com/member/profile/savedJobActivity"
                ]

                if (updatedTabId === tab.id && changeInfo.status === 'complete' && STORE.enableWrongReturn) {
                    chrome.tabs.get(updatedTabId, (tabInfo) => {
                        for (prefix of glassdoorUrlPrefixes) {
                            if (tabInfo.url.startsWith(prefix)) {
                                return;
                            }
                        }

                        console.log('wrong return', tabInfo.url);
                        STORE.agentGeometry.wrongReturned = true;
                        saveStoreToStorage();
                        chrome.tabs.update(updatedTabId, { url: STORE.tasks.search.url });
                        
                    });
                }
            });
        }

        if (typeof sendResponse === 'function') {
            sendResponse({type: 'SUCCESS'});
        }

    }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
}

async function finishError(reason) {
    if (STORE.nonstop && reason != 'NotAuthorized') {
        retryCurrentPlaftormAtTheEnd()
    }

    if (STORE.platformsFlow.length) {
        shiftPlatformAndRole(STORE.session, STORE.platformsFlow);
        startSearchTask();
        return;
    }

    if (STORE.session.liftsCurrent || STORE.nonstop) {
        return finishSuccess();
    }

    await fetchWithRetry(`${buildServerUrl()}/finish`, {
        method: 'PUT',
        headers: buildFetchHeaders()
    })
        .then(handleTextFetchResponse)
        .then((data) => {

            let event_str;
            if (reason === 'NotAuthorized') {
                event_str = 'not-authorized-error';
            } else {
                event_str = 'send-cv-finished-error';
            }

            chrome.tabs.query({
                url: ['https://app.liftmycv.com/*', 'https://dev.liftmycv.com:*/*', 'http://localhost:*/*']
            })
                .then((tabs) => {
                    if (!tabs) {
                        return;
                    }
                    tabs.forEach(tab => {
                        chrome.scripting.executeScript({
                            args: [event_str],
                            func: (event_str) => window.dispatchEvent(new Event(event_str)),
                            target: {tabId: tab.id},
                        }).then(() => console.log("injected a function"));
                    });
                });

            STORE.finished = true;
            chrome.windows.remove(STORE.windowId, () => {
            });
        });
}

async function finishSuccess(reason, status) {
    if (STORE.platformsFlow.length && reason !== 'lifts-out' && reason !== 'window-closed') {
        shiftPlatformAndRole(STORE.session, STORE.platformsFlow);
        startSearchTask();
        return;
    }

    // Continuous run: when the entire flow has been exhausted, refill from the original
    // flow and cycle back to the beginning indefinitely.
    // Only stops on explicit user interruption (lifts-out or window-closed).
    if (STORE.continuousRun && STORE.continuousRunOriginalFlow.length > 0 &&
        reason !== 'lifts-out' && reason !== 'window-closed') {
        STORE.platformsFlow = [...STORE.continuousRunOriginalFlow];
        STORE.nonstopRetryLimit = NONSTOP_RETRY_MAX; // reset retry counter for the new cycle
        shiftPlatformAndRole(STORE.session, STORE.platformsFlow);
        startSearchTask();
        return;
    }

    let event_str;
    let arg;
    const isStop = status === 'stop';

    if (STORE.nonstop) {
        event_str = 'send-cv-finished-nonstop-success'
        arg = {
            failedSubmissions: STORE.failedSubmissions,
            successfulSubmissions: STORE.successfulSubmissions,
            isStop,
        }
    } else {
        arg = { ...STORE.session, isStop };
        event_str = 'send-cv-finished-success'
    }

    
    if (status != 'already-stopped') {
        await fetchWithRetry(isStop ? `${buildServerUrl()}/stop` : `${buildServerUrl()}/finish`, {
            method: 'PUT',
            headers: buildFetchHeaders()
        }).then(handleTextFetchResponse)
    }
   
            chrome.tabs.query({
                url: ['https://app.liftmycv.com/*', 'https://dev.liftmycv.com:*/*', 'http://localhost:*/*']
            })
                .then((tabs) => {
                    if (!tabs) {
                        return;
                    }
                    tabs.forEach(tab => {
                        chrome.scripting.executeScript({
                            args: [event_str, arg],
                            func: (event_str, arg) => {
                                window.dispatchEvent(new CustomEvent(event_str, {
                                    detail: arg
                                }));
                            },
                            target: {tabId: tab.id},
                        }).then(() => console.log("injected a function"));
                    });
                }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error));

            STORE.finished = true;

            if (reason !== 'window-closed') {
                try{
                    chrome.windows.remove(STORE.windowId);
                } catch {}
            }

}

function sendErrorToServer(url, details) {
    if (!STORE || !STORE.serverBaseUrl) {
        console.error('unable to send error to server: server base url not found');
        return;
    }

    fetchWithRetry(`${buildServerUrl()}/log/error`, {
        body: JSON.stringify({
            url,
            details
        }),
        method: 'POST',
        headers: buildFetchHeaders()
    })
        .then(handleJsonFetchResponse)
        .then(() => {
            console.log('error sent to server');
        })
        .catch((error) => {
            console.trace('send error to server error', error);
        });
}

function closeSendCvTabAndSearchNext(sendResponse, status, message, terminated) {
    STORE.applyTabOpened = null;
    STORE.searchTabTimestamp = Date.now();
    saveStoreToStorage();
    if (!STORE.joinedTab) {
        try {
            chrome.tabs.remove(STORE.tasks.sendCv.tabId);
        } catch {}
    }
    chrome.tabs.sendMessage(STORE.tasks.search.tabId, {
        type: "SEARCH-NEXT",
        data: {url: STORE.tasks.sendCv.url, status: status ?? 'SUCCESS', message, terminated}
    }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
    chrome.runtime.sendMessage({ action: "updatePopup"});
    STORE.tasks.sendCv = {
        ...SEND_CV_TASK_DEFAULT
    };
    
}

function stopApplyOne(success) {
    STORE.applyOne = false;
    STORE.tasks.sendCv = {...SEND_CV_TASK_DEFAULT};
    const boardApplyTab = STORE.boardApplyTab;
    STORE.boardApplyTab = null;
    saveStoreToStorage();
    if (boardApplyTab) {
        setTimeout(() => {
            if (success) {
                boardApplyFinished();
            } else {
                boardApplyAborted();
            }
            chrome.tabs.remove(boardApplyTab).catch(() => {});
        }, 3000);
    }
}

function cvSubmitted(sendResponse) {
    STORE.applyTabOpened = null;
    STORE.searchTabTimestamp = Date.now();
    STORE.submittedLinks.push({url: STORE.tasks.sendCv.url, details: null, status: 'SUCCESS'});
    console.log(STORE.tasks.sendCv.url, 'added to submittedLinks');
    console.log(STORE.submittedLinks);
    STORE.successfulSubmissions++;
    saveStoreToStorage();
    const historyDetails = STORE.historyDetails;
    STORE.historyDetails = {};
    fetchWithRetry(`${buildServerUrl()}/cv-submitted`, {
        body: JSON.stringify({url: STORE.tasks.sendCv.url, hasManualEdits: STORE.tasks.sendCv.has_manual_edits === true, hasManualFixes: STORE.tasks.sendCv.has_manual_fixes === true, ...historyDetails}),
        method: 'PUT',
        headers: buildFetchHeaders()
    })
        .then(handleJsonFetchResponse)
        .then((data) => {
            if (!STORE.started) {
                stopApplyOne(true);
                return;
            }

            const platform = STORE.session.platform;
            STORE.session = data;
            STORE.session.platform = platform;

            const after = () => {

                sendResponse({
                    type: 'SUCCESS'
                });

                const oldSendCvTask = STORE.tasks.sendCv;

                STORE.tasks.sendCv = {
                    ...SEND_CV_TASK_DEFAULT
                };

                const {liftsLimit, liftsCurrent} = data;

                if (liftsCurrent >= liftsLimit) {
                    finishSuccess('lifts-out').catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
                } else {
                    chrome.tabs.sendMessage(STORE.tasks.search.tabId, {
                        type: "SEARCH-NEXT",
                        data: {url: oldSendCvTask.url, status: 'SUCCESS', terminated: data.unlim && data.status != 'ACTIVE'}
                    }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
                    chrome.runtime.sendMessage({ action: "updatePopup"});
                }

            }

            if (STORE.joinedTab) {
                after();
            } else {
                chrome.tabs.remove(STORE.tasks.sendCv.tabId).then(after).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
            }

        })
        .catch((error) => {
            if (error?.message?.includes('Session reached max lifts limit.')) {
                finishSuccess('lifts-out').catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
            }
            logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);
        });
}

function cvNotSubmitted(sendResponse, url, type, details) {
    if (details == 'skipped by user') {
        if (STORE.session.skipDisabled) {
            sendResponse({
                type: 'ERROR',
                data: "limit reached"
            });
            return;
        }
        if (STORE.session.trial) {
            STORE.session.skipDisabled = true;
            saveStoreToStorage();
        }
    }
    
    if (type != 'SKIP') {
        STORE.failedSubmissions++;
    }
    const historyDetails = STORE.historyDetails;
    STORE.historyDetails = {};
    
    fetchWithRetry(`${buildServerUrl()}/cv-not-submitted`, {
        body: JSON.stringify({url, type, details, hasManualEdits: STORE.tasks.sendCv.has_manual_edits === true, ...historyDetails}),
        method: 'PUT',
        headers: buildFetchHeaders()
    })
        .then(handleJsonFetchResponse)
        .then((data) => {
            if (!STORE.started) {
                stopApplyOne(false);
                return;
            }

            const {liftsLimit, liftsCurrent} = data;

            if (liftsCurrent >= liftsLimit) {
                finishSuccess('lifts-out').catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
            } else {
                closeSendCvTabAndSearchNext(sendResponse, 'ERROR', `${type}: ${details}`, data.unlim && data.status != 'ACTIVE');
            }
        })
        .catch((error) => {
            console.error(error);
            sendResponse({
                type: 'ERROR',
                data: error.message
            });
        });
}

function getBaseOrigin() {
    if (STORE?.serverBaseUrl) {
        return STORE?.serverBaseUrl.endsWith('/') ? STORE?.serverBaseUrl.substring(0, STORE?.serverBaseUrl.lastIndexOf('/')) : STORE?.serverBaseUrl;
    } else {
        return 'https://app.liftmycv.com';
    }
}

function getWebSocketUrl() {
    return getBaseOrigin().replace(/^http/, 'ws') + '/ws/';
}

function getContentScripts() {
    const manifest = chrome.runtime.getManifest();
    return manifest.content_scripts || [];
}

function urlMatchesPattern(url, pattern) {
    // Конвертируем pattern в regex
    const regexPattern = pattern
        .replace(/\./g, '\\.') 
        .replace(/\*/g, '.*')
        .replace(/\?/g, '\\?');
    
    const regex = new RegExp('^' + regexPattern + '$');
    return regex.test(url);
}

function getMatchingContentScripts(url) {
    const contentScripts = getContentScripts();
    
    return contentScripts.filter(script => {
        // Проверяем matches
        const matchesPattern = script.matches?.some(pattern => 
            urlMatchesPattern(url, pattern)
        );
        
        if (!matchesPattern) return false;
        
        // Проверяем exclude_matches
        const excludeMatches = script.exclude_matches?.some(pattern => 
            urlMatchesPattern(url, pattern)
        );
        
        return !excludeMatches;
    });
}

async function reloadContentScriptsOnAllTabs() {
    try {
        console.log('Starting content scripts reload on all tabs...');
        
        // Получаем все вкладки во всех окнах
        const allTabs = await chrome.tabs.query({});
        
        console.log(`Found ${allTabs.length} tabs to process`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const tab of allTabs) {
            try {
                // Исключаем специальные вкладки
                if (tab.id === STORE?.tasks?.sendCv?.tabId || 
                    tab.id === STORE?.tasks?.search?.tabId) {
                    continue;
                }
                
                // Проверяем, что URL валидный
                if (!tab.url || tab.url.startsWith('chrome://') || 
                    tab.url.startsWith('chrome-extension://') ||
                    tab.url.startsWith('edge://') ||
                    tab.url.startsWith('about:')) {
                    continue;
                }
                
                // Находим подходящие content scripts для этой вкладки
                const matchingScripts = getMatchingContentScripts(tab.url);
                
                if (matchingScripts.length === 0) {
                    continue;
                }
                
                console.log(`Processing tab ${tab.id}: ${tab.url}`);
                
                await chrome.tabs.reload(tab.id);
                
                successCount++;
                
            } catch (tabError) {
                console.error(`Error processing tab ${tab.id}:`, tabError);
                errorCount++;
                continue; // Переходим к следующей вкладке
            }
        }
        
        console.log(`Content scripts reload completed. Success: ${successCount}, Errors: ${errorCount}`);
        
    } catch (error) {
        console.error('Error in reloadContentScriptsOnAllTabs:', error);
    }
}

function reloadAppTab() {
    chrome.tabs.query({
                url: ['https://app.liftmycv.com/*', 'https://dev.liftmycv.com:*/*', 'http://localhost:*/*']
    })
        .then((tabs) => {
            if (!tabs) {
                return;
            }
            tabs.forEach(tab => {
                chrome.scripting.executeScript({
                    func: () => window.dispatchEvent(new Event('reload-settings')),
                    target: {tabId: tab.id},
                }).then(() => console.log("reload-settings"));
            });
        }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error));
    
}

function boardApplyFinished() {
    console.log('🎉 boardApplyFinished called');
    const event_str = 'board-apply-finished';
    const arg = {
        url: STORE.boardApplyUrl,
        historyDetails: STORE.historyDetails
    }
    console.log('boardApplyFinished data:', arg);

    chrome.tabs.query({
                url: ['https://app.liftmycv.com/*', 'https://dev.liftmycv.com:*/*', 'http://localhost:*/*']
            })
                .then((tabs) => {
                    if (!tabs) {
                        return;
                    }
                    tabs.forEach(tab => {
                        chrome.scripting.executeScript({
                            args: [event_str, arg],
                            func: (event_str, arg) => {
                                window.dispatchEvent(new CustomEvent(event_str, {
                                    detail: arg
                                }));
                            },
                            target: {tabId: tab.id},
                        }).then(() => console.log('✅ board-apply-finished event injected to tab', tab.id));
                    });
                }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error));
    
}

function boardApplyAborted() {
    console.log('⚠️ boardApplyAborted called');
    const event_str = 'board-apply-aborted';
    const arg = {
        url: STORE.boardApplyUrl,
        historyDetails: STORE.historyDetails
    }
    console.log('boardApplyAborted data:', arg);

    chrome.tabs.query({
                url: ['https://app.liftmycv.com/*', 'https://dev.liftmycv.com:*/*', 'http://localhost:*/*']
            })
                .then((tabs) => {
                    if (!tabs) {
                        return;
                    }
                    tabs.forEach(tab => {
                        chrome.scripting.executeScript({
                            args: [event_str, arg],
                            func: (event_str, arg) => {
                                window.dispatchEvent(new CustomEvent(event_str, {
                                    detail: arg
                                }));
                            },
                            target: {tabId: tab.id},
                        }).then(() => console.log('⚠️ board-apply-aborted event injected to tab', tab.id));
                    });
                }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error));
    
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.type != 'APPLY-TAB-KEEPALIVE') {
        console.log('INCOMING MESSAGE', request, sender)
    }

    loadStoreFromStorage().then(() => {

    const {type, data} = request;

    try {

        if (type === 'GET-SEND-CV-TASK' && (!STORE.session || !STORE.profile)) {
            bootstrapSessionFromDashboard().catch(() => {});
        }

        switch (type) {

            case 'CHECK-SESSION':

                if (sender?.tab?.id !== STORE?.tasks?.sendCv?.tabId && sender?.tab?.id !== STORE?.tasks?.search?.tabId) {
                    sendResponse({
                        type: 'ERROR',
                        message: 'Tab do not match'
                    });
                    return;
                }

                console.log('CHECK-SESSION OK');
                sendResponse({
                    type: 'SUCCESS'
                });

                break;

            case 'GET-SEARCH-TASK':

                if (!STORE.session || !STORE?.tasks?.search?.tabId) {
                    
                    sendResponse({
                        type: 'ERROR',
                        message: 'Session do not started',
                        data: {applyOneEnabled: STORE.applyOneEnabled, isBoardApply: STORE.isBoardApply}
                    });
                    return;
                }

                if (!sender?.tab?.id || sender?.tab?.id !== STORE?.tasks?.search?.tabId) {
                    
                    sendResponse({
                        type: 'ERROR',
                        message: 'Tab do not match',
                        data: {applyOneEnabled: STORE.applyOneEnabled, isBoardApply: STORE.isBoardApply, isApplyTab: sender?.tab?.id === STORE?.tasks?.sendCv?.tabId}
                    });
                    return;
                }

                STORE.searchTabTimestamp = Date.now();
                STORE.agentGeometry.isApplyOne = !STORE.started;
                saveStoreToStorage();

                sendResponse({
                    type: 'SUCCESS',
                    data: {
                        ...STORE?.tasks?.search,
                        submittedLinks: STORE.submittedLinks,
                        agentGeometry: STORE.agentGeometry,
                        agentMessages: STORE.agentMessages,
                        agentMode: STORE.agentMode,
                        session: STORE.session,
                        nonstop: STORE.nonstop,
                        profile: {
                            num: STORE?.profile?.num,
                            title: STORE?.profile?.title,
                        },
                        resumePerJob: STORE.session.resumePerJob,
                    }
                });

                if (STORE?.agentGeometry?.wrongReturned) {
                    STORE.agentGeometry.wrongReturned = false;
                    saveStoreToStorage();
                }

                break;
            case 'SEARCH-TASK-ERROR':
                console.error(data);
                if (STORE.nonstop) {
                    finishError(data);
                }
                break;
            case 'NOT-AUTHORIZED-ERROR':
                console.error(data);
                finishError('NotAuthorized');
                break;
            case 'SEARCH-TASK-DONE':
                finishSuccess().catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
                break;

            case 'GET-SEND-CV-TASK':

                if (!STORE.session || !STORE?.tasks?.sendCv?.tabId) {
                    
                    sendResponse({
                        type: 'ERROR',
                        message: 'Session do not started or send cv task not found',
                        data: {applyOneEnabled: STORE.applyOneEnabled || STORE.isBoardApply, isBoardApply: STORE.isBoardApply}
                    });
                    return;
                }

                if (STORE?.tasks?.sendCv?.tabId == 'new') {
                    STORE.tasks.sendCv.tabId = sender?.tab?.id;
                }

                if (STORE?.tasks?.sendCv?.tabId == 'new-double') {
                    STORE.tasks.sendCv.tabId = 'new';
                }
                
                if (!sender?.tab?.id || sender?.tab?.id !== STORE?.tasks?.sendCv?.tabId) {
                    if (STORE?.tasks?.sendCv?.tabId != 'new') {
                        sendResponse({
                            type: 'ERROR',
                            message: 'Tab do not match',
                            data: {applyOneEnabled: STORE.applyOneEnabled || STORE.isBoardApply, isBoardApply: STORE.isBoardApply}
                        });
                        return;
                    }
                }

                STORE.applyTabTimestamp = Date.now();

                if (STORE.setAutopilotMode && STORE.session.agentMode == 'Autopilot') {
                    STORE.agentMode = 'Autopilot';
                    STORE.setAutopilotMode = false;
                }

                STORE.agentGeometry.isApplyOne = !STORE.started;

                saveStoreToStorage();

                const sessionData = (STORE.session.platform === 'ATS' || STORE.session.platform === 'QUEUE')
                    ? { ...STORE.session, workplace: 'ANY', country: null, city: null }
                    : STORE?.session;

                sendResponse({
                    type: 'SUCCESS',
                    data: {
                        devMode: STORE.devMode,
                        profile: STORE?.profile,
                        session: sessionData,
                        avatarUrl: STORE.avatarUrl,
                        agentGeometry: STORE.agentGeometry,
                        agentMessages: STORE.agentMessages,
                        agentMode: STORE.agentMode,
                        nonstop: STORE.nonstop,
                        successfulSubmissions: STORE.applyOne ? 1 : STORE.successfulSubmissions,
                        failedSubmissions: STORE.failedSubmissions,
                        url: STORE.tasks.sendCv.url
                    }
                });

                break;
            case "SEND-CV-TASK":

                // Сбрасываем флаги ручных правок для нового задания
                // В режиме Copilot пользователь всегда редактирует вручную
                STORE.tasks.sendCv.has_manual_edits = STORE.session.agentMode === 'Copilot';
                STORE.tasks.sendCv.has_manual_fixes = false;

                // Проверяем если нужно получить лучший URL для ATS или QUEUE платформ
                (async () => {
                    let jobUrl = data.url;

                    if (STORE.session.platform === 'ATS' || STORE.session.platform === 'QUEUE') {
                        try {
                            console.log('Fetching best job URL for:', jobUrl);
                            const response = await fetchWithRetry(
                                `${buildServerUrl()}/select-best-job-url?url=${encodeURIComponent(jobUrl)}`,
                                {
                                    method: 'GET',
                                    headers: buildFetchHeaders()
                                },
                                10000, // totalTimeout 10 секунд
                                8000,  // requestTimeout 8 секунд
                                2000   // delay 2 секунды
                            );
                            const result = await handleJsonFetchResponse(response);
                            if (result && result.url) {
                                console.log('Using best job URL:', result.url, 'instead of:', jobUrl);
                                jobUrl = result.url;
                            }
                        } catch (error) {
                            console.error('Error fetching best job URL, using original:', error);
                            // jobUrl остается data.url в случае ошибки
                        }
                    }

                    const applyUrl = resolveSendCvApplyUrlDependsOnPlatform(jobUrl, STORE.session.platform);

                    STORE.applyTabTimestamp = Date.now();

                    if (STORE.joinedTab) {
                        STORE.applyTabOpened = Date.now();
                        STORE.tasks.sendCv.url = applyUrl;
                        STORE.tasks.sendCv.tabId = STORE.tasks.search.tabId;
                        STORE.tasks.sendCv.active = true;
                        STORE.tasks.sendCv.finalUrl = applyUrl;
                        saveStoreToStorage();
                        sendResponse({
                            type: 'SUCCESS'
                        });
                        return;
                    }

                    sendResponse({
                        type: 'SUCCESS'
                    });

                    chrome.tabs.create({
                        url: applyUrl,
                        windowId: STORE.windowId
                    }).then((tab) => {
                        STORE.applyTabOpened = Date.now();
                        STORE.tasks.sendCv.url = jobUrl;
                    STORE.tasks.sendCv.tabId = tab.id;
                    STORE.tasks.sendCv.active = true;
                    STORE.tasks.sendCv.finalUrl = applyUrl;

                    saveStoreToStorage();

                    chrome.tabs.onUpdated.addListener(function(updatedTabId, changeInfo) {
                        
                        if (tab.id != STORE.tasks.sendCv.tabId) {
                            chrome.tabs.onUpdated.removeListener(arguments.callee);
                        }

                        if (updatedTabId === tab.id && (changeInfo.status === 'complete' || STORE?.session?.platform?.startsWith('GLASSDOOR'))) {
                            
                            chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                func: () => {
                                    Object.defineProperty(window, 'debugger', {
                                            value: () => {},
                                            configurable: true,
                                            writable: true
                                    }); 

                                    const originalAddEventListener = window.addEventListener;
                                    window.addEventListener = function(type, listener, options) {
                                      if (type === 'beforeunload') {
                                        console.warn('Blocked beforeunload');
                                        return;
                                      }
                                      return originalAddEventListener.call(this, type, listener, options);
                                    };
                                },
                                world: "MAIN"
                            }).then(() => {
                                console.log('debugger disabled');
                            }).catch(error => {
                                console.error('error disabling debugger', error);
                                logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);

                                chrome.tabs.get(updatedTabId, async (tabInfo) => {
                                    const leverAppId = new URL(tabInfo.url)?.searchParams?.get('LeverAppId');
                                    if (leverAppId && STORE.tasks?.sendCv?.url?.includes(leverAppId)) {
                                        cvSubmitted(sendResponse);
                                    }
                                });
                            });
                        }
                    });


                    if (STORE.session.platform == 'RECRUITEE' || STORE.session.platform == 'WORKABLE' || STORE.session.platform == 'GREENHOUSE' ) {
                        chrome.tabs.onUpdated.addListener(function(updatedTabId, changeInfo) {
                            if (updatedTabId === tab.id) {
                                chrome.tabs.onUpdated.removeListener(arguments.callee);
                                chrome.tabs.get(updatedTabId, async (tabInfo) => {
                                    let domain = new URL(tabInfo.url).hostname;
                                    if (!domain.endsWith('.recruitee.com') && !domain.endsWith('.workable.com') && domain != 'job-boards.greenhouse.io') {
                                        console.log('Redirect to unsupported domain occurred')
                                        STORE.applyTabOpened = null;
                                        STORE.searchTabTimestamp = Date.now();
                                        let tabs = await chrome.tabs.query({
                                            windowId: STORE.windowId
                                        });
                                        for (let i = 0; i < tabs.length; i++) {
                                            if (tabs[i].id === STORE.tasks.search.tabId) {
                                                continue;
                                            }
                                            chrome.tabs.remove(tabs[i].id).then(() => console.log('close unsupported tab'))
                                                .catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error));
                                        }
                                    
                                        const oldSendCvTask = STORE.tasks.sendCv;
                                        STORE.tasks.sendCv = {
                                            ...SEND_CV_TASK_DEFAULT
                                        };
                                        chrome.tabs.sendMessage(STORE.tasks.search.tabId, {
                                            type: "SEARCH-NEXT",
                                            data: {url: oldSendCvTask.url, status: 'ERROR', message: 'Redirect to unsupported domain occurred'}
                                        });
                                        
                                    }
                                })
                            }
                        });
                    }

                    if (STORE.session.platform === 'GLASSDOOR' || STORE.session.platform === 'GLASSDOOR_SEARCH' || STORE.session.platform === 'GLASSDOOR_BOOKMARKS') {
                        if (tab.id != STORE.tasks.sendCv.tabId) {
                            chrome.tabs.onUpdated.removeListener(arguments.callee);
                        }
                        
                        chrome.tabs.onUpdated.addListener(function(updatedTabId, changeInfo) {
                            if (updatedTabId === tab.id && changeInfo.status === 'complete') {
                                chrome.scripting.executeScript({
                                    target: { tabId: tab.id },
                                    func: () => {
                                        if (window.__liftmycvWindowOpenOverrideInstalled) {
                                            return;
                                        }
                                        window.__liftmycvWindowOpenOverrideInstalled = true;

                                        const sendInterceptedUrl = (candidateUrl) => {
                                            if (!candidateUrl || candidateUrl === 'about:blank') {
                                                return;
                                            }
                                            window.postMessage({ type: 'INTERCEPTED_URL', url: candidateUrl }, '*');
                                        };

                                        const noop = () => {};

                                        window.open = function(url, target, features) {
                                            sendInterceptedUrl(typeof url === 'string' ? url : null);

                                            const locationProxy = {};
                                            Object.defineProperties(locationProxy, {
                                                href: {
                                                    enumerable: true,
                                                    get: () => 'about:blank',
                                                    set: (value) => sendInterceptedUrl(value),
                                                },
                                                assign: {
                                                    enumerable: true,
                                                    value: (value) => sendInterceptedUrl(value)
                                                },
                                                replace: {
                                                    enumerable: true,
                                                    value: (value) => sendInterceptedUrl(value)
                                                },
                                                toString: {
                                                    enumerable: false,
                                                    value: () => 'about:blank'
                                                }
                                            });

                                            const fakeWindow = {
                                                closed: false,
                                                close() {
                                                    this.closed = true;
                                                },
                                                focus: noop,
                                                blur: noop,
                                                print: noop,
                                                postMessage: noop,
                                                stop: noop,
                                                moveTo: noop,
                                                moveBy: noop,
                                                resizeTo: noop,
                                                resizeBy: noop,
                                                get opener() {
                                                    return null;
                                                },
                                                set opener(_) {}
                                            };

                                            Object.defineProperty(fakeWindow, 'location', {
                                                configurable: true,
                                                enumerable: true,
                                                get: () => locationProxy,
                                                set: (value) => sendInterceptedUrl(value)
                                            });

                                            return fakeWindow;
                                        };
                                    },
                                    world: "MAIN"
                                }).then(() => {
                                    console.log('window.open overrided');
                                }).catch(error => {
                                    console.error('error override window.open', error);
                                    logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);
                                });
                            }
                        });
                    }


                }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));

                })(); // Закрываем async IIFE
                
                break;
            case 'SEND-CV-TASK-SKIP':
                console.warn(data);
                cvNotSubmitted(sendResponse, STORE.tasks.sendCv.url, 'SKIP', data);
                break;
            
            case 'SEND-CV-TASK-DONE':
                cvSubmitted(sendResponse);
                break;
            case 'SEND-CV-TASK-ERROR':
                cvNotSubmitted(sendResponse, STORE.tasks.sendCv.url, 'ERROR', data);
                break;
            case 'SET-HAS-MANUAL-EDITS':
                STORE.tasks.sendCv.has_manual_edits = true;
                sendResponse({type: 'SUCCESS'});
                break;
            case 'SET-HAS-MANUAL-FIXES':
                STORE.tasks.sendCv.has_manual_fixes = true;
                sendResponse({type: 'SUCCESS'});
                break;
            case 'GET-HISTORY-DETAILS':
                sendResponse({type: 'SUCCESS', data: STORE.historyDetails});
                break;
            case 'CONVERT-RESUME':
                fetchWithRetry(`${buildServerUrl()}/convert-resume`, {
                    body: JSON.stringify({htmlContent: data.htmlContent}),
                    method: 'POST',
                    headers: buildFetchHeaders()
                })
                    .then(handleJsonFetchResponse)
                    .then(mr => {
                        if (mr.url) {
                            STORE.historyDetails.cv = mr.url;
                            saveStoreToStorage();
                        }
                        sendResponse({type: 'SUCCESS', data: mr});
                    })
                    .catch((error) => {
                        console.error(error);
                        logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);
                        sendResponse({type: 'ERROR', data: errorToString(error)});
                    });
                break;
            case 'SET-MATCH-SCORE':
                if (!STORE.historyDetails) {
                    STORE.historyDetails = {};
                }
                STORE.historyDetails.matchScore = data;
                saveStoreToStorage();
                sendResponse({type: 'SUCCESS'});
                break;
            case 'SET-HISTORY-DETAILS':
                STORE.historyDetails = data;
                saveStoreToStorage();

                if (data.company?.trim() && !data.quick && !data.company?.startsWith('https://')) {
                    fetchWithRetry(`${buildServerUrl()}/is-ignored-company?value=${encodeURIComponent(data.company)}&url=${encodeURIComponent(data.url || STORE.tasks.sendCv.url)}`, {
                        method: 'GET',
                        headers: buildFetchHeaders()
                    })
                        .then(handleJsonFetchResponse)
                        .then(ignored => {
                            console.log(ignored)
                            if (ignored) {
                                sendResponse({type: 'SKIP'});
                                cvNotSubmitted(sendResponse, STORE.tasks.sendCv.url, 'SKIP', 'ignored company');
                            } else {
                                sendResponse({type: 'SUCCESS', data: STORE.session});
                            }
                        })
                        .catch((error) => {
                            console.error(error);
                            logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);
                            sendResponse({type: 'SUCCESS', data: STORE.session});
                        });
                } else {
                    sendResponse({type: 'SUCCESS', data: STORE.session});
                }
                break;
            case 'GET-VACANCY-COUNTRIES-CITIES':
                fetchWithRetry(`${buildServerUrl()}/resolve-countries-cities?value=${encodeURIComponent(data)}`, {
                    method: 'GET',
                    headers: buildFetchHeaders()
                }, RESOLVE_COUNTRIES_CITIES_TIMEOUT, RESOLVE_COUNTRIES_CITIES_TIMEOUT, 15000)
                    .then(handleJsonFetchResponse)
                    .then(data => {
                        sendResponse({
                            type: 'SUCCESS',
                            data: {
                                cities: data.cities,
                                countries: data.countries,
                            }
                        });
                    })
                    .catch((error) => {
                        console.error(error);
                        sendResponse({
                            type: 'ERROR',
                            data: error.message
                        });
                    });
                break;
            case 'GET-WEBSOCKET-URL':
                fetchWithRetry(`${buildServerUrl()}/origin-key`, {
                    body: JSON.stringify({originKey: "now"}),
                    method: 'POST',
                    headers: buildFetchHeaders()
                })
                    .then(handleJsonFetchResponse)
                    .then((data) => {
                        sendResponse({
                            type: 'SUCCESS',
                            data: {
                                url: getWebSocketUrl(),
                                apiKey: STORE?.session?.apiKey,
                                originKey: data.originKey,
                                historyDetails: STORE.historyDetails,
                                successfulSubmissions: STORE.successfulSubmissions,
                                failedSubmissions: STORE.failedSubmissions
                            }
                        });
                    })
                    .catch((error) => {
                        console.error(error);
                        sendResponse({
                            type: 'ERROR',
                            data: error.message
                        });
                    });

                break;

            case 'EMAIL-ACCESS-ENABLED':
                fetchWithRetry(`${buildServerUrl()}/email-access-enabled`, {
                    method: 'GET',
                    headers: buildFetchHeaders()
                })
                .then(handleTextFetchResponse)
                .then(res => {
                    sendResponse({type: 'SUCCESS', data: res});
                })
                .catch((error) => {
                    console.error(error);
                    logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);
                    sendResponse({type: 'SUCCESS', data: 'DISABLED'});
                });
                
                break;

            case 'ENABLE-EMAIL-ACCESS':
                fetchWithRetry(`${buildServerUrl()}/enable-email-access`, {
                    method: 'PUT',
                    headers: buildFetchHeaders()
                })
                .then(handleTextFetchResponse)
                .then(res => {
                    sendResponse({type: 'SUCCESS'});
                })
                .catch((error) => {
                    console.error(error);
                    logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);
                    sendResponse({type: 'ERROR'});
                });
                
                break;

            case 'DISABLE-EMAIL-ACCESS':
                fetchWithRetry(`${buildServerUrl()}/disable-email-access`, {
                    method: 'PUT',
                    headers: buildFetchHeaders()
                })
                .then(handleTextFetchResponse)
                .then(res => {
                    sendResponse({type: 'SUCCESS'});
                })
                .catch((error) => {
                    console.error(error);
                    logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);
                    sendResponse({type: 'ERROR'});
                });
                
                break;

            case 'SEND-ERROR-TO-SERVER':
                sendErrorToServer(data.url, data.details);
                break;

            case 'SEND-CV-TAB-TIMER-ENDED':
                sendErrorToServer(STORE.tasks.sendCv.url, errorToString('Timer ended'));
                cvNotSubmitted(sendResponse, STORE.tasks.sendCv.url, 'TIMER_ENDED', 'timer ended');
                break;

            case 'SAVE-AGENT-GEOMETRY':
                if (JSON.stringify(STORE.agentGeometry) != JSON.stringify(data)) {
                    STORE.agentGeometry = data;
                    saveStoreToStorage();
                }
                break;

            case 'ENABLE-WRONG-RETURN':
                STORE.enableWrongReturn = true;
                saveStoreToStorage();
                break;

            case 'SET-COPILOT-MODE':
                STORE.agentMode = 'Copilot';
                saveStoreToStorage();
                break;

            case 'UNSET-COPILOT-MODE':
                if (STORE.session.agentMode == 'Autopilot') {
                    STORE.setAutopilotMode = true;
                    saveStoreToStorage();
                    sendResponse({
                        type: 'SUCCESS',
                    });
                } else {
                    sendResponse({
                        type: 'ERROR',
                    });
                }
                break;

            case 'UNSET-COPILOT-NOW':
                if (STORE.session.agentMode == 'Autopilot') {
                    STORE.agentMode = 'Autopilot';
                    if (STORE.applyTabOpened) {
                        STORE.applyTabOpened = Date.now();
                    }
                    saveStoreToStorage();
                    sendResponse({
                        type: 'SUCCESS',
                    });
                } else {
                    sendResponse({
                        type: 'ERROR',
                    });
                }
                break;
            
            
            case 'STOP-APPLYING':
                finishSuccess('lifts-out', 'stop');
                break;

            case 'GET-STATS':
                sendResponse({
                    type: 'SUCCESS',
                    data: {
                        successfulSubmissions: STORE.successfulSubmissions,
                        failedSubmissions: STORE.failedSubmissions
                    }
                });
                break;

            case 'CAN-SKIP-CHALLENGE':
                if (STORE.nonstop && !STORE.platformsChallengeSkipped.includes(STORE.session.platform)) {
                    sendResponse({
                        type: 'SUCCESS',
                    });
                } else {
                    sendResponse({
                        type: 'ERROR',
                    });
                }
                break;

            case 'PLATFORM-SKIP-CHALLENGE':
                if (STORE.nonstop && !STORE.platformsChallengeSkipped.includes(STORE.session.platform)) {
                    finishError(data);
                    STORE.platformsChallengeSkipped.push(STORE.session.platform);
                    sendResponse({
                        type: 'SUCCESS',
                    });
                } else {
                    sendResponse({
                        type: 'ERROR',
                        data: 'already skipped or not nonstop mode'
                    });
                }
                break;

            case 'AGENT-MESSAGE':
                STORE.agentMessages.push(data);
                saveStoreToStorage();
                
                // Send agent message to apply-log endpoint
                if (STORE && STORE.serverBaseUrl && data.message) {
                    fetchWithRetry(`${buildServerUrl()}/apply-log`, {
                        body: JSON.stringify({message: data.message}),
                        method: 'POST',
                        headers: buildFetchHeaders()
                    })
                }
                
                if (sender?.tab?.id !== STORE?.tasks?.search?.tabId && STORE?.tasks?.search?.tabId) {
                    chrome.tabs.sendMessage(STORE.tasks.search.tabId, {
                        type: "AGENT-MESSAGE",
                        data: data
                    }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
                }
                break;

            case 'APPLY-TAB-KEEPALIVE':
                if (!sender?.tab?.id || sender?.tab?.id !== STORE?.tasks?.sendCv?.tabId) {
                    return;
                }

                STORE.applyTabTimestamp = Date.now();
                saveStoreToStorage();
                
                break;

            case 'APPLY-EXTERNAL-NAV-BLOCKED':
                // Content script prevented an external link/window.open during apply (consent policy links).
                console.warn('APPLY-EXTERNAL-NAV-BLOCKED', data);
                logConsoleAndSendToServerAndSendResponseIfNeed(
                    `Apply blocked external navigation (${data?.kind || '?'}): ${data?.href || ''}`,
                    null
                );
                // Keep apply tab focused if something already stole focus
                if (sender?.tab?.id) {
                    chrome.tabs.update(sender.tab.id, { active: true }).catch(() => {});
                    if (sender.tab.windowId != null) {
                        chrome.windows.update(sender.tab.windowId, { focused: true }).catch(() => {});
                    }
                }
                break;

            case 'CLICK-N-BUTTON':
                chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    func: (selector1, n, selector2) => {
                        console.log(selector1, n, selector2);
                        document.querySelectorAll(selector1)[n].querySelector(selector2).click();
                    },
                    args: [data.selector1, data.n, data.selector2],
                    world: "MAIN"
                }).then(() => {
                    console.log('button clicked');
                }).catch(error => {
                    console.error('error clicking button', data.selector, error);
                    logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);
                });
                
                break;

            case 'SEND-CV-TAB-NOT-RESPOND':
                if (STORE.agentMode == 'Copilot') {
                    console.log("timer is disabled in copilot mode");
                    break;
                }
                chrome.tabs.query({
                    windowId: STORE.windowId
                }).then(tabs => {
                    if (!STORE.joinedTab) {
                        for (let i = 0; i < tabs.length; i++) {
                            if (tabs[i].id === STORE.tasks.search.tabId) {
                                continue;
                            }
                            chrome.tabs.remove(tabs[i].id).then(() => console.log('close hanged tab'))
                                .catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
                        }
                    }
                    const oldSendCvTask = STORE.tasks.sendCv;
                    STORE.tasks.sendCv = {
                        ...SEND_CV_TASK_DEFAULT
                    };
                    chrome.tabs.sendMessage(STORE.tasks.search.tabId, {
                        type: "SEARCH-NEXT",
                        data: {url: oldSendCvTask.url, status: 'ERROR', message: 'Hanged tab closed (not respond)'}
                    }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
                }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
                break;

            case "UPDATE-TOGGLERS":
                new Promise(async (resolve) => {
                    try {
                        fetchWithRetry(`${buildServerUrl()}/update-settings`, {
                            body: JSON.stringify(data),
                            method: 'POST',
                            headers: buildFetchHeaders()
                        })
                            .then(handleJsonFetchResponse)
                            .then((data) => {
                                reloadAppTab();
                                sendResponse({
                                    type: 'SUCCESS',
                                });
                            })
                            .catch((error) => {
                                console.error(error);
                                sendResponse({
                                    type: 'ERROR',
                                    data: errorToString(error)
                                });
                            });
                    } catch {
                        chrome.tabs.create({ url: 'https://app.liftmycv.com/?installed-version=' + chrome.runtime.getManifest().version });
                        sendResponse({
                            type: 'ERROR'
                        });
                    }
                })
                break;

            case "POPUP-STATS-GET":
                new Promise(async (resolve) => {
                    try {
                        await clearStaleStartedSessionIfNeeded();

                        const tabs = await chrome.tabs.query({});

                        let boardApply = false;
                        if (STORE.boardApplyTab) {
                            boardApply = tabs.some(t => t.id === STORE.boardApplyTab);
                        }

                        let applyOne = false;
                        if (STORE.applyOne) {
                            applyOne = tabs.some(t => STORE.tasks?.sendCv?.tabId && t.id === STORE.tasks.sendCv.tabId);
                        }

                        fetchWithRetry(`${buildServerUrl()}/stats`, {
                            method: 'GET',
                            headers: buildFetchHeaders()
                        }, 12000, 5000, 5000)
                            .then(handleJsonFetchResponse)
                            .then((data) => {
                                if (typeof data.resumePerJob === "boolean") {
                                    if (data.resumePerJob != STORE.session.resumePerJob) {
                                        console.log("Setting resumePerJob to", data.resumePerJob);
                                        STORE.session.resumePerJob = data.resumePerJob;
                                        saveStoreToStorage();
                                    }
                                }
                                sendResponse({
                                    type: 'SUCCESS',
                                    data: {
                                        active: STORE?.started,
                                        applyOneEnabled: STORE?.applyOneEnabled,
                                        boardApply,
                                        applyOne,
                                        ...data
                                    }
                                });
                            })
                            .catch((error) => {
                                console.error(error);
                                sendResponse({
                                    type: 'ERROR',
                                    data: {
                                        active: STORE?.started,
                                        applyOneEnabled: STORE?.applyOneEnabled,
                                        boardApply,
                                        applyOne,
                                        error: errorToString(error)
                                    }
                                });
                            });
                    } catch {
                        sendResponse({
                            type: 'SUCCESS',
                            data: {
                                applyOneEnabled: STORE?.applyOneEnabled,
                                active: STORE?.started,
                            }
                        });
                    }
                })
                break;
            case "POPUP-STOP-APPLYING":
                new Promise(async (resolve) => {
                    // Always clear local session state so the popup / web app can
                    // recover even when the working window is already gone (e.g.
                    // after a browser restart) or the backend /stop call fails.
                    if (!STORE?.started) {
                        clearSession();
                        sendResponse({
                            type: 'SUCCESS'
                        });
                        return;
                    }

                    try {
                        await Promise.race([
                            finishSuccess('lifts-out', 'stop'),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('stop timeout')), 15000)
                            )
                        ]);
                    } catch (error) {
                        console.error(error);
                        bestEffortStopBackendSession();
                    }

                    clearSession();
                    sendResponse({
                        type: 'SUCCESS'
                    });
                });
                break;

            case "POPUP-CONTINUE-APPLYING":
                startSearchTask(sendResponse);
                break;

            case "SET-PROFILE":
                new Promise(async (resolve) => {
                    try {
                        const profileId = data.profileId;
                        if (!profileId) {
                            sendResponse({
                                type: 'ERROR',
                                data: 'Profile ID is required'
                            });
                            return;
                        }

                        fetchWithRetry(`${buildServerUrl()}/set-profile?profileId=${profileId}`, {
                            method: 'PUT',
                            headers: buildFetchHeaders()
                        })
                            .then(handleJsonFetchResponse)
                            .then(() => {
                                sendResponse({
                                    type: 'SUCCESS'
                                });
                            })
                            .catch((error) => {
                                console.error('Failed to set profile:', error);
                                sendResponse({
                                    type: 'ERROR',
                                    data: errorToString(error)
                                });
                            });
                    } catch (error) {
                        console.error('Failed to set profile:', error);
                        sendResponse({
                            type: 'ERROR',
                            data: errorToString(error)
                        });
                    }
                });
                break;

            case "GET-SUBMITTED-LINKS":
                if (STORE.agentMessages && STORE.agentMessages.length) {
                    STORE.agentMessages = [];
                    saveStoreToStorage();
                }

                if (STORE.loadedSubmittedLinks) {
                    sendResponse({
                        type: 'SUCCESS',
                        data: STORE.submittedLinks
                    });
                } else {
                    console.log('Fetching submitted links from server');
                    fetchWithRetry(`${buildServerUrl()}/submitted-links`, {
                        method: 'GET',
                        headers: buildFetchHeaders()
                    })
                        .then(handleJsonFetchResponse)
                        .then(data => {
                            console.log(data);
                            STORE.submittedLinks = data;
                            STORE.loadedSubmittedLinks = true;
                            sendResponse({
                                type: 'SUCCESS',
                                data
                            });
                            saveStoreToStorage();
                        })
                        .catch((error) => {
                            console.error(error);
                            sendResponse({
                                type: 'ERROR',
                                data: []
                            });
                        });
                }
                
                break;

            case "START-APPLY-ONE":

                chrome.tabs.query({}).then((tabs) => {

                let isSearchTab = false;
                let isApplyTab = false;

                for (let i = 0; i < tabs.length; i++) {
                    if (STORE.tasks.search.tabId && tabs[i].id === STORE.tasks.search.tabId) {
                        if (!tabs[i].active) {
                            isSearchTab = true;
                        }
                    }

                    if (STORE.tasks.sendCv.tabId && tabs[i].id === STORE.tasks.sendCv.tabId && STORE.applyTabOpened) {
                        if (!tabs[i].active) {
                            isApplyTab = true;
                        }
                    }
                }

                if (STORE.started) {
                    if (isSearchTab || isApplyTab) {
                        sendResponse({type: 'AGAIN'});
                        console.warn('Start apply one: session is active');
                        return;
                    }
                }

                if (STORE.applyOne) {
                    for (let i = 0; i < tabs.length; i++) {
                        if (STORE.tasks?.sendCv?.tabId && tabs[i].id === STORE.tasks.sendCv.tabId) {
                            if (!tabs[i].active) {
                                sendResponse({type: 'AGAIN'});
                                console.warn('Start apply one: another apply one is active');
                                return;
                            }
                            break;
                        }
                    }
                }

                console.log('Start apply one');
                fetchWithRetry(`${buildServerUrl()}/profile`, {
                    method: 'GET',
                    headers: buildFetchHeaders()
                })
                    .then(handleJsonFetchResponse)
                    .then(profile => {
                        console.log(profile);
                        STORE.applyOne = true;
                        STORE.profile = profile;
                        STORE.avatarUrl = profile.avatarUrl;
                        STORE.agentMode = 'Copilot';
                        STORE.session.searchAccuracy = "Broad match";
                        STORE.session.platform = "APPLY_ONE";
                        STORE.session.workplace = "ANY";
                        STORE.session.datePosted = "Any";
                        STORE.session.country = "";
                        STORE.session.city = "";
                        STORE.session.role = "";
                        STORE.session.liftsLimit = 1;
                        STORE.session.liftsCurrent = 0;
                        STORE.tasks.sendCv.url = data.url;
                        STORE.nonstop = false;

                        if (data.tab == "current") {
                            STORE.tasks.sendCv.tabId = sender.tab.id;
                        } else {
                            STORE.tasks.sendCv.tabId = data.tab;
                        }

                        saveStoreToStorage();

                        const tab = sender.tab;

                        chrome.tabs.onUpdated.addListener(function(updatedTabId, changeInfo) {
                        
                            if (tab.id != STORE.tasks.sendCv.tabId) {
                                chrome.tabs.onUpdated.removeListener(arguments.callee);
                            }

                            if (updatedTabId === tab.id && (changeInfo.status === 'complete')) {
                                
                                chrome.scripting.executeScript({
                                    target: { tabId: tab.id },
                                    func: () => {
                                        Object.defineProperty(window, 'debugger', {
                                                value: () => {},
                                                configurable: true,
                                                writable: true
                                        });
                                    },
                                    world: "MAIN"
                                }).then(() => {
                                    console.log('debugger disabled');
                                }).catch(error => {
                                    console.error('error disabling debugger', error);
                                    logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse);
                                });
                            }
                        });

                        sendResponse({
                            type: 'SUCCESS',
                            data: profile
                        });
                        
                    })
                    .catch((error) => {
                        console.error(error);
                        sendResponse({
                            type: 'ERROR',
                            message: errorToString(error)
                        });
                    });
                
                });
                break;

            case "APPLY-ONE-OPEN-NEW-TAB":
                chrome.tabs.create({
                    url: STORE.tasks.sendCv.url
                }).then(tab => {
                    STORE.tasks.sendCv.tabId = tab.id;
                    saveStoreToStorage();
                });
                break;

            case "RELOGIN-START":
                chrome.tabs.create({
                    url: getBaseOrigin() + '/login?installed-version=' + chrome.runtime.getManifest().version + '&relogin=true',
                    active: false
                }).then(tab => {
                    STORE.reloginPending = true;
                    STORE.reloginTabId = tab.id;
                    STORE.returnTabId = sender?.tab?.id
                    saveStoreToStorage();
                    sendResponse({type: 'SUCCESS'});
                });
                break;

            case "RELOGIN-IS-COMPLETED":
                if (!STORE.reloginPending) {
                    chrome.tabs.update(STORE.returnTabId, {
                        active: true
                    });
                    sendResponse({type: 'SUCCESS'});
                } else {
                    sendResponse({type: 'ERROR'});
                }
                break;

            case "RELOGIN-FOCUS":
                chrome.tabs.update(STORE.reloginTabId, {
                    active: true
                });
                break;

            case "GO-TO-PROFILE":
                chrome.tabs.create({url: getBaseOrigin() + '/#/profile'});
                break;

            case "STOP-APPLY-ONE":
                stopApplyOne(false);
                break;

            case "STOP-APPLY-ONE-FROM-POPUP":
                if (!STORE.boardApplyTab && STORE.tasks?.sendCv?.tabId) {
                    chrome.tabs.get(STORE.tasks.sendCv.tabId)
                        .then(() => chrome.tabs.reload(STORE.tasks.sendCv.tabId))
                        .catch(() => {});
                }
                stopApplyOne(false);
                sendResponse({type: 'SUCCESS'});
                break;

            case "APPLY-ONE-ENABLED":
                sendResponse({type: 'SUCCESS', data: STORE.applyOneEnabled});
                break;

            case "DISABLE-APPLY-ONE":
                STORE.applyOneEnabled = false;
                saveStoreToStorage();
                reloadAppTab();
                break;

            case "ENABLE-APPLY-ONE":
                STORE.applyOneEnabled = true;
                saveStoreToStorage();
                reloadContentScriptsOnAllTabs();
                reloadAppTab();
                break;

            case "RESET-BOARD-APPLY":
                STORE.isBoardApply = null;
                saveStoreToStorage();
                sendResponse({type: 'SUCCESS', data: {showStartButton: STORE.showStartButton}});
                break;

            case "GET-DELAY":
                if (STORE.agentMode == 'Autopilot') {
                    sendResponse({type: 'SUCCESS', data: Number(STORE.session.delay) || 0});
                } else {
                    sendResponse({type: 'SUCCESS', data: 0});
                }
                break;

            case "SEARCH-EMAIL":

                sendResponse({
                    type: 'SUCCESS'
                });

                if (!STORE.gAccountNum) {
                    STORE.gAccountNum = 0;
                }

                chrome.tabs.create({
                    url: `https://mail.google.com/mail/u/${STORE.gAccountNum}/#search/` + encodeURIComponent(data.query),
                    windowId: STORE.windowId
                }).then((tab) => {
                    STORE.tasks.searchEmail = data;
                    STORE.tasks.searchEmail.tabId = tab.id;
                    STORE.tasks.searchEmail.resTabId = sender.tab.id;
                    STORE.tasks.searchEmail.timestamp = Date.now();

                    saveStoreToStorage();

                    chrome.tabs.onUpdated.addListener(function(updatedTabId, changeInfo) {
                        
                        if (tab.id != STORE.tasks.searchEmail.tabId) {
                            chrome.tabs.onUpdated.removeListener(arguments.callee);
                        }

                        if (updatedTabId === tab.id && (changeInfo.status === 'complete')) {
                            chrome.tabs.get(updatedTabId, (tabInfo) => {
                                console.log(tabInfo.url);
                                if (!tabInfo.url) { return ;}
                                if (tabInfo.url.startsWith('https://mail.google.com/mail/u/')) {
                                    let num = Number(tabInfo.url.split('/')[5]);
                                    if (!num) { num = 0; }
                                    STORE.gAccountNum = num;
                                    saveStoreToStorage();
                                    console.log(STORE.gAccountNum);
                                } else {
                                    STORE.gAccountNum += Math.random() < 0.5 ? 1 : 2;;
                                    saveStoreToStorage();
                                    console.log(STORE.gAccountNum);
                                    chrome.tabs.update(updatedTabId, { url: `https://mail.google.com/mail/u/${STORE.gAccountNum}/#search/` + encodeURIComponent(data.query) });
                                }
                            });
                        }
                    });


                }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));

                break;

            case 'GET-SEARCH-EMAIL':

                if (!STORE.session || !STORE?.tasks?.searchEmail?.tabId) {
                    
                    sendResponse({
                        type: 'ERROR',
                        message: 'Session do not started'
                    });
                    return;
                }

                if (!sender?.tab?.id || sender?.tab?.id !== STORE?.tasks?.searchEmail?.tabId) {
                    
                    sendResponse({
                        type: 'ERROR',
                        message: 'Tab do not match'
                    });
                    return;
                }

                sendResponse({
                    type: 'SUCCESS',
                    data: {
                        ...STORE?.tasks?.searchEmail,
                        agentGeometry: STORE.agentGeometry,
                        agentMessages: STORE.agentMessages,
                        agentMode: STORE.agentMode,
                    }
                });

                break;

            case "SEARCH-EMAIL-DONE":

                chrome.tabs.remove(STORE.tasks.searchEmail.tabId).then(() => {

                    sendResponse({type: 'SUCCESS'});

                    STORE.gAccountNum = data.gAccountNum;
                    saveStoreToStorage();

                    chrome.tabs.sendMessage(STORE.tasks.searchEmail.resTabId || STORE.tasks.sendCv.tabId, {
                        type: "EMAIL-FINISHED",
                        data
                    }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));

                }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));

                break;

            case 'GET-SITE-PASSWORD':
                fetchWithRetry(`${buildServerUrl()}/site-password`, {
                    method: 'POST',
                    body: JSON.stringify({ origin: data?.origin || '' }),
                    headers: buildFetchHeaders(),
                })
                    .then(handleJsonFetchResponse)
                    .then((response) => sendResponse({ type: 'SUCCESS', data: response }))
                    .catch((error) => {
                        console.error('Failed to get site password', error);
                        sendResponse({ type: 'ERROR', data: errorToString(error) });
                    });
                break;

            default:
                break;
        }

    } catch (e) {
        console.trace('MESSAGE PROCESSING ERROR', e);
        sendErrorToServer(SERVICE_WORKER_URL_FOR_ERROR_LOGGING, errorToString(e));
        sendResponse({
            type: 'ERROR',
            message: e.message
        });
    }

    });

    return true;

});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {

    loadStoreFromStorage().then(() => {

    console.log("REQUEST FROM WEB PAGE", request, sender);

    const {type, data} = request;

    try {

        switch (type) {
            case "PING":
                sendResponse({type: 'PONG'});
                break;
            case "STOP":
                finishSuccess('lifts-out', 'already-stopped')
                break;
            case "START":

                console.log('START DATA', JSON.stringify(data))

                STORE.devMode = data.devMode;
                STORE.profile = data.profile;
                STORE.session = data.session;
                STORE.avatarUrl = data.avatarUrl;
                STORE.serverBaseUrl = data.serverBaseUrl;
                STORE.frontendBaseUrl = data.frontendBaseUrl;
                STORE.submittedLinks = data.submittedLinks;
                STORE.finished = false;
                STORE.agentMode = data.session.agentMode;
                STORE.applyOne = false;
                STORE.agentMessages = [];
                STORE.failedSubmissions = 0;
                STORE.successfulSubmissions = 0;

                if (STORE.session.platform === 'ALL') {
                    if (data.platformsFlow && data.platformsFlow.length) {
                        STORE.platformsFlow = makePlatformsFlowEx(data.platformsFlow, STORE.session);
                    } else {
                        STORE.platformsFlow = makePlatformsFlow(STORE.session);
                    }
                    // Set up continuous run before shifting first platform
                    STORE.continuousRun = data.continuousRun === true;
                    if (STORE.continuousRun) {
                        STORE.continuousRunOriginalFlow = [...STORE.platformsFlow];
                    } else {
                        STORE.continuousRunOriginalFlow = [];
                    }
                    shiftPlatformAndRole(STORE.session, STORE.platformsFlow);
                    STORE.nonstop = true;
                } else {
                    STORE.platformsFlow = []
                    STORE.continuousRun = false;
                    STORE.continuousRunOriginalFlow = [];
                }

                chrome.windows.create({state: 'maximized'}).then(window => {

                    STORE.windowId = window.id;
                    STORE.windowTimestamp = Date.now();

                    startSearchTask(sendResponse);

                    chrome.alarms.create("heartbeat", { delayInMinutes: 1, periodInMinutes: 1 });
                    chrome.power.requestKeepAwake("system");
                
                }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));

                break;
            case 'GET-VERSION':
                sendResponse({type: 'SUCCESS', data: chrome.runtime.getManifest().version});
                break;

            case 'GET-STARTED':
                clearStaleStartedSessionIfNeeded().then(() => {
                    sendResponse({type: 'SUCCESS', data: STORE.started});
                }).catch((error) => {
                    console.error(error);
                    sendResponse({type: 'SUCCESS', data: false});
                });
                break;

            case "BOARD-APPLY-START":
                console.log('BOARD-APPLY-START DATA', JSON.stringify(data));
                
                STORE.serverBaseUrl = data.serverBaseUrl;
                if (!STORE.session) {
                    STORE.session = {}
                }
                STORE.session.apiKey = data.apiKey;
                STORE.isBoardApply = Date.now();
                STORE.showStartButton = data.showStartButton;
                STORE.boardApplyUrl = data.urls[0];
                saveStoreToStorage();

                chrome.tabs.create({
                    url: data.urls[0]
                }).then((tab) => {
                    STORE.boardApplyTab = tab.id;
                    saveStoreToStorage();
                }).catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error, sendResponse));
                
                break;
            
            case "LOGIN":
                console.log('LOGIN DATA', JSON.stringify(data));
                STORE.serverBaseUrl = data.serverBaseUrl;
                if (!STORE.session) {
                    STORE.session = {}
                }
                STORE.session.apiKey = data.apiKey;
                STORE.session.resumePerJob = data.resumePerJob;
                STORE.reloginPending = false;
                saveStoreToStorage();
                break;

            case "LOGOUT":
                setTimeout(() => {
                    STORE.session = null;
                    STORE.loadedSubmittedLinks = false;
                    saveStoreToStorage();
                }, STORE?.started ? 5000 : 50);

                if (STORE?.started) {
                    finishSuccess('lifts-out', 'stop');
                }
                
                break;

            case "APPLY-ONE-ENABLED":
                sendResponse({type: 'SUCCESS', data: STORE.applyOneEnabled});
                break;

            case "DISABLE-APPLY-ONE":
                STORE.applyOneEnabled = false;
                saveStoreToStorage();
                break;

            case "ENABLE-APPLY-ONE":
                STORE.applyOneEnabled = true;
                saveStoreToStorage();
                reloadContentScriptsOnAllTabs()
                break;
                
            default:
                sendResponse({type: 'ERROR', data: 'Unknown message type'});
                break;
        }

    } catch (e) {
        console.error('MESSAGE PROCESSING ERROR', e);
        sendErrorToServer('SERVICE-WORKER-ON-MESSAGE-EXTERNAL', errorToString(e));
        sendResponse({
            type: 'ERROR',
            message: e.message
        })
    }

    });
    return true;
});

chrome.windows.onRemoved.addListener(async (windowId) => {
    await loadStoreFromStorage();

    if (!STORE.started || windowId !== STORE.windowId) {
        return;
    }

    try {
        if (!STORE.finished) {
            if (STORE.nonstop && STORE.tasks.search.tabId) {
                retryCurrentPlaftormAtTheEnd()
            
                if (STORE.platformsFlow.length) {
                    shiftPlatformAndRole(STORE.session, STORE.platformsFlow);
                    STORE.tasks.search.tabId = null;

                    // Prevent clearStaleStartedSessionIfNeeded from wiping the
                    // session while the replacement working window is being created.
                    STORE.reopeningWindow = true;
                    saveStoreToStorage();

                    chrome.windows.create({state: 'maximized', url: 'popup.html#reopened-window'}).then(window => {

                        STORE.windowId = window.id;
                        STORE.windowTimestamp = Date.now();
                        STORE.reopeningWindow = false;

                        saveStoreToStorage();
                
                    }).catch(error => {
                        STORE.reopeningWindow = false;
                        logConsoleAndSendToServerAndSendResponseIfNeed(error);
                    });

                    return;        
                }
                
            }

            await finishSuccess('window-closed', 'stop');

        }
    } catch (e) {
        console.error('Error in windows onRemoved handler', e);
        sendErrorToServer('Error in windows onRemoved handler', errorToString(e));
    }

    clearSession();

});

/**
 * Hosts we auto-apply on (from chrome-extension/manifest.json host_permissions /
 * content_scripts). New tabs to these hosts opened from the apply tab must NOT be
 * closed — only truly external consent/policy sites (e.g. safelite.com).
 */
function isSupportedApplyPlatformHost(hostname) {
    const h = String(hostname || '').toLowerCase();
    if (!h) return false;
    if (h === 'localhost' || h === '127.0.0.1') return true;

    // Exact / suffix matches derived from manifest host_permissions + content_scripts.
    const suffixAllow = [
        'liftmycv.com',
        'myworkdayjobs.com',
        'myworkday.com',
        'workday.com',
        'lever.co',
        'smartrecruiters.com',
        'linkedin.com',
        'workable.com',
        'monster.com',
        'monster.ca',
        'recruitee.com',
        'ashbyhq.com',
        'breezy.hr',
        'greenhouse.io',
        'wellfound.com',
        'indeed.com',
        'google.com',
        'recaptcha.net',
    ];
    if (suffixAllow.some((d) => h === d || h.endsWith('.' + d))) return true;

    // Glassdoor regional hosts (www.glassdoor.co.uk, fr.glassdoor.ch, nl.glassdoor.be, …)
    if (/(^|\.)glassdoor\./i.test(h)) return true;

    return false;
}

function isExternalApplyTabUrl(url) {
    if (!url || url === 'about:blank' || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        return false; // wait for real URL via onUpdated
    }
    try {
        const u = new URL(url);
        // Supported apply/search hosts — keep the tab. Everything else is external.
        if (isSupportedApplyPlatformHost(u.hostname)) return false;
        return true;
    } catch (_) {
        return false;
    }
}

async function closeExternalTabOpenedFromApply(tab, reason) {
    const applyTabId = STORE.tasks?.sendCv?.tabId;
    if (!applyTabId || typeof applyTabId !== 'number' || !tab?.id || tab.id === applyTabId) return;
    const url = tab.pendingUrl || tab.url || '';
    console.warn('Closing external tab opened during apply:', tab.id, url, reason);
    try {
        await chrome.tabs.remove(tab.id);
    } catch (e) {
        console.error('Failed to close external apply tab', e);
        return;
    }
    try {
        await chrome.tabs.update(applyTabId, { active: true });
        const applyTab = await chrome.tabs.get(applyTabId);
        if (applyTab?.windowId != null) {
            await chrome.windows.update(applyTab.windowId, { focused: true });
        }
    } catch (e) {
        console.error('Failed to refocus apply tab', e);
    }
    try {
        await chrome.tabs.sendMessage(applyTabId, {
            type: 'APPLY-EXTERNAL-TAB-CLOSED',
            data: { url, pendingUrl: tab.pendingUrl || '', reason, tabId: tab.id },
        });
    } catch (_) { /* apply tab may be busy */ }
    logConsoleAndSendToServerAndSendResponseIfNeed(
        `External tab opened during apply and closed: ${url || reason}`,
        null
    );
}

// New tabs opened from the apply tab (e.g. consent label → safelite.com arbitration) steal focus.
chrome.tabs.onCreated.addListener(async (tab) => {
    try {
        await loadStoreFromStorage();
        if (!STORE.tasks?.sendCv?.active) return;
        const applyTabId = STORE.tasks.sendCv.tabId;
        if (!applyTabId || typeof applyTabId !== 'number') return;
        if (tab.id === applyTabId) return;
        if (tab.openerTabId !== applyTabId) return;

        const url = tab.pendingUrl || tab.url || '';
        if (url && isExternalApplyTabUrl(url)) {
            await closeExternalTabOpenedFromApply(tab, 'onCreated');
            return;
        }
        // about:blank / empty — wait for navigation URL
        STORE._pendingExternalApplyTabs = STORE._pendingExternalApplyTabs || {};
        STORE._pendingExternalApplyTabs[tab.id] = { openerTabId: applyTabId, at: Date.now() };
        await saveStoreToStorage();
    } catch (e) {
        console.error('tabs.onCreated external-guard error', e);
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    try {
        if (!changeInfo.url && changeInfo.status !== 'loading') return;
        await loadStoreFromStorage();
        if (!STORE.tasks?.sendCv?.active) return;
        const applyTabId = STORE.tasks.sendCv.tabId;
        if (!applyTabId || typeof applyTabId !== 'number') return;
        if (tabId === applyTabId) return;

        const pending = STORE._pendingExternalApplyTabs?.[tabId];
        const fromApply = tab.openerTabId === applyTabId || Boolean(pending);
        if (!fromApply) return;

        const url = changeInfo.url || tab.url || tab.pendingUrl || '';
        if (!isExternalApplyTabUrl(url)) return;

        if (STORE._pendingExternalApplyTabs) {
            delete STORE._pendingExternalApplyTabs[tabId];
            await saveStoreToStorage();
        }
        await closeExternalTabOpenedFromApply(tab, 'onUpdated');
    } catch (e) {
        console.error('tabs.onUpdated external-guard error', e);
    }
});

// Глобальный обработчик закрытия вкладок (переживает перезагрузку Service Worker)
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    await loadStoreFromStorage();

    if (STORE._pendingExternalApplyTabs?.[tabId]) {
        delete STORE._pendingExternalApplyTabs[tabId];
        await saveStoreToStorage();
    }

    // Проверяем, закрылась ли вкладка board apply
    if (STORE.boardApplyTab && tabId === STORE.boardApplyTab) {
        console.log('Board apply tab closed:', tabId);
        boardApplyAborted();
        STORE.boardApplyTab = null;
        STORE.isBoardApply = null;
        STORE.boardApplyUrl = null;
        await saveStoreToStorage();
    }
});

chrome.alarms.onAlarm.addListener(async () => {
    console.log("heartbeat");
    await loadStoreFromStorage();

    if (!STORE.started) {
        return;
    }

    try {
        if (!STORE.windowId) {
            throw new Error('windowId missing');
        }
        await chrome.windows.get(STORE.windowId);
    } catch (e) {
        console.warn('Window with STORE.windowId does not exist, clearing session');
        if (STORE.reopeningWindow) {
            return;
        }
        if (STORE.nonstop && !STORE.noWindow) {
            STORE.noWindow = true;
            saveStoreToStorage();
        } else {
            STORE.noWindow = false;
            finishSuccess('window-closed', 'stop');
            clearSession();
        }
        return;
    }

    if (STORE.agentMode == 'Copilot') {
        console.log("heartbeat is disabled in copilot mode");
        return;
    }

    try {
        let tabs = await chrome.tabs.query({
            windowId: STORE.windowId
        });

        let isSearchTab = false;
        let isApplyTab = false;

        let hangedApplyTab = false;
        let hangedSearchTab = false;

        for (let i = 0; i < tabs.length; i++) {
            if (STORE.tasks.search.tabId && tabs[i].id === STORE.tasks.search.tabId) {
                isSearchTab = true;
            }

            if (STORE.tasks.sendCv.tabId && tabs[i].id === STORE.tasks.sendCv.tabId && STORE.applyTabOpened) {
                isApplyTab = true;
            }
        }

        if (isApplyTab) {
            if (Date.now() - STORE.applyTabTimestamp > 90_000) {
                console.log('apply tab hanged: no keepalive within 90 seconds');
                hangedApplyTab = true;
            } else {
                if (Date.now() - STORE.applyTabTimestamp > 30_000) {
                    console.log('apply tab hanged: no keepalive within 30 seconds');
                    try {
                        if (STORE?.tasks?.sendCv?.tabId) {
                            await chrome.scripting.executeScript({
                                target: { tabId: STORE.tasks.sendCv.tabId },
                                world: 'MAIN',
                                func: () => {
                                    
                                    const rand = (min, max) => Math.floor(min + Math.random() * (max - min));
                                    const x = rand(Math.floor(window.innerWidth * 0.2), Math.floor(window.innerWidth * 0.8));
                                    const y = rand(Math.floor(window.innerHeight * 0.2), Math.floor(window.innerHeight * 0.8));

                                    const movementX = rand(-3, 5);
                                    const movementY = rand(-3, 5);

                                    const target = document.elementFromPoint(x, y) || document.body || document.documentElement;

                                    const init = {
                                        bubbles: true,
                                        cancelable: true,
                                        clientX: x,
                                        clientY: y,
                                        movementX,
                                        movementY,
                                        screenX: x,
                                        screenY: y,
                                        view: window
                                    };

                                    const evt = new MouseEvent('mousemove', init);
                                    
                                    target.dispatchEvent(evt);
                                    document.dispatchEvent(new MouseEvent('mousemove', init));
                                    window.dispatchEvent(new MouseEvent('mousemove', init));
                                    
                                },
                            });
                            console.log('synthetic mousemove dispatched to apply tab');
                        }
                    } catch (e) {
                        console.error('error dispatching mousemove to apply tab', e);
                        hangedApplyTab = true;
                    }
                }
            }
            if (Date.now() - STORE.applyTabOpened > 60_000 * 8) {
                console.log('apply tab hanged: opened more 8 minutes');
                hangedApplyTab = true;
            }
        } else {

            if (isSearchTab) {
                if (Date.now() - STORE.searchTabTimestamp > 60_000 && Date.now() - STORE.applyTabOpened > 30_000) {
                    console.log('search tab hanged: no requests within 60 seconds');
                    hangedSearchTab = true;
                }
            }
        }

        if (STORE.joinedTab) {
            if (hangedApplyTab || (STORE.applyTabOpened && !isApplyTab)) {
                hangedSearchTab = true;
            }
        }

        if (hangedSearchTab || (!isSearchTab)) {
            if (Date.now() - STORE.windowTimestamp > 60_000) {
                console.log('restarting search task');
                if (STORE.nonstop) {
                    finishError('search-tab-closed');
                } else {
                    startSearchTask();
                }
            } else {
                console.log('window is fresh, no restarting');
            }
        } else {
            if (hangedApplyTab) {
                for (let i = 0; i < tabs.length; i++) {
                    if (tabs[i].id === STORE.tasks.search.tabId) {
                        continue;
                    }
                    chrome.tabs.remove(tabs[i].id).then(() => console.log('close hanged tab'))
                        .catch(error => logConsoleAndSendToServerAndSendResponseIfNeed(error));
                }
            }

                        if (hangedApplyTab || (STORE.applyTabOpened && !isApplyTab)) {
                console.log('search next');
                const oldSendCvTask = STORE.tasks.sendCv;
                STORE.tasks.sendCv = {
                    ...SEND_CV_TASK_DEFAULT
                };
                chrome.tabs.sendMessage(STORE.tasks.search.tabId, {
                    type: "SEARCH-NEXT",
                    data: {url: oldSendCvTask.url, status: 'ERROR', message: 'Hanged tab closed'}
                });
            }
        }
    } catch (e) {
        console.error('Error in alarm', e);
        sendErrorToServer('Error in alarm', errorToString(e));
    }
    
});

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD ADAPTER — routes this worker to the AutoApply CV dashboard
// instead of app.liftmycv.com. Session/CV data is synthesized from the
// dashboard profile+resume; apply results are pushed into the CareerPilot
// portal import queue so they surface on the dashboard.
// ═══════════════════════════════════════════════════════════════════
const DASHBOARD_ORIGINS = [
    "https://www.autoapplycv.in",
    "https://autoapplycv.in",
    "https://autoapplycv.vercel.app",
    "https://app.liftmycv.com",
    "https://dev.liftmycv.com",
];

const DASHBOARD_SETTINGS_PREFIX = "cpSettings";
const DASHBOARD_PORTAL_QUEUE_KEY = "cpPortalImportQueue";

async function getDashboardOrigin() {
    try {
        const snap = await chrome.storage.local.get([DASHBOARD_SETTINGS_PREFIX]);
        const settings = snap?.[DASHBOARD_SETTINGS_PREFIX] || {};
        const base = String(settings?.apiBaseUrl || "").trim().replace(/\/$/, "");
        if (base && /^https?:\/\//.test(base)) {
            try { return new URL(base).origin; } catch {}
        }
    } catch {}
    return DASHBOARD_ORIGINS[0];
}

async function fetchDashboardProfile() {
    for (const origin of DASHBOARD_ORIGINS) {
        try {
            const res = await fetch(`${origin}/api/user/resume`, { cache: "no-store", credentials: "include" });
            if (!res.ok) continue;
            const body = await res.json().catch(() => null);
            if (body && body.data) return body.data;
        } catch {}
    }
    return null;
}

function buildLiftProfileFromDashboard(payload = {}) {
    const profile = payload.profile || {};
    const parsed = (payload.parsed || {}) || {};
    const name = String(profile.name || parsed.name || "").trim();
    const parts = name.split(/\s+/);
    const experience = Array.isArray(parsed.experience) ? parsed.experience : [];
    const education = Array.isArray(parsed.education) ? parsed.education : [];
    return {
        num: 1,
        title: String(parsed.headline || profile.name || "My Profile"),
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
        fullName: name,
        email: String(profile.email || "").trim(),
        phone: String(profile.phone || "").trim(),
        city: String(profile.currentCity || profile.addressLine || "").trim(),
        country: "",
        linkedinUrl: String(profile.linkedinUrl || "").trim(),
        websiteUrl: String(profile.portfolioUrl || "").trim(),
        coverLetter: String(parsed.summary || "").trim(),
        professionalSummary: String(parsed.summary || "").trim(),
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        experiences: experience,
        educations: education,
    };
}

function buildLiftSessionFromDashboard(profile) {
    return {
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phone: profile.phone || "",
        city: profile.city || "Any",
        country: "any",
        role: "Resume",
        cvUrl: "",
        coverLetter: profile.coverLetter || "",
        linkedinUrl: profile.linkedinUrl || "",
        websiteUrl: profile.websiteUrl || "",
        githubUrl: "",
        visaSponsorship: false,
        resumePerJob: false,
        apiKey: "",
    };
}

async function bootstrapSessionFromDashboard() {
    try {
        const payload = await fetchDashboardProfile();
        if (!payload || !payload.profile || !payload.profile.email) return null;
        const profile = buildLiftProfileFromDashboard(payload);
        STORE.profile = profile;
        STORE.session = buildLiftSessionFromDashboard(profile);
        STORE.serverBaseUrl = (await getDashboardOrigin()) + "/";
        STORE.historyDetails = {};
        saveStoreToStorage();
        console.log("[adapter] session synthesized from AutoApplyCV profile");
        return STORE.session;
    } catch (error) {
        console.error("[adapter] failed to synthesize session", error);
        return null;
    }
}

function reportToDashboardQueue(outcomeType, data = {}) {
    chrome.storage.local.get([DASHBOARD_PORTAL_QUEUE_KEY]).then((snap) => {
        const queue = Array.isArray(snap?.[DASHBOARD_PORTAL_QUEUE_KEY]) ? snap[DASHBOARD_PORTAL_QUEUE_KEY] : [];
        const ts = new Date().toISOString();
        const provider = "linkedin";
        const entry = {
            ts,
            outcomeType: String(outcomeType || "SKIPPED").trim().toUpperCase(),
            data: { ...(data || {}) },
            provider,
        };
        const entryId = `${provider}:${entry.outcomeType}:${String(data.jobUrl || data.url || "unknown")}:${ts}`;
        if (queue.some((item) => item.entryId === entryId)) return;
        queue.push({ ...entry, entryId });
        chrome.storage.local.set({ [DASHBOARD_PORTAL_QUEUE_KEY]: queue.slice(-1500) });
    });
}

function notifyCareerWorkerFlush() {
    try {
        chrome.runtime.sendMessage({ type: "DASHBOARD_FLUSH_REQUESTOP" });
    } catch {}
}

// ── Origin overrides: never talk to app.liftmycv.com as the primary backend ──
const _originalGetBaseOrigin = getBaseOrigin;
getBaseOrigin = async function () {
    return await getDashboardOrigin();
};

const _originalGetUiBaseUrl = getUiBaseUrl;
getUiBaseUrl = function () {
    return DASHBOARD_ORIGINS[0];
};

const _originalGetWebSocketUrl = getWebSocketUrl;
getWebSocketUrl = function () {
    return DASHBOARD_ORIGINS[0].replace(/^http/, 'ws') + '/ws/';
};

// ── Result reporting → dashboard import queue ──
const _originalCvSubmitted = cvSubmitted;
cvSubmitted = function (sendResponse) {
    try {
        reportToDashboardQueue("APPLIED", {
            jobUrl: STORE.tasks.sendCv.url,
            url: STORE.tasks.sendCv.url,
            company: STORE.historyDetails?.company || "",
            role: STORE.historyDetails?.role || "",
            reasonCode: "SUBMITTED",
        });
    } catch (e) {}
    return _originalCvSubmitted.call(this, sendResponse);
};

const _originalFinishSuccess = finishSuccess;
finishSuccess = async function () {
    try {
        reportToDashboardQueue("APPLIED", {
            jobUrl: STORE.tasks.sendCv.url,
            url: STORE.tasks.sendCv.url,
            company: STORE.historyDetails?.company || "",
            role: STORE.historyDetails?.role || "",
            reasonCode: "SUBMITTED",
        });
    } catch (e) {}
    return _originalFinishSuccess.call(this);
};

const _originalFinishError = finishError;
finishError = async function (message) {
    try {
        reportToDashboardQueue("FAILED", {
            jobUrl: STORE.tasks.sendCv.url,
            url: STORE.tasks.sendCv.url,
            reasonCode: String(message || "ERROR").toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 40),
        });
    } catch (e) {}
    return _originalFinishError.call(this, message);
};
})();
