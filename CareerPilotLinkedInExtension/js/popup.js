document.addEventListener('DOMContentLoaded', function(e) {

    const errorEl = document.querySelector('.error');
    const contentEl = document.querySelector('.content');

    const liftsLeftValueEl = document.querySelector('.lifts-left-value');
    const failedSubmissionsValueEl = document.querySelector('.failed-submissions-value');
    const successfulSubmissionsValueEl = document.querySelector('.successful-submissions-value');

    const stopApplyingBtnEl = document.querySelector('.stop-applying-btn');
    const startApplyingBtnEl = document.querySelector('.start-applying-btn');
    const loginBtnEl = document.querySelector('.login-btn');

    const statsEl = document.querySelector('.stats');
    const footerEl = document.querySelector('.footer');

    const applyOneCheckbox = document.querySelector('.apply-one-checkbox');
    const applyOneToggler = applyOneCheckbox.closest('.toggler');
    const agentModeToggler = document.querySelectorAll('.toggler')[0];
    const resumePerJobToggler = document.querySelectorAll('.toggler')[1];
    const fieldsModelToggler = document.querySelectorAll('.toggler')[3];
    const agentModeCheckbox = document.querySelector('.agent-mode-checkbox');
    const resumePerJobCheckbox = document.querySelector('.resume-per-job-checkbox');
    const fieldsModelCheckbox = document.querySelector('.fields-model-checkbox');

    const modelTogglerCaptionEl = document.getElementById('modelTogglerCaption');
    const modelTogglerTooltipEl = document.getElementById('modelTogglerTooltip');

    const profileSelectorEl = document.querySelector('.profile-selector');
    const profileSelectEl = document.querySelector('.profile-select');

    let modelOpt1Id;
    let modelOpt2Id;

    function loadAndSetStats() {
        contentEl.classList.add('loading');
        chrome.runtime.sendMessage({type: 'POPUP-STATS-GET'})
            .then(redrawUi)
            .catch(redrawUi);
    }

    function redrawUi(response) {
        const {type, data} = response;

        // Check if user is authenticated (data should be an object with liftsLeft property)
        const isAuthenticated = data && typeof data === 'object' && data.liftsLeft !== undefined && data.liftsLeft !== null;

        if (!isAuthenticated) {
            // Show only login button and apply-one toggler for unauthenticated users
            errorEl.innerText = '';
            errorEl.style.display = 'none';
            loginBtnEl.style.display = 'flex';
            startApplyingBtnEl.style.display = 'none';
            stopApplyingBtnEl.style.display = 'none';
            statsEl.style.display = 'none';
            footerEl.style.display = 'none';
            profileSelectorEl.style.display = 'none';
            agentModeToggler.style.display = 'none';
            resumePerJobToggler.style.display = 'none';
            fieldsModelToggler.style.display = 'none';
            applyOneToggler.style.display = 'flex';
            
            if (data && data.applyOneEnabled) {
                applyOneCheckbox.classList.remove('toggler-disabled');
            } else {
                applyOneCheckbox.classList.add('toggler-disabled');
            }
            
            contentEl.classList.remove('loading');
            return;
        }

        switch (type) {
            case 'ERROR':
                //errorEl.innerText = data;
                //errorEl.style.display = 'flex';
                break;
            case 'SUCCESS':

                errorEl.innerText = '';
                errorEl.style.display = 'none';

                // Show all elements for authenticated users
                loginBtnEl.style.display = 'none';
                statsEl.style.display = 'flex';
                footerEl.style.display = 'flex';
                agentModeToggler.style.display = 'flex';
                resumePerJobToggler.style.display = 'flex';
                applyOneToggler.style.display = 'flex';

                // Handle profiles if they exist
                if (data.profiles && Array.isArray(data.profiles) && data.profiles.length > 0) {
                    profileSelectorEl.style.display = 'flex';
                    profileSelectEl.innerHTML = '';
                    
                    data.profiles.forEach(profile => {
                        const option = document.createElement('option');
                        option.value = profile.id;
                        option.textContent = `Profile ${profile.num}: ${profile.title}`;
                        if (data.activeProfileId && profile.id === data.activeProfileId) {
                            option.selected = true;
                        }
                        profileSelectEl.appendChild(option);
                    });
                }

                liftsLeftValueEl.innerText = data.liftsLeft ?? '-';

                if (data.liftsLeft == 'Unlimited') {
                    document.querySelector('.buy-lifts-btn').style.display = 'none';
                }

                failedSubmissionsValueEl.innerText = data.failedSubmissions ?? '-';
                successfulSubmissionsValueEl.innerText = data.successfulSubmissions ?? '-';

                if (data.modelTogglerCaption) {
                    fieldsModelToggler.style.display = 'flex';
                } else {
                    fieldsModelToggler.style.display = 'none';
                }

                modelTogglerCaptionEl.innerText = data.modelTogglerCaption || "";
                modelTogglerTooltipEl.innerText = data.modelTogglerTooltip || "Switch models for autofill and cover letters: GPT-4o (faster, more efficient), GPT-4.1 (more accurate, precise). Resume generation always uses GPT-4.1.";
                modelOpt1Id = data.modelOpt1Id;
                modelOpt2Id = data.modelOpt2Id;

                if (data.applyOneEnabled) {
                    applyOneCheckbox.classList.remove('toggler-disabled');
                } else {
                    applyOneCheckbox.classList.add('toggler-disabled');
                }
                if (data.agentMode == "Copilot") {
                    agentModeCheckbox.classList.remove('toggler-disabled');
                } else {
                    agentModeCheckbox.classList.add('toggler-disabled');
                }
                if (data.resumePerJob) {
                    resumePerJobCheckbox.classList.remove('toggler-disabled');
                } else {
                    resumePerJobCheckbox.classList.add('toggler-disabled');
                }
                if (data.fieldsModel == modelOpt2Id) {
                    fieldsModelCheckbox.classList.remove('toggler-disabled');
                } else {
                    fieldsModelCheckbox.classList.add('toggler-disabled');
                }

                if (data.active || data.boardApply || data.applyOne) {
                    stopApplyingBtnEl.style.display = 'flex';
                    startApplyingBtnEl.style.display = 'none';
                    stopApplyingBtnEl.dataset.stopMode = data.active ? 'normal' : 'board';
                } else {
                    stopApplyingBtnEl.style.display = 'none';
                    startApplyingBtnEl.style.display = 'flex';
                    delete stopApplyingBtnEl.dataset.stopMode;
                }

                break;
        }

        if (location.hash.includes('#reopened-window')) {
            errorEl.style.display = 'flex';
            
            let countDown = 7;
            setInterval(() => {
                errorEl.innerText = `The working window was unexpectedly closed. Auto applying will continue in ${countDown} seconds.`;
                countDown --;
                if (countDown <= 0) {
                    chrome.runtime.sendMessage({type: 'POPUP-CONTINUE-APPLYING'}).then((response) => {
                        const {type, data} = response;
                        switch (type) {
                            case 'ERROR':
                                errorEl.innerText = data;
                                break;
                        }
                    });
                } 
            }, 1000)
        }

        contentEl.classList.remove('loading');
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "updatePopup") {
            loadAndSetStats();
        }
    });

    document.querySelectorAll('header svg').forEach(function(svgEl) {
        svgEl.addEventListener('click', function(e) {
            chrome.tabs.create({
                url: "https://app.liftmycv.com/",
            });
        });
    });

    document.querySelector('.stop-applying-btn').addEventListener('click', function(e) {
        contentEl.classList.add('loading');
        const stopMessageType = stopApplyingBtnEl.dataset.stopMode === 'board' ? 'STOP-APPLY-ONE-FROM-POPUP' : 'POPUP-STOP-APPLYING';
        chrome.runtime.sendMessage({type: stopMessageType}).then((response) => {
            const {type, data} = response;
            switch (type) {
                case 'ERROR':
                    errorEl.innerText = data;
                    errorEl.style.display = 'flex';
                    break;
                case 'SUCCESS':
                    loadAndSetStats();
                    break;
            }
            contentEl.classList.remove('loading');
        }).catch(() => contentEl.classList.remove('loading'));
    });

    document.querySelector('.start-applying-btn').addEventListener('click', function(e) {
        chrome.tabs.create({
            url: "https://app.liftmycv.com/non-stop-apply",
        });
    });

    document.querySelector('.buy-lifts-btn').addEventListener('click', function(e) {
        chrome.tabs.create({
            url: "https://app.liftmycv.com/upgrade",
        });
    });

    loginBtnEl.addEventListener('click', function(e) {
        chrome.tabs.create({
            url: "https://app.liftmycv.com/",
        });
    });

    applyOneCheckbox.addEventListener('click', function(e) {
        if (applyOneCheckbox.classList.contains('toggler-disabled')) {
            applyOneCheckbox.classList.remove('toggler-disabled');
            chrome.runtime.sendMessage({type: 'ENABLE-APPLY-ONE'});
        } else {
            applyOneCheckbox.classList.add('toggler-disabled');
            chrome.runtime.sendMessage({type: 'DISABLE-APPLY-ONE'});
        }
    });

    function updateTogglers(ev) {
        const checkbox = ev.target.closest('.toggler-checkbox');
        if (checkbox.classList.contains('toggler-disabled')) {
            checkbox.classList.remove('toggler-disabled');
        } else {
            checkbox.classList.add('toggler-disabled');
        }

        const agentMode = agentModeCheckbox.classList.contains('toggler-disabled') ? "Autopilot" : "Copilot";
        const resumePerJob = resumePerJobCheckbox.classList.contains('toggler-disabled') ? false : true;
        const fieldsModel = fieldsModelCheckbox.classList.contains('toggler-disabled') ? modelOpt1Id : modelOpt2Id;

        chrome.runtime.sendMessage({
            type: 'UPDATE-TOGGLERS',
            data: {
                agentMode,
                resumePerJob,
                fieldsModel
            }
        }).then((response) => {
            const {type, data} = response;
            switch (type) {
                case 'ERROR':
                    if (data) {
                        errorEl.innerText = data;
                        errorEl.style.display = 'flex';
                    }
                    break;
            }
        });
    }

    agentModeCheckbox.addEventListener('click', updateTogglers);
    resumePerJobCheckbox.addEventListener('click', updateTogglers);
    fieldsModelCheckbox.addEventListener('click', updateTogglers);

    profileSelectEl.addEventListener('change', function(e) {
        const profileId = parseInt(e.target.value);
        if (profileId) {
            contentEl.classList.add('loading');
            chrome.runtime.sendMessage({
                type: 'SET-PROFILE',
                data: { profileId }
            }).then((response) => {
                const {type, data} = response;
                if (type === 'ERROR') {
                    errorEl.innerText = data || 'Failed to change profile';
                    errorEl.style.display = 'flex';
                }
                contentEl.classList.remove('loading');
                loadAndSetStats();
            }).catch(() => {
                errorEl.innerText = 'Failed to change profile';
                errorEl.style.display = 'flex';
                contentEl.classList.remove('loading');
            });
        }
    });

    loadAndSetStats();

    // Глобальные обработчики для tooltip
    // Показывает tooltip при наведении и фокусе, скрывает при уходе мыши и потере фокуса

    document.querySelectorAll('.tooltip-container').forEach(function (container) {
        function showTooltip() {
            const tooltip = container.querySelector('.tooltip');
            if (tooltip) tooltip.style.display = 'block';
        }
        function hideTooltip() {
            const tooltip = container.querySelector('.tooltip');
            if (tooltip) tooltip.style.display = 'none';
        }
        container.addEventListener('mouseenter', showTooltip);
        container.addEventListener('mouseleave', hideTooltip);
        container.addEventListener('focus', showTooltip);
        container.addEventListener('blur', hideTooltip);
    });
})