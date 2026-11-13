(function () {
  "use strict";
  if (location.origin !== "https://launcher.tmb.cat" || !/^\/apps\/?$/.test(location.pathname)) return "wrong-origin";
  if (window.__tmbWebviewProbe) return "installed";
  var BASE = "/sap/opu/odata/sap/ZHR_CBE_ODATA_SRV/";
  var ENTITY = BASE + "ValorActividadSet";
  var PERIOD = "202610";
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
    if (disabled || !identity || running || done) return;
    running = true;
    var currentGeneration = ++generation;
    var started = Date.now(), pages = 0, rows = [], seen = new Set();
    controller = new AbortController();
    var activeController = controller;
    var timeout = setTimeout(function () { activeController.abort(); }, 30000);
    set("querying", {http: null, records: null, pages: 0});
    try {
      var filter = "Aaaamm eq '" + PERIOD + "' and Pernr eq '" + identity + "' and Screen eq 'PAN1'";
      var next = new URL(ENTITY, location.origin);
      next.searchParams.set("sap-client", "030");
      next.searchParams.set("$format", "json");
      next.searchParams.set("$filter", filter);
      var expectedTotal = null;
      while (next) {
        if (next.origin !== location.origin || next.pathname !== ENTITY) throw new Error("unsafe-pagination");
        if (next.searchParams.has("$filter") && next.searchParams.get("$filter") !== filter) throw new Error("changed-filter");
        if (seen.has(next.href) || ++pages > 20) throw new Error("pagination-limit");
        seen.add(next.href);
        var response = await originalFetch(next.href, {
          method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
          headers: {Accept: "application/json"}, signal: activeController.signal
        });
        if (currentGeneration !== generation) return;
        state.http = response.status;
        if (!response.ok) throw new Error("http-" + response.status);
        if ((response.headers.get("content-type") || "").toLowerCase().indexOf("json") < 0) throw new Error("not-json");
        var json = await response.json(), data = json && json.d;
        if (!data || !Array.isArray(data.results)) throw new Error("invalid-odata");
        if (data.__count != null) {
          var n = Number(data.__count);
          if (!Number.isInteger(n) || n < 0 || (expectedTotal !== null && expectedTotal !== n)) throw new Error("invalid-total");
          expectedTotal = n;
        }
        data.results.forEach(function (row) {
          if (row.Pernr !== identity) throw new Error("identity-mismatch");
          var day = dateOf(row.Date);
          if (day.slice(0, 7) !== "2026-10") throw new Error("wrong-period");
          if (typeof row.LongText !== "string" || !/^-?\d+(?:[.,]\d+)?$/.test(String(row.Number))) throw new Error("invalid-row");
          rows.push({Date: row.Date, LongText: row.LongText, Number: row.Number, Wagetype: row.Wagetype || ""});
        });
        if (rows.length > 10000) throw new Error("record-limit");
        set("querying", {pages: pages, records: rows.length});
        next = data.__next ? new URL(data.__next, next) : null;
      }
      if (expectedTotal !== null && expectedTotal !== rows.length) throw new Error("incomplete-response");
      values = rows; // Volatile memory only. No files, storage, upload or credential export.
      var dates = rows.map(function (r) { return dateOf(r.Date); }).sort();
      done = true;
      set("success", {
        http: 200, records: rows.length, pages: pages, matchesReference: rows.length === 127,
        firstDate: dates[0] || null, lastDate: dates[dates.length - 1] || null,
        elapsedMs: Date.now() - started, capturedAt: new Date().toISOString()
      });
    } catch (e) {
      if (currentGeneration === generation) set("error", {
        error: e && e.name === "AbortError" ? "timeout" :
          /^(http-\d{3}|invalid-date|unsafe-pagination|changed-filter|pagination-limit|not-json|invalid-odata|invalid-total|identity-mismatch|wrong-period|invalid-row|record-limit|incomplete-response)$/.test(e && e.message || "") ? e.message : "network-or-redirect"
      });
    } finally {
      clearTimeout(timeout);
      if (currentGeneration === generation) { running = false; controller = null; }
    }
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
      return {schema:"tmb-probe-month-v1",period:"2026-10",extractedAt:state.capturedAt,rows:values};
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
