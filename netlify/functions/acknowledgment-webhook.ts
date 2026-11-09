import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { getRuntimeEnv } from '../../lib/runtime-env.js';
import { websiteAcknowledgments } from '../../lib/netlify-submission.js';
import { ACK_SCHEMA_SQL } from '../../lib/acknowledgment-outbox.js';
import { acknowledgmentWebhookHandler } from '../../lib/acknowledgment-webhook.js';

// Disabled until this exact endpoint and its signing secret are configured.
export default acknowledgmentWebhookHandler({
  configuration: () => ({ enabled:getRuntimeEnv('WEBSITE_ACK_WEBHOOK_ENABLED')==='true', secret:getRuntimeEnv('RESEND_ACK_WEBHOOK_SECRET') }),
  outbox: async () => { await db.execute(sql.raw(ACK_SCHEMA_SQL)); return websiteAcknowledgments; },
});
export const config = { path:'/api/resend-acknowledgment-webhook' };
