(() => {
  "use strict";
  if (location.origin !== "https://launcher.tmb.cat" || !/^\/apps\/?$/.test(location.pathname))return;
  let inFlight=false, completed=false;
  const tick=()=>{
    if(inFlight||completed)return;
    inFlight=true;
    chrome.runtime.sendMessage({type:"poll"}, reply=>{
      inFlight=false;
      if(chrome.runtime.lastError)return;
      if(reply?.status==="complete"||reply?.status==="expired")completed=true;
    });
  };
  tick();
  const timer=setInterval(()=>{if(completed){clearInterval(timer);return;}tick();},3000);
  addEventListener("pagehide",()=>clearInterval(timer),{once:true});
})();
