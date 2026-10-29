// Riwaaz-e-Kashmir backend: one file for Cloudflare Pages ("advanced mode").
// Routes: /api/create-order, /api/track, /api/review, /api/reviews, /api/rphoto, /api/enquiry, /api/buddy, /api/connect, /api/write, /api/writings, /api/wphoto, /api/journey, /api/journeys, /api/jphoto, /api/admin, /api/webhook, /admin. Everything else is served from the site files.
const KID = e => e.RAZORPAY_KEY_ID || e.RZP_KEY_ID || 'rzp_live_TjTHI6nlesU7e1';
const SEC = e => e.RAZORPAY_KEY_SECRET || e.RAZORPAY_SECRET || e.RZP_KEY_SECRET || e.KEY_SECRET;
const rz = (env, path, opt = {}) => fetch('https://api.razorpay.com/v1' + path, { ...opt, headers: { Authorization: 'Basic ' + btoa(KID(env) + ':' + SEC(env)), 'Content-Type': 'application/json' } });
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...h } });
const last10 = s => String(s || '').replace(/\D/g, '').slice(-10);
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const normNo = s => { s = String(s || '').toUpperCase().replace(/\s+/g, ''); const m = s.match(/^REK-?(\d{4})$/); return m ? 'REK-' + m[1] : s; };
async function byReceipt(env, no) { const d = await (await rz(env, '/orders?receipt=' + encodeURIComponent(no))).json(); return d && d.items && d.items[0]; }

// ---- Prices (keep in sync with the website) ----
const CATALOG = {"walnut": [["100g", 249], ["250g", 499], ["500g", 990], ["1kg", 1999]], "giftbox": [["Simple", 1200], ["Custom Box", 1499]], "mamra": [["250g", 499], ["500g", 990], ["1kg", 1950]], "badam": [["250g", 349], ["500g", 649], ["1kg", 1199]], "pista": [["250g", 499], ["500g", 949], ["1kg", 1799]], "kaju": [["250g", 299], ["500g", 599], ["1kg", 1150]], "saffron": [["1g", 499], ["2g", 998]], "honey": [["250ml", 299], ["500ml", 549], ["1kg jar", 999]], "kahwa": [["150g", 299], ["250g", 599]], "noon": [["Pack", 499]], "shila": [["20g", 999]], "combo": [["Combo", 1799]], "winter": [["Set", 1199]], "sh1": [["1 shawl", 1499]], "sh2": [["1 shawl", 499]], "sh3": [["1 shawl", 699]], "sh4": [["1 shawl", 499]], "sh5": [["1 shawl", 1299]], "sh6": [["1 shawl", 1699]], "sample": [["0.5g", 149]]};
const NAMES = {"walnut": "Kashmiri Kernels", "giftbox": "Walnut Kernels Gift Box", "mamra": "Mamra Kashmiri Badam", "badam": "Kashmiri Badam", "pista": "Shahi Pista", "kaju": "Shahi Kaju", "saffron": "Kashmiri Saffron", "honey": "Pure Raw Kashmiri Honey", "kahwa": "Kashmiri Kahwa", "noon": "Kashmiri Noon Chai", "shila": "Himalayan Shilajit", "combo": "Kashmir Treasure Combo", "winter": "Winter Kahwa Set", "sh1": "Shahi Kashmiri Paisley Shawl", "sh2": "Midnight Floral Paisley", "sh3": "Black Copper & Silver Embroidery", "sh4": "Navy Paisley", "sh5": "Ivory Floral Embroidery", "sh6": "Ivory & Gold Paisley"};
const FREE_ABOVE = 499, DELIVERY = 70, GIFT_MIN = 1499, DIWALI_END = Date.parse('2026-11-09T00:00:00+05:30');
function priceOrder(lines, coupon) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 30) return null;
  let sub = 0, esub = 0, saffron = false; const ids = new Set();
  for (const l of lines) {
    const s = CATALOG[l.id] && CATALOG[l.id][l.sz], q = Math.floor(Number(l.q));
    if (!s || !(q >= 1 && q <= 20)) return null;
    sub += s[1] * q;
    if (l.id === 'saffron') saffron = true;
    if (!['combo', 'winter', 'sample'].includes(l.id)) { ids.add(l.id); esub += s[1] * q; }
  }
  const combo = ids.size >= 3 ? Math.round(esub * 0.05) : 0; // make-your-own combo: 5% off with 3+ different products
  const c = String(coupon || '').toUpperCase(), welcome = c === 'WELCOME' && !saffron, diwali = c === 'DIWALI' && Date.now() < DIWALI_END;
  const delivery = (sub > FREE_ABOVE || welcome) ? 0 : DELIVERY; // free above 499; WELCOME gives free shipping except with saffron
  return { total: sub - combo + delivery, gift: diwali && sub >= GIFT_MIN };
}

// ---- Telegram (one or more chat ids, comma separated) ----
async function tg(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return [{ ok: false, description: 'Telegram secrets not set' }];
  const out = [];
  for (const id of String(env.TELEGRAM_CHAT_ID).split(',').map(s => s.trim()).filter(Boolean)) {
    try { const r = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: id, text }) }); const d = await r.json(); out.push({ chat: id, ok: d.ok, description: d.description || '' }); }
    catch (e) { out.push({ chat: id, ok: false, description: 'network error' }); }
  }
  return out;
}

async function createOrder({ request, env }) {
  try {
    if (!SEC(env)) return json({ error: 'Razorpay secret not set' }, 500);
    const b = await request.json(), r0 = priceOrder(b.lines, b.coupon);
    if (!r0 || r0.total < 1) return json({ error: 'Invalid cart' }, 400);
    let receipt = '';
    for (let i = 0; i < 8; i++) { receipt = 'REK-' + (1000 + Math.floor(Math.random() * 9000)); if (!(await byReceipt(env, receipt))) break; }
    let items = String(b.items || ''); if (r0.gift && !/FREE GIFT/.test(items)) items += ' | FREE GIFT: Kahwa sachet';
    const c = (s, i) => String(s || '').slice(i * 250, i * 250 + 250);
    const notes = { n: c(b.name, 0).slice(0, 100), p: String(b.phone || '').slice(0, 20), e: String(b.email || '').slice(0, 100), a1: c(b.address, 0), a2: c(b.address, 1), i1: c(items, 0), i2: c(items, 1), st: '', trk: '' };
    const r = await rz(env, '/orders', { method: 'POST', body: JSON.stringify({ amount: r0.total * 100, currency: 'INR', receipt, notes }) });
    const o = await r.json();
    if (!r.ok) return json({ error: (o.error && o.error.description) || 'Razorpay error' }, 502);
    return json({ id: o.id, amount: o.amount, receipt, key: KID(env) });
  } catch (e) { return json({ error: 'Server error' }, 500); }
}
async function trackOrder({ request, env }) {
  const u = new URL(request.url), no = normNo(u.searchParams.get('no')), ph = last10(u.searchParams.get('phone'));
  if (!no || ph.length < 10) return json({ error: 'Enter your order number and phone number' }, 400);
  const o = await byReceipt(env, no);
  if (!o || last10(o.notes && o.notes.p) !== ph) return json({ error: 'No order found. Check the order number and phone number.' }, 404);
  const n = o.notes || {};
  return json({ no, paid: o.status === 'paid', status: n.st || 'Order placed', items: (n.i1 || '') + (n.i2 || ''), total: o.amount / 100, trk: n.trk || '' });
}

// ---- Reviews (stored in the KV namespace bound as REVIEWS; new reviews wait for approval) ----
async function allReviews(env) {
  const l = await env.REVIEWS.list({ prefix: 'r:', limit: 500 }), out = [];
  for (const k of l.keys) { const v = await env.REVIEWS.get(k.name); if (v) { try { out.push(JSON.parse(v)); } catch (e) {} } }
  return out.sort((a, b) => b.ts - a.ts);
}
async function reviewSubmit({ request, env }) {
  if (!env.REVIEWS) return json({ error: 'Reviews are not set up yet', fallback: true }, 503);
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }
  if (b.hp) return json({ ok: true }); // spam trap
  const p = String(b.p || ''), r = Math.floor(Number(b.r)), t = String(b.t || '').trim().slice(0, 600), n = String(b.n || '').trim().slice(0, 40), c = String(b.c || '').trim().slice(0, 40);
  if (!CATALOG[p] || !(r >= 1 && r <= 5) || t.length < 5 || !n) return json({ error: 'Please fill in your name and review' }, 400);
  const ip = request.headers.get('CF-Connecting-IP') || 'x', rk = 'rl:' + ip, cnt = parseInt((await env.REVIEWS.get(rk)) || '0');
  if (cnt >= 3) return json({ error: 'Too many reviews from this device. Please try again later.' }, 429);
  await env.REVIEWS.put(rk, String(cnt + 1), { expirationTtl: 3600 });
  let v = false;
  if (b.no && b.ph && SEC(env)) { try { const o = await byReceipt(env, normNo(b.no)); v = !!(o && o.status === 'paid' && last10(o.notes && o.notes.p) === last10(b.ph)); } catch (e) {} }
  const ts = Date.now(), id = ts + '-' + Math.random().toString(36).slice(2, 6);
  const pics = (Array.isArray(b.pics) ? b.pics : []).slice(0, 2).filter(x => typeof x === 'string' && /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+\/=]+$/.test(x) && x.length < 260000);
  for (let i = 0; i < pics.length; i++) await env.REVIEWS.put('ri:' + id + ':' + (i + 1), pics[i]);
  await env.REVIEWS.put('r:' + id, JSON.stringify({ id, p, r, t, n, c, v, st: 'pending', ts, np: pics.length }));
  await tg(env, 'New review waiting for approval\n' + (NAMES[p] || p) + ' - ' + r + '/5\n' + t + '\n- ' + n + (c ? ', ' + c : '') + (v ? ' (verified buyer)' : '') + (pics.length ? '\n(' + pics.length + ' photo' + (pics.length > 1 ? 's' : '') + ' attached)' : '') + '\nApprove it at riwaazekashmir.com/admin');
  return json({ ok: true });
}
async function reviewsPublic({ env }) {
  if (!env.REVIEWS) return json([], 200, { 'Cache-Control': 'public, max-age=60' });
  const a = (await allReviews(env)).filter(x => x.st === 'approved').map(x => ({ id: x.id, p: x.p, r: x.r, t: x.t, n: x.n, c: x.c, v: x.v, d: x.ts, np: x.np || 0 }));
  return json(a, 200, { 'Cache-Control': 'public, max-age=60' });
}


async function reviewPhoto({ request, env }) {
  if (!env.REVIEWS) return new Response('', { status: 404 });
  const u = new URL(request.url), id = u.searchParams.get('id') || '', n = u.searchParams.get('n') === '2' ? '2' : '1';
  const raw = await env.REVIEWS.get('r:' + id); if (!raw) return new Response('', { status: 404 });
  let x; try { x = JSON.parse(raw); } catch (e) { return new Response('', { status: 404 }); }
  if (x.st !== 'approved') return new Response('', { status: 404 });
  const d = await env.REVIEWS.get('ri:' + id + ':' + n); const m = d && d.match(/^data:(image\/[a-z]+);base64,(.+)$/); if (!m) return new Response('', { status: 404 });
  const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
  return new Response(bin, { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=86400' } });
}
async function enquiry({ request, env }) {
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }
  if (b.hp) return json({ ok: true });
  const cl = (v, m) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, m);
  const name = cl(b.name, 60), phone = cl(b.phone, 20), when = cl(b.when, 60), people = cl(b.people, 30), type = cl(b.type, 40), place = cl(b.place, 100), msg = cl(b.msg, 500);
  if (!name || last10(phone).length < 10) return json({ error: 'Please add your name and a valid phone number' }, 400);
  if (env.REVIEWS) {
    const ip = request.headers.get('CF-Connecting-IP') || 'x', rk = 'rl:enq:' + ip, cnt = parseInt((await env.REVIEWS.get(rk)) || '0');
    if (cnt >= 4) return json({ error: 'Too many requests. Please WhatsApp us instead.' }, 429);
    await env.REVIEWS.put(rk, String(cnt + 1), { expirationTtl: 3600 });
  }
  const res = await tg(env, 'New Kashmir TRAVEL enquiry\n' + name + ' - ' + phone + '\nType: ' + (type || '-') + '\nPlaces: ' + (place || '-') + '\nWhen: ' + (when || '-') + '\nPeople: ' + (people || '-') + (msg ? '\nNote: ' + msg : ''));
  const sent = Array.isArray(res) ? res.some(r => r && (r.ok === true || r === true)) : !!res;
  return json({ ok: true, sent });
}

// ---- Community: Kashmiri Buddy board + Mehfil-e-Adab (Literary Lounge). Everything waits for admin approval. ----
const DESTS = ['Srinagar', 'Gulmarg', 'Pahalgam', 'Sonamarg', 'Doodhpathri', 'Kupwara', 'Other'];
const BCATS = ['family', 'adventure', 'solo', 'cultural', 'solo_female', 'mixed'], WCATS = ['nazm', 'safarnama', 'afsana'];
const AVS = ['saffron', 'emerald', 'rose', 'snowcap', 'ivory', 'sunset', 'trekker', 'kulla', 'shades', 'scarf', 'lens', 'pheran'];
const BAD = /\b(fuck|fucking|bitch|slut|porn|nude|nudes|escort|sex|rape|bastard)\b/i;
const todayIST = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
const clean = (v, m) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, m);
const PICRE = /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+\/=]+$/;
async function overLimit(env, request, kind, max) {
  const ip = request.headers.get('CF-Connecting-IP') || 'x', k = 'rl:' + kind + ':' + ip, n = parseInt((await env.REVIEWS.get(k)) || '0');
  if (n >= max) return true; await env.REVIEWS.put(k, String(n + 1), { expirationTtl: 3600 }); return false;
}
async function listPrefix(env, prefix) {
  const l = await env.REVIEWS.list({ prefix, limit: 500 }), out = [];
  for (const k of l.keys) { const v = await env.REVIEWS.get(k.name); if (v) { try { out.push(JSON.parse(v)); } catch (e) {} } }
  return out.sort((a, b) => b.ts - a.ts);
}
async function readJson(request) { try { return await request.json(); } catch (e) { return null; } }
async function buddySubmit({ request, env }) {
  if (!env.REVIEWS) return json({ error: 'Not set up yet', fallback: true }, 503);
  const b = await readJson(request); if (!b) return json({ error: 'Bad request' }, 400);
  if (b.hp) return json({ ok: true });
  const name = clean(b.name, 20), st = clean(b.st, 30), dest = DESTS.includes(b.dest) ? b.dest : '', cat = BCATS.includes(b.cat) ? b.cat : '', bio = clean(b.bio, 300);
  const av = AVS.includes(b.av) ? b.av : 'saffron', ph = clean(b.ph, 20), size = Math.max(1, Math.min(20, parseInt(b.size) || 1)), f = clean(b.from, 10), t = clean(b.to, 10), re = /^\d{4}-\d{2}-\d{2}$/;
  if (!name || !st || !dest || !cat || bio.length < 10 || last10(ph).length < 10 || !b.age) return json({ error: 'Please fill in every field, add a valid WhatsApp number and confirm you are 18 or older' }, 400);
  if (!re.test(f) || !re.test(t) || t < f || t < todayIST()) return json({ error: 'Please check your travel dates' }, 400);
  if (BAD.test(name + ' ' + st + ' ' + bio)) return json({ error: 'Please keep your post friendly and respectful' }, 400);
  if (/https?:|www\.|@|\d{6,}/i.test(name + ' ' + st + ' ' + bio)) return json({ error: 'Please do not put phone numbers, emails or links in your post. Share them only with our team.' }, 400);
  if (await overLimit(env, request, 'buddy', 3)) return json({ error: 'Too many posts from this device. Please try later.' }, 429);
  const ts = Date.now(), id = ts + '-' + Math.random().toString(36).slice(2, 6);
  await env.REVIEWS.put('b:' + id, JSON.stringify({ id, name, st, dest, cat, women: !!b.women || cat === 'solo_female', bio, av, size, from: f, to: t, ph, status: 'pending', ts }));
  await tg(env, 'New Kashmiri Buddy post waiting\n' + name + ' (' + cat + ') - ' + dest + ', ' + f + ' to ' + t + '\n' + bio + '\nPrivate number: ' + ph + '\n' + ((b.women || cat === 'solo_female') ? 'WOMEN-ONLY post: confirm on WhatsApp that she is a woman before approving.\n' : '') + 'Approve at riwaazekashmir.com/admin');
  return json({ ok: true });
}
async function buddyPublic({ env }) {
  if (!env.REVIEWS) return json([], 200, { 'Cache-Control': 'public, max-age=30' });
  const today = todayIST(), a = (await listPrefix(env, 'b:')).filter(x => x.status === 'approved' && x.to >= today).map(x => ({ id: x.id, name: x.name, st: x.st, dest: x.dest, cat: x.cat === 'solo_female' || x.cat === 'mixed' ? 'solo' : x.cat, women: !!x.women || x.cat === 'solo_female', bio: x.bio, av: x.av, size: x.size, from: x.from, to: x.to }));
  return json(a, 200, { 'Cache-Control': 'public, max-age=30' });
}
async function buddyConnect({ request, env }) {
  if (!env.REVIEWS) return json({ error: 'Not set up yet', fallback: true }, 503);
  const b = await readJson(request); if (!b) return json({ error: 'Bad request' }, 400);
  if (b.hp) return json({ ok: true });
  const kind = b.kind === 'report' ? 'report' : 'connect', raw = await env.REVIEWS.get('b:' + clean(b.id, 40));
  if (!raw) return json({ error: 'This post is no longer available' }, 404);
  const p = JSON.parse(raw), name = clean(b.name, 40), ph = clean(b.ph, 20), note = clean(b.note, 300), reason = clean(b.reason, 60);
  if (kind === 'connect' && (!name || last10(ph).length < 10 || !b.age)) return json({ error: 'Please add your name, a valid WhatsApp number and confirm you are 18 or older' }, 400);
  if (BAD.test(note)) return json({ error: 'Please keep your message respectful' }, 400);
  if (await overLimit(env, request, 'conn', 6)) return json({ error: 'Too many requests from this device. Please try later.' }, 429);
  const ts = Date.now(), id = ts + '-' + Math.random().toString(36).slice(2, 6);
  await env.REVIEWS.put('c:' + id, JSON.stringify({ id, kind, post: p.id, summary: p.name + ', ' + p.dest + ', ' + p.from + ' to ' + p.to + ' (' + p.cat + ')', pph: p.ph, name, ph, note, reason, ts }));
  await tg(env, (kind === 'report' ? 'REPORT on a Kashmiri Buddy post\n' : 'Kashmiri Buddy connect request\n') + 'Post: ' + p.name + ', ' + p.dest + ', ' + p.from + ' to ' + p.to + '\nPoster WhatsApp: ' + p.ph + (kind === 'report' ? '\nReason: ' + (reason || '-') : '\nFrom: ' + name + ' ' + ph) + (note ? '\nNote: ' + note : '') + '\nAsk BOTH for consent on WhatsApp before sharing any contact.');
  return json({ ok: true });
}
async function writeSubmit({ request, env }) {
  if (!env.REVIEWS) return json({ error: 'Not set up yet', fallback: true }, 503);
  const b = await readJson(request); if (!b) return json({ error: 'Bad request' }, 400);
  if (b.hp) return json({ ok: true });
  const name = clean(b.name, 40), cat = WCATS.includes(b.cat) ? b.cat : '', title = clean(b.title, 80), text = String(b.text == null ? '' : b.text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 3000), av = AVS.includes(b.av) ? b.av : 'saffron';
  let soc = clean(b.soc, 40).replace(/^@/, ''); if (soc && !/^[A-Za-z0-9._]{1,30}$/.test(soc)) return json({ error: 'Instagram handle looks wrong. Use letters, numbers, dot or underscore only.' }, 400);
  if (!name || !cat || !title || text.length < 20 || !b.orig) return json({ error: 'Please add your name, a title, your writing (at least a few lines) and confirm it is your own work' }, 400);
  if (BAD.test(name + ' ' + title + ' ' + text)) return json({ error: 'Please keep it wholesome and respectful' }, 400);
  if (/https?:|www\./i.test(title + ' ' + text)) return json({ error: 'Please remove links from your writing' }, 400);
  const pic = typeof b.pic === 'string' && PICRE.test(b.pic) && b.pic.length < 200000 ? b.pic : '';
  if (await overLimit(env, request, 'write', 3)) return json({ error: 'Too many submissions from this device. Please try later.' }, 429);
  const ts = Date.now(), id = ts + '-' + Math.random().toString(36).slice(2, 6);
  if (pic) await env.REVIEWS.put('wi:' + id, pic);
  await env.REVIEWS.put('w:' + id, JSON.stringify({ id, name, cat, title, text, soc, av, hp: !!pic, status: 'pending', ts }));
  await tg(env, 'New Mehfil-e-Adab submission waiting\n' + title + ' (' + cat + ') by ' + name + (pic ? ' (photo attached)' : '') + '\nApprove at riwaazekashmir.com/admin');
  return json({ ok: true });
}
async function writingsPublic({ env }) {
  if (!env.REVIEWS) return json([], 200, { 'Cache-Control': 'public, max-age=60' });
  const a = (await listPrefix(env, 'w:')).filter(x => x.status === 'approved').map(x => ({ id: x.id, name: x.name, cat: x.cat, title: x.title, text: x.text, soc: x.soc, av: x.av, hp: x.hp, d: x.ts }));
  return json(a, 200, { 'Cache-Control': 'public, max-age=60' });
}
async function writerPhoto({ request, env }) {
  if (!env.REVIEWS) return new Response('', { status: 404 });
  const id = new URL(request.url).searchParams.get('id') || '', raw = await env.REVIEWS.get('w:' + id); if (!raw) return new Response('', { status: 404 });
  let x; try { x = JSON.parse(raw); } catch (e) { return new Response('', { status: 404 }); }
  if (x.status !== 'approved') return new Response('', { status: 404 });
  const d = await env.REVIEWS.get('wi:' + id), m = d && d.match(/^data:(image\/[a-z]+);base64,(.+)$/); if (!m) return new Response('', { status: 404 });
  return new Response(Uint8Array.from(atob(m[2]), c => c.charCodeAt(0)), { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=86400' } });
}

async function journeySubmit({ request, env }) {
  if (!env.REVIEWS) return json({ error: 'Not set up yet', fallback: true }, 503);
  const b = await readJson(request); if (!b) return json({ error: 'Bad request' }, 400);
  if (b.hp) return json({ ok: true });
  const name = clean(b.name, 30), town = clean(b.town, 40), month = clean(b.month, 7), place = clean(b.place, 60), story = clean(b.story, 600);
  if (!name || !town || !/^\d{4}-\d{2}$/.test(month) || !place || story.length < 10) return json({ error: 'Please fill in your name, hometown, trip month, place and a short story' }, 400);
  if (!b.own || !b.consent) return json({ error: 'Please tick both confirmations about your photo' }, 400);
  if (typeof b.pic !== 'string' || !PICRE.test(b.pic) || b.pic.length > 260000) return json({ error: 'Please add one photo (it will be resized automatically)' }, 400);
  if (BAD.test(name + ' ' + town + ' ' + place + ' ' + story)) return json({ error: 'Please keep it friendly and respectful' }, 400);
  if (/https?:|www\.|@|\d{6,}/i.test(name + ' ' + town + ' ' + place + ' ' + story)) return json({ error: 'Please remove links, handles and phone numbers from your story' }, 400);
  if (await overLimit(env, request, 'jr', 3)) return json({ error: 'Too many submissions from this device. Please try later.' }, 429);
  const ts = Date.now(), id = ts + '-' + Math.random().toString(36).slice(2, 6);
  await env.REVIEWS.put('ji:' + id, b.pic);
  await env.REVIEWS.put('j:' + id, JSON.stringify({ id, name, town, month, place, story, status: 'pending', ts }));
  await tg(env, 'New Journey Wall photo waiting\\n' + name + ' (' + town + ') - ' + place + ', ' + month + '\\n' + story + '\\nCheck the photo for children, other faces, room numbers. Approve at riwaazekashmir.com/admin');
  return json({ ok: true });
}
async function journeysPublic({ env }) {
  if (!env.REVIEWS) return json([], 200, { 'Cache-Control': 'public, max-age=60' });
  const a = (await listPrefix(env, 'j:')).filter(x => x.status === 'approved').map(x => ({ id: x.id, name: x.name, town: x.town, month: x.month, place: x.place, story: x.story, d: x.ts }));
  return json(a, 200, { 'Cache-Control': 'public, max-age=60' });
}
async function journeyPhoto({ request, env }) {
  if (!env.REVIEWS) return new Response('', { status: 404 });
  const id = new URL(request.url).searchParams.get('id') || '', raw = await env.REVIEWS.get('j:' + id); if (!raw) return new Response('', { status: 404 });
  let x; try { x = JSON.parse(raw); } catch (e) { return new Response('', { status: 404 }); }
  if (x.status !== 'approved') return new Response('', { status: 404 });
  const d = await env.REVIEWS.get('ji:' + id), m = d && d.match(/^data:(image\/[a-z]+);base64,(.+)$/); if (!m) return new Response('', { status: 404 });
  return new Response(Uint8Array.from(atob(m[2]), c => c.charCodeAt(0)), { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=86400' } });
}

async function adminApi({ request, env }) {
  const b = await request.json();
  if (!env.ADMIN_KEY || b.key !== env.ADMIN_KEY) return json({ error: 'Wrong key' }, 401);
  if (b.action === 'testalert') return json({ results: await tg(env, 'Test alert from your Riwaaz-e-Kashmir website. Telegram is working!') });
  if (['rlist', 'rset', 'rdel', 'redit', 'rphoto'].includes(b.action)) {
    if (!env.REVIEWS) return json({ error: 'Review storage (KV) is not connected yet' }, 503);
    if (b.action === 'rlist') return json({ reviews: (await allReviews(env)).map(x => ({ ...x, pn: NAMES[x.p] })) });
    const key = 'r:' + String(b.id || ''), raw = await env.REVIEWS.get(key);
    if (!raw) return json({ error: 'Review not found' }, 404);
    if (b.action === 'rdel') { await env.REVIEWS.delete(key); await env.REVIEWS.delete('ri:' + b.id + ':1'); await env.REVIEWS.delete('ri:' + b.id + ':2'); return json({ ok: true }); }
    if (b.action === 'rphoto') return json({ pics: [await env.REVIEWS.get('ri:' + b.id + ':1'), await env.REVIEWS.get('ri:' + b.id + ':2')].filter(Boolean) });
    if (b.action === 'redit') { const t = String(b.t || '').trim().slice(0, 600); if (t.length < 5) return json({ error: 'Text too short' }, 400); const y = JSON.parse(raw); y.t = t; await env.REVIEWS.put(key, JSON.stringify(y)); return json({ ok: true }); }
    const x = JSON.parse(raw); if (!['approved', 'rejected', 'pending'].includes(b.status)) return json({ error: 'Bad status' }, 400);
    x.st = b.status; await env.REVIEWS.put(key, JSON.stringify(x)); return json({ ok: true });
  }
  if (['blist', 'bset', 'bdel', 'clist', 'cdel', 'wlist', 'wset', 'wdel', 'wphoto', 'jlist', 'jset', 'jdel', 'jphoto'].includes(b.action)) {
    if (!env.REVIEWS) return json({ error: 'Storage (KV) is not connected yet' }, 503);
    const k = b.action[0];
    if (b.action.endsWith('list')) return json({ items: await listPrefix(env, k + ':') });
    const id = String(b.id || ''), key = k + ':' + id, raw = await env.REVIEWS.get(key);
    if (!raw) return json({ error: 'Not found' }, 404);
    if (b.action === 'wphoto' || b.action === 'jphoto') return json({ pic: await env.REVIEWS.get(k + 'i:' + id) });
    if (b.action.endsWith('del')) { await env.REVIEWS.delete(key); if (k === 'w' || k === 'j') await env.REVIEWS.delete(k + 'i:' + id); return json({ ok: true }); }
    if (!['approved', 'rejected', 'pending'].includes(b.status)) return json({ error: 'Bad status' }, 400);
    const x = JSON.parse(raw); x.status = b.status; await env.REVIEWS.put(key, JSON.stringify(x)); return json({ ok: true });
  }
  if (b.action === 'list') {
    const d = await (await rz(env, '/orders?count=50')).json();
    return json({ orders: (d.items || []).filter(o => /^(RK|REK)/.test(o.receipt || '')).map(o => ({ no: o.receipt, paid: o.status === 'paid', total: o.amount / 100, name: o.notes.n, phone: o.notes.p, address: (o.notes.a1 || '') + (o.notes.a2 || ''), items: (o.notes.i1 || '') + (o.notes.i2 || ''), st: o.notes.st || 'Order placed', trk: o.notes.trk || '' })) });
  }
  const o = await byReceipt(env, normNo(b.no));
  if (!o) return json({ error: 'Order not found' }, 404);
  const r = await rz(env, '/orders/' + o.id, { method: 'PATCH', body: JSON.stringify({ notes: { ...o.notes, st: b.status || '', trk: b.trk || '' } }) });
  return json({ ok: r.ok });
}

// ---- Paid-order alerts (optional): Telegram + email via Resend ----
async function hmac(secret, body) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(body));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function mail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !to) return;
  await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html }) });
}
async function webhook({ request, env }) {
  const body = await request.text();
  if (!env.RAZORPAY_WEBHOOK_SECRET || (await hmac(env.RAZORPAY_WEBHOOK_SECRET, body)) !== request.headers.get('x-razorpay-signature')) return json({ error: 'bad signature' }, 401);
  const ev = JSON.parse(body);
  if (ev.event === 'payment.captured') {
    const oid = ev.payload.payment.entity.order_id;
    const o = await (await rz(env, '/orders/' + oid)).json(), n = o.notes || {}, items = (n.i1 || '') + (n.i2 || ''), addr = (n.a1 || '') + (n.a2 || '');
    const text = 'New paid order ' + o.receipt + '\nTotal: Rs ' + o.amount / 100 + '\n' + n.n + ' ' + n.p + '\n' + addr + '\n' + items;
    await tg(env, text);
    await mail(env, env.OWNER_EMAIL || 'riwaazekashmiroffical@gmail.com', 'New paid order ' + o.receipt, '<pre>' + esc(text) + '</pre>');
    if (n.e) await mail(env, n.e, 'Your Riwaaz-e-Kashmir order ' + o.receipt + ' is confirmed',
      '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #c9a961;padding:20px"><h2 style="color:#8a6d2b">Thank you, ' + esc(n.n) + '!</h2><p>Your order <b>' + esc(o.receipt) + '</b> is confirmed.</p><p>' + esc(items) + '</p><p>Total paid: <b>Rs ' + o.amount / 100 + '</b></p><p>Track your order any time on riwaazekashmir.com with your order number and phone number.</p><p>Questions? WhatsApp +91 91494 80384 (8 AM to 12 midnight) or riwaazekashmiroffical@gmail.com</p><p>With love from Kashmir,<br>Riwaaz-e-Kashmir</p></div>');
  }
  return json({ ok: true });
}
const ADMIN_PAGE = 'PCFET0NUWVBFIGh0bWw+PGh0bWw+PGhlYWQ+PG1ldGEgY2hhcnNldD0idXRmLTgiPjxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsaW5pdGlhbC1zY2FsZT0xIj48bWV0YSBuYW1lPSJyb2JvdHMiIGNvbnRlbnQ9Im5vaW5kZXgiPjx0aXRsZT5BZG1pbjwvdGl0bGU+CjxzdHlsZT5ib2R5e2ZvbnQtZmFtaWx5OnNhbnMtc2VyaWY7YmFja2dyb3VuZDojMGYxYTEzO2NvbG9yOiNmMGVjZTI7cGFkZGluZzoxNHB4O21heC13aWR0aDo2NDBweDttYXJnaW46YXV0b31pbnB1dCxzZWxlY3QsYnV0dG9ue2ZvbnQ6aW5oZXJpdDtwYWRkaW5nOjEwcHg7bWFyZ2luOjNweCAwO3dpZHRoOjEwMCU7Ym94LXNpemluZzpib3JkZXItYm94O2JvcmRlci1yYWRpdXM6NXB4O2JvcmRlcjoxcHggc29saWQgIzQ0NDtiYWNrZ3JvdW5kOiMxNDIwMWE7Y29sb3I6I2YwZWNlMn1idXR0b257YmFja2dyb3VuZDojYzlhOTYxO2NvbG9yOiMwZjFhMTM7Ym9yZGVyOjB9Lmd7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyIDFmcjtnYXA6NnB4fS5ve2JvcmRlcjoxcHggc29saWQgI2M5YTk2MTY2O2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweDttYXJnaW46MTBweCAwO2ZvbnQtc2l6ZToxM3B4O2xpbmUtaGVpZ2h0OjEuNX0uYjJ7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyIDFmcjtnYXA6NnB4fS5ye2JhY2tncm91bmQ6IzdhMmEyYTtjb2xvcjojZmZmfS5ze2NvbG9yOiNjOWE5NjF9PC9zdHlsZT48L2hlYWQ+PGJvZHk+CjxoMz5SaXdhYXotZS1LYXNobWlyIGFkbWluPC9oMz48aW5wdXQgaWQ9ImsiIHR5cGU9InBhc3N3b3JkIiBwbGFjZWhvbGRlcj0iQWRtaW4ga2V5Ij4KPGRpdiBjbGFzcz0iZyI+PGJ1dHRvbiBvbmNsaWNrPSJvcmRlcnMoKSI+T3JkZXJzPC9idXR0b24+PGJ1dHRvbiBvbmNsaWNrPSJyZXZzKCkiPlJldmlld3M8L2J1dHRvbj48YnV0dG9uIG9uY2xpY2s9InRlc3QoKSI+VGVzdCBhbGVydDwvYnV0dG9uPjxidXR0b24gb25jbGljaz0iYnVkZHkoKSI+QnVkZHkgcG9zdHM8L2J1dHRvbj48YnV0dG9uIG9uY2xpY2s9InJlcXMoKSI+UmVxdWVzdHM8L2J1dHRvbj48YnV0dG9uIG9uY2xpY2s9ImxvdW5nZSgpIj5Mb3VuZ2U8L2J1dHRvbj48YnV0dG9uIG9uY2xpY2s9ImpyKCkiPkpvdXJuZXkgV2FsbDwvYnV0dG9uPjwvZGl2PjxkaXYgaWQ9ImwiPjwvZGl2Pgo8c2NyaXB0Pgpjb25zdCBKPWI9PmZldGNoKCcvYXBpL2FkbWluJyx7bWV0aG9kOidQT1NUJyxib2R5OkpTT04uc3RyaW5naWZ5KHtrZXk6ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2snKS52YWx1ZSwuLi5ifSl9KS50aGVuKHI9PnIuanNvbigpKTsKY29uc3QgZT1zPT5TdHJpbmcocz09bnVsbD8nJzpzKS5yZXBsYWNlKC9bJjw+Il0vZyxjPT4oeycmJzonJmFtcDsnLCc8JzonJmx0OycsJz4nOicmZ3Q7JywnIic6JyZxdW90Oyd9W2NdKSk7Y29uc3QgTD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbCcpOwpmdW5jdGlvbiBvcmRlcnMoKXtKKHthY3Rpb246J2xpc3QnfSkudGhlbihkPT57aWYoZC5lcnJvcil7YWxlcnQoZC5lcnJvcik7cmV0dXJufQpMLmlubmVySFRNTD1kLm9yZGVycy5tYXAobz0+YDxkaXYgY2xhc3M9Im8iPjxiPiR7ZShvLm5vKX08L2I+ICR7by5wYWlkPydQQUlEJzonPHNwYW4gc3R5bGU9ImNvbG9yOiNlNTQ4NGQiPk5PVCBQQUlEPC9zcGFuPid9IC0gUnMgJHtvLnRvdGFsfTxicj4ke2Uoby5uYW1lKX0gJHtlKG8ucGhvbmUpfTxicj4ke2Uoby5hZGRyZXNzKX08YnI+JHtlKG8uaXRlbXMpfQo8c2VsZWN0IGlkPSJzLSR7by5ub30iPiR7WydPcmRlciBwbGFjZWQnLCdDb25maXJtZWQnLCdQYWNrZWQnLCdTaGlwcGVkJywnRGVsaXZlcmVkJ10ubWFwKHM9PmA8b3B0aW9uICR7cz09PW8uc3Q/J3NlbGVjdGVkJzonJ30+JHtzfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0Pgo8aW5wdXQgaWQ9InQtJHtvLm5vfSIgcGxhY2Vob2xkZXI9IlRyYWNraW5nIGxpbmsgKG9wdGlvbmFsKSIgdmFsdWU9IiR7ZShvLnRyayl9Ij48YnV0dG9uIG9uY2xpY2s9InNhdmUoJyR7by5ub30nKSI+U2F2ZSBzdGF0dXM8L2J1dHRvbj48L2Rpdj5gKS5qb2luKCcnKXx8J05vIG9yZGVycyB5ZXQnfSl9CmZ1bmN0aW9uIHNhdmUobm8pe0ooe25vLHN0YXR1czpkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy0nK25vKS52YWx1ZSx0cms6ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3QtJytubykudmFsdWV9KS50aGVuKGQ9PmFsZXJ0KGQub2s/J1NhdmVkJzooZC5lcnJvcnx8J0ZhaWxlZCcpKSl9CmZ1bmN0aW9uIHJldnMoKXtKKHthY3Rpb246J3JsaXN0J30pLnRoZW4oZD0+e2lmKGQuZXJyb3Ipe2FsZXJ0KGQuZXJyb3IpO3JldHVybn0KUlY9ZC5yZXZpZXdzO0wuaW5uZXJIVE1MPVJWLm1hcChyPT5gPGRpdiBjbGFzcz0ibyI+PHNwYW4gY2xhc3M9InMiPiR7JyYjOTczMzsnLnJlcGVhdChyLnIpfTwvc3Bhbj4gPGI+JHtlKHIucG58fHIucCl9PC9iPiA8aT4ke2Uoci5zdCl9PC9pPiR7ci52PycgKHZlcmlmaWVkIGJ1eWVyKSc6Jyd9IDxzbWFsbD4ke25ldyBEYXRlKHIudHMpLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tSU4nKX08L3NtYWxsPjxicj48c3BhbiBpZD0idC0ke3IuaWR9Ij4ke2Uoci50KX08L3NwYW4+PGJyPi0gJHtlKHIubil9JHtyLmM/JywgJytlKHIuYyk6Jyd9CiR7ci5ucD9gPGRpdiBpZD0icC0ke3IuaWR9Ij48YnV0dG9uIG9uY2xpY2s9InBoKCcke3IuaWR9JykiPlNob3cgJHtyLm5wfSBwaG90byR7ci5ucD4xPydzJzonJ308L2J1dHRvbj48L2Rpdj5gOicnfQo8ZGl2IGNsYXNzPSJiMiIgc3R5bGU9ImdyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyIj48YnV0dG9uIG9uY2xpY2s9InJzKCcke3IuaWR9JywnYXBwcm92ZWQnKSI+QXBwcm92ZTwvYnV0dG9uPjxidXR0b24gY2xhc3M9InIiIG9uY2xpY2s9InJzKCcke3IuaWR9JywncmVqZWN0ZWQnKSI+UmVqZWN0PC9idXR0b24+PGJ1dHRvbiBvbmNsaWNrPSJlZCgnJHtyLmlkfScpIj5FZGl0IHRleHQ8L2J1dHRvbj48YnV0dG9uIGNsYXNzPSJyIiBvbmNsaWNrPSJyZCgnJHtyLmlkfScpIj5EZWxldGU8L2J1dHRvbj48L2Rpdj48L2Rpdj5gKS5qb2luKCcnKXx8J05vIHJldmlld3MgeWV0J30pfQpsZXQgUlY9W107CmZ1bmN0aW9uIHBoKGlkKXtKKHthY3Rpb246J3JwaG90bycsaWR9KS50aGVuKGQ9Pntkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncC0nK2lkKS5pbm5lckhUTUw9KGQucGljc3x8W10pLm1hcChzPT5gPGltZyBzcmM9IiR7c30iIHN0eWxlPSJ3aWR0aDo0OCU7Ym9yZGVyLXJhZGl1czo2cHg7bWFyZ2luOjJweCI+YCkuam9pbignJyl8fCdObyBwaG90b3MnfSl9CmZ1bmN0aW9uIGVkKGlkKXtjb25zdCByPVJWLmZpbmQoeD0+eC5pZD09PWlkKSx0PXByb21wdCgnRml4IHR5cG9zIG9ubHkgKGtlZXAgdGhlIGN1c3RvbWVyXCdzIG1lYW5pbmcpOicsci50KTtpZih0PT09bnVsbHx8dC50cmltKCk9PT1yLnQpcmV0dXJuO0ooe2FjdGlvbjoncmVkaXQnLGlkLHR9KS50aGVuKGQ9PnthbGVydChkLm9rPydTYXZlZCc6KGQuZXJyb3J8fCdGYWlsZWQnKSk7cmV2cygpfSl9CmZ1bmN0aW9uIHJzKGlkLHN0YXR1cyl7Sih7YWN0aW9uOidyc2V0JyxpZCxzdGF0dXN9KS50aGVuKGQ9PnthbGVydChkLm9rPydEb25lJzooZC5lcnJvcnx8J0ZhaWxlZCcpKTtyZXZzKCl9KX0KZnVuY3Rpb24gcmQoaWQpe2lmKGNvbmZpcm0oJ0RlbGV0ZSB0aGlzIHJldmlldz8nKSlKKHthY3Rpb246J3JkZWwnLGlkfSkudGhlbihkPT57YWxlcnQoZC5vaz8nRGVsZXRlZCc6KGQuZXJyb3J8fCdGYWlsZWQnKSk7cmV2cygpfSl9Cgpjb25zdCBDTD17c29sb19mZW1hbGU6J1dPTUVOJyxtaXhlZDonTWl4ZWQnLGZhbWlseTonRmFtaWx5ICYgRnJpZW5kcycsYWR2ZW50dXJlOidBZHZlbnR1cmUnLHNvbG86J1NvbG8nLGN1bHR1cmFsOidDdWx0dXJhbCd9OwpmdW5jdGlvbiBzYnRuKHAsaWQsc3Qpe3JldHVybiBgPGRpdiBjbGFzcz0iYjIiIHN0eWxlPSJncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDFmciAxZnIiPjxidXR0b24gb25jbGljaz0iY3MoJyR7cH0nLCcke2lkfScsJ2FwcHJvdmVkJykiPkFwcHJvdmU8L2J1dHRvbj48YnV0dG9uIGNsYXNzPSJyIiBvbmNsaWNrPSJjcygnJHtwfScsJyR7aWR9JywncmVqZWN0ZWQnKSI+UmVqZWN0PC9idXR0b24+PGJ1dHRvbiBjbGFzcz0iciIgb25jbGljaz0iY2QoJyR7cH0nLCcke2lkfScpIj5EZWxldGU8L2J1dHRvbj48L2Rpdj5gfQpsZXQgTEFTVD0nJzsKZnVuY3Rpb24gY3MocCxpZCxzKXtKKHthY3Rpb246cCsnc2V0JyxpZCxzdGF0dXM6c30pLnRoZW4oZD0+e2FsZXJ0KGQub2s/J0RvbmUnOihkLmVycm9yfHwnRmFpbGVkJykpO0xBU1QmJndpbmRvd1tMQVNUXSgpfSl9CmZ1bmN0aW9uIGNkKHAsaWQpe2lmKGNvbmZpcm0oJ0RlbGV0ZSB0aGlzPycpKUooe2FjdGlvbjpwKydkZWwnLGlkfSkudGhlbihkPT57YWxlcnQoZC5vaz8nRGVsZXRlZCc6KGQuZXJyb3J8fCdGYWlsZWQnKSk7TEFTVCYmd2luZG93W0xBU1RdKCl9KX0KZnVuY3Rpb24gYnVkZHkoKXtMQVNUPSdidWRkeSc7Sih7YWN0aW9uOidibGlzdCd9KS50aGVuKGQ9PntpZihkLmVycm9yKXthbGVydChkLmVycm9yKTtyZXR1cm59CkwuaW5uZXJIVE1MPShkLml0ZW1zfHxbXSkubWFwKHI9PmA8ZGl2IGNsYXNzPSJvIj48Yj4ke2Uoci5uYW1lKX08L2I+IGZyb20gJHtlKHIuc3QpfSA8aT4ke2Uoci5zdGF0dXMpfTwvaT4gPHNwYW4gY2xhc3M9InMiPiR7ZShDTFtyLmNhdF18fHIuY2F0KX08L3NwYW4+PGJyPiR7ZShyLmRlc3QpfTogJHtlKHIuZnJvbSl9IHRvICR7ZShyLnRvKX0sIGdyb3VwIG9mICR7ZShyLnNpemUpfTxicj4ke2Uoci5iaW8pfTxicj5Qcml2YXRlIFdoYXRzQXBwOiA8Yj4ke2Uoci5waCl9PC9iPiR7KHIud29tZW58fHIuY2F0PT09J3NvbG9fZmVtYWxlJyk/Jzxicj48c3BhbiBjbGFzcz0icyI+V09NRU4tT05MWTogY29uZmlybSBvbiBXaGF0c0FwcCB0aGF0IHNoZSBpcyBhIHdvbWFuIGJlZm9yZSBhcHByb3ZpbmcuPC9zcGFuPic6Jyd9JHtzYnRuKCdiJyxyLmlkKX08L2Rpdj5gKS5qb2luKCcnKXx8J05vIGJ1ZGR5IHBvc3RzIHlldCd9KX0KZnVuY3Rpb24gcmVxcygpe0xBU1Q9J3JlcXMnO0ooe2FjdGlvbjonY2xpc3QnfSkudGhlbihkPT57aWYoZC5lcnJvcil7YWxlcnQoZC5lcnJvcik7cmV0dXJufQpMLmlubmVySFRNTD0oZC5pdGVtc3x8W10pLm1hcChyPT5gPGRpdiBjbGFzcz0ibyI+PGI+JHtyLmtpbmQ9PT0ncmVwb3J0Jz8nUkVQT1JUJzonQ29ubmVjdCByZXF1ZXN0J308L2I+IDxzbWFsbD4ke25ldyBEYXRlKHIudHMpLnRvTG9jYWxlU3RyaW5nKCdlbi1JTicpfTwvc21hbGw+PGJyPlBvc3Q6ICR7ZShyLnN1bW1hcnkpfTxicj5Qb3N0ZXIgV2hhdHNBcHA6ICR7ZShyLnBwaCl9PGJyPiR7ci5raW5kPT09J3JlcG9ydCc/J1JlYXNvbjogJytlKHIucmVhc29uKTonRnJvbTogJytlKHIubmFtZSkrJyAnK2Uoci5waCl9JHtyLm5vdGU/Jzxicj5Ob3RlOiAnK2Uoci5ub3RlKTonJ308YnI+PHNwYW4gY2xhc3M9InMiPkFzayBib3RoIHBlb3BsZSBmb3IgY29uc2VudCwgdGhlbiBpbnRyb2R1Y2UgdGhlbSBpbiBhIFdoYXRzQXBwIGdyb3VwIHdpdGggYSBndWlkZS48L3NwYW4+PGRpdiBjbGFzcz0iYjIiIHN0eWxlPSJncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIj48YnV0dG9uIGNsYXNzPSJyIiBvbmNsaWNrPSJjZCgnYycsJyR7ci5pZH0nKSI+RG9uZSAvIGRlbGV0ZTwvYnV0dG9uPjwvZGl2PjwvZGl2PmApLmpvaW4oJycpfHwnTm8gcmVxdWVzdHMgeWV0J30pfQpmdW5jdGlvbiBsb3VuZ2UoKXtMQVNUPSdsb3VuZ2UnO0ooe2FjdGlvbjond2xpc3QnfSkudGhlbihkPT57aWYoZC5lcnJvcil7YWxlcnQoZC5lcnJvcik7cmV0dXJufQpMLmlubmVySFRNTD0oZC5pdGVtc3x8W10pLm1hcChyPT5gPGRpdiBjbGFzcz0ibyI+PGI+JHtlKHIudGl0bGUpfTwvYj4gYnkgJHtlKHIubmFtZSl9IDxpPiR7ZShyLnN0YXR1cyl9PC9pPiA8c21hbGw+JHtlKHIuY2F0KX08L3NtYWxsPjxicj48ZGl2IHN0eWxlPSJ3aGl0ZS1zcGFjZTpwcmUtd3JhcDttYXgtaGVpZ2h0OjE2MHB4O292ZXJmbG93OmF1dG87bWFyZ2luOjZweCAwIj4ke2Uoci50ZXh0KX08L2Rpdj4ke3Iuc29jPydJbnN0YWdyYW06IEAnK2Uoci5zb2MpKyc8YnI+JzonJ30ke3IuaHA/YDxkaXYgaWQ9IndwLSR7ci5pZH0iPjxidXR0b24gb25jbGljaz0id3BoKCcke3IuaWR9JykiPlNob3cgcGhvdG88L2J1dHRvbj48L2Rpdj5gOicnfSR7c2J0bigndycsci5pZCl9PC9kaXY+YCkuam9pbignJyl8fCdObyBzdWJtaXNzaW9ucyB5ZXQnfSl9CmZ1bmN0aW9uIGpyKCl7TEFTVD0nanInO0ooe2FjdGlvbjonamxpc3QnfSkudGhlbihkPT57aWYoZC5lcnJvcil7YWxlcnQoZC5lcnJvcik7cmV0dXJufQpMLmlubmVySFRNTD0oZC5pdGVtc3x8W10pLm1hcChyPT5gPGRpdiBjbGFzcz0ibyI+PGI+JHtlKHIubmFtZSl9PC9iPiBmcm9tICR7ZShyLnRvd24pfSA8aT4ke2Uoci5zdGF0dXMpfTwvaT48YnI+JHtlKHIucGxhY2UpfSwgJHtlKHIubW9udGgpfTxicj4ke2Uoci5zdG9yeSl9PGRpdiBpZD0ianAtJHtyLmlkfSI+PGJ1dHRvbiBvbmNsaWNrPSJqcGgoJyR7ci5pZH0nKSI+U2hvdyBwaG90bzwvYnV0dG9uPjwvZGl2PjxzcGFuIGNsYXNzPSJzIj5DaGVjazogY2hpbGRyZW4sIG90aGVyIGZhY2VzLCByb29tIG51bWJlcnMsIGFueXRoaW5nIHVuc2FmZS48L3NwYW4+JHtzYnRuKCdqJyxyLmlkKX08L2Rpdj5gKS5qb2luKCcnKXx8J05vIGpvdXJuZXlzIHlldCd9KX0KZnVuY3Rpb24ganBoKGlkKXtKKHthY3Rpb246J2pwaG90bycsaWR9KS50aGVuKGQ9Pntkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnanAtJytpZCkuaW5uZXJIVE1MPWQucGljP2A8aW1nIHNyYz0iJHtkLnBpY30iIHN0eWxlPSJ3aWR0aDo3MCU7Ym9yZGVyLXJhZGl1czo2cHgiPmA6J05vIHBob3RvJ30pfQpmdW5jdGlvbiB3cGgoaWQpe0ooe2FjdGlvbjond3Bob3RvJyxpZH0pLnRoZW4oZD0+e2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd3cC0nK2lkKS5pbm5lckhUTUw9ZC5waWM/YDxpbWcgc3JjPSIke2QucGljfSIgc3R5bGU9IndpZHRoOjUwJTtib3JkZXItcmFkaXVzOjZweCI+YDonTm8gcGhvdG8nfSl9CmZ1bmN0aW9uIHRlc3QoKXtKKHthY3Rpb246J3Rlc3RhbGVydCd9KS50aGVuKGQ9PnthbGVydChkLmVycm9yP2QuZXJyb3I6KCdUZWxlZ3JhbSByZXBsaWVkOiAnK0pTT04uc3RyaW5naWZ5KGQucmVzdWx0cykpKX0pfQo8L3NjcmlwdD48L2JvZHk+PC9odG1sPgo=';

/* =====================================================================
   FOOD (Mehfil-e-Kashmir) - added block. Nothing above this line is touched.
   KV prefixes (same REVIEWS namespace):
     fc:cfg   settings          fr:{id}        restaurant      fd:{rid}:{did}  dish
     fo:20yymmdd:{orderId} order  fa:{loginId}  login account   ft:{token}     session (12h)
     fp:{CODE} promo            fpu:{CODE}:{phone} promo use     fg:{ts}-{r}    price-change log
     fb:{phone} blocked number  fs:{rid}:{from}:{to} settlement paid
   ===================================================================== */
const FNEXT = { placed: ['accepted', 'rejected', 'cancelled'], accepted: ['ready', 'cancelled'], ready: ['picked', 'cancelled'], picked: ['delivered', 'cancelled'] };
const FCFG = { fee: 30, freeAbove: 499, paused: false, riderCost: 0, localities: ['Lal Chowk', 'Rajbagh', 'Karan Nagar', 'Bemina', 'Hazratbal', 'Jawahar Nagar'] };
const fhex = a => [...new Uint8Array(a)].map(b => b.toString(16).padStart(2, '0')).join('');
const frnd = n => fhex(crypto.getRandomValues(new Uint8Array(n)));
const fget = async (env, k) => { const v = await env.REVIEWS.get(k); if (!v) return null; try { return JSON.parse(v); } catch (e) { return null; } };
const fput = (env, k, o, opt) => env.REVIEWS.put(k, JSON.stringify(o), opt);
const fcfg = async env => ({ ...FCFG, ...((await fget(env, 'fc:cfg')) || {}) });
const fstr = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const fslug = s => fstr(s, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fymd = ts => new Date(ts + 19800000).toISOString().slice(2, 10).replace(/-/g, '');
const fkey = id => { const m = /^MK(\d{6})-[0-9A-F]{4}$/.exec(String(id)); return m ? 'fo:20' + m[1] + ':' + id : null; };
async function fhash(pw, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return fhex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, k, 256));
}
async function fdays(env, days) { let out = []; for (const d of days) out = out.concat(await listPrefix(env, 'fo:20' + d + ':')); return out.sort((a, b) => b.ts - a.ts); }
function fdaysBack(n) { const out = []; for (let i = 0; i < n; i++) out.push(fymd(Date.now() - i * 86400000)); return out; }
function frange(from, to) { const out = []; let t = Date.parse('20' + from.slice(0, 2) + '-' + from.slice(2, 4) + '-' + from.slice(4, 6) + 'T00:00:00+05:30'); const e = Date.parse('20' + to.slice(0, 2) + '-' + to.slice(2, 4) + '-' + to.slice(4, 6) + 'T00:00:00+05:30'); for (let i = 0; t <= e && i < 62; i++, t += 86400000) out.push(fymd(t)); return out; }
const fsafe = o => ({ id: o.id, st: o.st, rn: o.rn, name: o.name, phone: o.phone, addr: o.addr, zone: o.zone, lines: o.lines, sub: o.sub, disc: o.disc, fee: o.fee, total: o.total, pay: o.pay, paid: o.paid, prep: o.prep, rider: o.rider, note: o.note, trail: o.trail, ts: o.ts, reason: o.reason });

/* kitchens see the first name only, never phone or address */
const fsafeRest = o => ({ id: o.id, st: o.st, name: String(o.name || '').split(' ')[0], lines: o.lines, sub: o.sub, prep: o.prep, note: o.note, trail: o.trail, ts: o.ts, reason: o.reason });

async function fmove(env, o, to, extra) {
  if (!(FNEXT[o.st] || []).includes(to)) return json({ error: 'This order is already ' + o.st + '.' }, 409);
  o.st = to; o.trail.push({ s: to, t: Date.now() }); Object.assign(o, extra || {}); await fput(env, fkey(o.id), o);
  return null;
}

/* ---------- public ---------- */
async function foodMenu(env) {
  const cfg = await fcfg(env), rs = (await listPrefix(env, 'fr:')).filter(r => !r.suspended), out = [];
  for (const r of rs) {
    const l = await env.REVIEWS.list({ prefix: 'fd:' + r.id + ':', limit: 300 }), dishes = [];
    for (const k of l.keys) { const d = await fget(env, k.name); if (d) dishes.push({ id: d.id, name: d.name, cat: d.cat, price: d.price, was: d.was || null, veg: !!d.veg, stock: !!d.stock, desc: d.desc || '' }); }
    out.push({ id: r.id, name: r.name, zone: r.zone, banner: r.banner || '', open: !!r.open, hours: r.hours || '', tags: r.tags || '', cuisines: r.cuisines || [], eta: r.eta || '', forTwo: r.forTwo || '', dishes });
  }
  const promos = (await listPrefix(env, 'fp:')).filter(p => p.pub && p.active && (!p.until || Date.now() <= p.until)).map(p => ({ code: p.code, title: p.title || '', flat: p.flat || 0, pct: p.pct || 0, min: p.min || 0, max: p.max || 0, rid: p.rid || null, freeDel: !!p.freeDel }));
  return json({ cfg: { fee: cfg.fee, freeAbove: cfg.freeAbove, paused: cfg.paused, localities: cfg.localities }, promos, restaurants: out }, 200, { 'Cache-Control': 'no-store' });
}

async function foodPlace(env, request) {
  const b = await readJson(request); if (!b) return json({ error: 'Bad request' }, 400);
  if (b.hp) return json({ ok: true });
  if (await overLimit(env, request, 'forder', 10)) return json({ error: 'Too many orders from this network. Please try later or call us.' }, 429);
  const cfg = await fcfg(env);
  if (cfg.paused) return json({ error: 'Ordering is paused for now. Please call us to order.' }, 503);
  const name = fstr(b.name, 60), phone = String(b.phone || '').replace(/\D/g, '').slice(-10), addr = fstr(b.address, 200), zone = fstr(b.zone, 40);
  if (name.length < 2 || phone.length !== 10 || addr.length < 8 || !cfg.localities.includes(zone)) return json({ error: 'Please give your name, a 10-digit phone, full address and area.' }, 400);
  if (BAD.test(name + ' ' + addr)) return json({ error: 'Please check your details.' }, 400);
  if (await env.REVIEWS.get('fb:' + phone)) return json({ error: 'We cannot take orders from this number. Please call us.' }, 403);
  const r = await fget(env, 'fr:' + fslug(b.rid));
  if (!r || r.suspended || !r.open) return json({ error: 'This restaurant is closed right now.' }, 409);
  const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
  if (!items.length) return json({ error: 'Your cart is empty.' }, 400);
  const lines = []; let sub = 0;
  for (const it of items) {
    const d = await fget(env, 'fd:' + r.id + ':' + fstr(it && it.d, 40)), q = parseInt(it && it.q);
    if (!d || !(q >= 1 && q <= 20)) return json({ error: 'An item in your cart is no longer available. Please refresh.' }, 409);
    if (!d.stock) return json({ error: d.name + ' is out of stock. Please remove it.' }, 409);
    lines.push({ d: d.id, n: d.name, p: d.price, q }); sub += d.price * q;
  }
  let disc = 0, fund = null, code = fstr(b.promo, 20).toUpperCase(), freeDel = false;
  if (code) {
    const p = await fget(env, 'fp:' + code);
    if (!p || !p.active || (p.until && Date.now() > p.until) || (p.rid && p.rid !== r.id) || sub < (p.min || 0)) return json({ error: 'This promo code is not valid for this order.' }, 400);
    if (p.limit && (p.used || 0) >= p.limit) return json({ error: 'This promo code has been fully used.' }, 400);
    if (await env.REVIEWS.get('fpu:' + code + ':' + phone)) return json({ error: 'You have already used this promo code.' }, 400);
    disc = p.flat ? p.flat : Math.round(sub * (p.pct || 0) / 100); if (p.max) disc = Math.min(disc, p.max); disc = Math.min(disc, sub);
    fund = disc ? (p.fund === 'restaurant' ? 'restaurant' : 'platform') : null; freeDel = !!p.freeDel;
    p.used = (p.used || 0) + 1; await fput(env, 'fp:' + code, p); await env.REVIEWS.put('fpu:' + code + ':' + phone, '1');
  }
  const fee = (freeDel || sub >= cfg.freeAbove) ? 0 : cfg.fee, ts = Date.now(), id = 'MK' + fymd(ts) + '-' + frnd(2).toUpperCase();
  const o = { id, ts, rid: r.id, rn: r.name, comm: r.commission == null ? 10 : r.commission, name, phone, addr, zone, lines, sub, disc, fund, promo: code || null, fee, total: sub - disc + fee, pay: b.pay === 'upi' ? 'upi' : 'cod', paid: false, st: 'placed', trail: [{ s: 'placed', t: ts }], prep: null, rider: null, note: fstr(b.note, 150) };
  await fput(env, fkey(id), o);
  await tg(env, 'NEW FOOD ORDER ' + id + '\n' + r.name + ' | ' + zone + '\n' + lines.map(l => l.q + 'x ' + l.n).join(', ') + '\nTotal Rs ' + o.total + ' (' + o.pay.toUpperCase() + ')\n' + name + ' ' + phone);
  return json({ ok: true, id, total: o.total });
}

async function foodPromoCheck(env, request) {
  const b = await readJson(request); if (!b) return json({ error: 'Bad request' }, 400);
  if (await overLimit(env, request, 'fpromo', 40)) return json({ error: 'Too many tries. Please wait a while.' }, 429);
  const code = fstr(b.code, 20).toUpperCase(), sub = parseInt(b.sub) || 0, phone = String(b.phone || '').replace(/\D/g, '').slice(-10), p = await fget(env, 'fp:' + code);
  if (!p || !p.active || (p.until && Date.now() > p.until) || (p.rid && p.rid !== fslug(b.rid))) return json({ error: 'This code is not valid.' }, 400);
  if (sub < (p.min || 0)) return json({ error: 'Add items worth Rs ' + p.min + ' or more to use this code.' }, 400);
  if (p.limit && (p.used || 0) >= p.limit) return json({ error: 'This code has been fully used.' }, 400);
  if (phone.length === 10 && await env.REVIEWS.get('fpu:' + code + ':' + phone)) return json({ error: 'You have already used this code.' }, 400);
  let disc = p.flat ? p.flat : Math.round(sub * (p.pct || 0) / 100); if (p.max) disc = Math.min(disc, p.max); disc = Math.min(disc, sub);
  return json({ ok: true, code, disc, freeDel: !!p.freeDel });
}

async function foodTrack(env, url) {
  const id = url.searchParams.get('id'), phone = String(url.searchParams.get('phone') || '').replace(/\D/g, '').slice(-10), k = fkey(id), o = k && await fget(env, k);
  if (!o || o.phone !== phone) return json({ error: 'Order not found. Check the order number and phone.' }, 404);
  return json({ id: o.id, st: o.st, rn: o.rn, total: o.total, prep: o.prep, rider: o.rider ? o.rider.split(' ')[0] : null, trail: o.trail, reason: o.reason || null }, 200, { 'Cache-Control': 'no-store' });
}

/* ---------- login (restaurants and dispatch) ---------- */
async function flogin(env, request, b) {
  if (await overLimit(env, request, 'flogin', 30)) return json({ error: 'Too many attempts. Please wait an hour.' }, 429);
  const acc = await fget(env, 'fa:' + fslug(b.id));
  if (!acc || acc.off || (await fhash(String(b.password || ''), acc.salt)) !== acc.hash) return json({ error: 'Wrong ID or password.' }, 401);
  const token = frnd(24); await fput(env, 'ft:' + token, { id: acc.id, role: acc.role, rid: acc.rid || null }, { expirationTtl: 43200 });
  const r = acc.rid ? await fget(env, 'fr:' + acc.rid) : null;
  return json({ ok: true, token, role: acc.role, name: r ? r.name : 'Dispatch', open: r ? !!r.open : null });
}
const fauth = async (env, b, role) => { const t = await fget(env, 'ft:' + fstr(b.token, 60)); return t && t.role === role ? t : null; };
async function forder(env, b, scope) { const k = fkey(b.oid), o = k && await fget(env, k); return o && (!scope || o.rid === scope) ? o : null; }

async function foodRest(env, request) {
  const b = await readJson(request); if (!b) return json({ error: 'Bad request' }, 400);
  if (b.action === 'login') return flogin(env, request, b);
  const t = await fauth(env, b, 'rest'); if (!t) return json({ error: 'Please log in again.', login: true }, 401);
  const r = await fget(env, 'fr:' + t.rid);
  if (b.action === 'orders') return json({ orders: (await fdays(env, fdaysBack(2))).filter(o => o.rid === t.rid).map(fsafeRest), open: !!r.open }, 200, { 'Cache-Control': 'no-store' });
  if (b.action === 'menu') { const l = await env.REVIEWS.list({ prefix: 'fd:' + t.rid + ':', limit: 300 }), out = []; for (const k of l.keys) { const d = await fget(env, k.name); if (d) out.push(d); } return json({ dishes: out }); }
  if (b.action === 'open') { r.open = !!b.open; await fput(env, 'fr:' + r.id, r); return json({ ok: true, open: r.open }); }
  if (b.action === 'stock' || b.action === 'price') {
    const k = 'fd:' + t.rid + ':' + fstr(b.did, 40), d = await fget(env, k); if (!d) return json({ error: 'Dish not found' }, 404);
    if (b.action === 'stock') d.stock = !!b.stock;
    else { const p = parseInt(b.price); if (!(p >= 1 && p <= 5000)) return json({ error: 'Enter a price between 1 and 5000.' }, 400); await fput(env, 'fg:' + Date.now() + '-' + frnd(2), { ts: Date.now(), rid: t.rid, did: d.id, n: d.name, from: d.price, to: p }); d.price = p; }
    await fput(env, k, d); return json({ ok: true, dish: d });
  }
  const o = await forder(env, b, t.rid); if (!o) return json({ error: 'Order not found' }, 404);
  let e;
  if (b.action === 'accept') { const p = parseInt(b.prep); if (![15, 20, 30].includes(p)) return json({ error: 'Choose 15, 20 or 30 minutes.' }, 400); e = await fmove(env, o, 'accepted', { prep: p }); }
  else if (b.action === 'reject') {
    const why = ['out_of_stock', 'too_busy', 'closed', 'other'].includes(b.reason) ? b.reason : 'other'; e = await fmove(env, o, 'rejected', { reason: why });
    if (!e) await tg(env, 'ORDER REJECTED ' + o.id + ' by ' + o.rn + ': ' + why + '\nCustomer ' + o.name + ' ' + o.phone + ' - please call them.');
  } else if (b.action === 'ready') { e = await fmove(env, o, 'ready'); if (!e) await tg(env, 'READY for pickup: ' + o.id + ' at ' + o.rn + (o.rider ? ' (rider ' + o.rider + ')' : ' - assign a rider')); }
  else return json({ error: 'Unknown action' }, 400);
  return e || json({ ok: true, order: fsafeRest(o) });
}

async function foodDispatch(env, request) {
  const b = await readJson(request); if (!b) return json({ error: 'Bad request' }, 400);
  if (b.action === 'login') return flogin(env, request, b);
  const t = await fauth(env, b, 'dispatch'); if (!t) return json({ error: 'Please log in again.', login: true }, 401);
  if (b.action === 'orders') return json({ orders: (await fdays(env, fdaysBack(2))).filter(o => ['placed', 'accepted', 'ready', 'picked', 'delivered'].includes(o.st)).map(fsafe) }, 200, { 'Cache-Control': 'no-store' });
  const o = await forder(env, b); if (!o) return json({ error: 'Order not found' }, 404);
  if (b.action === 'assign') { const n = fstr(b.rider, 40); if (n.length < 2) return json({ error: 'Enter the rider name.' }, 400); if (['delivered', 'rejected', 'cancelled'].includes(o.st)) return json({ error: 'Order is already ' + o.st + '.' }, 409); o.rider = n; await fput(env, fkey(o.id), o); return json({ ok: true, order: fsafe(o) }); }
  let e;
  if (b.action === 'picked') { if (!o.rider) return json({ error: 'Assign a rider first.' }, 400); e = await fmove(env, o, 'picked'); }
  else if (b.action === 'delivered') { e = await fmove(env, o, 'delivered', o.pay === 'cod' ? { paid: true, cash: o.total } : {}); }
  else return json({ error: 'Unknown action' }, 400);
  return e || json({ ok: true, order: fsafe(o) });
}

/* ---------- owner/admin ---------- */
async function foodSummary(env, from, to) {
  const cfg = await fcfg(env), orders = await fdays(env, frange(from, to)), now = Date.now(), per = {}, st = {}, late = [], rej = [];
  let cod = 0, plat = 0;
  for (const o of orders) {
    st[o.st] = (st[o.st] || 0) + 1;
    const p = per[o.rid] || (per[o.rid] = { rid: o.rid, name: o.rn, orders: 0, sales: 0, commission: 0, restFunded: 0, payable: 0 });
    if (o.st === 'delivered') {
      const c = Math.round(o.sub * o.comm / 100), rf = o.fund === 'restaurant' ? o.disc : 0, pf = o.fund === 'platform' ? o.disc : 0;
      p.orders++; p.sales += o.sub; p.commission += c; p.restFunded += rf; p.payable += o.sub - c - rf;
      plat += c + o.fee - pf - (cfg.riderCost || 0); if (o.pay === 'cod') cod += o.total;
    }
    if (o.st === 'rejected') rej.push({ id: o.id, rn: o.rn, reason: o.reason, phone: o.phone });
    const end = (o.trail.find(x => x.s === 'delivered') || {}).t || now;
    if (o.st === 'placed' && now - o.ts > 180000) late.push({ id: o.id, rn: o.rn, why: 'Not accepted in 3 min' });
    else if (o.st === 'ready' && !o.rider && now - o.trail[o.trail.length - 1].t > 300000) late.push({ id: o.id, rn: o.rn, why: 'No rider in 5 min' });
    else if (!['rejected', 'cancelled'].includes(o.st) && end - o.ts > 3600000) late.push({ id: o.id, rn: o.rn, why: 'Over 60 min' });
  }
  const rows = Object.values(per); const t = rows.reduce((a, r) => ({ sales: a.sales + r.sales, commission: a.commission + r.commission, payable: a.payable + r.payable, orders: a.orders + r.orders }), { sales: 0, commission: 0, payable: 0, orders: 0 });
  return { from, to, status: st, restaurants: rows, totals: { ...t, platformProfit: plat, codCashWithRiders: cod }, late, rejected: rej };
}

async function foodAdmin(env, request) {
  const b = await readJson(request);
  if (!b || !env.ADMIN_KEY || b.key !== env.ADMIN_KEY) return json({ error: 'Wrong key' }, 401);
  const A = b.action;
  if (A === 'cfg') { const c = await fcfg(env); if (b.set) { const s = b.set; if (s.fee != null) c.fee = Math.max(0, parseInt(s.fee) || 0); if (s.freeAbove != null) c.freeAbove = Math.max(0, parseInt(s.freeAbove) || 0); if (s.riderCost != null) c.riderCost = Math.max(0, parseInt(s.riderCost) || 0); if (s.paused != null) c.paused = !!s.paused; if (Array.isArray(s.localities) && s.localities.length) c.localities = s.localities.map(x => fstr(x, 40)).filter(Boolean); await fput(env, 'fc:cfg', c); } return json({ cfg: c }); }
  if (A === 'rlist') return json({ restaurants: await listPrefix(env, 'fr:') });
  if (A === 'rset') {
    const id = fslug(b.id || b.name); if (!id || fstr(b.name, 60).length < 2) return json({ error: 'Restaurant name needed' }, 400);
    const o = (await fget(env, 'fr:' + id)) || { id, ts: Date.now(), open: false };
    for (const k of ['name', 'zone', 'banner', 'hours', 'fssai', 'fssaiExp', 'payout']) if (b[k] != null) o[k] = fstr(b[k], 120);
    for (const k of ['tags', 'eta', 'forTwo']) if (b[k] != null) o[k] = fstr(b[k], 60);
    if (Array.isArray(b.cuisines)) o.cuisines = b.cuisines.filter(c => ['wazwan', 'bakery', 'fast', 'veg', 'street', 'sweets'].includes(c));
    if (b.commission != null) o.commission = Math.min(40, Math.max(0, Number(b.commission) || 0)); if (o.commission == null) o.commission = 10;
    if (b.open != null) o.open = !!b.open; if (b.suspended != null) o.suspended = !!b.suspended;
    await fput(env, 'fr:' + id, o); return json({ ok: true, restaurant: o });
  }
  if (A === 'acct') {
    const lid = fslug(b.loginId), role = b.role === 'dispatch' ? 'dispatch' : 'rest', pw = String(b.password || '');
    if (lid.length < 3 || pw.length < 6) return json({ error: 'Login ID (3+ letters) and password (6+ characters) needed.' }, 400);
    if (role === 'rest' && !(await fget(env, 'fr:' + fslug(b.rid)))) return json({ error: 'Restaurant not found' }, 404);
    const salt = frnd(8); await fput(env, 'fa:' + lid, { id: lid, role, rid: role === 'rest' ? fslug(b.rid) : null, salt, hash: await fhash(pw, salt), off: !!b.off }); return json({ ok: true, loginId: lid });
  }
  if (A === 'dset') {
    const rid = fslug(b.rid), r = await fget(env, 'fr:' + rid); if (!r) return json({ error: 'Restaurant not found' }, 404);
    const id = fslug(b.id || b.name), price = parseInt(b.price); if (!id || !(price >= 1 && price <= 5000)) return json({ error: 'Dish name and price (1 to 5000) needed' }, 400);
    const old = await fget(env, 'fd:' + rid + ':' + id), was = b.was ? parseInt(b.was) : null;
    await fput(env, 'fd:' + rid + ':' + id, { id, rid, name: fstr(b.name || (old && old.name), 80), cat: fstr(b.cat || (old && old.cat) || 'Menu', 40), price, was: was && was > price ? was : null, veg: !!b.veg, stock: b.stock == null ? (old ? old.stock : true) : !!b.stock, desc: fstr(b.desc, 140) }); return json({ ok: true, id });
  }
  if (A === 'ddel') { await env.REVIEWS.delete('fd:' + fslug(b.rid) + ':' + fslug(b.id)); return json({ ok: true }); }
  if (A === 'olist') return json({ orders: (await fdays(env, frange(fstr(b.from, 6) || fymd(Date.now()), fstr(b.to, 6) || fymd(Date.now())))).filter(o => !b.st || o.st === b.st).map(o => ({ ...fsafe(o), comm: o.comm })) });
  if (['oassign', 'ocancel', 'opaid'].includes(A)) {
    const o = await forder(env, b); if (!o) return json({ error: 'Order not found' }, 404);
    if (A === 'opaid') { o.paid = true; await fput(env, fkey(o.id), o); return json({ ok: true }); }
    if (A === 'oassign') { o.rider = fstr(b.rider, 40); await fput(env, fkey(o.id), o); return json({ ok: true }); }
    const e = await fmove(env, o, 'cancelled', { reason: fstr(b.reason, 100) || 'cancelled by admin' }); return e || json({ ok: true });
  }
  if (A === 'plist') return json({ promos: await listPrefix(env, 'fp:') });
  if (A === 'pset') { const code = fslug(b.code).toUpperCase().replace(/-/g, ''); if (code.length < 3) return json({ error: 'Code needed' }, 400); const old = (await fget(env, 'fp:' + code)) || { used: 0, ts: Date.now() }; await fput(env, 'fp:' + code, { ...old, code, pct: Number(b.pct) || 0, flat: Number(b.flat) || 0, min: Number(b.min) || 0, max: Number(b.max) || 0, fund: b.fund === 'restaurant' ? 'restaurant' : 'platform', freeDel: !!b.freeDel, title: fstr(b.title, 60), pub: !!b.pub, rid: b.rid ? fslug(b.rid) : null, limit: Number(b.limit) || 0, until: b.until ? Date.parse(b.until + 'T23:59:59+05:30') : 0, active: b.active !== false }); return json({ ok: true, code }); }
  if (A === 'pdel') { await env.REVIEWS.delete('fp:' + fstr(b.code, 20).toUpperCase()); return json({ ok: true }); }
  if (A === 'summary') { const d = fymd(Date.now()); return json(await foodSummary(env, fstr(b.from, 6) || d, fstr(b.to, 6) || d)); }
  if (A === 'spaid') { const k = 'fs:' + fslug(b.rid) + ':' + fstr(b.from, 6) + ':' + fstr(b.to, 6); await fput(env, k, { rid: fslug(b.rid), from: b.from, to: b.to, ref: fstr(b.ref, 60), amount: Number(b.amount) || 0, ts: Date.now() }); return json({ ok: true }); }
  if (A === 'slist') return json({ settlements: await listPrefix(env, 'fs:') });
  if (A === 'block') { if (b.on === false) await env.REVIEWS.delete('fb:' + String(b.phone).replace(/\D/g, '').slice(-10)); else await env.REVIEWS.put('fb:' + String(b.phone).replace(/\D/g, '').slice(-10), '1'); return json({ ok: true }); }
  if (A === 'glog') return json({ log: await listPrefix(env, 'fg:') });
  if (A === 'rdel') {
    const id = fslug(b.id), r = await fget(env, 'fr:' + id); if (!r) return json({ error: 'Restaurant not found' }, 404);
    const l = await env.REVIEWS.list({ prefix: 'fd:' + id + ':', limit: 500 }); for (const k of l.keys) await env.REVIEWS.delete(k.name);
    for (const x of await listPrefix(env, 'fa:')) if (x.rid === id) await env.REVIEWS.delete('fa:' + x.id);
    await env.REVIEWS.delete('fr:' + id); return json({ ok: true });
  }
  if (A === 'dlist') { const l = await env.REVIEWS.list({ prefix: 'fd:' + fslug(b.rid) + ':', limit: 300 }), out = []; for (const k of l.keys) { const d = await fget(env, k.name); if (d) out.push(d); } return json({ dishes: out }); }
  if (A === 'alist') return json({ accounts: (await listPrefix(env, 'fa:')).map(x => ({ id: x.id, role: x.role, rid: x.rid, off: !!x.off })) });
  if (A === 'aset') { const x = await fget(env, 'fa:' + fslug(b.loginId)); if (!x) return json({ error: 'Login not found' }, 404); x.off = !!b.off; await fput(env, 'fa:' + x.id, x); return json({ ok: true }); }
  if (A === 'blist') return json({ phones: (await env.REVIEWS.list({ prefix: 'fb:', limit: 300 })).keys.map(k => k.name.slice(3)) });
  return json({ error: 'Unknown action' }, 400);
}

async function foodApi({ request, env, pathname }) {
  if (!env.REVIEWS) return json({ error: 'Storage (KV) is not connected yet' }, 503);
  const a = pathname.slice(10), m = request.method;
  try {
    if (a === 'menu' && m === 'GET') return await foodMenu(env);
    if (a === 'order' && m === 'POST') return await foodPlace(env, request);
    if (a === 'promo' && m === 'POST') return await foodPromoCheck(env, request);
    if (a === 'order' && m === 'GET') return await foodTrack(env, new URL(request.url));
    if (a === 'rest' && m === 'POST') return await foodRest(env, request);
    if (a === 'dispatch' && m === 'POST') return await foodDispatch(env, request);
    if (a === 'admin' && m === 'POST') return await foodAdmin(env, request);
  } catch (e) { return json({ error: 'Something went wrong. Please try again.' }, 500); }
  return json({ error: 'Not found' }, 404);
}
/* ===================== end FOOD block ===================== */

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url), m = request.method;
    if (pathname.startsWith('/api/food/')) return foodApi({ request, env, pathname });
    if (pathname === '/api/create-order' && m === 'POST') return createOrder({ request, env });
    if (pathname === '/api/track' && m === 'GET') return trackOrder({ request, env });
    if (pathname === '/api/review' && m === 'POST') return reviewSubmit({ request, env });
    if (pathname === '/api/reviews' && m === 'GET') return reviewsPublic({ env });
    if (pathname === '/api/rphoto' && m === 'GET') return reviewPhoto({ request, env });
    if (pathname === '/api/enquiry' && m === 'POST') return enquiry({ request, env });
    if (pathname === '/api/buddy' && m === 'POST') return buddySubmit({ request, env });
    if (pathname === '/api/buddy' && m === 'GET') return buddyPublic({ env });
    if (pathname === '/api/connect' && m === 'POST') return buddyConnect({ request, env });
    if (pathname === '/api/write' && m === 'POST') return writeSubmit({ request, env });
    if (pathname === '/api/writings' && m === 'GET') return writingsPublic({ env });
    if (pathname === '/api/wphoto' && m === 'GET') return writerPhoto({ request, env });
    if (pathname === '/api/journey' && m === 'POST') return journeySubmit({ request, env });
    if (pathname === '/api/journeys' && m === 'GET') return journeysPublic({ env });
    if (pathname === '/api/jphoto' && m === 'GET') return journeyPhoto({ request, env });
    if (pathname === '/api/admin' && m === 'POST') return adminApi({ request, env });
    if (pathname === '/api/webhook' && m === 'POST') return webhook({ request, env });
    if (pathname === '/admin' || pathname === '/admin.html') return new Response(atob(ADMIN_PAGE), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
    return env.ASSETS.fetch(request);
  }
};
