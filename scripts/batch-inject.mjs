import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOOGLE_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GT-TNH3PWDV"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-28FSWPQMQV');
  gtag('config', 'AW-18239894267');
</script>`;

const CLARITY_TAG = `<script>
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "x7aygvaxhx");
</script>`;

const PARTNER_TAG = `<script src="//s.ksrndkehqnwntyxlhgto.com/174339.js"></script>`;

console.log("[batch-inject] Installing first-party tracking and Google Ads configuration across public HTML files...");

function listHtml(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "artifacts"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listHtml(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

const htmlFiles = listHtml(ROOT);
let trackerNormalized = 0;
let analyticsNormalized = 0;
let placeholdersRemoved = 0;
let filesUpdated = 0;

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, "utf-8");
  let changed = false;
  const relative = path.relative(ROOT, file).replaceAll(path.sep, "/");

  const withoutPlaceholder = content.replace(/\s*<script[^>]+tracking\.whatconverts\.com\/scripts\/wc\.js[^>]*><\/script>/gi, "");
  if (withoutPlaceholder !== content) {
    content = withoutPlaceholder;
    changed = true;
    placeholdersRemoved++;
  }

  if (relative === "admin/index.html" || relative === "google776ef470e4863026.html") {
    const withoutTracker = content.replace(/\s*<script[^>]+src="\/tracker\.v1\.js"[^>]*><\/script>/gi, "");
    if (withoutTracker !== content) {
      content = withoutTracker;
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(file, content, "utf-8");
      filesUpdated++;
    }
    continue;
  }

  const withoutAnalytics = content
    .replace(/\s*(?:<!--\s*Google tag \(gtag\.js\)\s*-->\s*)?<script\b[^>]*src=["']https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"']+["'][^>]*>\s*<\/script>/gi, "")
    .replace(/\s*<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi, (match, body) => {
      if (body.includes("gtag('js', new Date())") && body.includes("function gtag")) return "";
      if (body.includes("clarity.ms/tag/") && body.includes('"x7aygvaxhx"')) return "";
      return match;
    });
  if (withoutAnalytics !== content) {
    content = withoutAnalytics;
    changed = true;
  }
  if (content.includes("<head>")) {
    content = content.replace("<head>", `<head>\n${GOOGLE_TAG}\n\n${CLARITY_TAG}`);
    changed = true;
    analyticsNormalized++;
  }

  const withoutPartnerTag = content.replace(/\s*<script\b[^>]*src=["'](?:https?:)?\/\/s\.ksrndkehqnwntyxlhgto\.com\/174339\.js["'][^>]*>\s*<\/script>/gi, "");
  if (withoutPartnerTag !== content) {
    content = withoutPartnerTag;
    changed = true;
  }
  if (content.includes("</head>")) {
    content = content.replace("</head>", `  ${PARTNER_TAG}\n</head>`);
    changed = true;
  }

  content = content.replace(/<button\b(?![^>]*\btype=)([^>]*\bclass=["'][^"']*\b(?:menu-toggle|hamburger)\b[^"']*["'][^>]*)>/gi, '<button type="button"$1>');

  const withoutTrackers = content.replace(/\s*<script\b[^>]*src=["']\/tracker\.v1\.js["'][^>]*>\s*<\/script>/gi, "");
  if (withoutTrackers !== content) {
    content = withoutTrackers;
    changed = true;
  }
  if (content.includes("</body>")) {
    content = content.replace("</body>", '  <script defer src="/tracker.v1.js"></script>\n</body>');
    changed = true;
    trackerNormalized++;
  }

  if (changed) {
    fs.writeFileSync(file, content, "utf-8");
    filesUpdated++;
  }
}

console.log(`[batch-inject] Completed: ${analyticsNormalized} Google/Clarity blocks normalized, ${trackerNormalized} trackers normalized, ${placeholdersRemoved} generic WhatConverts placeholders removed, ${filesUpdated} files updated.`);
