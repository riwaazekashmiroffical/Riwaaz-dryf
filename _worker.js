// Riwaaz-e-Kashmir backend: one file for Cloudflare Pages ("advanced mode").
// Routes: /api/create-order, /api/track, /api/admin, /api/webhook, /admin. Everything else is served from the site files.
const KID = e => e.RAZORPAY_KEY_ID || e.RZP_KEY_ID || 'rzp_live_TjTHI6nlesU7e1';
const SEC = e => e.RAZORPAY_KEY_SECRET || e.RAZORPAY_SECRET || e.RZP_KEY_SECRET || e.KEY_SECRET;
const rz = (env, path, opt = {}) => fetch('https://api.razorpay.com/v1' + path, { ...opt, headers: { Authorization: 'Basic ' + btoa(KID(env) + ':' + SEC(env)), 'Content-Type': 'application/json' } });
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const last10 = s => String(s || '').replace(/\D/g, '').slice(-10);
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const normNo = s => { s = String(s || '').toUpperCase().replace(/\s+/g, ''); const m = s.match(/^REK-?(\d{4})$/); return m ? 'REK-' + m[1] : s; };
async function byReceipt(env, no) { const d = await (await rz(env, '/orders?receipt=' + encodeURIComponent(no))).json(); return d && d.items && d.items[0]; }

// ---- Prices (keep in sync with the website) ----
const CATALOG = {"walnut": [["100g", 249], ["250g", 499], ["500g", 990], ["1kg", 1999]], "giftbox": [["Simple", 1200], ["Custom Box", 1499]], "mamra": [["250g", 499], ["500g", 990], ["1kg", 1950]], "badam": [["250g", 349], ["500g", 649], ["1kg", 1199]], "pista": [["250g", 499], ["500g", 949], ["1kg", 1799]], "kaju": [["250g", 299], ["500g", 599], ["1kg", 1150]], "saffron": [["1g", 499], ["2g", 998]], "honey": [["250ml", 299], ["500ml", 549], ["1kg jar", 999]], "kahwa": [["150g", 299], ["250g", 599]], "noon": [["Pack", 499]], "shila": [["20g", 999]], "combo": [["Combo", 1599]], "winter": [["Set", 999]], "wed": [["Simple", 2999], ["Customized", 3299]], "sample": [["0.5g", 149]]};
const FREE_SHIP = 999, DELIVERY = 70, GIFT_MIN = 1499, DIWALI_END = Date.parse('2026-11-09T00:00:00+05:30');
function priceOrder(lines, coupon) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 30) return null;
  let sub = 0;
  for (const l of lines) {
    const s = CATALOG[l.id] && CATALOG[l.id][l.sz], q = Math.floor(Number(l.q));
    if (!s || !(q >= 1 && q <= 20)) return null;
    sub += s[1] * q;
  }
  const c = String(coupon || '').toUpperCase(), welcome = c === 'WELCOME', diwali = c === 'DIWALI' && Date.now() < DIWALI_END;
  const delivery = (sub >= FREE_SHIP || welcome) ? 0 : DELIVERY;
  return { total: sub + delivery, gift: diwali && sub >= GIFT_MIN };
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
async function adminApi({ request, env }) {
  const b = await request.json();
  if (!env.ADMIN_KEY || b.key !== env.ADMIN_KEY) return json({ error: 'Wrong key' }, 401);
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
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }) });
    await mail(env, env.OWNER_EMAIL || 'riwaazekashmiroffical@gmail.com', 'New paid order ' + o.receipt, '<pre>' + esc(text) + '</pre>');
    if (n.e) await mail(env, n.e, 'Your Riwaaz-e-Kashmir order ' + o.receipt + ' is confirmed',
      '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #c9a961;padding:20px"><h2 style="color:#8a6d2b">Thank you, ' + esc(n.n) + '!</h2><p>Your order <b>' + esc(o.receipt) + '</b> is confirmed.</p><p>' + esc(items) + '</p><p>Total paid: <b>Rs ' + o.amount / 100 + '</b></p><p>Track your order any time on riwaazekashmir.com with your order number and phone number.</p><p>Questions? WhatsApp +91 91494 80384 (8 AM to 12 midnight) or riwaazekashmiroffical@gmail.com</p><p>With love from Kashmir,<br>Riwaaz-e-Kashmir</p></div>');
  }
  return json({ ok: true });
}
const ADMIN_PAGE = 'PCFET0NUWVBFIGh0bWw+PGh0bWw+PGhlYWQ+PG1ldGEgY2hhcnNldD0idXRmLTgiPjxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsaW5pdGlhbC1zY2FsZT0xIj48bWV0YSBuYW1lPSJyb2JvdHMiIGNvbnRlbnQ9Im5vaW5kZXgiPjx0aXRsZT5PcmRlcnM8L3RpdGxlPgo8c3R5bGU+Ym9keXtmb250LWZhbWlseTpzYW5zLXNlcmlmO2JhY2tncm91bmQ6IzBmMWExMztjb2xvcjojZjBlY2UyO3BhZGRpbmc6MTRweH1pbnB1dCxzZWxlY3QsYnV0dG9ue2ZvbnQ6aW5oZXJpdDtwYWRkaW5nOjlweDttYXJnaW46M3B4IDA7d2lkdGg6MTAwJTtib3gtc2l6aW5nOmJvcmRlci1ib3g7Ym9yZGVyLXJhZGl1czo1cHg7Ym9yZGVyOjFweCBzb2xpZCAjNDQ0O2JhY2tncm91bmQ6IzE0MjAxYTtjb2xvcjojZjBlY2UyfWJ1dHRvbntiYWNrZ3JvdW5kOiNjOWE5NjE7Y29sb3I6IzBmMWExMztib3JkZXI6MH0ub3tib3JkZXI6MXB4IHNvbGlkICNjOWE5NjE2Njtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjEwcHg7bWFyZ2luOjEwcHggMDtmb250LXNpemU6MTNweH08L3N0eWxlPjwvaGVhZD48Ym9keT4KPGgzPlJpd2Fhei1lLUthc2htaXIgb3JkZXJzPC9oMz48aW5wdXQgaWQ9ImsiIHR5cGU9InBhc3N3b3JkIiBwbGFjZWhvbGRlcj0iQWRtaW4ga2V5Ij48YnV0dG9uIG9uY2xpY2s9ImxvYWQoKSI+TG9hZCBvcmRlcnM8L2J1dHRvbj48ZGl2IGlkPSJsIj48L2Rpdj4KPHNjcmlwdD4KY29uc3QgSj0oYik9PmZldGNoKCcvYXBpL2FkbWluJyx7bWV0aG9kOidQT1NUJyxib2R5OkpTT04uc3RyaW5naWZ5KHtrZXk6ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2snKS52YWx1ZSwuLi5ifSl9KS50aGVuKHI9PnIuanNvbigpKTsKY29uc3QgZT1zPT5TdHJpbmcoc3x8JycpLnJlcGxhY2UoL1smPD4iXS9nLGM9Pih7JyYnOicmYW1wOycsJzwnOicmbHQ7JywnPic6JyZndDsnLCciJzonJnF1b3Q7J31bY10pKTsKZnVuY3Rpb24gbG9hZCgpe0ooe2FjdGlvbjonbGlzdCd9KS50aGVuKGQ9PntpZihkLmVycm9yKXthbGVydChkLmVycm9yKTtyZXR1cm59CmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsJykuaW5uZXJIVE1MPWQub3JkZXJzLm1hcChvPT5gPGRpdiBjbGFzcz0ibyI+PGI+JHtlKG8ubm8pfTwvYj4gJHtvLnBhaWQ/J1BBSUQnOic8c3BhbiBzdHlsZT0iY29sb3I6I2U1NDg0ZCI+Tk9UIFBBSUQ8L3NwYW4+J30gLSBScyAke28udG90YWx9PGJyPiR7ZShvLm5hbWUpfSAke2Uoby5waG9uZSl9PGJyPiR7ZShvLmFkZHJlc3MpfTxicj4ke2Uoby5pdGVtcyl9CjxzZWxlY3QgaWQ9InMtJHtvLm5vfSI+JHtbJ09yZGVyIHBsYWNlZCcsJ0NvbmZpcm1lZCcsJ1BhY2tlZCcsJ1NoaXBwZWQnLCdEZWxpdmVyZWQnXS5tYXAocz0+YDxvcHRpb24gJHtzPT09by5zdD8nc2VsZWN0ZWQnOicnfT4ke3N9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+CjxpbnB1dCBpZD0idC0ke28ubm99IiBwbGFjZWhvbGRlcj0iVHJhY2tpbmcgbGluayAob3B0aW9uYWwpIiB2YWx1ZT0iJHtlKG8udHJrKX0iPjxidXR0b24gb25jbGljaz0ic2F2ZSgnJHtvLm5vfScpIj5TYXZlIHN0YXR1czwvYnV0dG9uPjwvZGl2PmApLmpvaW4oJycpfSl9CmZ1bmN0aW9uIHNhdmUobm8pe0ooe25vLHN0YXR1czpkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy0nK25vKS52YWx1ZSx0cms6ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3QtJytubykudmFsdWV9KS50aGVuKGQ9PmFsZXJ0KGQub2s/J1NhdmVkJzooZC5lcnJvcnx8J0ZhaWxlZCcpKSl9Cjwvc2NyaXB0PjwvYm9keT48L2h0bWw+Cg==';
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url), m = request.method;
    if (pathname === '/api/create-order' && m === 'POST') return createOrder({ request, env });
    if (pathname === '/api/track' && m === 'GET') return trackOrder({ request, env });
    if (pathname === '/api/admin' && m === 'POST') return adminApi({ request, env });
    if (pathname === '/api/webhook' && m === 'POST') return webhook({ request, env });
    if (pathname === '/admin' || pathname === '/admin.html') return new Response(atob(ADMIN_PAGE), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
    return env.ASSETS.fetch(request);
  }
};
