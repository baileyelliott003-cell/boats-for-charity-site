import type { Config, Context } from "@netlify/functions";
import { createAdminLoginHandler } from "../../lib/admin-auth.js";

const handler = createAdminLoginHandler();

export default async (request: Request, context: Context) => handler(request, context);

export const config: Config = { path: "/api/admin-login" };
