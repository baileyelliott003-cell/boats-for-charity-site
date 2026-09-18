import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bfc-file-lookup-'));
await build({entryPoints:[new URL('../lib/photo-upload-files.ts',import.meta.url).pathname],outfile:path.join(dir,'files.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {resolvePhotoUploadFiles}=await import(pathToFileURL(path.join(dir,'files.mjs')));
await fs.rm(dir,{recursive:true,force:true});
const id='eae47d60-6c45-4bfd-86e5-a180be107808';
const url=`https://d33wubrfki0l68.cloudfront.net/example/${id}-01.jpg`;
const data={page_context:'boat-photo-upload',upload_id:id,photo_count:'1',first_name:'Test',last_name:'Donor',phone:'5551234567',boat_details:'Test boat',photo_01:id+'-01.jpg'};
const env=k=>({NETLIFY_FORMS_BACKFILL_TOKEN:'fake-token',SITE_ID:'site-123'})[k];
const json=(x,headers={})=>new Response(JSON.stringify(x),{status:200,headers});
test('filename-only event resolves exact saved submission and object URL',async()=>{
 let calls=0;const resolved=await resolvePhotoUploadFiles(data,{env,fetch:async(u,init)=>{
 assert.ok(u.startsWith('https://api.netlify.com/api/v1/'));assert.equal(init.redirect,'error');calls++;
 return calls===1?json([{name:'boatPhotoUpload',id:'form-123'}]):json([{data:{...data,photo_01:{url}}}]);
 }});assert.equal(resolved.photo_01,url);assert.equal(calls,2);
});
test('existing URL needs no token or API call',async()=>assert.equal((await resolvePhotoUploadFiles({...data,photo_01:url},{env:()=>undefined})).photo_01,url));
test('missing credential produces actionable non-secret error',async()=>assert.rejects(resolvePhotoUploadFiles(data,{env:()=>undefined}),/PHOTO_LOOKUP_TOKEN_MISSING/));
test('never match another donor even with same upload ID',async()=>{
 let i=0;await assert.rejects(resolvePhotoUploadFiles(data,{env,fetch:async()=>++i===1?json([{name:'boatPhotoUpload',id:'f'}]):json([{data:{...data,phone:'different',photo_01:{url}}}])}),/NOT_READY/);
});
test('follow pagination and validate filename association',async()=>{
 let i=0;const result=await resolvePhotoUploadFiles(data,{env,fetch:async()=>{
 i++;if(i===1)return json([{name:'boatPhotoUpload',id:'f'}]);
 if(i===2)return json([{data:{...data,photo_01:{url:'https://example.com/wrong.jpg'}}}],{link:'<https://api.netlify.com/api/v1/forms/f/submissions?page=2>; rel="next"'});
 return json([{data:{...data,photo_01:JSON.stringify({url})}}]);
 }});assert.equal(i,3);assert.equal(result.photo_01,url);
});
test('other forms bypass lookup',async()=>assert.deepEqual(await resolvePhotoUploadFiles({page_context:'donate-a-boat'}),{page_context:'donate-a-boat'}));
