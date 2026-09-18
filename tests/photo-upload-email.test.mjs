import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const out = await fs.mkdtemp(path.join(os.tmpdir(), 'bfc-photo-email-'));
const filename = path.join(out, 'email.mjs');
await build({entryPoints:[new URL('../lib/photo-upload-email.ts', import.meta.url).pathname],outfile:filename,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {buildPhotoEmail,sendPhotoUploadEmail,photoUrl}=await import(pathToFileURL(filename));
await fs.rm(out,{recursive:true,force:true});
const data={page_context:'boat-photo-upload',upload_id:'eae47d60-6c45-4bfd-86e5-a180be107808',photo_count:'2',first_name:'Bailey',last_name:'Test',phone:'5551234567',email:'donor@example.com',boat_details:'2006 Crest',photo_01:'https://files.example.com/one.jpg',photo_02:'https://files.example.com/two.heic'};
const env=k=>({RESEND_API_KEY:'test-key',FROM_EMAIL:'BFC <photos@boatsforcharity.org>'})[k];
const pause=async()=>{};
test('donor details and two attachments go only to the fixed inbox',()=>{
 const message=buildPhotoEmail({...data,to:'attacker@example.com'},env('FROM_EMAIL'));
 assert.deepEqual(message.to,['info.boatsforcharity@gmail.com']);assert.equal(message.attachments.length,2);
 assert.match(message.text,/5551234567/);assert.match(message.text,/2006 Crest/);assert.equal(message.reply_to,'donor@example.com');
 assert.match(message.attachments[1].filename,/02\.heic$/);
});
test('other forms send nothing and do not require email configuration',async()=>{
 await sendPhotoUploadEmail({page_context:'donate-a-boat'},{env:()=>undefined,fetch:()=>{throw Error('must not send')}});
 assert.equal(buildPhotoEmail({page_context:'donate-a-boat'},''),null);
});
test('invalid configuration/count/reference fail visibly',async()=>{
 await assert.rejects(sendPhotoUploadEmail(data,{env:()=>undefined}),/requires/);
 assert.throws(()=>buildPhotoEmail({...data,photo_count:'21'},'sender'),/count/);
 assert.throws(()=>buildPhotoEmail({...data,upload_id:'bad'},'sender'),/reference/);
});
test('reject unsafe URLs, strip header newlines and flag missing photos',()=>{
 for(const url of ['http://example.com/a.jpg','https://127.0.0.1/a.jpg','https://[::1]/a.jpg','https://x.local/a.jpg','https://a:b@example.com/a.jpg','file:///tmp/x.jpg'])assert.equal(photoUrl(url),null);
 const m=buildPhotoEmail({...data,first_name:'Bad\r\nBcc: x',photo_01:'http://example.com/a.jpg'},'sender');
 assert.doesNotMatch(m.subject,/[\r\n]/);assert.match(m.text,/ATTENTION/);assert.equal(m.attachments.length,1);
});
test('transient errors retry with the same idempotency key',async()=>{
 const calls=[];
 await sendPhotoUploadEmail(data,{env,pause,fetch:async(url,init)=>{calls.push(init);return new Response('{}',{status:calls.length===1?429:200})}});
 assert.equal(calls.length,2);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
});
test('attachment rejection sends explicit link fallback',async()=>{
 const calls=[];
 await sendPhotoUploadEmail(data,{env,pause,fetch:async(url,init)=>{calls.push(JSON.parse(init.body));return new Response(JSON.stringify({message:'Failed to download attachment'}),{status:calls.length===1?422:200})}});
 assert.equal(calls.length,2);assert.equal(calls[1].attachments,undefined);assert.match(calls[1].text,/could not attach/);assert.match(calls[1].text,/one.jpg/);
});
test('auth failures are not swallowed and do not trigger fallback',async()=>{
 let calls=0;await assert.rejects(sendPhotoUploadEmail(data,{env,pause,fetch:async()=>{calls++;return new Response('{}',{status:401})}}),/401/);assert.equal(calls,1);
});
test('network failures exhaust bounded retries without fallback',async()=>{
 let calls=0;await assert.rejects(sendPhotoUploadEmail(data,{env,pause,fetch:async()=>{calls++;throw Error('network')}}),/confirmed/);assert.equal(calls,3);
});
