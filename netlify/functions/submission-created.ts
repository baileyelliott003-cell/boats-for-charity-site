// netlify/functions/submission-created.ts
import type { Handler } from "@netlify/functions";
import { createNetlifySubmissionHandler } from "../../lib/netlify-submission.js";
import { runMigrations } from "../../db/migrate.js";

let migrated = false;
const baseHandler = createNetlifySubmissionHandler();

export const handler: Handler = async (event, context) => {
  if (!migrated) {
    try {
      await runMigrations();
      migrated = true;
    } catch (err) {
      console.warn("[submission-created] migration warning:", err);
    }
  }
  return baseHandler(event, context);
};
