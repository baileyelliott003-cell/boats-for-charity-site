import type { Config } from "@netlify/functions";
import { createWhatConvertsWebhookHandler } from "../../lib/whatconverts.js";

const handler = createWhatConvertsWebhookHandler();

export default async (request: Request) => handler(request);

export const config: Config = { path: "/api/whatconverts-webhook" };
