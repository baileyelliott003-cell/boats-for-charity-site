import type { Config } from '@netlify/functions';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import { getRuntimeEnv } from '../../lib/runtime-env.js';
import { websiteAcknowledgments, acknowledgmentConfiguration } from '../../lib/netlify-submission.js';
import { ACK_SCHEMA_SQL, deliverWebsiteAcknowledgment } from '../../lib/acknowledgment-outbox.js';

// One bounded provider request per run. Publishing this function activates the
// schedule; the local draft does not create a production timer or send mail.
export default async () => {
  if (getRuntimeEnv('WEBSITE_ACK_RECOVERY_ENABLED') !== 'true' || acknowledgmentConfiguration().paused) return;
  // Do not run unrelated conversion/backfill migrations on a timer.
  await db.execute(sql.raw(ACK_SCHEMA_SQL));
  for (const row of await websiteAcknowledgments.pending(1)) {
    await deliverWebsiteAcknowledgment(websiteAcknowledgments, row.id, { configuration: acknowledgmentConfiguration });
  }
};
export const config: Config = { schedule: '*/5 * * * *' };
