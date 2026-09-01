import type { Handler } from "@netlify/functions";
import { createNetlifySubmissionHandler } from "../../lib/netlify-submission.js";

export const handler: Handler = createNetlifySubmissionHandler();
