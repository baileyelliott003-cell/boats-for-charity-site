import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { sha256Value } from './security.js';
import { verifyAcknowledgmentProviderSnapshot } from './acknowledgment-provider.js';
import { ACK_WIRE_CONTRACT, ACK_WEBHOOK_EVENTS, acknowledgmentWirePayload, acknowledgmentWireHash, acknowledgmentWebhookMatches } from './acknowledgment-wire.js';

export const ACK_CONTRACT = 'website-acknowledgment-outbox-v1';
export interface AckMessage { from: string; to: string; subject: string; html: string }
type Database = { execute: (query: any) => Promise<any>; transaction: <T>(fn: (tx: Database) => Promise<T>) => Promise<T> };
function canonical(v: any, depth = 0): string {
  if (depth > 64) throw Error('ACK_JSON_DEPTH');
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(x => canonical(x, depth + 1)).join(',') + ']';
  if (v && Object.getPrototypeOf(v) === Object.prototype) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k], depth + 1)).join(',') + '}';
  throw Error('ACK_JSON_VALUE');
}
const digest = (v: any) => sha256Value(canonical(v));
const email = (v: unknown) => typeof v === 'string' && v.length <= 320 && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(v);
const rows = (result: any): any[] => { const value = Array.isArray(result) ? result : result?.rows; if (!Array.isArray(value)) throw Error('ACK_DATABASE_RESPONSE'); return value; };
const stamp = (now: number) => new Date(now).toISOString();
export function acknowledgmentSourceHash(source: any) {
  return digest({ id: String(source.netlifySubmissionId ?? source.netlify_submission_id ?? ''), form: String(source.formName ?? source.form_name ?? ''), email: String(source.email || '').trim().toLowerCase(), phone: String(source.phone || ''), data: source.rawFormData ?? source.raw_form_data ?? {} });
}
export function acknowledgmentMessageHash(message: AckMessage) {
  if (!message || Object.keys(message).sort().join(',') !== 'from,html,subject,to' || !email(message.to) || typeof message.from !== 'string' || message.from.length > 320 || /[\r\n]/.test(message.from) || !email(message.from.match(/<([^<>]+)>$/)?.[1] || message.from) || typeof message.subject !== 'string' || !message.subject.trim() || message.subject.length > 300 || /[\r\n]/.test(message.subject) || typeof message.html !== 'string' || !message.html || Buffer.byteLength(message.html) > 20000) throw Error('ACK_MESSAGE_REVIEW');
  return digest(message);
}

// No source/recipient/body is placed in diagnostic events. Message bodies remain
// within the existing protected website database and authenticated admin view.
export const ACK_SCHEMA_STATEMENTS = [
`CREATE TABLE IF NOT EXISTS website_ack_outbox (
 id text PRIMARY KEY, lead_id integer NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
 submission_id text NOT NULL UNIQUE, contract text NOT NULL, source_hash text NOT NULL,
 message_hash text NOT NULL, message jsonb NOT NULL,
 state text NOT NULL CHECK (state IN ('ready','attempting','accepted','uncertain','blocked')),
 blocked_reason text, last_error_code text, attempt_token text, attempt_count integer NOT NULL DEFAULT 0,
 lease_until timestamptz, request_started_at timestamptz, provider_id text UNIQUE,
 accepted_at timestamptz, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);`,
`CREATE INDEX IF NOT EXISTS website_ack_pending_idx ON website_ack_outbox(state, created_at);`,
`CREATE TABLE IF NOT EXISTS website_ack_events (
 id bigserial PRIMARY KEY, outbox_id text NOT NULL REFERENCES website_ack_outbox(id) ON DELETE RESTRICT,
 attempt_token text, event text NOT NULL, error_code text, observed_at timestamptz NOT NULL
);`,
`ALTER TABLE website_ack_events ADD COLUMN IF NOT EXISTS observation jsonb;`,
`ALTER TABLE website_ack_outbox ADD COLUMN IF NOT EXISTS wire_contract text;`,
`ALTER TABLE website_ack_outbox ADD COLUMN IF NOT EXISTS wire_hash text;`,
`CREATE UNIQUE INDEX IF NOT EXISTS website_ack_attempt_idx ON website_ack_outbox(attempt_token) WHERE attempt_token IS NOT NULL;`,
`CREATE TABLE IF NOT EXISTS website_ack_webhooks (
 id text PRIMARY KEY, outbox_id text NOT NULL REFERENCES website_ack_outbox(id) ON DELETE RESTRICT,
 payload_hash text NOT NULL, signature_hash text NOT NULL, observed_at timestamptz NOT NULL
);`
] as const;
export const ACK_SCHEMA_SQL = ACK_SCHEMA_STATEMENTS.join("\n");

export class WebsiteAcknowledgmentOutbox {
  constructor(readonly database: Database, readonly clock: () => number = Date.now) {}
  private async event(tx: Database, id: string, token: string | null, event: string, code: string | null = null, observation: any = null) {
    await tx.execute(sql`INSERT INTO website_ack_events(outbox_id,attempt_token,event,error_code,observed_at,observation) VALUES(${id},${token},${event},${code},${stamp(this.clock())},${observation === null ? null : JSON.stringify(observation)}::jsonb)`);
  }
  // Must run inside the SAME transaction that creates/resolves the lead.
  async prepare(tx: Database, source: any, leadId: number, created: boolean, message: AckMessage) {
    if (!Number.isSafeInteger(leadId) || leadId < 1 || !source.netlifySubmissionId || message.to !== source.email) throw Error('ACK_SOURCE_BINDING');
    const sourceHash = acknowledgmentSourceHash(source), messageHash = acknowledgmentMessageHash(message), id = 'web-ack-' + sha256Value(String(source.netlifySubmissionId)), at = stamp(this.clock());
    const inserted = rows(await tx.execute(sql`INSERT INTO website_ack_outbox(id,lead_id,submission_id,contract,source_hash,message_hash,message,state,blocked_reason,created_at,updated_at)
      VALUES(${id},${leadId},${source.netlifySubmissionId},${ACK_CONTRACT},${sourceHash},${messageHash},${JSON.stringify(message)}::jsonb,${created ? 'ready' : 'blocked'},${created ? null : 'ACK_LEGACY_DELIVERY_UNVERIFIED'},${at},${at}) ON CONFLICT (submission_id) DO NOTHING RETURNING id`));
    const row = rows(await tx.execute(sql`SELECT * FROM website_ack_outbox WHERE submission_id=${source.netlifySubmissionId} FOR UPDATE`))[0];
    if (!row || row.lead_id !== leadId || row.contract !== ACK_CONTRACT) throw Error('ACK_INTENT_BINDING');
    if (inserted.length) await this.event(tx, id, null, created ? 'prepared' : 'legacy_delivery_held', created ? null : 'ACK_LEGACY_DELIVERY_UNVERIFIED');
    if (row.source_hash !== sourceHash || row.message_hash !== messageHash) {
      if (row.blocked_reason !== 'ACK_SOURCE_OR_TEMPLATE_CHANGED') {
        await tx.execute(sql`UPDATE website_ack_outbox SET blocked_reason='ACK_SOURCE_OR_TEMPLATE_CHANGED',updated_at=${at} WHERE id=${id}`);
        await this.event(tx, id, row.attempt_token, 'source_or_template_changed', 'ACK_SOURCE_OR_TEMPLATE_CHANGED');
      }
    }
    return id;
  }
  async get(id: string) { return rows(await this.database.execute(sql`SELECT * FROM website_ack_outbox WHERE id=${id}`))[0] || null; }
  async pending(limit = 1) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10) throw Error('ACK_BOUNDED_SCAN');
    return rows(await this.database.execute(sql`SELECT id FROM website_ack_outbox WHERE blocked_reason IS NULL AND (state='ready' OR (state='attempting' AND lease_until<=${stamp(this.clock())})) ORDER BY created_at,id LIMIT ${limit}`));
  }
  private async sourceMatches(tx: Database, row: any) {
    const parent = rows(await tx.execute(sql`SELECT netlify_submission_id,form_name,email,phone,raw_form_data FROM leads WHERE id=${row.lead_id} FOR UPDATE`))[0];
    // A broken connection must roll back. Invalid stored JSON/message content
    // is a separate integrity hold and must never reach the provider.
    try { return !!parent && acknowledgmentSourceHash(parent) === row.source_hash && acknowledgmentMessageHash(row.message) === row.message_hash; }
    catch { return false; }
  }
  async configurationMissing(id: string) {
    await this.database.transaction(async tx => {
      const row = rows(await tx.execute(sql`SELECT * FROM website_ack_outbox WHERE id=${id} FOR UPDATE`))[0];
      if (!row || row.state !== 'ready' || row.last_error_code === 'ACK_CONNECTION_NOT_CONFIGURED') return;
      await tx.execute(sql`UPDATE website_ack_outbox SET last_error_code='ACK_CONNECTION_NOT_CONFIGURED',updated_at=${stamp(this.clock())} WHERE id=${id}`);
      await this.event(tx, id, null, 'connection_unavailable', 'ACK_CONNECTION_NOT_CONFIGURED');
    });
  }
  async claim(id: string) {
    return this.database.transaction(async tx => {
      let row = rows(await tx.execute(sql`SELECT * FROM website_ack_outbox WHERE id=${id} FOR UPDATE`))[0];
      if (!row || row.contract !== ACK_CONTRACT || row.blocked_reason) return null;
      const at = stamp(this.clock());
      if (row.state === 'attempting' && new Date(row.lease_until).getTime() <= this.clock()) {
        const state = row.request_started_at ? 'uncertain' : 'ready', code = row.request_started_at ? 'ACK_PROVIDER_OUTCOME_UNCERTAIN' : 'ACK_STOPPED_BEFORE_REQUEST';
        await tx.execute(sql`UPDATE website_ack_outbox SET state=${state},last_error_code=${code},updated_at=${at} WHERE id=${id}`);
        await this.event(tx, id, row.attempt_token, row.request_started_at ? 'request_interrupted' : 'claim_interrupted_before_request', code);
        row = { ...row, state };
      }
      if (row.state !== 'ready') return null;
      const matches = await this.sourceMatches(tx, row);
      if (!matches) {
        await tx.execute(sql`UPDATE website_ack_outbox SET state='blocked',blocked_reason='ACK_CURRENT_SOURCE_MISMATCH',updated_at=${at} WHERE id=${id}`);
        await this.event(tx, id, null, 'current_source_changed', 'ACK_CURRENT_SOURCE_MISMATCH'); return null;
      }
      const token = randomUUID(), lease = stamp(this.clock() + 300000);
      await tx.execute(sql`UPDATE website_ack_outbox SET state='attempting',attempt_token=${token},attempt_count=attempt_count+1,lease_until=${lease},request_started_at=NULL,last_error_code=NULL,updated_at=${at} WHERE id=${id}`);
      await this.event(tx, id, token, 'claimed');
      return { ...row, state: 'attempting', attempt_token: token, request_started_at: null, lease_until: lease };
    });
  }
  async beginRequest(id: string, token: string, from: string) {
    return this.database.transaction(async tx => {
      const row = rows(await tx.execute(sql`SELECT * FROM website_ack_outbox WHERE id=${id} FOR UPDATE`))[0];
      if (!row || row.state !== 'attempting' || row.attempt_token !== token || row.blocked_reason || row.request_started_at || new Date(row.lease_until).getTime() <= this.clock()) return false;
      const matches = await this.sourceMatches(tx, row) && row.message.from === from;
      if (!matches) {
        await tx.execute(sql`UPDATE website_ack_outbox SET state='blocked',blocked_reason='ACK_CURRENT_SOURCE_MISMATCH',updated_at=${stamp(this.clock())} WHERE id=${id}`);
        await this.event(tx, id, token, 'stopped_before_request', 'ACK_CURRENT_SOURCE_MISMATCH'); return false;
      }
      await tx.execute(sql`UPDATE website_ack_outbox SET request_started_at=${stamp(this.clock())},wire_contract=${ACK_WIRE_CONTRACT},wire_hash=${acknowledgmentWireHash(row)},updated_at=${stamp(this.clock())} WHERE id=${id}`);
      await this.event(tx, id, token, 'request_started'); return true;
    });
  }
  async uncertain(id: string, token: string, code = 'ACK_PROVIDER_OUTCOME_UNCERTAIN') {
    if (!['ACK_PROVIDER_OUTCOME_UNCERTAIN','ACK_PROVIDER_REJECTED','ACK_RECEIPT_INVALID'].includes(code)) throw Error('ACK_SAFE_ERROR_CODE');
    await this.database.transaction(async tx => {
      const row = rows(await tx.execute(sql`SELECT * FROM website_ack_outbox WHERE id=${id} FOR UPDATE`))[0];
      if (!row || row.attempt_token !== token || !row.request_started_at || !['attempting','uncertain'].includes(row.state)) return;
      await tx.execute(sql`UPDATE website_ack_outbox SET state='uncertain',last_error_code=${code},updated_at=${stamp(this.clock())} WHERE id=${id}`);
      await this.event(tx, id, token, 'provider_outcome_requires_review', code);
    });
  }
  async accepted(id: string, token: string, providerId: string, messageHash: string) {
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(providerId)) throw Error('ACK_RECEIPT_INVALID');
    const conflict = await this.database.transaction(async tx => {
      const row = rows(await tx.execute(sql`SELECT * FROM website_ack_outbox WHERE id=${id} FOR UPDATE`))[0];
      if (!row || row.attempt_token !== token || !row.request_started_at || row.message_hash !== messageHash || !['attempting','uncertain','accepted'].includes(row.state)) throw Error('ACK_RECEIPT_BINDING');
      if (row.provider_id && row.provider_id !== providerId) {
        await tx.execute(sql`UPDATE website_ack_outbox SET blocked_reason='ACK_PROVIDER_ID_CONFLICT',updated_at=${stamp(this.clock())} WHERE id=${id}`);
        await this.event(tx,id,token,'provider_receipt_conflict','ACK_PROVIDER_ID_CONFLICT');
        return true;
      }
      if (row.state === 'accepted') return;
      await tx.execute(sql`UPDATE website_ack_outbox SET state='accepted',provider_id=${providerId},accepted_at=${stamp(this.clock())},last_error_code=NULL,updated_at=${stamp(this.clock())} WHERE id=${id}`);
      await this.event(tx, id, token, 'provider_accepted');
    });
    // Commit the conflict evidence before rejecting the conflicting receipt.
    if (conflict) throw Error('ACK_PROVIDER_ID_CONFLICT');
  }
  async recordProviderWebhook(value: any, receipt: { id: string; payloadHash: string; signatureHash: string }) {
    const kind = String(value?.type).replace(/^email\./,''), data=value?.data;
    if (!ACK_WEBHOOK_EVENTS.has(kind) || !String(value?.type).startsWith('email.') ||
        !/^[A-Za-z0-9_-]{1,200}$/.test(receipt.id) || ![receipt.payloadHash,receipt.signatureHash].every(hash=>/^[a-f0-9]{64}$/.test(hash)) ||
        !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data?.email_id)) throw Error('ACK_WEBHOOK_INPUT');
    const token=data?.tags?.bfc_ack_attempt;
    if (typeof token!=='string' || !/^[a-f0-9-]{36}$/i.test(token)) return {state:'unowned'};
    return this.database.transaction(async tx => {
      const row=rows(await tx.execute(sql`SELECT * FROM website_ack_outbox WHERE attempt_token=${token} FOR UPDATE`))[0];
      if (!row || row.wire_contract !== ACK_WIRE_CONTRACT) return {state:'unowned'};
      // Serialize globally unique delivery IDs before deduplication, including
      // concurrent deliveries that claim different local attempts.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${receipt.id},0))`);
      const existing=rows(await tx.execute(sql`SELECT * FROM website_ack_webhooks WHERE id=${receipt.id}`))[0];
      if(existing) {
        if(existing.payload_hash===receipt.payloadHash && existing.outbox_id===row.id)return {state:'duplicate'};
        await tx.execute(sql`UPDATE website_ack_outbox SET blocked_reason='ACK_WEBHOOK_ID_COLLISION',updated_at=${stamp(this.clock())} WHERE id=${row.id}`);
        await this.event(tx,row.id,token,'webhook_id_collision','ACK_WEBHOOK_ID_COLLISION');
        return {state:'collision'};
      }
      let matches=false;
      try { matches=acknowledgmentMessageHash(row.message)===row.message_hash && acknowledgmentWebhookMatches(value,row,this.clock()); } catch {}
      const other=rows(await tx.execute(sql`SELECT id FROM website_ack_outbox WHERE provider_id=${data.email_id} AND id<>${row.id}`))[0];
      matches=matches && !other && (!row.provider_id || row.provider_id===data.email_id);
      await tx.execute(sql`INSERT INTO website_ack_webhooks(id,outbox_id,payload_hash,signature_hash,observed_at) VALUES(${receipt.id},${row.id},${receipt.payloadHash},${receipt.signatureHash},${stamp(this.clock())})`);
      if(!matches) {
        await tx.execute(sql`UPDATE website_ack_outbox SET blocked_reason='ACK_WEBHOOK_BINDING_REVIEW',updated_at=${stamp(this.clock())} WHERE id=${row.id}`);
        await this.event(tx,row.id,token,'webhook_binding_requires_review','ACK_WEBHOOK_BINDING_REVIEW');
        return {state:'requires_review'};
      }
      // A provider event binds the original request, not the current lead edit.
      // Late evidence is retained even after pause/source changes; never resend.
      await tx.execute(sql`UPDATE website_ack_outbox SET state='accepted',provider_id=${data.email_id},accepted_at=coalesce(accepted_at,${stamp(this.clock())}),last_error_code=NULL,updated_at=${stamp(this.clock())} WHERE id=${row.id}`);
      await this.event(tx,row.id,token,'provider_signed_event',null,{
        provider:'resend',providerId:data.email_id,state:'event_verified',providerEvent:kind,
        providerEventAt:new Date(value.created_at).toISOString(),providerCreatedAt:new Date(data.created_at).toISOString(),
        payloadSHA256:receipt.payloadHash,expectedMessageHash:row.message_hash,
        deliveryEventVerified:true,attemptBindingVerified:true,contentReadbackVerified:false,
        checkedAt:stamp(this.clock()),scope:'Signed provider event and original attempt/envelope binding only; no body readback or human receipt.'
      });
      return {state:'event_verified'};
    });
  }
  async providerReadbackCandidates(limit = 1) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10) throw Error('ACK_BOUNDED_SCAN');
    return rows(await this.database.execute(sql`SELECT o.id FROM website_ack_outbox o LEFT JOIN LATERAL (SELECT observed_at FROM website_ack_events WHERE outbox_id=o.id AND observation IS NOT NULL ORDER BY id DESC LIMIT 1) p ON true WHERE o.state='accepted' AND o.provider_id IS NOT NULL AND (p.observed_at IS NULL OR p.observed_at<=${stamp(this.clock()-3600000)}) ORDER BY coalesce(p.observed_at,o.accepted_at),o.id LIMIT ${limit}`));
  }
  async recordProviderReadFailure(id: string, providerId: string, messageHash: string, code: string) {
    if (!['ACK_PROVIDER_READ_NOT_CONFIGURED','ACK_PROVIDER_READ_PERMISSION','ACK_PROVIDER_READ_UNAVAILABLE'].includes(code)) throw Error('ACK_SAFE_ERROR_CODE');
    return this.recordProviderReadback(id,providerId,messageHash,null,null,code);
  }
  async recordProviderReadback(id: string, providerId: string, messageHash: string, value: any, responseHash: string | null, failure?: string) {
    return this.database.transaction(async tx => {
      const row = rows(await tx.execute(sql`SELECT * FROM website_ack_outbox WHERE id=${id} FOR UPDATE`))[0];
      if (!row || row.state !== 'accepted' || row.provider_id !== providerId || row.message_hash !== messageHash || acknowledgmentMessageHash(row.message) !== messageHash) throw Error('ACK_PROVIDER_READ_BINDING');
      let observation: any;
      try {
        if (failure) throw Error(failure);
        observation = verifyAcknowledgmentProviderSnapshot(value,row,this.clock(),responseHash!);
      } catch (error) {
        const code = error instanceof Error && ['ACK_PROVIDER_READ_NOT_CONFIGURED','ACK_PROVIDER_READ_PERMISSION','ACK_PROVIDER_READ_UNAVAILABLE','ACK_PROVIDER_READ_BINDING','ACK_PROVIDER_CONTENT_MISMATCH','ACK_PROVIDER_READ_TIME','ACK_PROVIDER_EVENT_UNKNOWN'].includes(error.message) ? error.message : 'ACK_PROVIDER_READ_BINDING';
        observation = { provider:'resend',providerId,state:'requires_review',errorCode:code,expectedMessageHash:messageHash,contentReadbackVerified:false,checkedAt:stamp(this.clock()) };
      }
      await this.event(tx,id,row.attempt_token,observation.state==='verified'?'provider_content_readback':'provider_readback_requires_review',observation.errorCode||null,observation);
      return observation;
    });
  }
  async status(limit = 50) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw Error('ACK_BOUNDED_SCAN');
    const counts = rows(await this.database.execute(sql`SELECT state,blocked_reason,last_error_code,count(*)::int AS count FROM website_ack_outbox GROUP BY state,blocked_reason,last_error_code`));
    const items = rows(await this.database.execute(sql`SELECT o.id,o.lead_id,o.submission_id,o.state,o.blocked_reason,o.last_error_code,o.attempt_count,o.provider_id,o.created_at,o.updated_at,o.accepted_at,p.observation AS provider_readback,EXISTS(SELECT 1 FROM website_ack_events e WHERE e.outbox_id=o.id AND e.observation->>'state' IN ('verified','event_verified') AND e.observation->>'providerEvent' IN ('bounced','complained','suppressed','failed','canceled','delivery_delayed')) AS provider_history_alert FROM website_ack_outbox o LEFT JOIN LATERAL (SELECT observation FROM website_ack_events WHERE outbox_id=o.id AND observation IS NOT NULL ORDER BY coalesce(observation->>'providerEventAt',observation->>'checkedAt',observed_at::text) DESC,id DESC LIMIT 1) p ON true ORDER BY o.created_at DESC,o.id LIMIT ${limit}`));
    const providerReadbackCounts = rows(await this.database.execute(sql`SELECT observation->>'state' AS state,observation->>'providerEvent' AS provider_event,count(*)::int AS count FROM (SELECT DISTINCT ON(outbox_id) observation FROM website_ack_events WHERE observation IS NOT NULL ORDER BY outbox_id,coalesce(observation->>'providerEventAt',observation->>'checkedAt',observed_at::text) DESC,id DESC) latest GROUP BY observation->>'state',observation->>'providerEvent'`));
    const providerHistoryAlerts = rows(await this.database.execute(sql`SELECT count(DISTINCT outbox_id)::int AS count FROM website_ack_events WHERE observation->>'state' IN ('verified','event_verified') AND observation->>'providerEvent' IN ('bounced','complained','suppressed','failed','canceled','delivery_delayed')`))[0]?.count || 0;
    return { contract: ACK_CONTRACT, counts, items, providerReadbackCounts, providerHistoryAlerts, delivered: false, scope: 'Saved intents, provider acceptance, signed attempt-bound provider events and exact-content provider readbacks only. No human receipt, complete event history or website/local reconciliation is inferred. Observed adverse events stay flagged for review; later reads do not automatically resolve them.' };
  }
}

export async function deliverWebsiteAcknowledgment(outbox: WebsiteAcknowledgmentOutbox, id: string, options: { configuration: () => { key?: string; from: string; paused?: boolean }; request?: typeof fetch }) {
  const config = options.configuration();
  if (config.paused) return { state: 'paused' };
  if (typeof config.key !== 'string' || !config.key.trim() || /[\r\n]/.test(config.key)) { await outbox.configurationMissing(id); return { state: 'connection_needed' }; }
  const claim = await outbox.claim(id); if (!claim) return { state: (await outbox.get(id))?.state || 'not_found' };
  // A second configuration read catches pause/key/from changes during I/O. A
  // changed credential is held before POST rather than silently switching it.
  const latest = options.configuration();
  if (latest.paused || latest.key !== config.key || latest.from !== config.from) return { state: 'held_before_request' };
  if (!await outbox.beginRequest(id, claim.attempt_token, config.from)) return { state: 'held_before_request' };
  const savedOutcome = async () => {
    const row = await outbox.get(id);
    if (row?.attempt_token !== claim.attempt_token || row.message_hash !== claim.message_hash) return {state:'uncertain'};
    if (row.blocked_reason) return {state:'requires_review'};
    return row.state === 'accepted' && row.provider_id ? {state:'accepted',providerId:row.provider_id,delivered:false} : {state:'uncertain'};
  };
  try {
    const response = await (options.request || fetch)('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + config.key, 'Content-Type': 'application/json', 'Idempotency-Key': 'bfc-website-ack/' + claim.message_hash + '/' + sha256Value(id).slice(0,32) }, body: JSON.stringify(acknowledgmentWirePayload(claim)), redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) { await response.body?.cancel(); await outbox.uncertain(id, claim.attempt_token, 'ACK_PROVIDER_REJECTED'); return savedOutcome(); }
    let raw = ''; for await (const chunk of response.body || []) { raw += Buffer.from(chunk).toString('utf8'); if (Buffer.byteLength(raw) > 8192) throw Error('ACK_RECEIPT_INVALID'); }
    const receipt = JSON.parse(raw); await outbox.accepted(id, claim.attempt_token, receipt.id, claim.message_hash);
    return { state: 'accepted', providerId: receipt.id, delivered: false };
  } catch {
    await outbox.uncertain(id, claim.attempt_token); return savedOutcome();
  }
}
