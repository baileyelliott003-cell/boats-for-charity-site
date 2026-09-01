import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("[batch-inject] Running comprehensive Sitewide Injection for tracker.v1.js & WhatConverts across all HTML files...");

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
const WHATCONVERTS_TAG = `  <script src="//tracking.whatconverts.com/scripts/wc.js" async></script>`;

let trackerUpdated = 0;
let wcUpdated = 0;

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, "utf-8");
  let changed = false;

  // 1. Inject tracker.v1.js
  if (!content.includes('src="/tracker.v1.js"')) {
    if (content.includes('src="/script.v123.js"')) {
      content = content.replace(
        '<script defer src="/script.v123.js"></script>',
        '<script defer src="/tracker.v1.js"></script>\n  <script defer src="/script.v123.js"></script>'
      );
      changed = true;
      trackerUpdated++;
    } else if (content.includes('</body>')) {
      content = content.replace('</body>', '  <script defer src="/tracker.v1.js"></script>\n</body>');
      changed = true;
      trackerUpdated++;
    }
  }

  // 2. Inject WhatConverts official script in <head>
  if (!content.includes('tracking.whatconverts.com/scripts/wc.js')) {
    if (content.includes('</head>')) {
      content = content.replace('</head>', `${WHATCONVERTS_TAG}\n</head>`);
      changed = true;
      wcUpdated++;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, "utf-8");
  }
}

console.log(`[batch-inject] Completed: Injected tracker into ${trackerUpdated} files, WhatConverts into ${wcUpdated} files across ${htmlFiles.length} total HTML pages.`);
