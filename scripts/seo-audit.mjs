import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://boatsforcharity.org";
const errors = [];
const warnings = [];

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

function stripMarkup(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inlineText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&apos;|&rsquo;|&lsquo;|&#8217;|&#8216;|&#39;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuestion(value) {
  return inlineText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

const htmlFiles = listFiles(ROOT, (file) => file.endsWith(".html"))
  .map((file) => toPosix(path.relative(ROOT, file)))
  .sort();
const preferredFiles = htmlFiles.filter((file) => preferredRoute(file));
const preferredRoutes = new Set(preferredFiles.map((file) => preferredRoute(file)));
const indexableFiles = preferredFiles.filter((file) => file !== "thanks.html");
const indexableRoutes = new Set(indexableFiles.map((file) => preferredRoute(file)));

const titles = new Map();
const descriptions = new Map();
const forms = [];
const cityFiles = preferredFiles.filter((file) => file.startsWith("city/"));
let canonicalPasses = 0;
let metadataPasses = 0;
let schemaPasses = 0;
let contentPasses = 0;

for (const file of preferredFiles) {
  const html = read(file);
  const route = preferredRoute(file);
  const expected = `${ORIGIN}${route}`;
  const titleMatches = [...html.matchAll(/<title>([^<]*)<\/title>/gi)];
  const descriptionMatches = [...html.matchAll(/<meta\s+name=["']description["'][^>]*\scontent=(["'])(.*?)\1[^>]*>/gi)];
  const canonicalMatches = [...html.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/gi)];
  const ogUrlMatches = [...html.matchAll(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["'][^>]*>/gi)];
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  if (!/<link\s+rel=["']stylesheet["']\s+href=["']\/?styles\.v142\.css["']/i.test(html)) {
    addError(`${file}: expected the reviewed styles.v142.css asset`);
  }
  if (file !== "thanks.html" && !/<script\b[^>]*src=["']\/script\.v123\.js["'][^>]*><\/script>/i.test(html)) {
    addError(`${file}: expected the reviewed script.v123.js asset`);
  }
  if (/script\.v123\.js/i.test(html) && /track\.v1\.js/i.test(html)) {
    addError(`${file}: loads both donate trackers and would double-count CTA clicks`);
  }
  const contentPageNeedsNavigation = file.startsWith("city/") || file.startsWith("guides/") || file === "boat-donation-by-city/index.html";
  if (contentPageNeedsNavigation) {
    if (!/id=["']menuToggle["']/i.test(html) || !/id=["']primaryNav["']/i.test(html)) {
      addError(`${file}: content-page navigation controls are missing`);
    }
  }

  if (titleMatches.length !== 1 || !titleMatches[0][1].trim()) addError(`${file}: expected one non-empty title`);
  if (descriptionMatches.length !== 1 || descriptionMatches[0][2].trim().length < 70) {
    addError(`${file}: expected one useful meta description (70+ characters)`);
  }
  if (h1Count !== 1) addError(`${file}: expected exactly one H1, found ${h1Count}`);
  if (titleMatches.length === 1 && (titleMatches[0][1].trim().length < 30 || titleMatches[0][1].trim().length > 65)) {
    addError(`${file}: title length must be 30–65 characters`);
  }
  if (descriptionMatches.length === 1 && (descriptionMatches[0][2].trim().length < 110 || descriptionMatches[0][2].trim().length > 165)) {
    addError(`${file}: meta description length must be 110–165 characters`);
  }
  if (canonicalMatches.length !== 1 || canonicalMatches[0][1] !== expected) {
    addError(`${file}: canonical must be ${expected}`);
  } else {
    canonicalPasses += 1;
  }
  if (ogUrlMatches.length !== 1 || ogUrlMatches[0][1] !== expected) {
    addError(`${file}: og:url must match the canonical ${expected}`);
  }
  for (const property of ["og:title", "og:description", "og:site_name"]) {
    if (!new RegExp(`<meta\\s+property=["']${property}["']`, "i").test(html)) {
      addError(`${file}: missing ${property}`);
    }
  }
  if (
    titleMatches.length === 1 &&
    descriptionMatches.length === 1 &&
    h1Count === 1 &&
    ogUrlMatches.length === 1
  ) {
    metadataPasses += 1;
  }

  const title = titleMatches[0]?.[1]?.trim();
  const description = descriptionMatches[0]?.[2]?.trim();
  if (file !== "thanks.html") {
    if (titles.has(title)) addError(`${file}: duplicate title also used by ${titles.get(title)}`);
    else titles.set(title, file);
    if (descriptions.has(description)) addError(`${file}: duplicate description also used by ${descriptions.get(description)}`);
    else descriptions.set(description, file);
  }

  const schemaBlocks = [...html.matchAll(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  const visibleAnswers = new Map();
  for (const match of html.matchAll(/<(h3|summary)\b[^>]*>([\s\S]*?)<\/\1>\s*<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    visibleAnswers.set(normalizeQuestion(match[2]), inlineText(match[3]));
  }
  let schemaValid = true;
  for (const block of schemaBlocks) {
    try {
      const parsed = JSON.parse(block[1]);
      if (JSON.stringify(parsed).includes('"@type":"LocalBusiness"')) {
        addError(`${file}: LocalBusiness schema is not supported by a real office`);
        schemaValid = false;
      }
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        if (item["@type"] === "FAQPage" && Array.isArray(item.mainEntity)) {
          for (const question of item.mainEntity) {
            const questionName = question?.name || "";
            const answer = question?.acceptedAnswer?.text;
            const visible = visibleAnswers.get(normalizeQuestion(questionName));
            if (typeof answer !== "string" || !visible) {
              addError(`${file}: FAQ schema question is missing a matching visible answer: ${questionName}`);
              schemaValid = false;
            } else if (/&(?:quot|amp|apos|rsquo|lsquo|rdquo|ldquo|ndash|mdash);/i.test(answer)) {
              addError(`${file}: FAQ schema answer contains an HTML entity instead of decoded text: ${questionName}`);
              schemaValid = false;
            } else if (inlineText(answer) !== visible) {
              addError(`${file}: FAQ schema answer differs from visible copy: ${questionName}`);
              schemaValid = false;
            }
          }
        }
        for (const value of Object.values(item)) {
          if (Array.isArray(value)) queue.push(...value.filter((entry) => entry && typeof entry === "object"));
          else if (value && typeof value === "object") queue.push(value);
        }
      }
    } catch (error) {
      addError(`${file}: invalid JSON-LD (${error.message})`);
      schemaValid = false;
    }
  }
  if (schemaBlocks.length && schemaValid) schemaPasses += 1;
  if (!schemaBlocks.length && file !== "thanks.html") addWarning(`${file}: no structured data block`);

  const text = stripMarkup(html);
  const mainHtml = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const mainText = stripMarkup(mainHtml);
  const words = mainText ? mainText.split(/\s+/).length : 0;
  const minimum = file.startsWith("state-") ? 500 : file.startsWith("city/") ? 625 : file.startsWith("guides/") ? 300 : 100;
  if (file !== "thanks.html" && words < minimum) {
    addWarning(`${file}: ${words} visible words; review against ${minimum}-word quality floor`);
  } else {
    contentPasses += 1;
  }

  if (/\b(?:lorem ipsum|loading posts|no posts yet|\[city\]|\[state\]|{{[^}]+}})\b/i.test(text)) {
    addError(`${file}: placeholder or empty-state content remains indexable`);
  }
  if (/"@type"\s*:\s*"LocalBusiness"/i.test(html)) addError(`${file}: unsupported LocalBusiness schema`);
  if (/"@type"\s*:\s*"(?:Nonprofit|NonprofitOrganization)"/i.test(html)) {
    addError(`${file}: unsupported Schema.org nonprofit type; use Organization or NGO with nonprofitStatus`);
  }
  if (/\b(?:100% tax deductible|free pickup|no towing required|without towing or transport|guaranteed tax deduction)\b/i.test(text)) {
    addError(`${file}: contains an unqualified high-risk donation claim`);
  }
  if (/optione|access and access|\ba an\b|common and workable|roadworthy trailer[^.!?]{0,40}confirmed in review|road-ready trailer|(?:state|say|check|confirm|be honest about) whether[^.!?]{0,60}(?:safe(?:ly)? (?:to )?(?:tow|roll)|roadworthy|rolls and stops safely)|\bone option to (?:move|close)\b/i.test(text)) {
    addError(`${file}: contains a known editorial replacement artifact`);
  }
  if (/will contact you shortly|reach out shortly|within one to two business days|1[–-]2 business days|faster (?:review|answer)|review (?:quicker|faster)/i.test(text)) {
    addError(`${file}: contains an unsupported service-timing claim`);
  }

  const paragraphTexts = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripMarkup(match[1]))
    .filter((value) => value.length >= 40);
  for (let index = 1; index < paragraphTexts.length; index += 1) {
    if (paragraphTexts[index] === paragraphTexts[index - 1]) {
      addError(`${file}: contains adjacent duplicate paragraphs`);
      break;
    }
  }

  const isQuestionMatch = (match) => /\b(?:do|does|will|can|could|would)\s*$/i.test(text.slice(Math.max(0, match.index - 24), match.index));
  const directMovementClaim = [...text.matchAll(
    /\b(?:we|our team|boats for charity)\s+(?:(?:will|can|may|also|typically|generally|often)\s+)?(?:pick up|tow|transport|move|store|haul|remove)\b/gi,
  )].find((match) => !isQuestionMatch(match));
  const arrangedMovementClaim = [...text.matchAll(
    /\b(?:we|our team|boats for charity)\s+(?:(?:will|can|may|also|typically|generally|often)\s+)?(?:arrange|coordinate|schedule|provide|handle|perform|offer|include)\b[^.!?]{0,60}\b(?:pickup|transport|towing|movement|moving|storage|haul(?:ing)?|removal)\b/gi,
  )].find((match) => !isQuestionMatch(match));
  const unsafeMovementClaim = directMovementClaim?.[0] ?? arrangedMovementClaim?.[0];
  if (unsafeMovementClaim) {
    addError(`${file}: possible charity-handled movement claim: ${unsafeMovementClaim}`);
  }

  if (file.startsWith("city/")) {
    if (/<h2\b[^>]*>\s*Questions from\b/i.test(html)) {
      addError(`${file}: redundant city FAQ section remains`);
    }
    if (/"@type"\s*:\s*"FAQPage"/i.test(html)) {
      addError(`${file}: redundant city FAQ schema remains`);
    }
    const pickupIdCount = (html.match(/\bid=["']buyer-pickup["']/gi) || []).length;
    if (pickupIdCount !== 1) addError(`${file}: expected one buyer-pickup section, found ${pickupIdCount}`);
    if (!/<p\s+class=["']process-note["'][^>]*>/i.test(html)) addError(`${file}: missing owner-custody process note`);
    if (!/Boats for Charity does not move, tow, transport, pick up, or store the vessel\./i.test(text)) {
      addError(`${file}: owner-custody policy is missing or incomplete`);
    }
    if (!/It remains with the owner during review and while an accepted boat is offered for sale\./i.test(text)) {
      addError(`${file}: review and sale custody policy is missing`);
    }
    if (!/After cleared payment, the buyer coordinates pickup or transport directly with the owner/i.test(text)) {
      addError(`${file}: buyer-arranged pickup policy is missing`);
    }
    for (const match of html.matchAll(/<h3\b[^>]*>[^<]*\bCan I\s+(?:still\s+)?(?:donate|submit)\b[^<]*<\/h3>\s*<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
      if (!stripMarkup(match[1]).startsWith("You may submit it for individual review.")) {
        addError(`${file}: a “Can I donate/submit” answer does not begin with the qualified review language`);
      }
    }
  }

  if (file.startsWith("state-")) {
    if (!/<strong>Owner keeps custody<\/strong>/i.test(html) || !/Boats for Charity does not move or store the boat\./i.test(text)) {
      addError(`${file}: owner-custody trust statement is missing`);
    }
    if (!/<strong>Buyer arranges pickup<\/strong>/i.test(html) || !/After a sale and cleared payment, the buyer coordinates directly with the owner\./i.test(text)) {
      addError(`${file}: buyer-arranged pickup trust statement is missing`);
    }
    if (!/A submission is a request, not acceptance\./i.test(text)) {
      addError(`${file}: submission-is-not-acceptance statement is missing`);
    }
  }

  for (const match of html.matchAll(/\b(?:href|action)=(['"])(.*?)\1/gi)) {
    const value = match[2];
    if (!value || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(value)) continue;
    if (/^https?:\/\//i.test(value) && !value.startsWith(ORIGIN)) continue;
    const local = value.startsWith(ORIGIN) ? value.slice(ORIGIN.length) || "/" : value;
    if (!local.startsWith("/")) continue;
    const pathname = local.split(/[?#]/)[0];
    if (/\.html$/i.test(pathname)) addError(`${file}: internal link uses legacy .html URL ${pathname}`);
    if (/^\/city\/[^/]+$/.test(pathname)) addError(`${file}: city link is missing its canonical trailing slash: ${pathname}`);
    if (/^\/guides(?:\/[^/]+)?$/.test(pathname)) addError(`${file}: guide link is missing its canonical trailing slash: ${pathname}`);
    if (pathname === "/boat-donation-by-city") addError(`${file}: city hub link is missing its canonical trailing slash`);

    if (
      pathname === "/" ||
      preferredRoutes.has(pathname) ||
      /^\/(?:assets|data)\//.test(pathname) ||
      /^\/(?:styles(?:\.v\d+)?\.css|script\.v\d+\.js|track\.v\d+\.js|favicon\.ico)$/.test(pathname) ||
      /^\/\.netlify\//.test(pathname)
    ) {
      continue;
    }
    addError(`${file}: internal link does not resolve to a preferred page or static asset: ${pathname}`);
  }

  for (const match of html.matchAll(/<form\b[\s\S]*?<\/form>/gi)) {
    if (/name=["']donationForm["']/i.test(match[0])) forms.push({ file, html: match[0] });
  }
}

const thanks = read("thanks.html");
if (!/<meta\s+name=["']robots["']\s+content=["']noindex,follow,noarchive["']/i.test(thanks)) {
  addError("thanks.html: missing noindex,follow,noarchive directive");
}
const thanksText = stripMarkup(thanks);
if (!/received your boat information/i.test(thanksText) || !/submission does not mean the boat has been accepted/i.test(thanksText)) {
  addError("thanks.html: receipt message must distinguish submission from acceptance");
}

try {
  const organizationSchema = JSON.parse(read("schema.json"));
  if (!["NGO", "Organization"].includes(organizationSchema["@type"])) {
    addError("schema.json: organization type must be NGO or Organization");
  }
  if (organizationSchema.nonprofitStatus !== "https://schema.org/Nonprofit501c3") {
    addError("schema.json: expected the explicit Nonprofit501c3 status");
  }
  if (organizationSchema.taxID !== "41-2487552") {
    addError("schema.json: nonprofit taxID is missing or incorrect");
  }
} catch (error) {
  addError(`schema.json: invalid organization schema (${error.message})`);
}

for (const { file, html } of forms) {
  const required = [
    /name=["']donationForm["']/i,
    /data-netlify=["']true["']/i,
    /netlify-honeypot=["']bot-field["']/i,
    /action=["']\/thanks["']/i,
    /name=["']form-name["']\s+value=["']donationForm["']/i,
    /name=["']first_name["']/i,
    /name=["']last_name["']/i,
    /name=["']email["']/i,
    /name=["']phone["']/i,
    /name=["']bot-field["']/i,
  ];
  if (required.some((expression) => !expression.test(html))) {
    addError(`${file}: donation form contract is incomplete or changed`);
  }
}
if (!forms.length) addError("No Netlify donation forms found");

const sitemapLocations = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const sitemapRoutes = sitemapLocations.map((url) => (url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) || "/" : url));
if (new Set(sitemapLocations).size !== sitemapLocations.length) addError("sitemap.xml: duplicate URLs found");
if (sitemapLocations.some((url) => !url.startsWith(`${ORIGIN}/`))) addError("sitemap.xml: non-canonical origin found");
if (sitemapRoutes.some((route) => /\.html$|\/index\.html$/i.test(route))) addError("sitemap.xml: legacy URL found");
for (const route of indexableRoutes) {
  if (!sitemapRoutes.includes(route)) addError(`sitemap.xml: missing ${route}`);
}
for (const route of sitemapRoutes) {
  if (!indexableRoutes.has(route)) addError(`sitemap.xml: non-indexable or unknown route ${route}`);
}

const cityDirectory = read("boat-donation-by-city/index.html");
const cityDirectoryText = stripMarkup(cityDirectory);
const listedCityRoutes = [...cityDirectory.matchAll(/href=["'](\/city\/[^"']+\/)["']/gi)].map((match) => match[1]);
const cityRoutes = new Set(cityFiles.map((file) => preferredRoute(file)));
const uniqueListedCityRoutes = new Set(listedCityRoutes);
if (uniqueListedCityRoutes.size !== cityFiles.length) {
  addError(`boat-donation-by-city/index.html: lists ${uniqueListedCityRoutes.size} unique city routes for ${cityFiles.length} city pages`);
}
for (const route of cityRoutes) {
  if (!uniqueListedCityRoutes.has(route)) addError(`boat-donation-by-city/index.html: missing city route ${route}`);
}
for (const route of uniqueListedCityRoutes) {
  if (!cityRoutes.has(route)) addError(`boat-donation-by-city/index.html: unknown city route ${route}`);
}
if (!new RegExp(`local preparation guides for ${cityFiles.length} U\\.S\\. boating communities`, "i").test(cityDirectoryText)) {
  addError(`boat-donation-by-city/index.html: visible city count does not match ${cityFiles.length}`);
}
const collectionSchema = [...cityDirectory.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap((match) => {
    try {
      const parsed = JSON.parse(match[1]);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  })
  .find((item) => item?.["@type"] === "CollectionPage");
if (collectionSchema?.numberOfItems !== cityFiles.length) {
  addError(`boat-donation-by-city/index.html: CollectionPage numberOfItems must be ${cityFiles.length}`);
}

const taxGuide = read("guides/boat-donation-tax-information/index.html");
for (const requiredTaxPoint of [
  /smaller of (?:the charity's )?gross sale proceeds or (?:the boat's )?fair market value/i,
  /basis and other limits/i,
  /qualified vehicle[^.]{0,180}Section A[^.]{0,80}(?:above|exceeds) \$5,000/i,
  /Form 8283 generally applies when the deduction[^.]{0,80}(?:exceeds|over) \$500/i,
  /qualified tax professional/i,
]) {
  if (!requiredTaxPoint.test(stripMarkup(taxGuide))) addError(`guides/boat-donation-tax-information/index.html: missing required qualified tax guidance (${requiredTaxPoint})`);
}

const redirectLines = read("_redirects")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const redirects = new Map();
for (const line of redirectLines) {
  const parts = line.split(/\s+/);
  if (parts.length !== 3 || parts[2] !== "301!") {
    addError(`_redirects: malformed rule ${line}`);
    continue;
  }
  if (redirects.has(parts[0])) addError(`_redirects: duplicate source ${parts[0]}`);
  redirects.set(parts[0], parts[1]);
}
for (const [source, target] of redirects) {
  if (source === target) addError(`_redirects: self redirect at ${source}`);
  if (redirects.has(target)) addError(`_redirects: chain detected ${source} -> ${target}`);
  if (!preferredRoutes.has(target) && target !== "/guides/") {
    addError(`_redirects: target is not a preferred route ${source} -> ${target}`);
  }
}
for (const file of preferredFiles) {
  const route = preferredRoute(file);
  let duplicatePath = null;
  if (file === "index.html") duplicatePath = "/index.html";
  else if (file.endsWith(".html") && !file.includes("/")) duplicatePath = `/${file}`;
  else if (file.endsWith("/index.html")) duplicatePath = `/${file}`;
  if (duplicatePath && duplicatePath !== route && redirects.get(duplicatePath) !== route) {
    addError(`_redirects: missing canonical redirect ${duplicatePath} -> ${route}`);
  }
}

const legacyHtml = htmlFiles.filter(
  (file) =>
    /^donate-a-boat-.+\.html$/.test(file) ||
    /^city-.+\.html$/.test(file) ||
    [
      "blog-donate-boat-without-title.html",
      "blog-index.html",
      "boat-selling-faq.html",
      "how-to-donate-a-boat.html",
      "sell-vs-donate-boat.html",
      "blog/index.html",
    ].includes(file),
);
if (legacyHtml.length) addError(`Legacy/thin HTML files still exist: ${legacyHtml.join(", ")}`);

for (const file of preferredFiles.filter((item) => item.startsWith("state-"))) {
  const html = read(file);
  if (!html.includes('id="state-page-schema"')) addError(`${file}: missing state WebPage/Breadcrumb schema`);
}

const categoryScores = {
  "Canonical URL system": Math.round((canonicalPasses / preferredFiles.length) * 25),
  "Metadata and page identity": Math.round((metadataPasses / preferredFiles.length) * 20),
  "Sitemap, redirects, and links": errors.some((item) => /sitemap|_redirects|internal link/i.test(item)) ? 0 : 20,
  "Structured data": Math.round((schemaPasses / indexableFiles.length) * 10),
  "Forms, trust, and claim safety": errors.some((item) => /form|high-risk|LocalBusiness|thanks\.html/i.test(item)) ? 0 : 15,
  "Content quality floor": Math.round((contentPasses / preferredFiles.length) * 10),
};
const score = Object.values(categoryScores).reduce((sum, value) => sum + value, 0);

console.log(`SEO readiness score: ${score}/100`);
console.log(`Preferred pages: ${preferredFiles.length} (${indexableFiles.length} indexable)`);
console.log(`Sitemap URLs: ${sitemapLocations.length}`);
console.log(`One-hop redirects: ${redirects.size}`);
console.log(`Donation forms checked: ${forms.length}`);
for (const [name, value] of Object.entries(categoryScores)) console.log(`- ${name}: ${value}`);

if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const warning of warnings.slice(0, 40)) console.log(`- ${warning}`);
  if (warnings.length > 40) console.log(`- ...and ${warnings.length - 40} more`);
}

if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  for (const error of errors.slice(0, 100)) console.error(`- ${error}`);
  if (errors.length > 100) console.error(`- ...and ${errors.length - 100} more`);
  process.exit(1);
}

if (score < 80) {
  console.error("SEO readiness score is below the 80/100 release threshold.");
  process.exit(1);
}

console.log("PASS: no blocking SEO integrity errors and score meets the 80/100 release threshold.");
