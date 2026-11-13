(function () {
  "use strict";
  if (location.origin !== "https://launcher.tmb.cat" || !/^\/apps\/?$/.test(location.pathname)) return "wrong-origin";
  if (window.__tmbWebviewProbe) return "installed";
  var BASE = "/sap/opu/odata/sap/ZHR_CBE_ODATA_SRV/";
  var ENTITY = BASE + "ValorActividadSet";
  var grant=window.__computoSapGrant;
  if(!grant||grant.uid!=="1dd672e7-707f-4197-a393-a5f6f3a6d74e"||grant.exp<=Date.now()||!Number.isInteger(grant.year))return "unauthorized";
  var PERIOD=String(grant.year),targetPeriod=grant.scope==="october-test"?PERIOD+"-10":PERIOD;
  var calendar=[],completedPeriods=[];
  var originalFetch = window.fetch.bind(window);
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;
  var urls = new WeakMap();
  var identity = null, opened = false, running = false, done = false, disabled = false;
  var values = [], controller = null, generation = 0;
  var state = {version: "0.1.1", phase: "waiting-shell", period: "2026-10", http: null, records: null, pages: 0, expected: 127};
  function set(phase, extra) { state = Object.assign({}, state, extra || {}, {phase: phase}); }
  function serviceUrl(value) {
    try {
      var u = new URL(value, location.href);
      return u.origin === location.origin && (u.pathname === BASE.slice(0, -1) || u.pathname.indexOf(BASE) === 0) ? u : null;
    } catch (_) { return null; }
  }
  function remember(text) {
    if (disabled || identity || typeof text !== "string" || text.length > 3000000) return;
    // Inspect ONLY responses from the official CBE service; never login pages or headers.
    var found = new Set(), re = /"Pernr"\s*:\s*"(\d{8})"/g, m;
    while ((m = re.exec(text))) { if (m[1] !== "00000000") found.add(m[1]); }
    if (found.size === 1) {
      identity = Array.from(found)[0];
      set("identified");
      void query();
    } else if (found.size > 1) {
      set("identity-ambiguous");
    }
  }
  XMLHttpRequest.prototype.open = function (method, url) {
    urls.set(this, String(url));
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var xhr = this, url = serviceUrl(urls.get(xhr));
    if (url) xhr.addEventListener("load", function () {
      if (xhr.status !== 200) return;
      try {
        if (xhr.responseType === "" || xhr.responseType === "text") remember(xhr.responseText);
        else if (xhr.responseType === "json") remember(JSON.stringify(xhr.response));
      } catch (_) {}
    }, {once: true});
    return originalSend.apply(this, arguments);
  };
  window.fetch = function (input) {
    var url = serviceUrl(typeof input === "string" || input instanceof URL ? String(input) : input && input.url);
    var result = originalFetch.apply(null, arguments);
    if (url) void result.then(function (response) {
      if (response.status === 200) void response.clone().text().then(remember).catch(function () {});
    }).catch(function () {});
    return result;
  };
  function dateOf(value) {
    var m = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(String(value));
    if (!m) throw new Error("invalid-date");
    var d = new Date(Number(m[1]));
    if (!Number.isFinite(d.getTime())) throw new Error("invalid-date");
    return d.toISOString().slice(0, 10);
  }
  async function query() {
    if(disabled||!identity||running||done)return;
    running=true;var currentGeneration=++generation,started=Date.now(),pages=0,all=[];
    calendar=[];completedPeriods=[];controller=new AbortController();var activeController=controller;
    var timeout=setTimeout(function(){activeController.abort();},180000);
    set("querying",{http:null,records:0,pages:0,period:targetPeriod});
    async function read(entity,filter,month){
      var next=new URL(BASE+entity,location.origin),rows=[],seen=new Set(),expected=null;
      next.searchParams.set("sap-client","030");next.searchParams.set("$format","json");next.searchParams.set("$filter",filter);
      while(next){
        if(next.origin!==location.origin||next.pathname!==BASE+entity)throw Error("unsafe-pagination");
        if(next.searchParams.has("$filter")&&next.searchParams.get("$filter")!==filter)throw Error("changed-filter");
        if(seen.has(next.href)||seen.size>=20)throw Error("pagination-limit");seen.add(next.href);pages++;
        var response=await originalFetch(next.href,{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",headers:{Accept:"application/json"},signal:activeController.signal});
        if(currentGeneration!==generation)throw Error("cancelled");state.http=response.status;
        if(!response.ok)throw Error("http-"+response.status);
        if(!(response.headers.get("content-type")||"").toLowerCase().includes("json"))throw Error("not-json");
        var json=await response.json(),data=json&&json.d;
        if(!data||!Array.isArray(data.results))throw Error("invalid-odata");
        if(data.__count!=null){var n=Number(data.__count);if(!Number.isInteger(n)||n<0||expected!==null&&n!==expected)throw Error("invalid-total");expected=n;}
        data.results.forEach(function(row){
          if(row.Pernr!==identity)throw Error("identity-mismatch");
          var date=dateOf(row.Date);if(!date.startsWith(month||PERIOD))throw Error("wrong-period");
          if(entity==="CalendarioSet")rows.push({Date:row.Date});
          else{
            if(typeof row.LongText!=="string"||row.LongText.length>180||!/^[-]?\d+(?:[.,]\d+)?$/.test(String(row.Number)))throw Error("invalid-row");
            rows.push({Date:row.Date,LongText:row.LongText,Number:String(row.Number),Wagetype:String(row.Wagetype||"")});
          }
        });
        if(rows.length>10000)throw Error("record-limit");
        set("querying",{pages:pages,records:all.length+rows.length});next=data.__next?new URL(data.__next,next):null;
      }
      if(expected!==null&&expected!==rows.length)throw Error("incomplete-response");return rows;
    }
    try{
      if(grant.scope==="year"){
        calendar=await read("CalendarioSet","Aaaamm eq '"+PERIOD+"' and Pernr eq '"+identity+"' and Screen eq 'PAN1'");
        if(new Set(calendar.map(function(r){return dateOf(r.Date);})).size!==(new Date(Number(PERIOD),1,29).getMonth()===1?366:365))throw Error("incomplete-calendar");
      }
      var months=grant.scope==="october-test"?[10]:Array.from({length:12},function(_,i){return i+1;});
      for(var month of months){
        var mm=String(month).padStart(2,"0"),period=PERIOD+"-"+mm;
        var part=await read("ValorActividadSet","Aaaamm eq '"+PERIOD+mm+"' and Pernr eq '"+identity+"' and Screen eq 'PAN1'",period);
        all=all.concat(part);completedPeriods.push(period);
      }
      values=all;done=true;var dates=all.map(function(r){return dateOf(r.Date);}).sort();
      set("success",{http:200,records:all.length,pages:pages,period:targetPeriod,matchesReference:grant.scope==="october-test"?all.length===127:null,firstDate:dates[0]||null,lastDate:dates[dates.length-1]||null,elapsedMs:Date.now()-started,capturedAt:new Date().toISOString()});
    }catch(e){if(currentGeneration===generation)set("error",{error:e&&e.name==="AbortError"?"timeout":String(e&&e.message||"network-error").slice(0,70)});}
    finally{clearTimeout(timeout);if(currentGeneration===generation){running=false;controller=null;}}
  }
  function identifyFromPage() {
    if (disabled || identity || running || done) return;
    var documents = [document], found = new Set(), totalText = 0, frameCount = 0;
    try {
      Array.prototype.forEach.call(document.querySelectorAll("iframe"), function (frame) {
        frameCount++;
        try {
          if (frame.contentDocument && frame.contentWindow.location.origin === location.origin) documents.push(frame.contentDocument);
        } catch (_) {}
      });
      documents.forEach(function (doc) {
        var text = doc.body && doc.body.innerText || "";
        totalText += text.length;
        var re = /(?:N[º°o]\s*Empleado|N[úu]m(?:ero)?\.?\s*(?:d['’]empleat|empleat))\s*:\s*(\d{8})\b/gi, m;
        while ((m = re.exec(text))) found.add(m[1]);
      });
      state.diagnostics = {documents: documents.length, frames: frameCount, textLength: totalText};
      if (found.size === 1) {
        identity = Array.from(found)[0];
        set("identified", {identitySource: "portal-header"});
        void query();
      } else if (found.size > 1) set("identity-ambiguous");
    } catch (_) {}
  }
  function identifyFromModels() {
    if (disabled || identity || running || done) return;
    try {
      var core = window.sap && sap.ui && sap.ui.getCore && sap.ui.getCore();
      if (!core) return;
      var controls = [], models = new Set(), found = new Set(), cbeModels = 0;
      Array.prototype.forEach.call(document.querySelectorAll("[data-sap-ui]"), function (el) {
        var control = core.byId(el.id);
        if (control) controls.push(control);
      });
      var registry = sap.ui.core && sap.ui.core.Component && sap.ui.core.Component.registry;
      if (registry && registry.all) {
        var components = registry.all();
        Object.keys(components).forEach(function (id) { controls.push(components[id]); });
      }
      controls.forEach(function (control) {
        [control.oModels, control.oPropagatedProperties && control.oPropagatedProperties.oModels].forEach(function (map) {
          if (map) Object.keys(map).forEach(function (name) { models.add(map[name]); });
        });
        if (control.getModel) models.add(control.getModel());
      });
      models.forEach(function (model) {
        if (!model || typeof model.sServiceUrl !== "string") return;
        var u = serviceUrl(model.sServiceUrl);
        if (!u || u.pathname.replace(/\/$/, "") !== BASE.replace(/\/$/, "")) return;
        cbeModels++;
        // Read ONLY employee fields from the already-loaded CBE model. Never auth models, headers or cookies.
        var data = model.oData;
        if (!data || typeof data !== "object") return;
        Object.keys(data).forEach(function (key) {
          var row = data[key];
          if (row && typeof row.Pernr === "string" && /^\d{8}$/.test(row.Pernr) && row.Pernr !== "00000000") found.add(row.Pernr);
        });
      });
      state.diagnostics = Object.assign({}, state.diagnostics, {controls: controls.length, models: models.size, cbeModels: cbeModels, employeeCount: found.size});
      if (found.size === 1) {
        identity = Array.from(found)[0];
        set("identified", {identitySource: "loaded-cbe-model"});
        void query();
      } else if (found.size > 1) set("identity-ambiguous");
    } catch (_) {}
  }
  function openCalendar(force) {
    if (running) return;
    if (force) {
      if (identity) { done = false; void query(); return; }
      opened = false;
    }
    try {
      var c = window.sap && sap.ushell && sap.ushell.Container;
      var user = c && c.getUser && c.getUser();
      if (!user || !user.getId || !user.getId()) return;
      if (!opened) {
        opened = true;
        set("waiting-data");
        if (location.hash === "#EmployeeCalendar-display") {
          location.hash = "Shell-home";
          setTimeout(function () { location.hash = "EmployeeCalendar-display"; }, 800);
        } else location.hash = "EmployeeCalendar-display";
      }
    } catch (_) {}
  }
  window.__tmbWebviewProbe = {
    exportResult: function () {
      if (!done || state.phase !== "success") return null;
      return {schema:"tmb-computo-bridge-v1",period:targetPeriod,extractedAt:state.capturedAt,rows:values,calendar:calendar,completedPeriods:completedPeriods};
    },
    snapshot: function () { identifyFromPage(); identifyFromModels(); openCalendar(false); return Object.assign({}, state); },
    retry: function () { disabled = false; openCalendar(true); return "requested"; },
    clear: function () {
      ++generation;
      disabled = true;
      if (controller) controller.abort();
      values = []; identity = null; done = false; running = false;
      set("cleared", {records: null, http: null});
    }
  };
  openCalendar(false);
  return "installed";
})();
