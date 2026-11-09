import { sha256Value } from './security.js';

export const ACK_WIRE_CONTRACT = 'website-ack-wire-v2';
export function acknowledgmentWirePayload(row: any) {
  return { ...row.message, text: '', tags: [
    { name: 'bfc_ack_contract', value: ACK_WIRE_CONTRACT },
    { name: 'bfc_ack_attempt', value: row.attempt_token },
    { name: 'bfc_ack_body', value: row.message_hash },
    { name: 'bfc_ack_outbox', value: sha256Value(row.id) },
  ] };
}
export const acknowledgmentWireHash = (row: any) => sha256Value(JSON.stringify(acknowledgmentWirePayload(row)));

export const ACK_WEBHOOK_EVENTS = new Set(['sent','delivered','delivery_delayed','bounced','complained','failed','suppressed']);
export function acknowledgmentWebhookMatches(event: any, row: any, now: number) {
  const data = event.data, tags = Object.fromEntries(acknowledgmentWirePayload(row).tags.map(tag => [tag.name, tag.value]));
  if (row.wire_contract !== ACK_WIRE_CONTRACT || row.wire_hash !== acknowledgmentWireHash(row) || !row.request_started_at ||
      !['attempting','uncertain','accepted'].includes(row.state) ||
      data.from !== row.message.from || data.subject !== row.message.subject ||
      !Array.isArray(data.to) || data.to.length !== 1 || data.to[0] !== row.message.to ||
      Object.entries(tags).some(([key,value]) => data.tags?.[key] !== value) ||
      ['cc','bcc'].some(key => data[key] != null && (!Array.isArray(data[key]) || data[key].length)) ||
      data.broadcast_id != null || data.template_id != null) return false;
  const date = (value: unknown) => typeof value === 'string' && /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? Date.parse(value) : NaN;
  const created = date(data.created_at), observed = date(event.created_at), started = Date.parse(row.request_started_at);
  return Number.isFinite(created) && Number.isFinite(observed) && Number.isFinite(started) &&
    created >= started - 300000 && created <= started + 300000 &&
    observed >= created - 30000 && observed <= now + 300000;
}
