import type { Config, Context } from "@netlify/functions";
import { createPublicEventHandler } from "../../lib/public-events.js";

const handler = createPublicEventHandler();

export default async (request: Request, context: Context) => handler(request, context);

export const config: Config = { path: "/api/track-event" };
