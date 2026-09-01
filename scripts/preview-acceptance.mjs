import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(process.argv[2] || "");
const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const productionUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const failures = [];

function count(value, pattern) {
  return (value.match(pattern) || []).length;
}

function textMatch(html, pattern) {
  return html.match(pattern)?.[1]?.trim() || "";
}

async function checkPage(productionUrl) {
  const expected = new URL(productionUrl);
  const previewUrl = new URL(expected.pathname + expected.search, base);
  const response = await fetch(previewUrl, { redirect: "follow" });
  const html = await response.text();
  const checks = {
    status: response.status === 200,
    title: Boolean(textMatch(html, /<title>([\s\S]*?)<\/title>/i)),
    description: Boolean(html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["'][^"']+["'][^>]*>/i)),
    h1: count(html, /<h1\b/gi) === 1,
    canonical: html.includes(`<link rel="canonical" href="${productionUrl}">`) || html.includes(`<link href="${productionUrl}" rel="canonical">`),
    tracker: count(html, /src=["']\/tracker\.v1\.js["']/g) === 1,
    clarity: count(html, /clarity\.ms\/tag\//g) === 1,
    googleLoader: count(html, /googletagmanager\.com\/gtag\/js\?id=GT-TNH3PWDV/g) === 1,
    ga4: count(html, /gtag\(['"]config['"],\s*['"]G-28FSWPQMQV['"]\)/g) === 1,
    googleAds: count(html, /gtag\(['"]config['"],\s*['"]AW-18239894267['"]\)/g) === 1,
    malformedSub: !html.includes('class="sub"&gt;'),
    noSecrets: !/GOOGLE_ADS_FEED_(?:USERNAME|PASSWORD)|DATABASE_URL|ADMIN_PASSWORD|RESEND_API_KEY/.test(html),
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) failures.push({ url: previewUrl.href, failed });
}

const queue = [...productionUrls];
await Promise.all(Array.from({ length: 12 }, async () => {
  while (queue.length) await checkPage(queue.shift());
}));

const rootResponse = await fetch(base, { redirect: "manual" });
const previewNoindex = /noindex/i.test(rootResponse.headers.get("x-robots-tag") || "");
if (!previewNoindex) failures.push({ url: base.href, failed: ["previewNoindex"] });

for (const endpoint of ["/api/dashboard?action=overview", "/api/export-conversions", "/api/visits", "/api/donate-clicks"]) {
  const response = await fetch(new URL(endpoint, base));
  if (response.status !== 401) failures.push({ url: new URL(endpoint, base).href, failed: [`expected401Got${response.status}`] });
}

for (const authorization of [null, "Basic aW52YWxpZDppbnZhbGlk"]) {
  const headers = authorization ? { authorization } : {};
  const response = await fetch(new URL("/api/google-ads-conversions-feed.csv", base), { headers });
  if (response.status !== 401) failures.push({ url: response.url, failed: [`feedExpected401Got${response.status}`] });
  for (const [header, pattern] of [["cache-control", /no-store/i], ["x-robots-tag", /noindex/i], ["x-content-type-options", /nosniff/i]]) {
    if (!pattern.test(response.headers.get(header) || "")) failures.push({ url: response.url, failed: [`feedHeader:${header}`] });
  }
}

const adminResponse = await fetch(new URL("/admin/dashboard", base));
const adminHtml = await adminResponse.text();
if (/donor@example|GOOGLE_ADS_FEED_PASSWORD|DATABASE_URL|RESEND_API_KEY/.test(adminHtml)) {
  failures.push({ url: adminResponse.url, failed: ["unauthenticatedDashboardData"] });
}

const result = {
  preview: base.href,
  testedSitemapUrls: productionUrls.length,
  uniqueSitemapUrls: new Set(productionUrls).size,
  sitemapExcludesThanks: !productionUrls.some((url) => new URL(url).pathname === "/thanks"),
  sitemapExcludesAdmin: !productionUrls.some((url) => new URL(url).pathname.startsWith("/admin")),
  failures,
};

fs.mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "artifacts", "preview-acceptance.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length || productionUrls.length !== new Set(productionUrls).size || !result.sitemapExcludesThanks || !result.sitemapExcludesAdmin) process.exitCode = 1;
