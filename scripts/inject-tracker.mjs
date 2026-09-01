import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WHATCONVERTS_SNIPPET = `<script src="//tracking.whatconverts.com/scripts/wc.js" async></script>`;

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
let trackerUpdated = 0;
let wcUpdated = 0;

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, "utf-8");
  let changed = false;

  // 1. Ensure tracker.v1.js is included
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

  // 2. Ensure official WhatConverts script tag is installed in <head>
  if (!content.includes('tracking.whatconverts.com/scripts/wc.js')) {
    if (content.includes('</head>')) {
      content = content.replace('</head>', `  ${WHATCONVERTS_SNIPPET}\n</head>`);
      changed = true;
      wcUpdated++;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, "utf-8");
  }
}

console.log(`[inject-tracker] Processed ${htmlFiles.length} HTML files: tracker updated in ${trackerUpdated}, WhatConverts script injected in ${wcUpdated}.`);
