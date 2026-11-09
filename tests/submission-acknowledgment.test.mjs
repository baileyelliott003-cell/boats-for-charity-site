import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {getTableConfig} from 'drizzle-orm/pg-core';
import {PgDialect} from 'drizzle-orm/pg-core';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),cache=path.join(root,'.cache');await fs.mkdir(cache,{recursive:true});
const directory=await fs.mkdtemp(path.join(cache,'bfc-submission-tests-')),filename=path.join(directory,'handler.mjs');
await build({stdin:{contents:`export * from './lib/netlify-submission.ts'; export * from './lib/acknowledgment-outbox.ts'; export {leads,visitors,sessions,events} from './db/schema.ts';`,resolveDir:root,loader:'ts'},outfile:filename,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'isolated-test-database',setup(builder){builder.onLoad({filter:/[\\/]db[\\/]index\.ts$/},()=>({contents:'export const db = globalThis[Symbol.for("bfc.website.synthetic.database")];',loader:'ts'}));}}]});
let iteration=0;
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const literal=(value,dialect)=>typeof value?.toQuery==='function'?dialect.sqlToQuery(value).sql:typeof value==='object'?"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb":typeof value==='string'?"'"+value.replaceAll("'","''")+"'":String(value);
async function fixture(t){
 const pg=new PGlite();await pg.waitReady;t.after(()=>pg.close());const database=drizzle({client:pg});
 globalThis[Symbol.for('bfc.website.synthetic.database')]=database;
 const module=await import(pathToFileURL(filename).href+'?fixture='+iteration++);delete globalThis[Symbol.for('bfc.website.synthetic.database')];
 const dialect=new PgDialect();
 // Use the production Drizzle column types/defaults, in an in-memory Postgres
 // database. Production connection discovery is replaced before module load.
 for(const table of [module.visitors,module.sessions,module.events,module.leads]){
  const config=getTableConfig(table),columns=config.columns.map(c=>quote(c.name)+' '+c.getSQLType()+(c.primary?' PRIMARY KEY':'')+(c.notNull?' NOT NULL':'')+(c.default===undefined?'':' DEFAULT '+literal(c.default,dialect)));
  await pg.exec('CREATE TABLE '+quote(config.name)+'('+columns.join(',')+')');
 }
 await pg.exec('CREATE UNIQUE INDEX leads_submission_test_unique ON leads(netlify_submission_id);'+module.ACK_SCHEMA_SQL);
 return {...module,pg,database};
}
const payload=(id='synthetic-form-001',form='donationForm')=>JSON.stringify({payload:{id,form_name:form,data:{email:'synthetic@example.com',first_name:'Synthetic',boat_details:'Synthetic test only'}}});
const config=()=>({from:'BFC <no-reply@boatsforcharity.org>',key:undefined,paused:false});
test('real lead repository atomically saves an intent and duplicate handler retries do not lose it',async t=>{
 const f=await fixture(t);let calls=0;
 const handler=f.createNetlifySubmissionHandler({configuration:config,deliverAcknowledgment:async id=>{calls++;return f.deliverWebsiteAcknowledgment(f.websiteAcknowledgments,id,{configuration:config});}});
 const first=await handler({body:payload()}),second=await handler({body:payload()});
 assert.equal(first.statusCode,200);assert.equal(JSON.parse(first.body).acknowledgment,'connection_needed');assert.equal(JSON.parse(second.body).duplicate,true);assert.equal(calls,2);
 assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM leads')).rows[0].n,1);
 assert.equal((await f.pg.query('SELECT state,last_error_code FROM website_ack_outbox')).rows[0].last_error_code,'ACK_CONNECTION_NOT_CONFIGURED');
});
test('historical import has no outgoing intent and later duplicate stays held',async t=>{
 const f=await fixture(t),submission=f.normalizeNetlifySubmission(payload());await f.postgresNetlifySubmissionRepository.createLead(submission);
 assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM website_ack_outbox')).rows[0].n,0);
 const handler=f.createNetlifySubmissionHandler({configuration:config,deliverAcknowledgment:async id=>({state:(await f.websiteAcknowledgments.get(id)).state})});
 assert.equal(JSON.parse((await handler({body:payload()})).body).acknowledgment,'blocked');
 assert.equal((await f.pg.query('SELECT blocked_reason FROM website_ack_outbox')).rows[0].blocked_reason,'ACK_LEGACY_DELIVERY_UNVERIFIED');
});
test('intent failure rolls back the newly inserted lead; delivery failure leaves it saved',async t=>{
 const f=await fixture(t),prepare=f.websiteAcknowledgments.prepare;f.websiteAcknowledgments.prepare=async()=>{throw Error('synthetic intent storage failure');};
 const handler=f.createNetlifySubmissionHandler({configuration:config,deliverAcknowledgment:async()=>{throw Error('synthetic delivery failure');}});
 assert.equal((await handler({body:payload()})).statusCode,500);assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM leads')).rows[0].n,0);
 f.websiteAcknowledgments.prepare=prepare;const result=await handler({body:payload()});assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).acknowledgment,'saved_requires_review');assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM leads')).rows[0].n,1);
});
test('photo-upload submissions do not trigger donor acknowledgments',async t=>{
 const f=await fixture(t);const handler=f.createNetlifySubmissionHandler({configuration:config,deliverAcknowledgment:async()=>{throw Error('must not send');}});
 assert.equal(JSON.parse((await handler({body:payload('synthetic-photo-001','boatPhotoUpload')})).body).acknowledgment,'not_applicable');assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM website_ack_outbox')).rows[0].n,0);
});
test.after(async()=>{if(path.dirname(path.resolve(directory))!==path.resolve(cache)||!path.basename(directory).startsWith('bfc-submission-tests-'))throw Error('Unexpected test cleanup target');await fs.rm(directory,{recursive:true,force:true});});
