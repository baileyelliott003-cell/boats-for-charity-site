import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("[batch-inject] Installing first-party tracking across public HTML files...");

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
let placeholdersRemoved = 0;

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

  if (relative === "admin/index.html") {
    const withoutTracker = content.replace(/\s*<script[^>]+src="\/tracker\.v1\.js"[^>]*><\/script>/gi, "");
    if (withoutTracker !== content) {
      content = withoutTracker;
      changed = true;
    }
    if (changed) fs.writeFileSync(file, content, "utf-8");
    continue;
  }

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

  if (changed) {
    fs.writeFileSync(file, content, "utf-8");
  }
}

console.log(`[batch-inject] Completed: tracker added to ${trackerUpdated} files; ${placeholdersRemoved} generic WhatConverts placeholders removed.`);
