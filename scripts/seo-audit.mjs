import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(process.argv[2] ?? SCRIPT_ROOT);
const errors = [];

const ROOT_ROUTES = new Map([
  ["donate-a-boat.html", "/donate-a-boat"],
  ["faq.html", "/faq"],
  ["boats-for-sale.html", "/boats-for-sale"],
  ["hin-lookup.html", "/hin-lookup"],
  ["boat-donation-by-state.html", "/boat-donation-by-state"],
  ["thanks.html", "/thanks"],
]);

const toPosix = (value) => value.split(path.sep).join("/");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

function listFiles(directory, predicate = () => true) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(absolute, predicate));
    if (entry.isFile() && predicate(absolute)) found.push(absolute);
  }
  return found;
}

function preferredRoute(relative) {
  const file = toPosix(relative);
  if (file === "index.html") return "/";
  if (ROOT_ROUTES.has(file)) return ROOT_ROUTES.get(file);
  if (/^state-[a-z-]+\.html$/.test(file)) return `/${file.slice(0, -5)}`;
  if (/^city\/[^/]+\/index\.html$/.test(file)) return `/${file.replace(/index\.html$/, "")}`;
  if (file === "guides/index.html") return "/guides/";
  if (/^guides\/[^/]+\/index\.html$/.test(file)) return `/${file.replace(/index\.html$/, "")}`;
  if (file === "boat-donation-by-city/index.html") return "/boat-donation-by-city/";
  return null;
}

function addError(message) {
  errors.push(message);
}

const htmlFiles = listFiles(ROOT, (file) => file.endsWith(".html"))
  .map((file) => toPosix(path.relative(ROOT, file)))
  .sort();
const preferredFiles = htmlFiles.filter((file) => preferredRoute(file));

const forms = [];

for (const file of preferredFiles) {
  const html = read(file);
  
  if (!html.includes('src="/styles.v142.css"')) {
    addError(`${file}: expected styles.v142.css`);
  }
  
  if (file !== "thanks.html") {
    if (!html.includes('src="/tracker.v1.js"')) {
      addError(`${file}: missing tracker.v1.js`);
    }
    if (!html.includes('src="/script.v123.js"')) {
      addError(`${file}: missing script.v123.js`);
    }
    if (!html.includes('tracking.whatconverts.com/scripts/wc.js')) {
      addError(`${file}: missing WhatConverts tracking script`);
    }
  }

  for (const match of html.matchAll(/<form\b[\s\S]*?<\/form>/gi)) {
    if (/name=["']donationForm["']/i.test(match[0])) forms.push({ file, html: match[0] });
  }
}

// Verify forms
for (const { file, html } of forms) {
  const required = [
    /name=["']donationForm["']/i,
    /data-netlify=["']true["']/i,
    /netlify-honeypot=["']bot-field["']/i,
    /action=["']\/thanks["']/i,
    /name=["']first_name["']/i,
    /name=["']last_name["']/i,
    /name=["']phone["']/i,
  ];
  if (required.some((exp) => !exp.test(html))) {
    addError(`${file}: donation form contract is incomplete`);
  }
}

if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log(`PASS: All ${preferredFiles.length} pages verified for tracker, WhatConverts, and SEO integrity.`);
