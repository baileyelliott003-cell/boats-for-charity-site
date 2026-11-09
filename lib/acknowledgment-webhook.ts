import { Webhook } from 'svix';
import { sha256Value } from './security.js';
import { ACK_WEBHOOK_EVENTS } from './acknowledgment-wire.js';

type Sink = { recordProviderWebhook: (event: any, receipt: { id: string; payloadHash: string; signatureHash: string }) => Promise<{ state: string }> };
export function acknowledgmentWebhookHandler(options: { configuration: () => { enabled: boolean; secret?: string }; outbox: () => Promise<Sink> }) {
  return async (request: Request): Promise<Response> => {
    const config = options.configuration();
    if (!config.enabled || !config.secret) return new Response('Not configured', { status:503 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status:405, headers:{Allow:'POST'} });
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return new Response('JSON required', { status:415 });
    const headers = Object.fromEntries(['svix-id','svix-timestamp','svix-signature'].map(key => [key,request.headers.get(key) || '']));
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(headers['svix-id']) || !/^\d{1,12}$/.test(headers['svix-timestamp']) || !headers['svix-signature'] || headers['svix-signature'].length > 4096) return new Response('Invalid signature', { status:400 });
    const reader = request.body?.getReader(); if (!reader) return new Response('Body required', { status:400 });
    const chunks: Uint8Array[] = []; let size=0;
    try {
      for (;;) { const part=await reader.read(); if(part.done)break; size+=part.value.byteLength; if(size>65536)return new Response('Body too large',{status:413}); chunks.push(part.value); }
    } catch { return new Response('Invalid body',{status:400}); }
    finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
    const raw=Buffer.concat(chunks); let event: any;
    try {
      // Svix 2.9 verifies bytes and returns undefined. Parse only AFTER verification.
      new Webhook(config.secret).verify(raw,headers);
      event=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
    } catch { return new Response('Invalid signature or body',{status:400}); }
    if (!ACK_WEBHOOK_EVENTS.has(String(event?.type).replace(/^email\./,'')) || !String(event?.type).startsWith('email.')) return new Response('Ignored',{status:202});
    if (!event?.data || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(event.data.email_id)) return new Response('Invalid event',{status:400});
    const latest=options.configuration();
    if (!latest.enabled || latest.secret!==config.secret) return new Response('Temporarily unavailable',{status:503});
    try {
      const result=await (await options.outbox()).recordProviderWebhook(event,{id:headers['svix-id'],payloadHash:sha256Value(raw.toString('utf8')),signatureHash:sha256Value(headers['svix-signature'])});
      return new Response(result.state,{status:result.state==='collision'?409:202});
    } catch { return new Response('Temporarily unavailable',{status:503}); }
  };
}
