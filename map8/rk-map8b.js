/* Riwaaz-e-Kashmir - Phase 8B customer tracking map controller (window.RKTrack8).
   Needs rk-map8a.js (window.RKMap8: engine loader + WebGL check). Classic script, no build step.
   - Loads the local emerald + antique-gold style (/map8/rk-style-8b.json, OpenMapTiles schema) and draws it with the bundled MapLibre.
   - glyphs (font) URL: taken from OpenFreeMap's own liberty style when reachable, so it is never guessed; otherwise the value written in the style file is used.
   - Markers: restaurant, customer, rider on a bulky scooter with a golden halo; distance bubble; golden glowing route; custom zoom / re-centre buttons.
   - NEVER invents data: callers pass real coordinates, nothing is drawn for a missing point.
   - create() never throws for map problems: it resolves {engine:null, reason} so the page can use its existing Leaflet map instead. */
(function () {
  'use strict';
  var STYLE_URL = '/map8/rk-style-8b.json';
  var LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';
  var SR_BOUNDS = [[74.45, 33.80], [75.18, 34.38]];   /* lng/lat: Srinagar region, same box the Leaflet maps use */
  var ROUTE_GOLD = '#f6dc8a';

  function scooterSVG(w) {
    /* bulky emerald + black scooter, antique-gold trim, rider with a branded RK delivery box; faces right (page flips it when heading west) */
    return '<svg width="' + w + '" height="' + Math.round(w * .82) + '" viewBox="0 0 110 90" aria-hidden="true">' +
      '<ellipse cx="55" cy="84" rx="40" ry="4.5" fill="#000" opacity=".35"/>' +
      '<rect x="6" y="14" width="32" height="30" rx="4" fill="#0f3a27" stroke="#d4af37" stroke-width="2.2"/>' +
      '<rect x="9.5" y="17.5" width="25" height="23" rx="2.5" fill="none" stroke="#d4af37" stroke-width=".9" opacity=".7"/>' +
      '<text x="22" y="34" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="14" fill="#f6dc8a">RK</text>' +
      '<circle cx="23" cy="68" r="14" fill="#0a0f0c" stroke="#d4af37" stroke-width="3.2"/><circle cx="23" cy="68" r="5.4" fill="#d4af37"/><circle cx="23" cy="68" r="2" fill="#0a0f0c"/>' +
      '<circle cx="88" cy="68" r="14" fill="#0a0f0c" stroke="#d4af37" stroke-width="3.2"/><circle cx="88" cy="68" r="5.4" fill="#d4af37"/><circle cx="88" cy="68" r="2" fill="#0a0f0c"/>' +
      '<path d="M9 64c0-12 9-17 21-17h36l9 12h17v13H82c-2-6-6-9-12-9H36c-6 0-10 3-12 9H9z" fill="#14573a" stroke="#d4af37" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M30 50h36l7 9H27z" fill="#0b1a12" opacity=".55"/>' +
      '<path d="M84 52l5-32" stroke="#d4af37" stroke-width="4" stroke-linecap="round"/><path d="M80 19h14" stroke="#d4af37" stroke-width="4" stroke-linecap="round"/>' +
      '<rect x="92" y="57" width="10" height="5" rx="2.5" fill="#ffe9a0"/>' +
      '<path d="M44 52l9-24" stroke="#0b1a12" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M54 31l28-9" stroke="#1d6b47" stroke-width="6.5" stroke-linecap="round"/>' +
      '<path d="M45 54l14 11" stroke="#0b1a12" stroke-width="7" stroke-linecap="round"/>' +
      '<circle cx="58" cy="15" r="8" fill="#e8c4a0"/><path d="M48.5 15a9.5 9.5 0 0 1 19 0z" fill="#d4af37" stroke="#8a6410" stroke-width="1.3"/></svg>';
  }

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function validLL(p) { return Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180; }
  function inRegion(p) { return validLL(p) && p[1] >= SR_BOUNDS[0][0] && p[1] <= SR_BOUNDS[1][0] && p[0] >= SR_BOUNDS[0][1] && p[0] <= SR_BOUNDS[1][1]; }
  function withTimeout(p, ms) { return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error('timeout')); }, ms); p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); }); }); }
  function fetchJson(u, ms) {
    var c = typeof AbortController === 'function' ? new AbortController() : null;
    return withTimeout(fetch(u, c ? { signal: c.signal } : {}).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }), ms).catch(function (e) { if (c) { try { c.abort(); } catch (x) {} } throw e; });
  }

  /* Load the local style; take the glyph URL from the provider's own style when reachable. Returns {style, glyphsFrom, error}. */
  async function loadStyle(opts) {
    var st = await fetchJson(opts.styleUrl || STYLE_URL, 8000);
    var out = { style: st, glyphsFrom: 'style-file', error: null };
    if (opts.inheritGlyphs !== false) {
      try {
        var lib = await fetchJson(opts.glyphsFrom || LIBERTY, 5000);
        if (lib && typeof lib.glyphs === 'string' && /^https:\/\//.test(lib.glyphs) && lib.glyphs.indexOf('{fontstack}') > -1 && lib.glyphs.indexOf('{range}') > -1) { st.glyphs = lib.glyphs; out.glyphsFrom = 'openfreemap-liberty'; }
      } catch (e) { out.error = 'glyph-lookup-failed'; }
    }
    return out;
  }

  /* create(container, options) -> Promise<handle | {engine:null, reason}>
     options: center [lat,lng], zoom, icons {restaurant, customer} (html strings), onStatus, firstIdleTimeoutMs, styleUrl, inheritGlyphs */
  async function create(container, options) {
    var o = Object.assign({ center: [34.0837, 74.7973], zoom: 13, firstIdleTimeoutMs: 15000, icons: {} }, options || {});
    var st = { engine: null, reason: null, version: null, styleLoaded: false, tilesLoaded: 0, tileErrors: 0, glyphsFrom: null, lastError: null, idle: false, ready: false };
    var emit = function () { if (o.onStatus) { try { o.onStatus(JSON.parse(JSON.stringify(st))); } catch (e) {} } };
    var dead = function (reason, detail) { st.reason = reason; st.lastError = detail ? String(detail).slice(0, 200) : st.lastError; emit(); return { engine: null, reason: reason, status: function () { return JSON.parse(JSON.stringify(st)); }, destroy: function () {} }; };
    if (!container) return dead('no-container');
    if (!window.RKMap8 || !window.RKMap8.hasWebGL || !window.RKMap8.hasWebGL()) return dead('no-webgl');
    var ml;
    try { ml = await window.RKMap8.loadEngine(15000); } catch (e) { return dead('engine-load-failed', e && e.message); }
    st.version = typeof ml.getVersion === 'function' ? ml.getVersion() : null;
    var styleRes;
    try { styleRes = await loadStyle(o); } catch (e) { return dead('style-failed', e && e.message); }
    st.glyphsFrom = styleRes.glyphsFrom;
    var map;
    try {
      container.innerHTML = '';
      map = new ml.Map({
        container: container, style: styleRes.style, center: [o.center[1], o.center[0]], zoom: o.zoom, minZoom: 9, maxZoom: 19,
        maxBounds: o.noBounds ? undefined : [[73, 32], [76.5, 35.5]], attributionControl: { compact: true },
        cooperativeGestures: true, dragRotate: false, pitchWithRotate: false, fadeDuration: 150
      });
      map.touchZoomRotate.disableRotation();
    } catch (e) { if (map) { try { map.remove(); } catch (x) {} } return dead('engine-error', e && e.message); }

    return new Promise(function (resolve) {
      var done = false, timer;
      var finish = function (fn) { if (done) return; done = true; clearTimeout(timer); resolve(fn()); };
      var kill = function () { try { map.remove(); } catch (e) {} };
      timer = setTimeout(function () { finish(function () { kill(); return dead(st.styleLoaded ? 'no-tiles' : 'style-failed', 'timeout'); }); }, o.firstIdleTimeoutMs);
      map.on('error', function (ev) {
        var msg = ev && ev.error && ev.error.message ? ev.error.message : 'error';
        st.lastError = String(msg).slice(0, 200);
        if (!done && !st.styleLoaded && !(ev && ev.tile) && !/glyph|font|pbf/i.test(msg)) { finish(function () { kill(); return dead('style-failed', msg); }); return; }
        st.tileErrors++; emit();
      });
      map.on('data', function (ev) { if (ev && ev.dataType === 'source' && ev.tile) st.tilesLoaded++; });
      map.on('load', function () { st.styleLoaded = true; emit(); });
      map.on('idle', function () {
        st.idle = true;
        if (!done) {
          if (st.tilesLoaded === 0 && st.tileErrors > 0) { finish(function () { kill(); return dead('no-tiles', st.lastError); }); return; }
          st.engine = 'maplibre'; st.ready = true;
          finish(function () { emit(); return makeHandle(ml, map, container, o, st, emit); });
        } else emit();
      });
    });
  }

  function makeHandle(ml, map, container, o, st, emit) {
    var H = { engine: 'maplibre', map: map, ml: ml };
    var mk = { r: null, c: null, d: null }, pos = { r: null, c: null, d: null }, riderEl = null, bubEl = null, flip = false;
    var routeSlots = {}, userAt = 0, progAt = 0, sig = '', af = 0, destroyed = false;
    var bottomPad = o.bottomPadding || 0;

    map.on('dragstart', function (e) { if (Date.now() - progAt > 1200) userAt = Date.now(); });
    map.on('zoomstart', function (e) { if (e && e.originalEvent && Date.now() - progAt > 1200) userAt = Date.now(); });

    /* custom controls (gold on emerald) */
    var ctl = el('div', 'rk8-ctl');
    var mkBtn = function (cls, label, txt, fn) { var b = el('button', 'rk8-btn ' + cls, txt); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', fn); ctl.appendChild(b); return b; };
    mkBtn('rk8-zi', 'Zoom in', '+', function () { userAt = Date.now(); map.zoomIn(); });
    mkBtn('rk8-zo', 'Zoom out', '\u2212', function () { userAt = Date.now(); map.zoomOut(); });
    mkBtn('rk8-fit', 'Show the whole route', '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l4 9-4-2-4 2z" fill="currentColor"/><circle cx="12" cy="15" r="6.5"/></svg>', function () { userAt = 0; H.fit(true); });
    container.appendChild(ctl);

    function marker(kind, ll, html, anchor, z) {
      var e = el('div', 'rk8-mk rk8-mk-' + kind, html);
      var m = new ml.Marker({ element: e, anchor: anchor || 'center' }).setLngLat([ll[1], ll[0]]).addTo(map);
      e.style.zIndex = z || 1; return m;
    }
    function removeMk(k) { if (mk[k]) { try { mk[k].remove(); } catch (e) {} mk[k] = null; pos[k] = null; } }

    H.setRestaurant = function (ll, name) {
      if (!ll || !validLL(ll)) { removeMk('r'); return; }
      if (mk.r) { mk.r.setLngLat([ll[1], ll[0]]); pos.r = ll; return; }
      mk.r = marker('rest', ll, (o.icons.restaurant || '<div class="rk8-fallback-pin"></div>') + (name ? '<div class="rk8-tag"></div>' : ''), 'bottom', 3);
      if (name) mk.r.getElement().querySelector('.rk8-tag').textContent = name;
      pos.r = ll;
    };
    H.setCustomer = function (ll) {
      if (!ll || !validLL(ll)) { removeMk('c'); return; }
      if (mk.c) { mk.c.setLngLat([ll[1], ll[0]]); pos.c = ll; return; }
      mk.c = marker('home', ll, o.icons.customer || '<div class="rk8-fallback-pin"></div>', 'center', 2); pos.c = ll;
    };
    H.setBubble = function (txt) {
      if (!bubEl) return; bubEl.textContent = txt || ''; bubEl.style.display = txt ? '' : 'none';
    };
    H.setRider = function (ll, label, animate) {
      if (!ll || !validLL(ll)) { removeMk('d'); riderEl = bubEl = null; return; }
      if (!mk.d) {
        var wrap = '<div class="rk8-bub" style="display:none"></div><div class="rk8-halo"></div><i class="rk8-pu"></i><div class="rk8-rin" role="img" aria-label="' + (label ? String(label).replace(/[<>"&]/g, '') : 'Your rider') + '">' + scooterSVG(86) + '</div>';
        mk.d = marker('rider', ll, wrap, 'center', 9); riderEl = mk.d.getElement().querySelector('.rk8-rin'); bubEl = mk.d.getElement().querySelector('.rk8-bub'); pos.d = ll; return;
      }
      var from = pos.d || ll, to = ll;
      if (Math.abs(from[0] - to[0]) < 1e-6 && Math.abs(from[1] - to[1]) < 1e-6) return;
      if (to[1] < from[1] - 3e-5 && !flip) { flip = true; riderEl.classList.add('flip'); } else if (to[1] > from[1] + 3e-5 && flip) { flip = false; riderEl.classList.remove('flip'); }
      cancelAnimationFrame(af); pos.d = to;
      if (animate === false) { mk.d.setLngLat([to[1], to[0]]); return; }
      var t0 = performance.now(), ms = 1400;
      var step = function (t) { if (destroyed) return; var k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; mk.d.setLngLat([from[1] + (to[1] - from[1]) * e, from[0] + (to[0] - from[0]) * e]); if (k < 1) af = requestAnimationFrame(step); };
      af = requestAnimationFrame(step);
    };

    /* golden route: wide soft glow + bright line (+ dashed when it is only a straight-line estimate or a planned next leg) */
    function ensureRoute(slot) {
      if (routeSlots[slot]) return routeSlots[slot];
      var src = 'rk-route-' + slot, data = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } };
      map.addSource(src, { type: 'geojson', data: data });
      map.addLayer({ id: src + '-glow', type: 'line', source: src, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#d4af37', 'line-width': 16, 'line-opacity': .22, 'line-blur': 7 } });
      map.addLayer({ id: src + '-line', type: 'line', source: src, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ROUTE_GOLD, 'line-width': 4.5, 'line-opacity': .98 } });
      map.addLayer({ id: src + '-dash', type: 'line', source: src, layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': ROUTE_GOLD, 'line-width': 3.5, 'line-opacity': .85, 'line-dasharray': [1, 2.2] } });
      return routeSlots[slot] = { src: src, pts: [], real: false };
    }
    /* pts: [[lat,lng],...]; real=false -> dotted straight-line estimate; faint -> planned next leg */
    H.setRoute = function (slot, pts, real, faint) {
      var s = ensureRoute(slot);
      if (!pts || pts.length < 2 || !pts.every(validLL)) { H.dropRoute(slot); return; }
      s.pts = pts; s.real = !!real;
      map.getSource(s.src).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.map(function (p) { return [p[1], p[0]]; }) } });
      var solid = !!real && !faint;
      map.setLayoutProperty(s.src + '-line', 'visibility', solid ? 'visible' : 'none');
      map.setLayoutProperty(s.src + '-glow', 'visibility', 'visible');
      map.setLayoutProperty(s.src + '-dash', 'visibility', solid ? 'none' : 'visible');
      map.setPaintProperty(s.src + '-glow', 'line-opacity', faint ? .1 : .22);
    };
    H.dropRoute = function (slot) {
      var s = routeSlots[slot]; if (!s) return;
      map.getSource(s.src).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
    };
    H.routeInfo = function (slot) { var s = routeSlots[slot]; return s ? { n: s.pts.length, real: s.real } : null; };
    /* keep the road route attached to the rider as it moves */
    H.setRouteStart = function (slot, ll) { var s = routeSlots[slot]; if (!s || !s.pts.length || !validLL(ll)) return; s.pts[0] = ll; map.getSource(s.src).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: s.pts.map(function (p) { return [p[1], p[0]]; }) } }); };

    /* fit restaurant + customer + rider. Re-fits when a point appears/disappears, or the rider left the view and the customer is not moving the map. */
    H.fit = function (anim) {
      var pts = [pos.r, pos.c, pos.d].filter(Boolean); if (!pts.length) return;
      progAt = Date.now();
      var pad = { top: 100, left: 60, right: 100, bottom: 60 + bottomPad }; /* right 100 keeps the 86 px scooter clear of the zoom buttons; top 100 clears the Live chip and distance bubble */
      if (pts.length === 1) { map.easeTo({ center: [pts[0][1], pts[0][0]], zoom: 15, duration: anim ? 600 : 0, padding: pad }); return; }
      var b = new ml.LngLatBounds([pts[0][1], pts[0][0]], [pts[0][1], pts[0][0]]); pts.forEach(function (p) { b.extend([p[1], p[0]]); });
      map.fitBounds(b, { padding: pad, maxZoom: 16, duration: anim ? 600 : 0 });
    };
    H.autoFit = function () {
      var s = [pos.r ? 1 : 0, pos.c ? 1 : 0, pos.d ? 1 : 0].join(''), first = sig === '';
      if (sig !== s) { sig = s; H.fit(!first); return 'fit'; }
      if (pos.d && Date.now() - userAt > 45000 && Date.now() - progAt > 1500) {
        /* pixel test: refit when the scooter drifts into the margins (right margin keeps it clear of the zoom buttons, top margin clear of the Live chip and distance bubble) */
        var sz = container.getBoundingClientRect(), p = map.project([pos.d[1], pos.d[0]]);
        var inView = p.x > 50 && p.x < sz.width - 110 && p.y > 100 && p.y < sz.height - 60 - bottomPad;
        if (!inView) { H.fit(true); return 'refit'; }
      }
      return null;
    };
    H.resize = function () { try { map.resize(); } catch (e) {} };
    H.status = function () { return JSON.parse(JSON.stringify(st)); };
    H.positions = function () { return JSON.parse(JSON.stringify(pos)); };
    H.userMovedAt = function () { return userAt; };
    H.destroy = function () { destroyed = true; cancelAnimationFrame(af); try { map.remove(); } catch (e) {} };
    return H;
  }

  window.RKTrack8 = { create: create, scooterSVG: scooterSVG, loadStyle: loadStyle, STYLE_URL: STYLE_URL, VERSION: '8B' };
})();
