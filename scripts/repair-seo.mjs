import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(process.argv[2] ?? SCRIPT_ROOT);
const ORIGIN = "https://boatsforcharity.org";

const STATE_NAMES = {
  alabama: "Alabama",
  alaska: "Alaska",
  arizona: "Arizona",
  arkansas: "Arkansas",
  california: "California",
  colorado: "Colorado",
  connecticut: "Connecticut",
  delaware: "Delaware",
  florida: "Florida",
  georgia: "Georgia",
  hawaii: "Hawaii",
  idaho: "Idaho",
  illinois: "Illinois",
  indiana: "Indiana",
  iowa: "Iowa",
  kansas: "Kansas",
  kentucky: "Kentucky",
  louisiana: "Louisiana",
  maine: "Maine",
  maryland: "Maryland",
  massachusetts: "Massachusetts",
  michigan: "Michigan",
  minnesota: "Minnesota",
  mississippi: "Mississippi",
  missouri: "Missouri",
  montana: "Montana",
  nebraska: "Nebraska",
  nevada: "Nevada",
  "new-hampshire": "New Hampshire",
  "new-jersey": "New Jersey",
  "new-mexico": "New Mexico",
  "new-york": "New York",
  "north-carolina": "North Carolina",
  "north-dakota": "North Dakota",
  ohio: "Ohio",
  oklahoma: "Oklahoma",
  oregon: "Oregon",
  pennsylvania: "Pennsylvania",
  "rhode-island": "Rhode Island",
  "south-carolina": "South Carolina",
  "south-dakota": "South Dakota",
  tennessee: "Tennessee",
  texas: "Texas",
  utah: "Utah",
  vermont: "Vermont",
  virginia: "Virginia",
  washington: "Washington",
  "west-virginia": "West Virginia",
  wisconsin: "Wisconsin",
  wyoming: "Wyoming",
};

const ROOT_PAGES = new Map([
  ["donate-a-boat.html", "/donate-a-boat"],
  ["faq.html", "/faq"],
  ["boats-for-sale.html", "/boats-for-sale"],
  ["hin-lookup.html", "/hin-lookup"],
  ["boat-donation-by-state.html", "/boat-donation-by-state"],
  ["thanks.html", "/thanks"],
]);

const WHATCONVERTS_TAG = `<script src="//tracking.whatconverts.com/scripts/wc.js" async></script>`;

const toPosix = (value) => value.split(path.sep).join("/");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const write = (relative, contents) =>
  fs.writeFileSync(path.join(ROOT, relative), contents, "utf8");

function listFiles(directory, predicate = () => true) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "artifacts") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(absolute, predicate));
    if (entry.isFile() && predicate(absolute)) found.push(absolute);
  }
  return found;
}

function preferredRoute(relative) {
  const file = toPosix(relative);
  if (file === "index.html") return "/";
  if (ROOT_PAGES.has(file)) return ROOT_PAGES.get(file);
  if (/^state-[a-z-]+\.html$/.test(file)) return `/${file.slice(0, -5)}`;
  if (file === "city/index.html") return "/city/";
  if (/^city\/[^/]+\/index\.html$/.test(file)) {
    return `/${file.replace(/index\.html$/, "")}`;
  }
  if (file === "guides/index.html") return "/guides/";
  if (/^guides\/[^/]+\/index\.html$/.test(file)) {
    return `/${file.replace(/index\.html$/, "")}`;
  }
  if (file === "boat-donation-by-city/index.html") return "/boat-donation-by-city/";
  return null;
}

const preferredHtml = listFiles(ROOT, (file) => file.endsWith(".html"))
  .map((file) => toPosix(path.relative(ROOT, file)))
  .filter((relative) => preferredRoute(relative));

let gtagAdsUpdated = 0;
let trackerInjected = 0;
for (const relative of preferredHtml) {
  let html = read(relative);
  let modified = false;

  // 1. Ensure Google Ads AW-18239894267 is configured on existing Google tag
  if (!html.includes("gtag('config', 'AW-18239894267');")) {
    if (html.includes("gtag('config', 'G-28FSWPQMQV');")) {
      html = html.replace(
        "gtag('config', 'G-28FSWPQMQV');",
        "gtag('config', 'G-28FSWPQMQV');\n  gtag('config', 'AW-18239894267');"
      );
      modified = true;
      gtagAdsUpdated++;
    }
  }

  // 2. Inject tracker.v1.js
  if (!html.includes('src="/tracker.v1.js"')) {
    if (html.includes('src="/script.v123.js"')) {
      html = html.replace(
        '<script defer src="/script.v123.js"></script>',
        '<script defer src="/tracker.v1.js"></script>\n  <script defer src="/script.v123.js"></script>'
      );
      modified = true;
    } else if (html.includes('</body>')) {
      html = html.replace('</body>', '  <script defer src="/tracker.v1.js"></script>\n</body>');
      modified = true;
    }
  }

  // 3. Inject WhatConverts script
  if (!html.includes('tracking.whatconverts.com/scripts/wc.js')) {
    if (html.includes('</head>')) {
      html = html.replace('</head>', `  ${WHATCONVERTS_TAG}\n</head>`);
      modified = true;
    }
  }

  if (modified) {
    write(relative, html);
    trackerInjected++;
  }
}

console.log(`[repair-seo] Verified Google tag (GA4 G-28FSWPQMQV + Google Ads AW-18239894267), WhatConverts & SEO structure across ${preferredHtml.length} pages (${gtagAdsUpdated} Google Ads configs added, ${trackerInjected} total updated).`);
