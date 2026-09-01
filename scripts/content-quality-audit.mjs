import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(process.argv[2] ?? SCRIPT_ROOT);
const REPORT_PATH = path.join(ROOT, "artifacts", "content-quality-audit.json");
const EDITORIAL_SIMILARITY_LIMIT = 0.35;
const WIDELY_REPEATED_EDITORIAL_PAGE_LIMIT = 7;

const ENTITY_MAP = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["quot", '"'],
  ["lt", "<"],
  ["gt", ">"],
  ["nbsp", " "],
  ["rsquo", "'"],
  ["lsquo", "'"],
  ["rdquo", '"'],
  ["ldquo", '"'],
  ["ndash", "-"],
  ["mdash", "-"],
]);

function decodeEntities(value) {
  return value
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) =>
      String.fromCodePoint(code[0].toLowerCase() === "x" ? Number.parseInt(code.slice(1), 16) : Number(code)),
    )
    .replace(/&([a-z]+);/gi, (match, name) => ENTITY_MAP.get(name.toLowerCase()) ?? match);
}

function text(value) {
  return decodeEntities(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function editorialHtml(value) {
  return value
    .replace(/<form\b[\s\S]*?<\/form>/gi, " ")
    .replace(/<section\b[^>]*class=["'][^"']*\b(?:donate|cta-band)\b[^"']*["'][^>]*>[\s\S]*?<\/section>/gi, " ")
    .replace(/<ul\b[^>]*class=["'][^"']*\btrust\b[^"']*["'][^>]*>[\s\S]*?<\/ul>/gi, " ")
    .replace(/<(p|div)\b[^>]*class=["'][^"']*\bprocess-note\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, " ");
}

function listHtml(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "artifacts"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listHtml(absolute));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(absolute);
  }
  return files;
}

function family(relative) {
  if (/^state-[a-z-]+\.html$/.test(relative)) return "state";
  if (/^city\/[^/]+\/index\.html$/.test(relative)) return "city";
  if (/^guides\/[^/]+\/index\.html$/.test(relative)) return "guide";
  if (["city/index.html", "guides/index.html", "boat-donation-by-city/index.html"].includes(relative)) return "hub";
  return "root";
}

function normalize(value, localTerms = []) {
  let normalized = value.toLowerCase();
  for (const term of [...localTerms].sort((a, b) => b.length - a.length)) {
    if (term.length < 3) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " PLACE ");
  }
  return normalized
    .replace(/\b\d+(?:[.,]\d+)?\b/g, " NUMBER ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shingleSet(value, size = 5) {
  const words = value.split(" ").filter(Boolean);
  const shingles = new Set();
  for (let index = 0; index <= words.length - size; index += 1) {
    shingles.add(words.slice(index, index + size).join(" "));
  }
  return shingles;
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function getMeta(html, selector, attribute = "name") {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html.match(new RegExp(`<meta\\s+[^>]*${attribute}=["']${escaped}["'][^>]*>`, "i"))?.[0];
  return tag?.match(/content=(["'])([\s\S]*?)\1/i)?.[2]?.trim() ?? "";
}

function getTitle(html) {
  return text(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
}

function localTermsFor(relative, html) {
  const h1 = text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const terms = ["Boats for Charity"];
  if (family(relative) === "state") {
    const state = h1.match(/(?:in|for)\s+(.+?)(?:\s*\||$)/i)?.[1];
    if (state) terms.push(state);
  }
  if (family(relative) === "city") {
    const match = h1.match(/in\s+(.+?),\s*(.+)$/i);
    if (match) terms.push(match[1], match[2]);
  }
  return terms;
}

const files = listHtml(ROOT)
  .map((absolute) => ({ absolute, relative: path.relative(ROOT, absolute).split(path.sep).join("/") }))
  .sort((a, b) => a.relative.localeCompare(b.relative));

const records = files.map(({ absolute, relative }) => {
  const html = fs.readFileSync(absolute, "utf8");
  const mainHtml = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? "";
  const mainEditorialHtml = editorialHtml(mainHtml);
  const localTerms = localTermsFor(relative, html);
  const blocks = [...mainHtml.matchAll(/<(p|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => ({ type: match[1].toLowerCase(), text: text(match[2]) }))
    .filter((block) => block.text);
  const prose = blocks.map((block) => block.text).join(" ");
  const editorialBlocks = [...mainEditorialHtml.matchAll(/<(p|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => ({ type: match[1].toLowerCase(), text: text(match[2]) }))
    .filter((block) => block.text);
  const editorialProse = editorialBlocks.map((block) => block.text).join(" ");
  const normalized = normalize(prose, localTerms);
  const editorialNormalized = normalize(editorialProse, localTerms);
  const title = getTitle(html);
  const description = getMeta(html, "description");
  const headings = blocks.filter((block) => ["h2", "h3"].includes(block.type)).map((block) => block.text);
  const structured = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const parsed = JSON.parse(match[1]);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [{ "@type": "INVALID_JSON_LD" }];
      }
    });
  const webPageDescriptions = structured
    .filter((item) => item?.["@type"] === "WebPage" && typeof item.description === "string")
    .map((item) => item.description);
  const risks = [];
  const riskPatterns = [
    ["charity-handles-movement", /\b(?:we|boats for charity)\s+(?:arrange|coordinate|handle|provide|schedule)[^.!?]{0,45}\b(?:pickup|transport|towing|movement|moving|storage)\b/gi],
    ["promised-movement", /\b(?:we|boats for charity)\s+(?:offer|offers|provide|provides|include|includes|guarantee|guarantees)[^.!?]{0,30}\b(?:free|guaranteed)?\s*(?:pickup|transport|towing|removal)\b/gi],
    ["implied-local-presence", /\b(?:our|a)\s+(?:local\s+)?(?:office|location|team)\s+(?:in|near|serving)\b/gi],
    ["tax-certainty", /\b(?:will|guaranteed to)\s+(?:qualify|get|receive)[^.!?]{0,35}\b(?:deduction|tax benefit)\b/gi],
    ["preacceptance-disqualification", /\b(?:rule(?:s)?\s+(?:a|the)\s+boat\s+out|disqualif(?:y|ies|ied|ying))\b/gi],
  ];
  for (const [name, pattern] of riskPatterns) {
    const matches = [...prose.matchAll(pattern)].map((match) => match[0]);
    if (matches.length) risks.push({ name, matches });
  }
  const repeatedHeadings = headings.filter((heading, index) => headings.indexOf(heading) !== index);
  return {
    relative,
    family: family(relative),
    title,
    description,
    wordCount: prose.split(/\s+/).filter(Boolean).length,
    blocks,
    editorialBlocks,
    headings,
    normalized,
    shingles: shingleSet(normalized),
    editorialNormalized,
    editorialShingles: shingleSet(editorialNormalized),
    invalidJsonLd: structured.some((item) => item?.["@type"] === "INVALID_JSON_LD"),
    schemaDescriptionMismatch: webPageDescriptions.some((item) => item !== description),
    webPageDescriptions,
    repeatedHeadings: [...new Set(repeatedHeadings)],
    risks,
  };
});

const duplicateBlocks = [];
const blockIndex = new Map();
for (const record of records) {
  for (const block of record.editorialBlocks) {
    if (block.type === "li" || block.text.split(/\s+/).length < 9) continue;
    const key = normalize(block.text, localTermsFor(record.relative, fs.readFileSync(path.join(ROOT, record.relative), "utf8")));
    if (!blockIndex.has(key)) blockIndex.set(key, { sample: block.text, pages: new Set() });
    blockIndex.get(key).pages.add(record.relative);
  }
}
for (const { sample, pages } of blockIndex.values()) {
  if (pages.size >= 3) duplicateBlocks.push({ count: pages.size, sample, pages: [...pages] });
}
duplicateBlocks.sort((a, b) => b.count - a.count || b.sample.length - a.sample.length);

const similarities = [];
const editorialSimilarities = [];
for (const groupName of ["state", "city", "guide"]) {
  const group = records.filter((record) => record.family === groupName);
  for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
      const score = jaccard(group[leftIndex].shingles, group[rightIndex].shingles);
      similarities.push({
        family: groupName,
        left: group[leftIndex].relative,
        right: group[rightIndex].relative,
        score: Number(score.toFixed(4)),
      });
      const editorialScore = jaccard(group[leftIndex].editorialShingles, group[rightIndex].editorialShingles);
      editorialSimilarities.push({
        family: groupName,
        left: group[leftIndex].relative,
        right: group[rightIndex].relative,
        score: Number(editorialScore.toFixed(4)),
      });
    }
  }
}
similarities.sort((a, b) => b.score - a.score);
editorialSimilarities.sort((a, b) => b.score - a.score);

const publicRecords = records.map(({ blocks, editorialBlocks, normalized, shingles, editorialNormalized, editorialShingles, ...record }) => record);
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    pages: records.length,
    byFamily: Object.fromEntries(
      [...new Set(records.map((record) => record.family))].map((name) => [name, records.filter((record) => record.family === name).length]),
    ),
    pagesWithRiskLanguage: records.filter((record) => record.risks.length).length,
    schemaDescriptionMismatches: records.filter((record) => record.schemaDescriptionMismatch).length,
    invalidJsonLd: records.filter((record) => record.invalidJsonLd).length,
    duplicateBlocksOnThreeOrMorePages: duplicateBlocks.length,
    widelyRepeatedEditorialBlocks: duplicateBlocks.filter((item) => item.count >= WIDELY_REPEATED_EDITORIAL_PAGE_LIMIT).length,
    statePairsAbove50Percent: similarities.filter((item) => item.family === "state" && item.score >= 0.5).length,
    cityPairsAbove50Percent: similarities.filter((item) => item.family === "city" && item.score >= 0.5).length,
    stateEditorialPairsAbove35Percent: editorialSimilarities.filter((item) => item.family === "state" && item.score >= EDITORIAL_SIMILARITY_LIMIT).length,
    cityEditorialPairsAbove35Percent: editorialSimilarities.filter((item) => item.family === "city" && item.score >= EDITORIAL_SIMILARITY_LIMIT).length,
    guideEditorialPairsAbove35Percent: editorialSimilarities.filter((item) => item.family === "guide" && item.score >= EDITORIAL_SIMILARITY_LIMIT).length,
  },
  duplicateBlocks,
  topSimilarities: similarities.slice(0, 250),
  topEditorialSimilarities: editorialSimilarities.slice(0, 250),
  pages: publicRecords,
};

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report.summary, null, 2));
console.log("\nMost repeated editorial blocks:");
for (const item of duplicateBlocks.slice(0, 12)) console.log(`${item.count} pages: ${item.sample.slice(0, 180)}`);
console.log("\nMost similar page pairs:");
for (const item of similarities.slice(0, 15)) console.log(`${item.family} ${item.score}: ${item.left} <> ${item.right}`);
console.log("\nMost similar editorial page pairs (forms, trust bars, and required policy notes excluded):");
for (const item of editorialSimilarities.slice(0, 15)) console.log(`${item.family} ${item.score}: ${item.left} <> ${item.right}`);
console.log(`\nFull report: ${path.relative(ROOT, REPORT_PATH)}`);

const releaseBlockers = [];
if (report.summary.pagesWithRiskLanguage) releaseBlockers.push(`${report.summary.pagesWithRiskLanguage} page(s) contain risky movement, local-presence, or tax language`);
if (report.summary.schemaDescriptionMismatches) releaseBlockers.push(`${report.summary.schemaDescriptionMismatches} schema description mismatch(es)`);
if (report.summary.invalidJsonLd) releaseBlockers.push(`${report.summary.invalidJsonLd} invalid JSON-LD block(s)`);
for (const familyName of ["state", "city", "guide"]) {
  const count = editorialSimilarities.filter((item) => item.family === familyName && item.score >= EDITORIAL_SIMILARITY_LIMIT).length;
  if (count) releaseBlockers.push(`${count} ${familyName} editorial pair(s) are at least 35% similar`);
}
const repeatedHeadingPages = records.filter((record) => record.repeatedHeadings.length);
if (repeatedHeadingPages.length) releaseBlockers.push(`${repeatedHeadingPages.length} page(s) repeat a heading`);
const widelyRepeatedEditorialBlocks = duplicateBlocks.filter((item) => item.count >= WIDELY_REPEATED_EDITORIAL_PAGE_LIMIT);
if (widelyRepeatedEditorialBlocks.length) {
  releaseBlockers.push(`${widelyRepeatedEditorialBlocks.length} editorial block(s) repeat across ${WIDELY_REPEATED_EDITORIAL_PAGE_LIMIT}+ pages`);
}

if (releaseBlockers.length) {
  console.error("\nContent release blockers:");
  for (const blocker of releaseBlockers) console.error(`- ${blocker}`);
  process.exit(1);
}

console.log("PASS: no content-risk, schema, repeated-heading, widely repeated editorial, or 35%+ editorial-similarity blockers.");
