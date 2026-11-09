import type { Config } from '@netlify/functions';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { getRuntimeEnv } from '../../lib/runtime-env.js';
import { websiteAcknowledgments } from '../../lib/netlify-submission.js';
import { ACK_SCHEMA_SQL } from '../../lib/acknowledgment-outbox.js';
import { inspectWebsiteAcknowledgment } from '../../lib/acknowledgment-provider.js';

// Independent read-only timer, disabled until its existing key's read scope and
// actual provider journey are verified. Never upgrades a key or sends an email.
export default async () => {
  const configuration = () => ({ key:getRuntimeEnv('RESEND_API_KEY'),enabled:getRuntimeEnv('WEBSITE_ACK_READBACK_ENABLED')==='true' });
  if (!configuration().enabled) return;
  await db.execute(sql.raw(ACK_SCHEMA_SQL));
  for (const row of await websiteAcknowledgments.providerReadbackCandidates(1)) await inspectWebsiteAcknowledgment(websiteAcknowledgments,row.id,{configuration});
};
export const config: Config = { schedule:'*/10 * * * *' };
