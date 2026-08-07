console.info('CONTENT');

function injectScript(file_path, tag) {
    var node = document.getElementsByTagName(tag)[0];
    var script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', file_path);
    node.appendChild(script);
}
injectScript(window.chrome.runtime.getURL('js/web_accessible_resources.js'), 'body');

window.postMessage({type : "INJECT_EXTENSION"}, "*");

