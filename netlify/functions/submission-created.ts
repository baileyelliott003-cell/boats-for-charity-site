import { createNetlifySubmissionHandler } from "../../lib/netlify-submission.js";
import { runMigrations } from "../../db/migrate.js";

let migrated = false;
const baseHandler = createNetlifySubmissionHandler();

export default async (req: Request) => {
  if (!migrated) {
    try {
      await runMigrations();
      migrated = true;
    } catch (err) {
      console.warn("[submission-created] migration warning:", err);
    }
  }

  const result = await baseHandler({ body: await req.text() });
  return new Response(result.body, {
    status: result.statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
