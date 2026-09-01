import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE_ROOT = path.join(ROOT, 'node_modules', '.cache');
fs.mkdirSync(CACHE_ROOT, { recursive: true });
const OUT = fs.mkdtempSync(path.join(CACHE_ROOT, 'bfc-attribution-tests-'));
const bundles = new Map();

async function importBundled(relativePath) {
  if (!bundles.has(relativePath)) {
    const outfile = path.join(OUT, relativePath.replaceAll('/', '_').replace(/\.ts$/, '.mjs'));
    await build({
      entryPoints: [path.join(ROOT, relativePath)],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      packages: 'external',
      logLevel: 'silent',
    });
    bundles.set(relativePath, import(`${pathToFileURL(outfile).href}?v=${Date.now()}`));
  }
  return bundles.get(relativePath);
}

after(() => fs.rmSync(OUT, { recursive: true, force: true }));

class FakeAdminStore {
  constructor() {
    this.sessions = new Map();
    this.rateResults = [];
    this.attempts = 0;
  }
  async consumeLoginRateLimit() {
    this.attempts++;
    return this.rateResults.shift() || { allowed: true, retryAfterSeconds: 0 };
  }
  async createSession(record) { this.sessions.set(record.tokenHash, { ...record }); }
  async findSession(tokenHash, now) {
    const record = this.sessions.get(tokenHash);
    return record && !record.revokedAt && record.expiresAt > now ? record : null;
  }
  async touchSession(tokenHash, now) { const record = this.sessions.get(tokenHash); if (record) record.lastUsedAt = now; }
  async revokeSession(tokenHash, now) { const record = this.sessions.get(tokenHash); if (record) record.revokedAt = now; }
}

function cookieHeader(response) {
  const values = response.headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
  return values.join('; ');
}

function requestCookies(response) {
  const combined = cookieHeader(response);
  const session = combined.match(/bfc_admin_session=([^;,]+)/)?.[1];
  const csrf = combined.match(/bfc_admin_csrf=([^;,]+)/)?.[1];
  return { session: decodeURIComponent(session || ''), csrf: decodeURIComponent(csrf || '') };
}

test('admin login succeeds with secure cookie flags and server-side token hashing', async () => {
  const { createAdminLoginHandler, ADMIN_SESSION_SECONDS } = await importBundled('lib/admin-auth.ts');
  const store = new FakeAdminStore();
  const handler = createAdminLoginHandler({
    store,
    getSecret: () => 'correct horse battery staple',
    getRateLimitSalt: () => 'protected-salt',
    now: () => new Date('2026-09-01T12:00:00Z'),
    randomToken: (() => { const tokens = ['raw-session-token', 'raw-csrf-token']; return () => tokens.shift(); })(),
  });
  const response = await handler(new Request('https://boatsforcharity.org/api/admin-login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'correct horse battery staple' }),
  }), { ip: '203.0.113.10' });
  assert.equal(response.status, 200);
  const cookies = cookieHeader(response);
  assert.match(cookies, /bfc_admin_session=/);
  assert.match(cookies, /HttpOnly/i);
  assert.match(cookies, /Secure/i);
  assert.match(cookies, /SameSite=Strict/i);
  assert.match(cookies, /Path=\//i);
  assert.match(cookies, new RegExp(`Max-Age=${ADMIN_SESSION_SECONDS}`));
  assert.doesNotMatch(cookies, /correct horse battery staple/);
  assert.equal(store.sessions.size, 1);
  assert.equal([...store.sessions.values()][0].tokenHash.includes('raw-session-token'), false);
});

test('admin login rejects incorrect password, missing secret, and persistent rate limit', async () => {
  const { createAdminLoginHandler } = await importBundled('lib/admin-auth.ts');
  const store = new FakeAdminStore();
  const base = { store, getRateLimitSalt: () => 'salt', randomToken: () => 'unused' };
  const incorrect = createAdminLoginHandler({ ...base, getSecret: () => 'expected' });
  const request = () => new Request('https://boatsforcharity.org/api/admin-login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }),
  });
  assert.equal((await incorrect(request(), { ip: '198.51.100.4' })).status, 401);
  const missing = createAdminLoginHandler({ ...base, getSecret: () => undefined });
  assert.equal((await missing(request(), { ip: '198.51.100.4' })).status, 503);
  store.rateResults.push({ allowed: false, retryAfterSeconds: 900 });
  const limited = await incorrect(request(), { ip: '198.51.100.4' });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '900');
});

test('cookie sessions protect APIs, enforce CSRF, expire, revoke, and log out', async () => {
  const { authorizeAdminRequest, createAdminLogoutHandler } = await importBundled('lib/admin-auth.ts');
  const { sha256Value } = await importBundled('lib/security.ts');
  const store = new FakeAdminStore();
  const session = 'session-token';
  const csrf = 'csrf-token';
  store.sessions.set(sha256Value(session), {
    tokenHash: sha256Value(session), csrfHash: sha256Value(csrf),
    expiresAt: new Date('2026-09-01T20:00:00Z'), revokedAt: null,
  });
  const noCookie = await authorizeAdminRequest(new Request('https://example.test/api/dashboard'), { store, now: new Date('2026-09-01T12:00:00Z') });
  assert.equal(noCookie.status, 401);
  const csrfRejected = await authorizeAdminRequest(new Request('https://example.test/api/dashboard', {
    method: 'POST', headers: { cookie: `bfc_admin_session=${session}; bfc_admin_csrf=${csrf}` },
  }), { store, requireCsrf: true, now: new Date('2026-09-01T12:00:00Z') });
  assert.equal(csrfRejected.status, 403);
  const acceptedRequest = new Request('https://example.test/api/dashboard', {
    method: 'POST', headers: { cookie: `bfc_admin_session=${session}; bfc_admin_csrf=${csrf}`, 'x-csrf-token': csrf },
  });
  assert.equal((await authorizeAdminRequest(acceptedRequest, { store, requireCsrf: true, now: new Date('2026-09-01T12:00:00Z') })).authorized, true);
  const logout = await createAdminLogoutHandler(store)(acceptedRequest);
  assert.equal(logout.status, 204);
  assert.ok(store.sessions.get(sha256Value(session)).revokedAt);
  assert.match(cookieHeader(logout), /Max-Age=0/);
  const revoked = await authorizeAdminRequest(acceptedRequest, { store, now: new Date('2026-09-01T12:01:00Z') });
  assert.equal(revoked.status, 401);
  store.sessions.get(sha256Value(session)).revokedAt = null;
  const expired = await authorizeAdminRequest(acceptedRequest, { store, now: new Date('2026-09-02T12:00:00Z') });
  assert.equal(expired.status, 401);
});

test('dashboard HTML never embeds secrets and query strings cannot authenticate', async () => {
  const dashboard = await importBundled('netlify/functions/admin-dashboard.ts');
  const secret = 'never-render-this-secret';
  process.env.DASHBOARD_SECRET = secret;
  const response = await dashboard.default(new Request(`https://boatsforcharity.org/admin/dashboard?key=${secret}`), {});
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.doesNotMatch(html, new RegExp(secret));
  assert.doesNotMatch(html, /AUTH_KEY|keyFromQuery|safeKey|name="key"|\?key=/);
  assert.match(html, /\/api\/admin-login/);
  const api = await importBundled('netlify/functions/dashboard-api.ts');
  assert.equal((await api.default(new Request('https://boatsforcharity.org/api/dashboard?action=overview'), {})).status, 401);
  const exportsHandler = await importBundled('netlify/functions/export-conversions.ts');
  assert.equal((await exportsHandler.default(new Request('https://boatsforcharity.org/api/export-conversions?format=csv'), {})).status, 401);
  const visitsHandler = await importBundled('netlify/functions/visits.ts');
  assert.equal((await visitsHandler.default(new Request('https://boatsforcharity.org/api/visits'), {})).status, 401);
  const clicksHandler = await importBundled('netlify/functions/donate-clicks.ts');
  assert.equal((await clicksHandler.default(new Request('https://boatsforcharity.org/api/donate-clicks'), {})).status, 401);
});

test('dashboard escaping executes safely for hostile values', async () => {
  const { escapeHtml } = await importBundled('lib/dashboard-view.ts');
  assert.equal(escapeHtml(`<img src=x onerror="alert('x')">`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
});

test('WhatConverts webhook fails closed before writes and deduplicates authorized calls', async () => {
  const { createWhatConvertsWebhookHandler, QUO_NUMBER } = await importBundled('lib/whatconverts.ts');
  const calls = new Map();
  let writes = 0;
  const repository = { async createCall(call) { writes++; if (calls.has(call.callId)) return { created: false }; calls.set(call.callId, call); return { created: true, id: calls.size }; } };
  const payload = JSON.stringify({ lead_id: 'wc-call-123', caller_number: '+15035551212', destination_number: 'wrong', call_duration: 42 });
  const request = (headers = {}) => new Request('https://boatsforcharity.org/api/whatconverts-webhook', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: payload });
  const missingEnv = createWhatConvertsWebhookHandler({ repository, getSecret: () => undefined });
  assert.equal((await missingEnv(request())).status, 503);
  const handler = createWhatConvertsWebhookHandler({ repository, getSecret: () => 'webhook-secret' });
  assert.equal((await handler(request())).status, 401);
  assert.equal((await handler(request({ 'x-whatconverts-secret': 'wrong' }))).status, 401);
  assert.equal(writes, 0);
  assert.equal((await handler(request({ 'x-whatconverts-secret': 'webhook-secret' }))).status, 200);
  assert.equal(calls.get('wc-call-123').forwardedToNumber, QUO_NUMBER);
  assert.equal((await handler(request({ 'x-whatconverts-secret': 'webhook-secret' }))).status, 200);
  assert.equal(calls.size, 1);
  assert.equal(writes, 2);
});

test('WhatConverts webhook enforces content type, body size, JSON, and stable IDs', async () => {
  const { createWhatConvertsWebhookHandler } = await importBundled('lib/whatconverts.ts');
  const repository = { async createCall() { throw new Error('must not write'); } };
  const handler = createWhatConvertsWebhookHandler({ repository, getSecret: () => 'secret' });
  const headers = { 'x-whatconverts-secret': 'secret' };
  assert.equal((await handler(new Request('https://example.test/api', { method: 'POST', headers, body: '{}' }))).status, 415);
  assert.equal((await handler(new Request('https://example.test/api', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal((await handler(new Request('https://example.test/api', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' }))).status, 400);
  assert.equal((await handler(new Request('https://example.test/api', { method: 'POST', headers: { ...headers, 'content-type': 'application/json', 'content-length': '70000' }, body: '{}' }))).status, 413);
});

test('Netlify submissions create one lead without prior tracking and deduplicate concurrent email', async () => {
  const { createNetlifySubmissionHandler } = await importBundled('lib/netlify-submission.ts');
  const leads = new Map();
  let nextId = 1;
  let events = 0;
  let emails = 0;
  const repository = {
    async createLead(submission) {
      await new Promise(resolve => setTimeout(resolve, 5));
      if (leads.has(submission.netlifySubmissionId)) return { created: false, leadId: leads.get(submission.netlifySubmissionId).id };
      const record = { id: nextId++, submission };
      leads.set(submission.netlifySubmissionId, record);
      return { created: true, leadId: record.id };
    },
    async recordVerifiedLead() { events++; },
  };
  const handler = createNetlifySubmissionHandler({ repository, sendAcknowledgment: async () => { emails++; } });
  const body = JSON.stringify({ payload: { id: 'netlify-sub-1', form_name: 'donationForm', data: { email: 'Donor@Example.com', phone: '503-555-1212', sms_consent: 'yes' } } });
  const results = await Promise.all(Array.from({ length: 8 }, () => handler({ body })));
  assert.ok(results.every(result => result.statusCode === 200));
  assert.equal(leads.size, 1);
  assert.equal(emails, 1);
  assert.equal(events, 1);
  assert.equal(leads.get('netlify-sub-1').submission.visitorId, '');
  assert.equal(leads.get('netlify-sub-1').submission.sessionId, '');
  assert.equal(leads.get('netlify-sub-1').submission.smsConsent, true);
});

test('Netlify fallback submission IDs are deterministic and acknowledgment sends only through Resend', async () => {
  const { normalizeNetlifySubmission, sendResendAcknowledgment } = await importBundled('lib/netlify-submission.ts');
  const body = JSON.stringify({ payload: { created_at: '2026-09-01T12:00:00Z', form_name: 'donationForm', data: { email: 'donor@example.com' } } });
  assert.equal(normalizeNetlifySubmission(body).netlifySubmissionId, normalizeNetlifySubmission(body).netlifySubmissionId);
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalNetlify = globalThis.Netlify;
  globalThis.Netlify = { env: { get: name => name === 'RESEND_API_KEY' ? 'test-key' : undefined } };
  globalThis.fetch = async (url, init) => { requests.push({ url: String(url), init }); return new Response('', { status: 200 }); };
  try {
    await sendResendAcknowledgment({ to: 'donor@example.com', subject: 'Received', html: '<p>Thanks</p>' });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.Netlify = originalNetlify;
  }
  assert.deepEqual(requests.map(request => request.url), ['https://api.resend.com/emails']);
});

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), values };
}

function makeForm(name) {
  const inputs = new Map();
  return {
    dataset: {}, id: name, listeners: {},
    getAttribute: attribute => attribute === 'name' ? name : null,
    querySelector(selector) { const match = selector.match(/input\[name="([^"]+)"\]/); return match ? inputs.get(match[1]) || null : null; },
    appendChild(input) { inputs.set(input.name, input); },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    inputs,
  };
}

async function runTrackerPage({ pathname, search = '', referrer = '', local, session, formName = 'donationForm' }) {
  const form = makeForm(formName);
  const beacons = [];
  let cookie = '';
  const document = {
    title: 'Test Page', referrer, readyState: 'complete',
    querySelectorAll(selector) { if (selector.includes('form[')) return [form]; if (selector.includes('a[href^="tel:"]')) return []; return []; },
    createElement() { return { type: '', name: '', value: '' }; },
    addEventListener() {},
  };
  Object.defineProperty(document, 'cookie', {
    get() { return cookie; },
    set(value) { const pair = value.split(';')[0]; const name = pair.split('=')[0]; const parts = cookie ? cookie.split('; ').filter(existing => !existing.startsWith(`${name}=`)) : []; parts.push(pair); cookie = parts.join('; '); },
  });
  const window = {
    location: { pathname, search, hostname: 'boatsforcharity.org' },
    crypto: globalThis.crypto,
  };
  const context = vm.createContext({
    window, document, localStorage: local, sessionStorage: session,
    navigator: { sendBeacon: (url, body) => { beacons.push({ url, body }); return true; } },
    URL, URLSearchParams, Blob, Uint8Array, Date, console, fetch: async () => new Response(null, { status: 204 }),
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tracker.v1.js'), 'utf8'), context);
  return { tracker: window.BFC_TRACKER, form, beacons };
}

test('browser tracker preserves first touch, last non-direct touch, sessions, and form fields', async () => {
  const local = storage();
  const session = storage();
  const first = await runTrackerPage({ pathname: '/state-oregon', search: '?utm_source=google&utm_medium=cpc&utm_campaign=boats', local, session });
  const firstSession = first.tracker.getSessionId();
  const second = await runTrackerPage({ pathname: '/guides/boat-donation-paperwork/', referrer: 'https://boatsforcharity.org/state-oregon', local, session });
  assert.equal(second.tracker.getFirstTouch().landing_page, '/state-oregon?utm_source=google&utm_medium=cpc&utm_campaign=boats');
  assert.equal(second.tracker.getFirstTouch().utm_source, 'google');
  assert.equal(second.tracker.getLastTouch().utm_source, 'google');
  assert.equal(second.tracker.getSessionId(), firstSession);
  assert.equal(second.form.inputs.get('first_touch_source').value, 'google');
  assert.equal(second.form.inputs.get('first_touch_landing_page').value, '/state-oregon?utm_source=google&utm_medium=cpc&utm_campaign=boats');
  const third = await runTrackerPage({ pathname: '/donate-a-boat', search: '?msclkid=abc123&utm_campaign=bingboats', local, session, formName: 'boatValuationIntent' });
  assert.equal(third.tracker.getLastTouch().utm_source, 'bing');
  assert.equal(third.tracker.getLastTouch().utm_medium, 'cpc');
  local.setItem('bfc_sts', String(Date.now() - (31 * 60 * 1000)));
  const rotated = await runTrackerPage({ pathname: '/faq', local, session });
  assert.notEqual(rotated.tracker.getSessionId(), firstSession);
});

test('thank-you refresh records page views but never a verified lead conversion', async () => {
  const local = storage();
  const session = storage();
  const first = await runTrackerPage({ pathname: '/thanks', local, session });
  const second = await runTrackerPage({ pathname: '/thanks', local, session });
  const payloads = await Promise.all([...first.beacons, ...second.beacons].map(async beacon => JSON.parse(await beacon.body.text())));
  assert.ok(payloads.every(payload => payload.event_name !== 'verified_lead'));
  assert.equal(payloads.filter(payload => payload.event_name === 'page_view').length, 2);
});

test('public event handler validates allowlist, strips PII, and rate limits persistently', async () => {
  const { createPublicEventHandler } = await importBundled('lib/public-events.ts');
  const recorded = [];
  let rate = { allowed: true, retryAfterSeconds: 0 };
  const handler = createPublicEventHandler({
    getSalt: () => 'protected-salt',
    consumeRateLimit: async () => rate,
    recordEvent: async event => recorded.push(event),
  });
  const valid = { visitor_id: 'vid_123456789', session_id: 'sid_123456789', event_name: 'form_start', page_path: '/donate-a-boat', metadata: { form_name: 'donationForm', email: 'private@example.com', donor_name: 'Private' }, unexpected: 'ignored' };
  const send = body => handler(new Request('https://example.test/api/track-event', { method: 'POST', headers: { 'content-type': 'application/json' }, body }), { ip: '192.0.2.8' });
  assert.equal((await send('{')).status, 400);
  assert.equal((await send(JSON.stringify({ ...valid, event_name: 'verified_lead' }))).status, 400);
  assert.equal((await send(JSON.stringify(valid))).status, 204);
  assert.deepEqual(recorded[0].metadata, { form_name: 'donationForm' });
  assert.equal(JSON.stringify(recorded[0]).includes('private@example.com'), false);
  rate = { allowed: false, retryAfterSeconds: 600 };
  assert.equal((await send(JSON.stringify(valid))).status, 429);
  assert.equal(recorded.length, 1);
});

test('pipeline rules choose the latest relist and stable Google Ads conversion IDs', async () => {
  const { selectLatestListingForFinalSale, conversionId } = await importBundled('lib/pipeline-rules.ts');
  const selected = selectLatestListingForFinalSale([
    { id: 1, createdAt: '2026-08-01T00:00:00Z' },
    { id: 2, auctionEndDate: '2026-08-20T00:00:00Z' },
    { id: 3, auctionEndDate: '2026-08-15T00:00:00Z' },
  ]);
  assert.equal(selected.id, 2);
  assert.equal(conversionId('qualified-lead', 4), 'conv_qual_lead_4');
  assert.equal(conversionId('donation-accepted', 4), 'conv_accept_lead_4');
  assert.equal(conversionId('boat-sold', 9), 'conv_sale_boat_9');
});

test('all applicable public HTML and sitemap routes contain the first-party tracker only', () => {
  const htmlFiles = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'artifacts'].includes(entry.name)) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(full);
    }
  };
  walk(ROOT);
  const excluded = new Set(['admin/index.html', 'google776ef470e4863026.html']);
  const applicable = htmlFiles.filter(file => !excluded.has(path.relative(ROOT, file).replaceAll(path.sep, '/')));
  for (const file of applicable) assert.match(fs.readFileSync(file, 'utf8'), /src="\/tracker\.v1\.js"/, path.relative(ROOT, file));
  for (const file of htmlFiles) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /tracking\.whatconverts\.com\/scripts\/wc\.js/, path.relative(ROOT, file));

  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
  for (const pathname of urls) {
    const candidates = pathname === '/' ? ['index.html'] : [
      `${pathname.replace(/^\//, '').replace(/\/$/, '')}.html`,
      `${pathname.replace(/^\//, '').replace(/\/$/, '')}/index.html`,
    ];
    const file = candidates.map(candidate => path.join(ROOT, candidate)).find(candidate => fs.existsSync(candidate));
    assert.ok(file, `No repository HTML found for ${pathname}`);
    assert.match(fs.readFileSync(file, 'utf8'), /src="\/tracker\.v1\.js"/, pathname);
  }
  assert.equal(applicable.length, 239);
  assert.equal(urls.length, 238);
});
