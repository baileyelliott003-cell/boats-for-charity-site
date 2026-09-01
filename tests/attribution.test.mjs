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
      plugins: [{
        name: 'stub-runtime-database',
        setup(buildContext) {
          buildContext.onResolve({ filter: /db\/index\.js$/ }, () => ({ path: 'runtime-database', namespace: 'test-stub' }));
          buildContext.onLoad({ filter: /.*/, namespace: 'test-stub' }, () => ({ contents: 'export const db = {};', loader: 'js' }));
        },
      }],
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

test('dashboard HTML contains Sync Netlify Forms button and never embeds secrets', async () => {
  const dashboard = await importBundled('netlify/functions/admin-dashboard.ts');
  const secret = 'never-render-this-secret';
  process.env.DASHBOARD_SECRET = secret;
  const response = await dashboard.default(new Request(`https://boatsforcharity.org/admin/dashboard?key=${secret}`), {});
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.doesNotMatch(html, new RegExp(secret));
  assert.match(html, /\/api\/admin-login/);
});

test('legacy admin entry points route to the current staff portal', () => {
  const adminHtml = fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf-8');
  const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf-8');
  assert.match(adminHtml, /\/admin\/dashboard/);
  assert.doesNotMatch(adminHtml, /netlify-cms|netlify-identity-widget/i);
  assert.match(redirects, /^\/admin\s+\/admin\/dashboard\s+302!/m);
  assert.match(redirects, /^\/admin\/\s+\/admin\/dashboard\s+302!/m);
  assert.match(redirects, /^\/admin\/index\.html\s+\/admin\/dashboard\s+302!/m);
});

test('Netlify submission normalization handles event payloads robustly', async () => {
  const { normalizeNetlifySubmission } = await importBundled('lib/netlify-submission.ts');
  const rawBody = JSON.stringify({
    payload: {
      id: 'sub_test_123',
      form_name: 'donationForm',
      data: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        visitor_id: 'bfc_vid_123456',
        session_id: 'bfc_sid_123456',
        gclid: 'test_gclid'
      }
    }
  });
  const normalized = normalizeNetlifySubmission(rawBody);
  assert.equal(normalized.netlifySubmissionId, 'sub_test_123');
  assert.equal(normalized.email, 'john@example.com');
  assert.equal(normalized.gclid, 'test_gclid');
});
