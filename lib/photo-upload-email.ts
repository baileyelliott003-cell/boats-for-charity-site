import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { getRuntimeEnv } from './runtime-env.js';

const RECIPIENT = 'info.boatsforcharity@gmail.com';
const FORM_URL = 'https://app.netlify.com/projects/boatsforcharity/forms';
const clean = (value: unknown, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';

// Resend retrieves remote attachments. Never fetch donor-supplied URLs on our server.
export function photoUrl(value: unknown): string | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) value = (value as Record<string, unknown>).url;
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try { value = JSON.parse(value).url; } catch { return null; }
  }
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(host.replace(/^\[|\]$/g, '')) ||
      !host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return null;
    return url.href;
  } catch { return null; }
}

export function buildPhotoEmail(data: Record<string, unknown>, from: string) {
  if (data.page_context !== 'boat-photo-upload') return null;
  const reference = clean(data.upload_id, 100);
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(reference)) throw new Error('Invalid photo upload reference');
  const expected = Number(data.photo_count);
  if (!Number.isInteger(expected) || expected < 1 || expected > 20) throw new Error('Invalid photo count');
  const attachments: { path: string; filename: string }[] = [];
  const unavailable: string[] = [];
  for (let i = 1; i <= expected; i++) {
    const number = String(i).padStart(2, '0');
    const path = photoUrl(data[`photo_${number}`]);
    if (!path) { unavailable.push(number); continue; }
    const extension = new URL(path).pathname.match(/\.(jpe?g|png|webp|heic|heif)$/i)?.[1]?.toLowerCase();
    if (!extension) { unavailable.push(number); continue; }
    attachments.push({path, filename:`${reference}-${number}.${extension}`});
  }
  const name = `${clean(data.first_name, 100)} ${clean(data.last_name, 100)}`.trim() || 'Donor';
  const subjectName = name.replace(/[\r\n\t]/g, ' ');
  const text = [
    'New boat photos — Boats for Charity', '',
    `Donor: ${name}`, `Phone: ${clean(data.phone, 50)}`, `Email: ${clean(data.email, 254) || 'Not provided'}`,
    `Boat: ${clean(data.boat_details, 500)}`, `Notes: ${clean(data.notes, 2000) || 'None'}`,
    `Upload reference: ${reference}`, `Photos submitted: ${expected}`, '',
    ...(unavailable.length ? [`ATTENTION: Could not attach photo field(s) ${unavailable.join(', ')}. Open the saved submission below to review them.`, ''] : []),
    'Original photo links:', ...attachments.map((a, i) => `${i+1}. ${a.path}`), '',
    `Saved submissions: ${FORM_URL}`, '',
    'This email contains donor-submitted information. This is a photo upload, not a new donation authorization.',
  ].join('\n');
  const email = clean(data.email, 254);
  return {
    from, to: [RECIPIENT], subject: `Boat photos: ${subjectName} (${expected})`, text,
    ...( /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { reply_to: email } : {} ),
    ...(attachments.length ? {attachments} : {}),
  };
}

export async function sendPhotoUploadEmail(data: Record<string, unknown>, dependencies: {
  env?: (key: string) => string | undefined;
  fetch?: typeof fetch;
  pause?: (ms: number) => Promise<void>;
} = {}) {
  if (data.page_context !== 'boat-photo-upload') return;
  const env = dependencies.env ?? getRuntimeEnv;
  const apiKey = env('RESEND_API_KEY');
  const from = env('FROM_EMAIL');
  if (!apiKey || !from) throw new Error('Photo email requires RESEND_API_KEY and FROM_EMAIL');
  const message = buildPhotoEmail(data, from)!;
  const request = dependencies.fetch ?? fetch;
  const pause = dependencies.pause ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  // Include content in the key: unchanged event deliveries/retries deduplicate, while
  // genuinely different batches cannot collide merely by reusing a client UUID.
  const digest = createHash('sha256').update(JSON.stringify(message)).digest('hex');
  async function deliver(body: typeof message, suffix: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await request('https://api.resend.com/emails', {
          method: 'POST', headers: {'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `bfc-photos-${digest}-${suffix}`},
          body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
        });
      } catch {
        if (attempt === 2) throw new Error('Photo email delivery could not be confirmed');
        await pause(500 * 2**attempt); continue;
      }
      if (response.ok) return null;
      if ((response.status === 429 || response.status >= 500) && attempt < 2) { await pause(500 * 2**attempt); continue; }
      return response;
    }
    throw new Error('Photo email delivery failed');
  }
  const response = await deliver(message, 'attachments');
  if (!response) return;
  // Only an explicit attachment rejection can switch to a link-only notice.
  // Never turn a timeout/unknown outcome into an additional email.
  let reason = '';
  try { const body = await response.json(); reason = typeof body.message === 'string' ? body.message : ''; } catch { /* keep generic error */ }
  if (message.attachments?.length && [400,413,422].includes(response.status) && (response.status === 413 || /attachment|file size|file type|download/i.test(reason))) {
    const {attachments, ...fallback} = message;
    const failure = await deliver({...fallback, text: 'Photos were saved, but the email service could not attach them. Use the original photo links below.\n\n' + fallback.text}, 'links');
    if (!failure) return;
    throw new Error(`Photo link notification failed (${failure.status})`);
  }
  throw new Error(`Photo email provider rejected request (${response.status})`);
}
