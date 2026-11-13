(() => {
  "use strict";
  if (location.origin !== "https://roberfernandez.github.io" || !location.pathname.startsWith("/computo-aac/")) return;
  const APP = "computo-sap-web-v1", BRIDGE = "computo-sap-chrome-v1";
  const respond = (type, extra = {}) =>
    window.postMessage({source:BRIDGE,type,...extra},location.origin);
  // No credentials, SAP data or browser storage are passed through the page bus.
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin ||
      event.data?.source !== APP) return;
    if (event.data.type === "ping") {
      respond("ready",{version:"0.1.1"});
      return;
    }
    if (event.data.type !== "start" || typeof event.data.ticket !== "string" ||
      event.data.ticket.length < 100 || event.data.ticket.length > 3500) return;
    chrome.runtime.sendMessage({type:"start",ticket:event.data.ticket}, response => {
      if (chrome.runtime.lastError) {
        respond("error",{message:"No es pot contactar amb el pont Chrome."});return;
      }
      respond(response?.ok?"started":"error",response?.ok?{message:"Obrint el portal de TMB…"}:{
        message:response?.error||"No s'ha pogut iniciar el contrast a Windows."
      });
    });
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== "status" || typeof message.message !== "string") return;
    respond(message.error?"error":"status",{message:message.message.slice(0,240)});
  });
  respond("ready",{version:"0.1.1"});
})();
