import type { Config } from "@netlify/functions";
import { createAdminLogoutHandler } from "../../lib/admin-auth.js";

const handler = createAdminLogoutHandler();

export default async (request: Request) => handler(request);

export const config: Config = { path: "/api/admin-logout" };
