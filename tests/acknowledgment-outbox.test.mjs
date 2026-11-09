import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {sql} from 'drizzle-orm';
import {build} from 'esbuild';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const cache=fileURLToPath(new URL('../.cache/',import.meta.url));
await fs.mkdir(cache,{recursive:true});
const directory=await fs.mkdtemp(path.join(cache,'bfc-ack-tests-'));
const filename=path.join(directory,'outbox.mjs');
await build({stdin:{contents:"export * from './lib/acknowledgment-outbox.ts';export * from './lib/acknowledgment-provider.ts';",resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'ts'},outfile:filename,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'});
const {WebsiteAcknowledgmentOutbox,ACK_SCHEMA_SQL,deliverWebsiteAcknowledgment,acknowledgmentMessageHash,inspectWebsiteAcknowledgment}=await import(pathToFileURL(filename));
if(path.dirname(path.resolve(directory))!==path.resolve(cache)||!path.basename(directory).startsWith('bfc-ack-tests-'))throw Error('Unexpected test cleanup target');
await fs.rm(directory,{recursive:true,force:true});

const message={from:'BFC <no-reply@boatsforcharity.org>',to:'synthetic@example.com',subject:'Synthetic acknowledgment',html:'<p>Synthetic test only</p>'};
const source={netlifySubmissionId:'synthetic-001',formName:'donationForm',email:message.to,phone:'',rawFormData:{name:'Synthetic'}};
const receipt='11111111-2222-4333-8444-555555555555';
async function fixture(t){
 const pg=new PGlite();await pg.waitReady;t.after(()=>pg.close());
 await pg.exec('CREATE TABLE leads(id serial PRIMARY KEY,netlify_submission_id text UNIQUE,form_name text,email text,phone text,raw_form_data jsonb);'+ACK_SCHEMA_SQL);
 const database=drizzle({client:pg});let now=Date.parse('2026-11-04T12:00:00Z');
 const outbox=new WebsiteAcknowledgmentOutbox(database,()=>now);
 const seed=async(created=true,override={})=>database.transaction(async tx=>{
  const s={...source,...override};
  const result=await tx.execute(sql`INSERT INTO leads(netlify_submission_id,form_name,email,phone,raw_form_data) VALUES(${s.netlifySubmissionId},${s.formName},${s.email},${s.phone},${JSON.stringify(s.rawFormData)}::jsonb) ON CONFLICT(netlify_submission_id) DO UPDATE SET netlify_submission_id=excluded.netlify_submission_id RETURNING id`);
  return outbox.prepare(tx,s,result.rows[0].id,created,{...message,to:s.email});
 });
 return {pg,database,outbox,seed,advance:(ms=300001)=>{now+=ms;}};
}
test('durable intent and diagnostic event roll back with the parent transaction',async t=>{
 const f=await fixture(t);
 await assert.rejects(f.database.transaction(async tx=>{await tx.execute(sql`INSERT INTO leads(netlify_submission_id,form_name,email,phone,raw_form_data) VALUES(${source.netlifySubmissionId},${source.formName},${source.email},'',${JSON.stringify(source.rawFormData)}::jsonb)`);await f.outbox.prepare(tx,source,1,true,message);throw Error('synthetic rollback');}),/synthetic rollback/);
 for(const table of ['leads','website_ack_outbox','website_ack_events'])assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM '+table)).rows[0].n,0);
});
test('duplicate replay preserves the original intent and legacy imports never auto-send',async t=>{
 const f=await fixture(t);const id=await f.seed();assert.equal(await f.seed(false),id);
 assert.equal((await f.outbox.get(id)).state,'ready');
 const old=await f.seed(false,{netlifySubmissionId:'historical-001'});
 assert.equal((await f.outbox.get(old)).blocked_reason,'ACK_LEGACY_DELIVERY_UNVERIFIED');assert.equal(await f.outbox.claim(old),null);
});
test('missing credentials are visible without creating an attempt; pause sends nothing',async t=>{
 const f=await fixture(t),id=await f.seed();let calls=0;const request=async()=>{calls++;throw Error('must not send');};
 assert.equal((await deliverWebsiteAcknowledgment(f.outbox,id,{configuration:()=>({from:message.from}),request})).state,'connection_needed');
 assert.equal((await f.outbox.get(id)).attempt_count,0);assert.equal((await f.outbox.get(id)).last_error_code,'ACK_CONNECTION_NOT_CONFIGURED');
 assert.equal((await deliverWebsiteAcknowledgment(f.outbox,id,{configuration:()=>({from:message.from,key:'synthetic',paused:true}),request})).state,'paused');assert.equal(calls,0);
});
test('provider acceptance is durably recorded and repeat processing does not resend',async t=>{
 const f=await fixture(t),id=await f.seed();let calls=0;
 const options={configuration:()=>({from:message.from,key:'synthetic-not-a-real-key'}),request:async(url,init)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(init.redirect,'error');const wire=JSON.parse(init.body);assert.deepEqual({from:wire.from,to:wire.to,subject:wire.subject,html:wire.html},message);assert.equal(wire.text,'');assert.equal(wire.tags.length,4);assert.ok(init.headers['Idempotency-Key'].length<256);return Response.json({id:receipt});}};
 assert.deepEqual(await deliverWebsiteAcknowledgment(f.outbox,id,options),{state:'accepted',providerId:receipt,delivered:false});
 assert.equal((await f.outbox.get(id)).provider_id,receipt);assert.equal((await deliverWebsiteAcknowledgment(f.outbox,id,options)).state,'accepted');assert.equal(calls,1);
 const status=await f.outbox.status();assert.equal(status.delivered,false);assert.ok(!JSON.stringify(status).includes(message.to));assert.ok(!JSON.stringify(status).includes(message.html));
});
test('timeouts, rejected requests and invalid receipts remain uncertain and never replay',async t=>{
 for(const outcome of ['throw','reject','invalid']){
  const f=await fixture(t),id=await f.seed();let calls=0;
  const options={configuration:()=>({from:message.from,key:'synthetic'}),request:async()=>{calls++;if(outcome==='throw')throw Error('synthetic timeout');return outcome==='reject'?new Response('{}',{status:503}):Response.json({id:'bad'});}};
  assert.equal((await deliverWebsiteAcknowledgment(f.outbox,id,options)).state,'uncertain');f.advance();
  assert.equal((await deliverWebsiteAcknowledgment(f.outbox,id,options)).state,'uncertain');assert.equal(calls,1);assert.deepEqual(await f.outbox.pending(),[]);
 }
});
test('an abandoned pre-request claim can recover, but a stamped request cannot replay',async t=>{
 const f=await fixture(t),id=await f.seed(),first=await f.outbox.claim(id);
 assert.equal(await f.outbox.claim(id),null);f.advance();const second=await f.outbox.claim(id);
 assert.notEqual(first.attempt_token,second.attempt_token);assert.equal(await f.outbox.beginRequest(id,first.attempt_token,message.from),false);
 assert.equal(await f.outbox.beginRequest(id,second.attempt_token,message.from),true);f.advance();assert.equal(await f.outbox.claim(id),null);
 assert.equal((await f.outbox.get(id)).state,'uncertain');
 await f.outbox.accepted(id,second.attempt_token,receipt,acknowledgmentMessageHash(message));assert.equal((await f.outbox.get(id)).state,'accepted');
});
test('changed recipient/source or template is held without overwriting the frozen intent',async t=>{
 const f=await fixture(t),id=await f.seed();await f.pg.query('UPDATE leads SET email=$1',['different@example.com']);
 assert.equal(await f.outbox.claim(id),null);assert.equal((await f.outbox.get(id)).blocked_reason,'ACK_CURRENT_SOURCE_MISMATCH');assert.equal((await f.outbox.get(id)).message.to,message.to);
 const g=await fixture(t),other=await g.seed();await g.database.transaction(tx=>g.outbox.prepare(tx,source,1,false,{...message,subject:'Changed template'}));
 assert.equal(await g.outbox.claim(other),null);assert.equal((await g.outbox.get(other)).message.subject,message.subject);
});
test('database transport errors roll back a claim instead of mislabeling consent/source',async t=>{
 const f=await fixture(t),id=await f.seed();const original=f.outbox.sourceMatches;
 f.outbox.sourceMatches=async()=>{throw Error('synthetic database unavailable');};await assert.rejects(f.outbox.claim(id),/database unavailable/);
 assert.equal((await f.outbox.get(id)).state,'ready');assert.equal((await f.outbox.get(id)).blocked_reason,null);f.outbox.sourceMatches=original;assert.ok(await f.outbox.claim(id));
});
test('header injection and recipient arrays cannot become outbound intents',()=>{
 for(const bad of [{to:['a@example.com','b@example.com']},{from:'x@example.com\r\nBcc: x@example.com'},{subject:'Subject\nBcc: x'},{to:'bad@example.com,other@example.com'}])assert.throws(()=>acknowledgmentMessageHash({...message,...bad}),/ACK_MESSAGE_REVIEW/);
});
test('corrupted persisted message is held without calling the provider',async t=>{
 const f=await fixture(t),id=await f.seed();await f.pg.query("UPDATE website_ack_outbox SET message='null'::jsonb");
 assert.equal(await f.outbox.claim(id),null);assert.equal((await f.outbox.get(id)).blocked_reason,'ACK_CURRENT_SOURCE_MISMATCH');
});
test('simultaneous local claimers yield one owner and a stale token cannot record acceptance',async t=>{
 const f=await fixture(t),id=await f.seed();const claims=await Promise.all([f.outbox.claim(id),f.outbox.claim(id)]);assert.equal(claims.filter(Boolean).length,1);
 const owner=claims.find(Boolean);await f.outbox.beginRequest(id,owner.attempt_token,message.from);
 await assert.rejects(f.outbox.accepted(id,'stale-token',receipt,acknowledgmentMessageHash(message)),/ACK_RECEIPT_BINDING/);assert.equal((await f.outbox.get(id)).state,'attempting');
});
async function accepted(f,suffix='readback'){
 const id=await f.seed(true,{netlifySubmissionId:suffix}),claim=await f.outbox.claim(id),providerId=randomUUID();
 await f.outbox.beginRequest(id,claim.attempt_token,message.from);await f.outbox.accepted(id,claim.attempt_token,providerId,acknowledgmentMessageHash(message));
 return {id,providerId,snapshot:{object:'email',id:providerId,from:message.from,to:[message.to],subject:message.subject,html:message.html,text:null,cc:[],bcc:[],reply_to:[],scheduled_at:null,created_at:'2026-11-04 12:00:00.000000+00',last_event:'delivered'}};
}
const readerConfig=()=>({key:'synthetic-not-a-provider-key',enabled:true});
test('provider readback verifies exact frozen content using GET only and retains an append-only observation',async t=>{
 const f=await fixture(t),a=await accepted(f);assert.deepEqual(await f.outbox.providerReadbackCandidates(),[{id:a.id}]);let calls=0;
 const result=await inspectWebsiteAcknowledgment(f.outbox,a.id,{configuration:readerConfig,request:async(url,init)=>{calls++;assert.equal(url,'https://api.resend.com/emails/'+a.providerId);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.body,undefined);return Response.json(a.snapshot);}});
 assert.equal(result.contentReadbackVerified,true);assert.equal(result.providerEvent,'delivered');assert.equal((await f.outbox.get(a.id)).state,'accepted');assert.equal(calls,1);assert.deepEqual(await f.outbox.providerReadbackCandidates(),[]);
 const status=await f.outbox.status();assert.equal(status.items[0].provider_readback.providerEvent,'delivered');assert.equal(status.providerReadbackCounts[0].count,1);assert.ok(!JSON.stringify(status).includes(message.to));assert.ok(!JSON.stringify(status).includes(message.html));assert.equal(status.delivered,false);
 f.advance(3600001);assert.deepEqual(await f.outbox.providerReadbackCandidates(),[{id:a.id}]);
});
test('mismatched content, extra recipients, unknown events and timezone-less dates remain review issues',async t=>{
 const f=await fixture(t),changes=[{html:'Different message'},{to:[message.to,'other@example.com']},{cc:['other@example.com']},{id:randomUUID()},{last_event:'invented-delivery'},{created_at:'2026-11-04 12:00:00'}];
 for(let i=0;i<changes.length;i++){
  const a=await accepted(f,'mismatch-'+i),result=await inspectWebsiteAcknowledgment(f.outbox,a.id,{configuration:readerConfig,request:async()=>Response.json({...a.snapshot,...changes[i]})});
  assert.equal(result.state,'requires_review');assert.equal(result.contentReadbackVerified,false);assert.equal((await f.outbox.get(a.id)).state,'accepted');
 }
 assert.equal((await f.outbox.status()).providerReadbackCounts.reduce((n,r)=>n+r.count,0),changes.length);
});
test('disabled reads and missing receipts cannot search, guess or send another email',async t=>{
 const f=await fixture(t),id=await f.seed();let calls=0;const request=async()=>{calls++;throw Error('must not request');};
 assert.equal((await inspectWebsiteAcknowledgment(f.outbox,id,{configuration:()=>({enabled:false}),request})).state,'readback_disabled');
 assert.equal((await inspectWebsiteAcknowledgment(f.outbox,id,{configuration:readerConfig,request})).state,'receipt_required');assert.equal(calls,0);assert.equal((await f.outbox.get(id)).attempt_count,0);
});
test('read permissions, malformed/oversized bodies and network errors never downgrade acceptance or resend',async t=>{
 const f=await fixture(t);
 const responses=[async()=>new Response('{}',{status:403}),async()=>{throw Error('synthetic network outage');},async()=>new Response(new Uint8Array([255])),async()=>new Response('{bad-json'),async()=>new Response('x'.repeat(262145))];
 for(let i=0;i<responses.length;i++){
  const a=await accepted(f,'read-failure-'+i);let calls=0;const result=await inspectWebsiteAcknowledgment(f.outbox,a.id,{configuration:readerConfig,request:async(_,init)=>{calls++;assert.equal(init.method,'GET');return responses[i]();}});
  assert.equal(result.state,'requires_review');assert.equal(result.errorCode,i===0?'ACK_PROVIDER_READ_PERMISSION':'ACK_PROVIDER_READ_UNAVAILABLE');assert.equal(calls,1);assert.equal((await f.outbox.get(a.id)).attempt_count,1);assert.equal((await f.outbox.get(a.id)).state,'accepted');
 }
});
test('readback persistence failures propagate and an old request cannot attach proof to a different receipt',async t=>{
 const f=await fixture(t),a=await accepted(f);const original=f.outbox.recordProviderReadback;
 f.outbox.recordProviderReadback=async()=>{throw Error('synthetic database unavailable');};
 await assert.rejects(inspectWebsiteAcknowledgment(f.outbox,a.id,{configuration:readerConfig,request:async()=>Response.json(a.snapshot)}),/database unavailable/);
 f.outbox.recordProviderReadback=original;await f.pg.query('UPDATE website_ack_outbox SET provider_id=$1 WHERE id=$2',[randomUUID(),a.id]);
 await assert.rejects(f.outbox.recordProviderReadback(a.id,a.providerId,acknowledgmentMessageHash(message),a.snapshot,'0'.repeat(64)),/ACK_PROVIDER_READ_BINDING/);
 assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM website_ack_events WHERE observation IS NOT NULL')).rows[0].n,0);
});
test('later provider read failures retain earlier verified delivery evidence in history',async t=>{
 const f=await fixture(t),a=await accepted(f);await inspectWebsiteAcknowledgment(f.outbox,a.id,{configuration:readerConfig,request:async()=>Response.json({...a.snapshot,last_event:'bounced'})});
 await f.outbox.recordProviderReadFailure(a.id,a.providerId,acknowledgmentMessageHash(message),'ACK_PROVIDER_READ_UNAVAILABLE');
 const history=(await f.pg.query('SELECT observation FROM website_ack_events WHERE observation IS NOT NULL ORDER BY id')).rows;
 assert.equal(history.length,2);assert.equal(history[0].observation.providerEvent,'bounced');assert.equal(history[1].observation.state,'requires_review');assert.equal((await f.outbox.status()).items[0].provider_readback.state,'requires_review');
 await inspectWebsiteAcknowledgment(f.outbox,a.id,{configuration:readerConfig,request:async()=>Response.json({...a.snapshot,last_event:'opened'})});
 const status=await f.outbox.status();assert.equal(status.items[0].provider_readback.providerEvent,'opened');assert.equal(status.items[0].provider_history_alert,true);assert.equal(status.providerHistoryAlerts,1);
});
