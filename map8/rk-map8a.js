/* Riwaaz-e-Kashmir - Phase 8A MapLibre foundation adapter.
   Classic script, no build step. Exposes window.RKMap8.
   - Loads the REAL, locally bundled MapLibre GL JS from /vendor/maplibre/ (ES module, loaded with import()).
   - Default provider: OpenFreeMap "liberty" style (evaluation only; the public service has no uptime guarantee).
   - Falls back to the self-hosted Leaflet 1.9.4 (/vendor/leaflet/) ONLY when MapLibre genuinely cannot run:
       no-webgl | engine-load-failed | engine-timeout | style-failed | no-tiles | engine-error
   - Never invents geography: it draws only what the style/tiles contain.
   Not in this phase: custom emerald+gold style, scooter, tracking panel, markers (Phase 8B and later). */
(function () {
  'use strict';
  var VENDOR = '/vendor/maplibre/';
  var LEAF = '/vendor/leaflet/';
  /* SRI for the self-hosted Leaflet 1.9.4 (same files and values the Phase 6/7 customer page already uses). */
  var LEAF_SRI = {
    js: 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH',
    css: 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H'
  };
  var OFM_STYLES = {
    liberty: 'https://tiles.openfreemap.org/styles/liberty',
    bright: 'https://tiles.openfreemap.org/styles/bright',
    positron: 'https://tiles.openfreemap.org/styles/positron'
  };
  var DEFAULTS = {
    styleUrl: OFM_STYLES.liberty,
    center: [74.7973, 34.0837],            /* [lng, lat] - the Srinagar default already used by the customer page */
    zoom: 12, minZoom: 8, maxZoom: 19,
    bounds: [[73, 32], [76.5, 35.5]],      /* the project's existing Kashmir geofence (lng/lat) */
    engineTimeoutMs: 15000,                /* import() + CSS */
    firstIdleTimeoutMs: 15000,             /* style + first tiles */
    fallbackTileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    fallbackAttr: '&copy; OpenStreetMap contributors (fallback map, development tiles)',
    allowFallback: true,
    cooperativeGestures: false,
    onStatus: null
  };

  var enginePromise = null;

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }
  function withTimeout(p, ms, tag) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error(tag)); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function cssLoaded(href) {
    return new Promise(function (res, rej) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      l.onload = function () { res(); };
      l.onerror = function () { rej(new Error('css-failed')); };
      document.head.appendChild(l);
    });
  }
  function loadEngine(ms) {
    if (enginePromise) return enginePromise;
    enginePromise = withTimeout((async function () {
      await cssLoaded(VENDOR + 'maplibre-gl.css');
      var ml = await import(VENDOR + 'maplibre-gl.mjs');
      if (!ml || typeof ml.Map !== 'function' || typeof ml.setWorkerUrl !== 'function') throw new Error('engine-shape');
      ml.setWorkerUrl(new URL(VENDOR + 'maplibre-gl-worker.mjs', location.href).href);
      return ml;
    })(), ms || DEFAULTS.engineTimeoutMs, 'engine-timeout').catch(function (e) {
      enginePromise = null; throw e;
    });
    return enginePromise;
  }

  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    return new Promise(function (res, rej) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = LEAF + 'leaflet.css'; l.integrity = LEAF_SRI.css; l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
      var s = document.createElement('script');
      s.src = LEAF + 'leaflet.js'; s.integrity = LEAF_SRI.js; s.crossOrigin = 'anonymous';
      s.onload = function () { window.L && window.L.map ? res(window.L) : rej(new Error('leaflet-missing')); };
      s.onerror = function () { rej(new Error('leaflet-failed')); };
      document.head.appendChild(s);
    });
  }

  function mkStatus(o) {
    return {
      engine: null, reason: null, version: null, webgl: hasWebGL(), styleUrl: o.styleUrl,
      styleLoaded: false, featuresInView: null, tilesLoaded: 0, tileErrors: 0, lastError: null, idle: false, ready: false
    };
  }

  async function fallbackLeaflet(el, o, st, reason, detail) {
    st.engine = 'leaflet'; st.reason = reason; st.lastError = detail ? String(detail).slice(0, 200) : st.lastError;
    el.innerHTML = '';
    var L = await loadLeaflet();
    var b = o.bounds;
    var map = L.map(el, { minZoom: Math.max(o.minZoom, 10), maxZoom: 18, maxBounds: [[b[0][1], b[0][0]], [b[1][1], b[1][0]]], maxBoundsViscosity: .7 })
      .setView([o.center[1], o.center[0]], o.zoom);
    L.tileLayer(o.fallbackTileUrl, { attribution: o.fallbackAttr, maxZoom: 18 }).addTo(map);
    st.ready = true;
    var h = {
      engine: 'leaflet', map: map, status: function () { return JSON.parse(JSON.stringify(st)); },
      resetView: function () { map.setView([o.center[1], o.center[0]], o.zoom); },
      resize: function () { map.invalidateSize(); },
      zoomIn: function () { map.zoomIn(); }, zoomOut: function () { map.zoomOut(); },
      destroy: function () { try { map.remove(); } catch (e) {} }
    };
    if (o.onStatus) o.onStatus(h.status());
    return h;
  }

  /* create(el, options) -> Promise<handle>. Never rejects for map problems: it resolves with a Leaflet fallback handle
     (engine:'leaflet', reason set) or, if even that fails or allowFallback is false, a handle with engine:null and map:null. */
  async function create(el, options) {
    var o = Object.assign({}, DEFAULTS, options || {});
    var st = mkStatus(o);
    var emit = function () { if (o.onStatus) { try { o.onStatus(JSON.parse(JSON.stringify(st))); } catch (e) {} } };
    var failTo = async function (reason, detail) {
      st.reason = reason; st.lastError = detail ? String(detail).slice(0, 200) : st.lastError;
      if (!o.allowFallback) { st.engine = null; emit(); return deadHandle(st); }
      try { return await fallbackLeaflet(el, o, st, reason, detail); }
      catch (e) { st.engine = null; st.lastError = 'fallback-failed: ' + String(e && e.message || e).slice(0, 120); emit(); return deadHandle(st); }
    };
    if (!el) return failTo('no-container');
    if (!st.webgl) return failTo('no-webgl');

    var ml;
    try { ml = await loadEngine(o.engineTimeoutMs); }
    catch (e) { return failTo(e && e.message === 'engine-timeout' ? 'engine-timeout' : 'engine-load-failed', e && e.message); }
    st.version = typeof ml.getVersion === 'function' ? ml.getVersion() : null;

    var map;
    try {
      el.innerHTML = '';
      map = new ml.Map({
        container: el, style: o.styleUrl, center: o.center, zoom: o.zoom, minZoom: o.minZoom, maxZoom: o.maxZoom,
        maxBounds: o.bounds, attributionControl: { compact: true }, cooperativeGestures: !!o.cooperativeGestures,
        dragRotate: false, pitchWithRotate: false, fadeDuration: 150
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new ml.ScaleControl({ unit: 'metric' }), 'bottom-left');
    } catch (e) {
      if (map) { try { map.remove(); } catch (x) {} }
      return failTo('engine-error', e && e.message);
    }

    return new Promise(function (resolve) {
      var done = false;
      var settle = async function (fn) { if (done) return; done = true; clearTimeout(timer); resolve(await fn()); };
      var killMap = function () { try { map.remove(); } catch (e) {} };
      var timer = setTimeout(function () {
        settle(async function () { killMap(); return failTo(st.styleLoaded ? 'no-tiles' : 'style-failed', 'timeout'); });
      }, o.firstIdleTimeoutMs);

      map.on('error', function (ev) {
        var msg = ev && ev.error && ev.error.message ? ev.error.message : 'error';
        st.lastError = String(msg).slice(0, 200);
        if (ev && ev.tile) st.tileErrors++;
        else if (!st.styleLoaded) { settle(async function () { killMap(); return failTo('style-failed', msg); }); return; }
        else st.tileErrors++;
        emit();
      });
      map.on('data', function (ev) { if (ev && ev.dataType === 'source' && ev.tile) { st.tilesLoaded++; } });
      map.on('load', function () { st.styleLoaded = true; emit(); });
      map.on('idle', function () {
        st.idle = true;
        try { st.featuresInView = map.queryRenderedFeatures().length; } catch (e) { st.featuresInView = null; }
        if (!done) {
          if (st.tilesLoaded === 0 && st.tileErrors > 0) { settle(async function () { killMap(); return failTo('no-tiles', st.lastError); }); return; }
          st.engine = 'maplibre'; st.ready = true;
          settle(async function () { emit(); return maplibreHandle(map, o, st); });
        } else emit();
      });
    });
  }

  function maplibreHandle(map, o, st) {
    return {
      engine: 'maplibre', map: map, status: function () { return JSON.parse(JSON.stringify(st)); },
      resetView: function () { map.jumpTo({ center: o.center, zoom: o.zoom }); },
      resize: function () { map.resize(); },
      zoomIn: function () { map.zoomIn(); }, zoomOut: function () { map.zoomOut(); },
      destroy: function () { try { map.remove(); } catch (e) {} }
    };
  }
  function deadHandle(st) {
    return { engine: null, map: null, status: function () { return JSON.parse(JSON.stringify(st)); }, resetView: function () {}, resize: function () {}, zoomIn: function () {}, zoomOut: function () {}, destroy: function () {} };
  }

  window.RKMap8 = { create: create, loadEngine: loadEngine, hasWebGL: hasWebGL, styles: OFM_STYLES, defaults: DEFAULTS, VERSION: '8A' };
})();
