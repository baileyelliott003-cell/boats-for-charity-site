import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
let updatedCount = 0;

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, "utf-8");
  let changed = false;

  // Check if tracker script is included
  if (!content.includes('src="/tracker.v1.js"')) {
    if (content.includes('src="/script.v123.js"')) {
      content = content.replace(
        '<script defer src="/script.v123.js"></script>',
        '<script defer src="/tracker.v1.js"></script>\n  <script defer src="/script.v123.js"></script>'
      );
      changed = true;
    } else if (content.includes('</body>')) {
      content = content.replace('</body>', '  <script defer src="/tracker.v1.js"></script>\n</body>');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, "utf-8");
    updatedCount++;
  }
}

console.log(`[inject-tracker] Injected tracker.v1.js into ${updatedCount} pages.`);
