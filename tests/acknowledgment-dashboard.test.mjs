import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),cache=path.join(root,'.cache');await fs.mkdir(cache,{recursive:true});
const directory=await fs.mkdtemp(path.join(cache,'bfc-ack-dashboard-')),filename=path.join(directory,'dashboard.mjs');
let reads=0;const databaseObservation={migrations:0,execute:async()=>{reads++;return {rows:[]};}};globalThis[Symbol.for('bfc.synthetic.dashboard.db')]=databaseObservation;
const runtime=new Map();globalThis[Symbol.for('bfc.synthetic.dashboard.environment')]=runtime;
await build({stdin:{contents:"export {default as dashboard} from './netlify/functions/admin-dashboard.ts'; export {default as api} from './netlify/functions/dashboard-api.ts';export {default as recover} from './netlify/functions/acknowledgment-recovery.ts';export {default as inspect} from './netlify/functions/acknowledgment-readback.ts';export {default as webhook} from './netlify/functions/acknowledgment-webhook.ts';",resolveDir:root,loader:'ts'},outfile:filename,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'isolated-auth-database',setup(builder){
 builder.onLoad({filter:/[\\/]db[\\/]index\.ts$/},()=>({contents:'export const db=globalThis[Symbol.for("bfc.synthetic.dashboard.db")];',loader:'ts'}));
 builder.onLoad({filter:/[\\/]db[\\/]migrate\.ts$/},()=>({contents:'const observation=globalThis[Symbol.for("bfc.synthetic.dashboard.db")];export const runMigrations=async()=>{observation.migrations++;};',loader:'ts'}));
 builder.onLoad({filter:/[\\/]lib[\\/]admin-auth\.ts$/},()=>({contents:'export const authorizeAdminRequest=async req=>req.headers.get("X-Synthetic-Admin")==="yes"?{authorized:true}:{authorized:false,status:401,error:"Unauthorized"};',loader:'ts'}));
 builder.onLoad({filter:/[\\/]lib[\\/]runtime-env\.ts$/},()=>({contents:'const environment=globalThis[Symbol.for("bfc.synthetic.dashboard.environment")];export const getRuntimeEnv=key=>environment.get(key);',loader:'ts'}));
}}]});
const module=await import(pathToFileURL(filename));delete globalThis[Symbol.for('bfc.synthetic.dashboard.db')];delete globalThis[Symbol.for('bfc.synthetic.dashboard.environment')];
if(path.dirname(path.resolve(directory))!==path.resolve(cache)||!path.basename(directory).startsWith('bfc-ack-dashboard-'))throw Error('Unexpected test cleanup target');await fs.rm(directory,{recursive:true,force:true});
const request=(authorized=false)=>new Request('https://synthetic.invalid/api/dashboard?action=acknowledgment-status',{headers:authorized?{'X-Synthetic-Admin':'yes'}:{}});
test('acknowledgment status checks staff authorization before accessing email metadata',async()=>{
 const before=reads,response=await module.api(request(),{});assert.equal(response.status,401);assert.equal(reads,before);
 const allowed=await module.api(request(true),{});assert.equal(allowed.status,200);assert.equal(allowed.headers.get('cache-control'),'no-store');assert.equal((await allowed.json()).delivered,false);
});
test('staff status panel displays held/accepted outcomes safely and cannot retry email',async()=>{
 const html=await (await module.dashboard(request(true),{})).text();assert.match(html,/Acceptance does not confirm delivery/);
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);assert.equal(scripts.length,1);
 const nodes=new Map(),document={cookie:'',getElementById:id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:''});return nodes.get(id);}};
 const calls=[],context=vm.createContext({document,console,fetch:async(url,init)=>{calls.push({url,init});return Response.json({counts:[{state:'accepted',count:1},{state:'uncertain',count:2},{state:'ready',blocked_reason:'ACK_SOURCE_CHANGED',count:1}],items:[{lead_id:1,state:'accepted',attempt_count:1,updated_at:'synthetic'},{lead_id:2,state:'uncertain',last_error_code:'<script>bad()</script>',attempt_count:1,updated_at:'synthetic'}]});}});
 new vm.Script(scripts[0].replace('\n    loadData();\n','\n')).runInContext(context);await context.loadAcknowledgmentStatus();
 assert.match(nodes.get('ack-summary').textContent,/1 accepted by provider; 3 need review/);assert.match(nodes.get('ack-rows').innerHTML,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);assert.doesNotMatch(nodes.get('ack-rows').innerHTML,/<script>/);
 assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/dashboard?action=acknowledgment-status');assert.equal(calls[0].init.method,undefined);
 context.fetch=async()=>new Response('{}',{status:401});await context.loadAcknowledgmentStatus();assert.match(nodes.get('ack-summary').textContent,/Sign in again/);assert.equal(nodes.get('ack-rows').innerHTML,'');
});
test('both scheduled email functions stay inactive without their explicit deployment flags',async()=>{
 const before=reads;let requests=0;const original=globalThis.fetch;
 globalThis.fetch=async()=>{requests++;throw Error('must not use provider');};
 try { await module.recover();await module.inspect();assert.equal((await module.webhook(new Request('https://synthetic.invalid/api/resend-acknowledgment-webhook',{method:'POST',body:'{}'}))).status,503);runtime.set('WEBSITE_ACK_RECOVERY_ENABLED','false');runtime.set('WEBSITE_ACK_READBACK_ENABLED','false');await module.recover();await module.inspect(); }
 finally { globalThis.fetch=original;runtime.clear(); }
 assert.equal(reads,before);assert.equal(requests,0);
});

test('exact-submission history requires staff auth and its dedicated path never runs migrations',async()=>{const url='https://synthetic.invalid/api/dashboard?action=submission-contact-history&submissionId=synthetic-exact-001',before=reads,migrations=databaseObservation.migrations;const denied=await module.api(new Request(url),{});assert.equal(denied.status,401);assert.equal(reads,before);const allowed=await module.api(new Request(url,{headers:{'X-Synthetic-Admin':'yes'}}),{});assert.equal(allowed.status,200);assert.equal(allowed.headers.get('cache-control'),'no-store');const body=await allowed.json();assert.equal(body.state,'submission_not_found');assert.equal(body.priorContactAbsent,false);assert.equal(reads,before+1);assert.equal(databaseObservation.migrations,migrations);});
test('history source ambiguity and write methods are rejected before the database',async()=>{const before=reads,migrations=databaseObservation.migrations;for(const query of ['','&submissionId=a&submissionId=b','&submissionId=x%2Fy']){const r=await module.api(new Request('https://synthetic.invalid/api/dashboard?action=submission-contact-history'+query,{headers:{'X-Synthetic-Admin':'yes'}}),{});assert.equal(r.status,400);}const write=await module.api(new Request('https://synthetic.invalid/api/dashboard?action=submission-contact-history&submissionId=a',{method:'POST',headers:{'X-Synthetic-Admin':'yes'}}),{});assert.equal(write.status,405);assert.equal(write.headers.get('allow'),'GET');assert.equal(reads,before);assert.equal(databaseObservation.migrations,migrations);});

test('complete-controls query requires existing staff authorization and carries contact data in the body only',async()=>{const url='https://synthetic.invalid/api/dashboard?action=submission-contact-history-by-controls',before=reads,migrations=databaseObservation.migrations;const denied=await module.api(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{});assert.equal(denied.status,401);const invalid=await module.api(new Request(url,{method:'POST',headers:{'content-type':'application/json','X-Synthetic-Admin':'yes'},body:JSON.stringify({controls:{email:'synthetic@example.test'}})}),{});assert.equal(invalid.status,400);const wrongMethod=await module.api(new Request(url,{headers:{'X-Synthetic-Admin':'yes'}}),{});assert.equal(wrongMethod.status,405);assert.equal(wrongMethod.headers.get('allow'),'POST');assert.equal(reads,before);assert.equal(databaseObservation.migrations,migrations);});

test('scoped history connection does not create a staff session, migrate schema or grant dashboard access',async()=>{const token='bfc_hist_'+'a'.repeat(43),hash=createHash('sha256').update(token).digest('hex'),before=reads,migrations=databaseObservation.migrations;runtime.set('BFC_LOCAL_HISTORY_TOKEN_SHA256',hash);try{const headers={authorization:'Bearer '+token};const response=await module.api(new Request('https://boatsforcharity.org/api/dashboard?action=website-history-connection',{headers}),{});assert.equal(response.status,200);assert.equal((await response.json()).scope,'website_contact_history_read_only');assert.equal(reads,before);for(const action of ['overview','leads','acknowledgment-status'])assert.equal((await module.api(new Request('https://boatsforcharity.org/api/dashboard?action='+action,{headers}),{})).status,401);assert.equal((await module.api(new Request('https://deploy-preview-57--boatsforcharity.netlify.app/api/dashboard?action=website-history-connection',{headers}),{})).status,401);assert.equal(reads,before);assert.equal(databaseObservation.migrations,migrations);}finally{runtime.delete('BFC_LOCAL_HISTORY_TOKEN_SHA256');}});
