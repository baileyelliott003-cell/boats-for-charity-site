import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {PgDialect} from 'drizzle-orm/pg-core';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=await fs.mkdtemp(path.join(root,'.cache/hosted-migrations-'));
const entry=path.join(folder,'migrations.mjs');
await build({entryPoints:[path.join(root,'db/migrate.ts')],outfile:entry,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'test-database',setup(b){b.onLoad({filter:/[\\/]db[\\/]index\.ts$/},()=>({contents:'export const db=globalThis[Symbol.for("bfc.test.migration.database")];',loader:'ts'}));}}]});
test('hosted single-prepared-command migrations initialize and reopen schema without changing existing form records',async t=>{
  const pg=new PGlite();await pg.waitReady;t.after(()=>pg.close());
  const db=drizzle({client:pg});let calls=0;
  // PostgreSQL digest is supplied by pgcrypto in hosting. A SQL equivalent keeps
  // the isolated test independent of optional WebAssembly extensions.
  await pg.exec("CREATE FUNCTION digest(text,text) RETURNS bytea LANGUAGE SQL IMMUTABLE AS 'SELECT sha256(convert_to($1, ''UTF8''))';");
  const dialect=new PgDialect();
  globalThis[Symbol.for('bfc.test.migration.database')]={execute:async q=>{
    const text=dialect.sqlToQuery(q).sql.trim();
    // These reviewed migrations contain no quoted semicolons. Procedural blocks
    // are a single PostgreSQL statement and must retain their inner semicolons.
    if(!text.startsWith('DO $$'))assert(!text.replace(/;\s*$/,'').includes(';'),'hosted prepared transport rejects multiple commands');
    calls++;return db.execute(q);
  }};
  const {runMigrations}=await import(pathToFileURL(entry));
  await runMigrations();
  const tables=await pg.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  for(const name of ['leads','website_ack_outbox','website_ack_events','website_ack_webhooks'])assert(tables.rows.some(r=>r.table_name===name));
  await pg.query("INSERT INTO leads(netlify_submission_id,email,raw_form_data) VALUES('synthetic-preserved','synthetic@example.test','{\"boat_details\":\"original\"}')");
  await runMigrations();
  const r=await pg.query("SELECT raw_form_data FROM leads WHERE netlify_submission_id='synthetic-preserved'");
  assert.deepEqual(r.rows[0].raw_form_data,{boat_details:'original'});
  assert(calls>100);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM website_ack_outbox')).rows[0].n,0);
});
test.after(async()=>{delete globalThis[Symbol.for('bfc.test.migration.database')];await fs.rm(folder,{recursive:true,force:true});});
