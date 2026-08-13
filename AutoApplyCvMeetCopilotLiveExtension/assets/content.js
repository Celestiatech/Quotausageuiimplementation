window.addEventListener("message",e=>{var t,i;e.source===window&&e.origin===location.origin&&((t=e.data)==null?void 0:t.target)==="murmurr"&&((i=e.data)==null?void 0:i.to)==="content"&&chrome.runtime.sendMessage(e.data)},!1);var M;chrome.runtime.onMessage.addListener(e=>{if((e==null?void 0:e.target)==="murmurr"){if((e==null?void 0:e.type)==="forceCodeScrape"){w();return}clearTimeout(M),M=setTimeout(()=>{window.postMessage({...e,to:"inpage"},location.origin)},100)}});function y(e){var i;let t="";if(!e||!e.childNodes)return(e==null?void 0:e.textContent)||"";for(let l of Array.from(e.childNodes))if(l.nodeType===Node.TEXT_NODE)t+=l.textContent;else if(l.nodeType===Node.ELEMENT_NODE){let o=l,r=o.tagName.toLowerCase(),s=o.className||"";if(r==="style"||typeof s=="string"&&s.includes("MathJax_Preview"))continue;if(r==="img"){let n=o.getAttribute("alt")||o.getAttribute("title")||"",d=o.getAttribute("src")||"";n&&!n.includes("image")?t+=` $${n.trim()}$ `:d&&(t+=`
![${n}](${d})
`);continue}if(r==="svg"){let n=o.getAttribute("aria-label")||o.getAttribute("data-tex")||o.getAttribute("data-mathml")||"";if(n)t+=` $${n.trim()}$ `;else{let d=o.querySelector("title");d&&d.textContent&&(t+=` $${d.textContent.trim()}$ `)}continue}if(typeof s=="string"&&(s.includes("katex")||s.includes("math")||s.includes("MathJax")||o.hasAttribute("data-mathml"))){let n="",d=o.querySelector('.katex-mathml, .MathJax_Preview, [class*="Assistive_MathML"]');if(d&&(n=d.textContent||""),!n){let a=o.getAttribute("data-mathml")||o.getAttribute("data-tex");a&&(n=a.replace(/<[^>]+>/g,"").trim())}if(!n){let a=o.querySelector("annotation");a&&(n=a.textContent||"")}if(!n){let a=o.nextElementSibling;a&&a.tagName.toLowerCase()==="script"&&((i=a.getAttribute("type"))!=null&&i.includes("math"))&&(n=a.textContent||"")}if(!n&&o.nodeType===Node.ELEMENT_NODE){let a=o.innerText||"";a.trim().length>0&&a.trim().length<80&&(n=a.trim())}if(n){let a=s.includes("display")||s.includes("block");t+=a?`
$$
${n}
$$
`:` $${n}$ `;continue}if(s.includes("katex-html"))continue}if(r==="mjx-container"){let n=o.getAttribute("aria-label")||o.textContent||"",d=o.getAttribute("display")==="true";t+=d?`
$$
${n}
$$
`:`$${n}$`;continue}if(r==="script"){let n=o.getAttribute("type")||"";if(n.includes("math/tex")){let d=n.includes("mode=display");t+=d?`
$$
${o.textContent}
$$
`:`$${o.textContent}$`}continue}let m=y(o);r==="code"||r==="pre"?r==="pre"||m.includes(`
`)?t+=`
\`\`\`
${m}
\`\`\`
`:t+=`\`${m}\``:r==="strong"||r==="b"?t+=`**${m}**`:r==="em"||r==="i"?t+=`*${m}*`:r==="li"?t+=`
- ${m.trim()}`:r==="p"||r==="div"||r==="h1"||r==="h2"||r==="h3"?t+=`
${m.trim()}
`:t+=m}return t}var b="",S={};function A(e,t){if(!e)return t;if(!t||e===t||e.includes(t))return e;if(t.includes(e))return t;let i=30;for(let l=Math.max(0,e.length-t.length);l<=e.length-i;l++){let o=e.substring(l);if(t.startsWith(o))return e.substring(0,l)+t}for(let l=Math.max(0,t.length-e.length);l<=t.length-i;l++){let o=t.substring(l);if(e.startsWith(o))return t.substring(0,l)+e}return e+`

/* ...scrolled... */

`+t}function w(){var $,C;let e=document.querySelector(".monaco-editor, .view-lines, .CodeMirror, .hr-monaco-editor, .editor-content, .code-area, .react-monaco-editor-container, .right-pane, .code-editor-section"),t=document.querySelector('[data-track-load="description_content"], meta[name="description"], .challenge-body-html, .problem-statement, .question-wrapper, .markdown-content, .challenge-text, .description, .problem-description, .content-wrapper, .coding-question__left-pane, .left-pane'),i="",l=Array.from(document.querySelectorAll(".monaco-editor, .view-lines, .CodeMirror, .hr-monaco-editor, .editor-content, .react-monaco-editor-container, .code-editor-section")),o=[],r=new Set;l.forEach(f=>{Array.from(f.querySelectorAll(".view-line, .CodeMirror-line")).forEach(c=>r.add(c))}),r.size>0&&(i=Array.from(r).sort((u,c)=>{var g,E;let h=u.getBoundingClientRect().top||parseFloat(((g=u.style)==null?void 0:g.top)||"0"),p=c.getBoundingClientRect().top||parseFloat(((E=c.style)==null?void 0:E.top)||"0");return h-p}).map(u=>u.textContent||"").filter(u=>u.trim().length>0||u==="").join(`
`).trim()),i.length<5&&e&&(i=e.innerText||e.textContent||"");let s="Unknown File",m=document.querySelector('.monaco-editor .tab.active, .hr-monaco-editor-tab-active, [role="tab"][aria-selected="true"], .tab-active, .active-tab');if(m&&(s=(($=m.textContent)==null?void 0:$.trim())||"Unknown File",s.length>50&&(s="Unknown File")),i.length>=5)if(s!=="Unknown File"){let f=S[s];f&&(i=A(f,i)),S[s]=i,b=i}else b=i;else i=b;let n=t?y(t).trim():"",d=((C=window.getSelection())==null?void 0:C.toString())||"";d.length>20&&(n=`USER HIGHLIGHTED TEXT:
`+d+`

`+n),i=i.replace(/Line:\s*\d+\s*Col:\s*\d+/ig,"").trim();let a=document.querySelector(".monaco-editor, .view-lines, .CodeMirror, .hr-monaco-editor, .editor-content, .code-area, .react-monaco-editor-container, .right-pane, .code-editor-section");if(n.length<50&&a){let f=Array.from(document.querySelectorAll("p, li")).map(u=>y(u).trim()).filter(u=>{let c=u.trim().toLowerCase();return!(c.length<20||c.includes("cookie")||c.includes("privacy notice")||c.includes("opt-out")||c.includes("california consumer")||c.includes("terms of service")||c.includes("all rights reserved")||c.includes("necessary for the website to function"))});f.length>0&&(n=f.join(`

`))}if(i.length>20||n.length>50){let f=i.length>3?i:`/* Waiting for user to focus standard IDE bounds... */
/* Scanning active processes... */`,u=document.querySelector("[data-mode-id], .ant-select-selection-item, .lang-select, .language-select, .select2-selection__rendered"),c="Unknown";u&&(c=u.getAttribute("data-mode-id")||u.textContent||"Unknown",c.length>30&&(c="Unknown"));let h={platform:window.location.hostname.replace("www.",""),title:document.title,language:c,file_name:s,problem_statement_markdown:n,starter_code:f},p=JSON.stringify(h,null,2);try{chrome.runtime.sendMessage({target:"murmurr",to:"background",type:"codeScrape",codeContext:p})}catch(g){g.message&&g.message.includes("Extension context invalidated")&&clearInterval(N)}}}var N=setInterval(w,800);
;(function(){
  var MEET_EXT_SOURCE="CP_MEET_EXT",MEET_PAGE_SOURCE="CP_MEET_PAGE";
  window.addEventListener("message",function(e){
    var d=e.data;
    if(!d||typeof d!=="object")return;
    if(d.source!==MEET_PAGE_SOURCE||d.type!=="CP_MEET_PING")return;
    try{
      window.postMessage({source:MEET_EXT_SOURCE,type:"CP_MEET_PONG",version:(chrome.runtime.getManifest().version||""),name:(chrome.runtime.getManifest().name||"")},"*");
    }catch(err){}
  });
})();