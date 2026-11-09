import { sha256Value } from './security.js';

// Official GET /emails/:email_id and event meanings checked 2026-11-05:
// https://resend.com/docs/api-reference/emails/retrieve-email
// https://resend.com/docs/dashboard/emails/manage-emails
const uuid = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const events = new Set(['bounced','canceled','clicked','complained','delivered','delivery_delayed','failed','opened','queued','scheduled','sent','suppressed']);
export function verifyAcknowledgmentProviderSnapshot(value: any, row: any, now: number, responseHash: string) {
  if (!uuid(row?.provider_id) || value?.object !== 'email' || value.id !== row.provider_id || !row.request_started_at || !/^[a-f0-9]{64}$/.test(responseHash)) throw Error('ACK_PROVIDER_READ_BINDING');
  if (!Array.isArray(value.to) || value.to.length !== 1 || value.to[0] !== row.message.to || value.from !== row.message.from || value.subject !== row.message.subject || value.html !== row.message.html || value.text != null && value.text !== '') throw Error('ACK_PROVIDER_CONTENT_MISMATCH');
  for (const field of ['cc','bcc','reply_to']) if (!Array.isArray(value[field]) || value[field].length) throw Error('ACK_PROVIDER_CONTENT_MISMATCH');
  if (value.scheduled_at != null || value.attachments != null && (!Array.isArray(value.attachments) || value.attachments.length)) throw Error('ACK_PROVIDER_CONTENT_MISMATCH');
  // Require an explicit timezone. Resend also returns SQL-style +00 dates.
  const date = value.created_at;
  if (typeof date !== 'string' || !/(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(date)) throw Error('ACK_PROVIDER_READ_TIME');
  const created = Date.parse(date), request = Date.parse(row.request_started_at);
  if (!Number.isFinite(created) || !Number.isFinite(request) || created < request - 300000 || created > now + 300000) throw Error('ACK_PROVIDER_READ_TIME');
  if (!events.has(value.last_event)) throw Error('ACK_PROVIDER_EVENT_UNKNOWN');
  return { provider: 'resend', providerId: row.provider_id, state: 'verified', providerEvent: value.last_event, providerCreatedAt: new Date(created).toISOString(), responseSHA256: responseHash, expectedMessageHash: row.message_hash, contentReadbackVerified: true, checkedAt: new Date(now).toISOString(), scope: 'Exact stored sender, recipient, subject and HTML read back from the provider. Event describes provider status, not human receipt or a complete event history.' };
}

type Reader = { get: (id: string) => Promise<any>; recordProviderReadback: (id: string, providerId: string, messageHash: string, value: any, responseHash: string) => Promise<any>; recordProviderReadFailure: (id: string, providerId: string, messageHash: string, code: string) => Promise<any> };
export async function inspectWebsiteAcknowledgment(outbox: Reader, id: string, options: { configuration: () => { key?: string; enabled?: boolean }; request?: typeof fetch }) {
  const configuration = options.configuration();
  if (configuration.enabled !== true) return { state: 'readback_disabled' };
  const row = await outbox.get(id);
  // A lost receipt cannot be guessed from recipient, subject or timing. No POST
  // or provider-list fallback exists on this reconciliation path.
  if (row?.state !== 'accepted' || !uuid(row.provider_id)) return { state: 'receipt_required' };
  const fail = async (code: string) => outbox.recordProviderReadFailure(id, row.provider_id, row.message_hash, code);
  if (typeof configuration.key !== 'string' || !configuration.key.trim() || /[\r\n]/.test(configuration.key)) return fail('ACK_PROVIDER_READ_NOT_CONFIGURED');
  const latest = options.configuration();
  if (latest.enabled !== true || latest.key !== configuration.key) return { state: 'readback_stopped' };
  let value: any, responseHash: string;
  try {
    const response = await (options.request || fetch)('https://api.resend.com/emails/' + row.provider_id, { method: 'GET', headers: { Authorization: 'Bearer ' + configuration.key, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) { await response.body?.cancel(); return fail([401,403].includes(response.status) ? 'ACK_PROVIDER_READ_PERMISSION' : 'ACK_PROVIDER_READ_UNAVAILABLE'); }
    const reader = response.body?.getReader(); if (!reader) throw Error('No bounded provider body');
    const chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 262144) throw Error('Provider response too large'); chunks.push(part.value); } }
    finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
    const bytes = Buffer.concat(chunks); value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); responseHash = sha256Value(bytes.toString('utf8'));
  } catch { return fail('ACK_PROVIDER_READ_UNAVAILABLE'); }
  // Database persistence errors propagate; never downgrade them to provider
  // failures, and never change the original accepted attempt into a new send.
  return outbox.recordProviderReadback(id, row.provider_id, row.message_hash, value, responseHash);
}
