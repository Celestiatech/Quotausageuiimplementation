window.addEventListener('load', () => {

    chrome.runtime.sendMessage({type: "GET-SEARCH-EMAIL"}).then(async (value) => {

        const {type, data} = value;

        switch (type) {
            case 'ERROR':
                
                break;
            case 'SUCCESS':
                try {
                    warmingUp(data.agentGeometry, data.agentMessages, data.agentMode);
                    let num = Number(location.pathname.split('/')[3]);
                    const lhash = location.hash;

                    for (let _t = 0; _t < 10; _t++) {
                        const extracted = document.body.innerText.split(data.begin)[1]?.trim().split(' ')[0]?.trim();
                        if (extracted && extracted.length == data.len) {
                            chrome.runtime.sendMessage({type: "SEARCH-EMAIL-DONE", data: {
                                code: extracted,
                                gAccountNum: num
                            }}).catch((e) => {
                                console.error(e)
                            });
                            return;
                        }
                        if (_t == 5 && location.hash.includes('in%3Aall+')) {
                            location.hash = location.hash.replace('in%3Aall+', '');
                        }
                        await wait(1000);
                    }

                    if (Date.now() - data.timestamp > 120_000) {
                        sendErrorToServerFromPage('email timeout');
                        chrome.runtime.sendMessage({type: "SEARCH-EMAIL-DONE", data: 'timeout'}).catch((e) => {
                            console.error(e)
                        });
                        return;
                    }
                    
                    num ++;
                    location.assign(`https://mail.google.com/mail/u/${num}/${lhash}`);

                } catch (e) {
                    sendErrorToServerFromPage(e);
                    chrome.runtime.sendMessage({type: "SEARCH-EMAIL-DONE", data: e.message}).catch((e) => {
                        console.error(e)
                    });
                }
                break;
        }

    });

});