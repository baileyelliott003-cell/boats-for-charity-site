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
let updated = 0;

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, "utf-8");
  let changed = false;

  // 1. Ensure Google Ads AW-18239894267 config is added to existing gtag loader
  if (!content.includes("gtag('config', 'AW-18239894267');")) {
    if (content.includes("gtag('config', 'G-28FSWPQMQV');")) {
      content = content.replace(
        "gtag('config', 'G-28FSWPQMQV');",
        "gtag('config', 'G-28FSWPQMQV');\n  gtag('config', 'AW-18239894267');"
      );
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, "utf-8");
    updated++;
  }
}

console.log(`Updated ${updated} HTML files with Google Ads destination AW-18239894267.`);
