import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {build} from 'esbuild';
import {Webhook} from 'svix';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),cache=path.join(root,'.cache');
await fs.mkdir(cache,{recursive:true});const directory=await fs.mkdtemp(path.join(cache,'bfc-ack-webhook-')),filename=path.join(directory,'webhook.mjs');
await build({stdin:{contents:"export * from './lib/acknowledgment-outbox.ts';export * from './lib/acknowledgment-wire.ts';export * from './lib/acknowledgment-webhook.ts';",resolveDir:root,loader:'ts'},outfile:filename,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'});
const {WebsiteAcknowledgmentOutbox,ACK_SCHEMA_SQL,deliverWebsiteAcknowledgment,acknowledgmentWirePayload,acknowledgmentWebhookHandler}=await import(pathToFileURL(filename));
if(path.dirname(path.resolve(directory))!==path.resolve(cache)||!path.basename(directory).startsWith('bfc-ack-webhook-'))throw Error('Unexpected test cleanup target');
await fs.rm(directory,{recursive:true,force:true});
const secret='whsec_'+Buffer.from('synthetic-signing-key-not-a-real-secret').toString('base64');
const message={from:'BFC <no-reply@boatsforcharity.org>',to:'synthetic@example.invalid',subject:'Synthetic only',html:'<p>No customer data</p>'};
const hash=value=>createHash('sha256').update(value).digest('hex');
async function fixture(t,{start=true}={}){
 const pg=new PGlite();await pg.waitReady;t.after(()=>pg.close());
 await pg.exec('CREATE TABLE leads(id serial PRIMARY KEY,netlify_submission_id text UNIQUE,form_name text,email text,phone text,raw_form_data jsonb);'+ACK_SCHEMA_SQL);
 const db=drizzle({client:pg});let now=Date.now();const outbox=new WebsiteAcknowledgmentOutbox(db,()=>now);
 const source={netlifySubmissionId:randomUUID(),formName:'donationForm',email:message.to,phone:'',rawFormData:{test:true}};
 await pg.query('INSERT INTO leads(netlify_submission_id,form_name,email,phone,raw_form_data) VALUES($1,$2,$3,$4,$5)',[source.netlifySubmissionId,source.formName,source.email,'',source.rawFormData]);
 const id=await db.transaction(tx=>outbox.prepare(tx,source,1,true,message));
 const claim=start?await outbox.claim(id):null;if(start)await outbox.beginRequest(id,claim.attempt_token,message.from);
 const providerId=randomUUID(),at=new Date(now).toISOString();
 const event={type:'email.delivered',created_at:at,data:{email_id:providerId,created_at:at,from:message.from,to:[message.to],subject:message.subject,tags:start?Object.fromEntries(acknowledgmentWirePayload(claim).tags.map(tag=>[tag.name,tag.value])):{}}};
 let dbReads=0,enabled=true;
 const handler=acknowledgmentWebhookHandler({configuration:()=>({enabled,secret}),outbox:async()=>{dbReads++;return outbox;}});
 const request=(value=event,{id='msg_'+randomUUID(),date=new Date(),raw=JSON.stringify(value),signedRaw=raw,contentType='application/json'}={})=>new Request('https://synthetic.invalid/api/resend-acknowledgment-webhook',{method:'POST',headers:{'content-type':contentType,'svix-id':id,'svix-timestamp':String(Math.floor(date.getTime()/1000)),'svix-signature':new Webhook(secret).sign(id,date,signedRaw)},body:raw});
 return {pg,outbox,id,claim,event,providerId,handler,request,reads:()=>dbReads,disable:()=>{enabled=false;},advance:ms=>{now+=ms;}};
}

test('signed delivery recovers a lost HTTP receipt, deduplicates retries and never resends',async t=>{
 const f=await fixture(t);await f.outbox.uncertain(f.id,f.claim.attempt_token);
 const id='msg_'+randomUUID();assert.equal((await f.handler(f.request(f.event,{id}))).status,202);
 assert.equal((await f.outbox.get(f.id)).state,'accepted');assert.equal((await f.outbox.get(f.id)).provider_id,f.providerId);
 assert.equal(await (await f.handler(f.request(f.event,{id}))).text(),'duplicate');
 let sends=0;await deliverWebsiteAcknowledgment(f.outbox,f.id,{configuration:()=>({key:'synthetic',from:message.from}),request:async()=>{sends++;throw Error('No resend');}});assert.equal(sends,0);
 const status=await f.outbox.status();assert.equal(status.items[0].provider_readback.state,'event_verified');assert.equal(status.items[0].provider_readback.contentReadbackVerified,false);
 assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM website_ack_webhooks')).rows[0].n,1);
 assert.ok(!JSON.stringify(status).includes(message.to));
});
test('signature binds exact raw bytes and SDK rejects stale signatures before database access',async t=>{
 const f=await fixture(t),raw=JSON.stringify(f.event);
 assert.equal((await f.handler(f.request(f.event,{raw:raw+' ',signedRaw:raw}))).status,400);
 assert.equal((await f.handler(f.request(f.event,{date:new Date(Date.now()-600000)}))).status,400);
 assert.equal((await f.handler(f.request(f.event,{raw:'x'.repeat(65537)}))).status,413);
 assert.equal((await f.handler(f.request(f.event,{contentType:'text/plain'}))).status,415);
 f.disable();assert.equal((await f.handler(f.request())).status,503);assert.equal(f.reads(),0);
});
test('unowned and tracking events are ignored without storing provider account mail',async t=>{
 const f=await fixture(t);
 const unrelated=structuredClone(f.event);unrelated.data.tags={};assert.equal(await (await f.handler(f.request(unrelated))).text(),'unowned');
 unrelated.type='email.opened';assert.equal((await f.handler(f.request(unrelated))).status,202);
 assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM website_ack_webhooks')).rows[0].n,0);
 assert.equal((await f.outbox.get(f.id)).state,'attempting');
});
test('wrong envelope, intent tags, timing or provider identity holds the owned attempt',async t=>{
 for(const change of [e=>e.data.to.push('other@example.invalid'),e=>{e.data.tags.bfc_ack_body='0'.repeat(64);},e=>{e.data.created_at='2020-01-01T00:00:00Z';},e=>{e.created_at='not-a-date';},e=>{e.data.template_id='unexpected';}]){
  const f=await fixture(t),bad=structuredClone(f.event);change(bad);
  assert.equal(await (await f.handler(f.request(bad))).text(),'requires_review');assert.equal((await f.outbox.get(f.id)).provider_id,null);
  assert.equal((await f.outbox.get(f.id)).blocked_reason,'ACK_WEBHOOK_BINDING_REVIEW');
 }
});
test('duplicate delivery IDs with changed payloads cannot replace original evidence',async t=>{
 const f=await fixture(t),id='msg_'+randomUUID();await f.handler(f.request(f.event,{id}));
 const changed=structuredClone(f.event);changed.type='email.sent';
 assert.equal((await f.handler(f.request(changed,{id}))).status,409);
 assert.equal((await f.outbox.get(f.id)).blocked_reason,'ACK_WEBHOOK_ID_COLLISION');
 assert.equal((await f.outbox.status()).items[0].provider_readback.providerEvent,'delivered');
});
test('out-of-order sent events do not hide later delivery and adverse history stays visible',async t=>{
 const f=await fixture(t);f.advance(60000);
 const bad=structuredClone(f.event);bad.type='email.bounced';bad.created_at=new Date(Date.parse(f.event.created_at)+30000).toISOString();
 await f.handler(f.request(bad));await f.handler(f.request({...f.event,type:'email.sent'}));
 let status=await f.outbox.status();assert.equal(status.items[0].provider_readback.providerEvent,'bounced');assert.equal(status.providerHistoryAlerts,1);
 const delivered=structuredClone(f.event);delivered.created_at=new Date(Date.parse(f.event.created_at)+60000).toISOString();await f.handler(f.request(delivered));
 status=await f.outbox.status();assert.equal(status.items[0].provider_readback.providerEvent,'delivered');assert.equal(status.items[0].provider_history_alert,true);
});
test('a webhook arriving before the POST response accepts the same receipt idempotently',async t=>{
 const f=await fixture(t);await f.handler(f.request());
 await f.outbox.accepted(f.id,f.claim.attempt_token,f.providerId,f.claim.message_hash);
 assert.equal((await f.outbox.get(f.id)).provider_id,f.providerId);
 await assert.rejects(f.outbox.accepted(f.id,f.claim.attempt_token,randomUUID(),f.claim.message_hash),/ACK_PROVIDER_ID_CONFLICT/);
 assert.equal((await f.outbox.get(f.id)).blocked_reason,'ACK_PROVIDER_ID_CONFLICT');
});
test('late signed evidence preserves original outcome after a source edit without granting a new send',async t=>{
 const f=await fixture(t);await f.outbox.uncertain(f.id,f.claim.attempt_token);await f.pg.query("UPDATE leads SET email='changed@example.invalid'");
 await f.handler(f.request());assert.equal((await f.outbox.get(f.id)).state,'accepted');assert.deepEqual(await f.outbox.pending(),[]);
 const saved=(await f.pg.query('SELECT * FROM website_ack_webhooks')).rows[0];assert.equal(saved.payload_hash,hash(JSON.stringify(f.event)));
 assert.ok(!JSON.stringify(saved).includes(message.to));assert.ok(!JSON.stringify(saved).includes(secret));
});
test('delivery arriving during POST survives a lost HTTP response without an uncertain caller result',async t=>{
 const f=await fixture(t,{start:false});let sends=0;
 const result=await deliverWebsiteAcknowledgment(f.outbox,f.id,{configuration:()=>({key:'synthetic',from:message.from}),request:async(_url,init)=>{
  sends++;const wire=JSON.parse(init.body);f.event.data.tags=Object.fromEntries(wire.tags.map(tag=>[tag.name,tag.value]));
  assert.equal(await (await f.handler(f.request())).text(),'event_verified');throw Error('Synthetic lost HTTP response');
 }});
 assert.deepEqual(result,{state:'accepted',providerId:f.providerId,delivered:false});assert.equal(sends,1);
 assert.equal((await f.outbox.get(f.id)).attempt_count,1);
});
test('conflicting HTTP receipt after a signed event reports review and cannot replace its provider ID',async t=>{
 const f=await fixture(t,{start:false});
 const result=await deliverWebsiteAcknowledgment(f.outbox,f.id,{configuration:()=>({key:'synthetic',from:message.from}),request:async(_url,init)=>{
  f.event.data.tags=Object.fromEntries(JSON.parse(init.body).tags.map(tag=>[tag.name,tag.value]));await f.handler(f.request());return Response.json({id:randomUUID()});
 }});
 assert.equal(result.state,'requires_review');assert.equal((await f.outbox.get(f.id)).provider_id,f.providerId);
 assert.equal((await f.outbox.get(f.id)).blocked_reason,'ACK_PROVIDER_ID_CONFLICT');
});
