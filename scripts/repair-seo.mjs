import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://boatsforcharity.org";
const OTTO_SCRIPT = '<script nowprocket nitro-exclude type="text/javascript" id="sa-dynamic-optimization" data-uuid="c4c383ae-21b1-44b0-b852-1cd9970a2c5d" src="https://dashboard.searchatlas.com/scripts/dynamic_optimization.js"></script>';
const STATE_CONTENT = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scripts", "state-content.json"), "utf8"),
);

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

const STATE_SLUGS = new Map(
  Object.entries(STATE_NAMES).map(([slug, name]) => [name, slug]),
);

const ROOT_PAGES = new Map([
  ["donate-a-boat.html", "/donate-a-boat"],
  ["faq.html", "/faq"],
  ["boats-for-sale.html", "/boats-for-sale"],
  ["hin-lookup.html", "/hin-lookup"],
  ["boat-donation-by-state.html", "/boat-donation-by-state"],
  ["thanks.html", "/thanks"],
]);

const LEGACY_PAGE_TARGETS = new Map([
  ["blog-donate-boat-without-title.html", "/guides/donate-a-boat-without-a-title/"],
  ["blog-index.html", "/guides/"],
  ["blog/index.html", "/guides/"],
  ["boat-selling-faq.html", "/guides/boat-donation-vs-selling/"],
  ["how-to-donate-a-boat.html", "/guides/how-to-donate-a-boat/"],
  ["sell-vs-donate-boat.html", "/guides/boat-donation-vs-selling/"],
  ["city-template.html", "/boat-donation-by-city/"],
]);

const MISSING_CITY_STATES = {
  albuquerque: "new-mexico",
  anaheim: "california",
  arlington: "texas",
  aurora: "colorado",
  bakersfield: "california",
  chandler: "arizona",
  "chula-vista": "california",
  cincinnati: "ohio",
  columbus: "ohio",
  durham: "north-carolina",
  "el-paso": "texas",
  "fort-wayne": "indiana",
  fresno: "california",
  gilbert: "arizona",
  glendale: "arizona",
  greensboro: "north-carolina",
  henderson: "nevada",
  irvine: "california",
  "jersey-city": "new-jersey",
  laredo: "texas",
  lexington: "kentucky",
  lincoln: "nebraska",
  lubbock: "texas",
  memphis: "tennessee",
  mesa: "arizona",
  newark: "new-jersey",
  "north-las-vegas": "nevada",
  philadelphia: "pennsylvania",
  plano: "texas",
  portland: "oregon",
  riverside: "california",
  "saint-paul": "minnesota",
  "san-jose": "california",
  "santa-ana": "california",
  scottsdale: "arizona",
  "winston-salem": "north-carolina",
};

const CITY_ALIASES = {
  "clear-lake": "/state-texas",
  "coeur-dalene": "/city/coeur-d-alene/",
  "lake-havasu": "/city/lake-havasu-city/",
  sausalito: "/city/sausalito/",
};

const LEGACY_DONATION_CITY_SLUGS = `
albuquerque anaheim anchorage arlington atlanta aurora austin bakersfield baltimore boston
buffalo chandler charlotte chicago chula-vista cincinnati cleveland colorado-springs columbus
corpus-christi dallas denver detroit durham el-paso fort-wayne fort-worth fresno gilbert
glendale greensboro henderson honolulu houston indianapolis irvine jacksonville jersey-city
kansas-city laredo las-vegas lexington lincoln long-beach los-angeles louisville lubbock madison
memphis mesa miami milwaukee minneapolis nashville new-orleans new-york newark north-las-vegas
oakland oklahoma-city omaha orlando philadelphia phoenix pittsburgh plano portland raleigh reno
riverside sacramento saint-paul san-antonio san-diego san-francisco san-jose santa-ana scottsdale
seattle st-louis st-petersburg stockton tampa toledo tucson tulsa virginia-beach washington
wichita winston-salem
`.trim().split(/\s+/);

const LEGACY_CITY_SLUGS = `
annapolis boston charleston chicago clear-lake coeur-dalene corpus-christi fort-lauderdale
galveston honolulu key-west lake-havasu lake-tahoe long-beach los-angeles miami milwaukee
new-orleans newport-beach san-diego san-francisco sausalito savannah seattle tacoma tampa
`.trim().split(/\s+/);

const toPosix = (value) => value.split(path.sep).join("/");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const write = (relative, contents) =>
  fs.writeFileSync(path.join(ROOT, relative), contents, "utf8");

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

const cityFiles = listFiles(path.join(ROOT, "city"), (file) =>
  file.endsWith(`${path.sep}index.html`),
);
const modernCitySlugs = new Set(
  cityFiles.map((file) => path.basename(path.dirname(file))),
);

const cityRecords = cityFiles.map((file) => {
  const html = fs.readFileSync(file, "utf8");
  const match = html.match(/<h1>Boat Donation in (.+?), ([^<]+)<\/h1>/i);
  const descriptionMatch = html.match(/<meta\s+name=["']description["'][^>]*\scontent=(["'])(.*?)\1[^>]*>/i);
  if (!match) throw new Error(`Could not read city/state from ${toPosix(file)}`);
  return {
    file: toPosix(path.relative(ROOT, file)),
    slug: path.basename(path.dirname(file)),
    city: match[1].trim(),
    state: match[2].trim(),
    description: descriptionMatch?.[2]?.trim() || "Local boat donation preparation guidance.",
  };
});

const citiesByState = new Map();
for (const record of cityRecords) {
  if (!citiesByState.has(record.state)) citiesByState.set(record.state, []);
  citiesByState.get(record.state).push(record);
}
for (const records of citiesByState.values()) {
  records.sort((a, b) => a.city.localeCompare(b.city));
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

function cityTarget(slug) {
  if (modernCitySlugs.has(slug)) return `/city/${slug}/`;
  if (CITY_ALIASES[slug]) return CITY_ALIASES[slug];
  if (MISSING_CITY_STATES[slug]) return `/state-${MISSING_CITY_STATES[slug]}`;
  throw new Error(`No safe legacy redirect target configured for city slug: ${slug}`);
}

for (const slug of LEGACY_DONATION_CITY_SLUGS) {
  LEGACY_PAGE_TARGETS.set(`donate-a-boat-${slug}.html`, cityTarget(slug));
}
for (const slug of LEGACY_CITY_SLUGS) {
  LEGACY_PAGE_TARGETS.set(`city-${slug}.html`, cityTarget(slug));
}

const REDIRECT_TARGETS = new Map();
function registerRedirect(source, target) {
  const previous = REDIRECT_TARGETS.get(source);
  if (previous && previous !== target) {
    throw new Error(`Conflicting redirects for ${source}: ${previous} and ${target}`);
  }
  if (source !== target) REDIRECT_TARGETS.set(source, target);
}

registerRedirect("/index.html", "/");
for (const [file, route] of ROOT_PAGES) registerRedirect(`/${file}`, route);
for (const slug of Object.keys(STATE_NAMES)) {
  registerRedirect(`/state-${slug}.html`, `/state-${slug}`);
  registerRedirect(`/state/${slug}/`, `/state-${slug}`);
  registerRedirect(`/state/${slug}`, `/state-${slug}`);
}
for (const record of cityRecords) {
  registerRedirect(`/city/${record.slug}/index.html`, `/city/${record.slug}/`);
}
for (const file of listFiles(path.join(ROOT, "guides"), (item) =>
  item.endsWith(`${path.sep}index.html`),
)) {
  const relative = toPosix(path.relative(ROOT, file));
  registerRedirect(`/${relative}`, preferredRoute(relative));
}
registerRedirect("/boat-donation-by-city/index.html", "/boat-donation-by-city/");
registerRedirect("/blog", "/guides/");
registerRedirect("/blog/", "/guides/");
registerRedirect("/blog/index.html", "/guides/");

registerRedirect("/guides/boat-title-transfer", "/guides/boat-donation-paperwork/");
registerRedirect("/guides/boat-title-transfer/", "/guides/boat-donation-paperwork/");
registerRedirect("/guides/boat-title-transfer/index.html", "/guides/boat-donation-paperwork/");

for (const [file, target] of LEGACY_PAGE_TARGETS) {
  const stem = file.slice(0, -5);
  registerRedirect(`/${file}`, target);
  registerRedirect(`/${stem}`, target);
}

function normalizeInternalTarget(value) {
  if (!value || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(value)) return value;
  const isAbsolute = value.startsWith(`${ORIGIN}/`) || value === ORIGIN;
  if (/^https?:\/\//i.test(value) && !isAbsolute) return value;

  let local = isAbsolute ? value.slice(ORIGIN.length) || "/" : value;
  if (!local.startsWith("/")) return value;

  const suffixIndex = local.search(/[?#]/);
  const suffix = suffixIndex >= 0 ? local.slice(suffixIndex) : "";
  let pathname = suffixIndex >= 0 ? local.slice(0, suffixIndex) : local;

  pathname = pathname.replace(/^\/state\/([a-z-]+)\/?$/, "/state-$1");

  if (REDIRECT_TARGETS.has(pathname)) pathname = REDIRECT_TARGETS.get(pathname);
  if (pathname === "/index.html") pathname = "/";
  pathname = pathname.replace(/^\/state-([a-z-]+)\.html$/, "/state-$1");
  pathname = pathname.replace(/^\/(donate-a-boat|faq|boats-for-sale|hin-lookup|boat-donation-by-state|thanks)\.html$/, "/$1");
  pathname = pathname.replace(/^\/city\/([^/]+)(?:\/index\.html)?\/?$/, "/city/$1/");
  pathname = pathname.replace(/^\/guides(?:\/index\.html)?\/?$/, "/guides/");
  pathname = pathname.replace(/^\/guides\/([^/]+)(?:\/index\.html)?\/?$/, "/guides/$1/");
  pathname = pathname.replace(/^\/boat-donation-by-city(?:\/index\.html)?\/?$/, "/boat-donation-by-city/");
  pathname = pathname.replace(/^\/blog(?:\/index\.html)?\/?$/, "/blog/");

  const normalized = `${pathname}${suffix}`;
  return isAbsolute ? `${ORIGIN}${normalized}` : normalized;
}

function setCanonical(html, route) {
  const tag = `<link rel="canonical" href="${ORIGIN}${route}">`;
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, tag);
  }
  return html.replace(/<\/head>/i, `${tag}\n<\/head>`);
}

function getTitle(html) {
  return html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || "Boats for Charity";
}

function getDescription(html) {
  const match = html.match(/<meta\s+name=["']description["'][^>]*\scontent=(["'])(.*?)\1[^>]*>/i);
  return match?.[2]?.trim() || "Practical information about donating a boat through Boats for Charity.";
}

function setTitle(html, value) {
  if (/<title>[^<]*<\/title>/i.test(html)) return html.replace(/<title>[^<]*<\/title>/i, `<title>${value}</title>`);
  return html.replace(/<\/head>/i, `<title>${value}</title>\n<\/head>`);
}

function setDescription(html, value) {
  const expression = /<meta\s+name=["']description["'][^>]*>/i;
  const tag = `<meta name="description" content="${value}">`;
  if (expression.test(html)) return html.replace(expression, tag);
  return html.replace(/<\/head>/i, `${tag}\n<\/head>`);
}

function optimizeSearchSnippet(html, relative) {
  let output = html;
  if (relative === "index.html") {
    output = setTitle(output, "Donate Your Boat for Charity: Tax-Deductible Vessel Donations | Boats for Charity");
    output = setDescription(
      output,
      "Donate your boat, sailboat, yacht, or trailer to Boats for Charity, an Oregon-based 501(c)(3) nonprofit (EIN 41-2487552). Free review, owner custody, and IRS Form 1098-C.",
    );
  }
  if (/^city\/[^/]+\/index\.html$/.test(relative)) {
    const currentTitle = getTitle(output);
    const compactTitle = currentTitle.replace(/: Local Donor Guide \| Boats for Charity$/, " | Boats for Charity");
    output = setTitle(output, compactTitle);
  }
  const stateMatch = relative.match(/^state-([a-z-]+)\.html$/);
  if (stateMatch) {
    const stateName = STATE_NAMES[stateMatch[1]];
    const areas = STATE_CONTENT[stateMatch[1]]?.areas.match(/may be near (.*?), or stored/i)?.[1];
    if (areas) {
      const phrases = areas.split(/,\s*/).filter(Boolean).slice(0, 2);
      const readableAreas = phrases.length > 1
        ? `${phrases[0]} and ${phrases[1]}`
        : areas;
      output = setDescription(
        output,
        `Boat donation review in ${stateName}: guidance for ${readableAreas}, paperwork, owner-held storage, and buyer-arranged pickup.`,
      );
    }
  }
  return output;
}

function setPropertyMeta(html, property, value) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(`<meta\\s+property=["']${escapedProperty}["'][^>]*>`, "i");
  const tag = `<meta property="${property}" content="${value}">`;
  if (expression.test(html)) return html.replace(expression, tag);
  return html.replace(/<\/head>/i, `${tag}\n<\/head>`);
}

function setNameMeta(html, name, value) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(`<meta\\s+name=["']${escapedName}["'][^>]*>`, "i");
  const tag = `<meta name="${name}" content="${value}">`;
  if (expression.test(html)) return html.replace(expression, tag);
  return html.replace(/<\/head>/i, `${tag}\n<\/head>`);
}

function addSocialMetadata(html, route) {
  let output = html;
  const title = getTitle(output);
  const description = getDescription(output);
  const canonicalUrl = `${ORIGIN}${route}`;
  const logoUrl = `${ORIGIN}/assets/logo.png`;

  output = setPropertyMeta(output, "og:type", "website");
  output = setPropertyMeta(output, "og:title", title);
  output = setPropertyMeta(output, "og:description", description);
  output = setPropertyMeta(output, "og:url", canonicalUrl);
  output = setPropertyMeta(output, "og:site_name", "Boats for Charity");
  output = setPropertyMeta(output, "og:image", logoUrl);

  output = setNameMeta(output, "twitter:card", "summary_large_image");
  output = setNameMeta(output, "twitter:title", title);
  output = setNameMeta(output, "twitter:description", description);
  output = setNameMeta(output, "twitter:image", logoUrl);
  output = setNameMeta(output, "twitter:site", "@boatsforcharity");

  return output;
}

function ensureLangAttribute(html) {
  if (!/<html\b[^>]*\blang=/i.test(html)) {
    return html.replace(/<html\b/i, '<html lang="en"');
  }
  return html;
}

function ensureOttoPixel(html) {
  if (!html.includes('id="sa-dynamic-optimization"')) {
    return html.replace(/<\/head>/i, `${OTTO_SCRIPT}\n<\/head>`);
  }
  return html;
}

function escapeHtmlText(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripInlineMarkup(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&rsquo;|&#8217;|&#39;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuestion(value) {
  return stripInlineMarkup(value)
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

function addStateSchema(html, stateSlug, route) {
  const marker = 'id="state-page-schema"';
  let output = html;
  if (output.includes(marker)) {
    output = output.replace(/<script\s+id=["']state-page-schema["'][^>]*>[\s\S]*?<\/script>\s*/i, "");
  }
  const stateName = STATE_NAMES[stateSlug];
  const content = STATE_CONTENT[stateSlug];
  const q1Answer = `You may submit it for individual review. ${content.comparison} Give the exact marina, yard, mooring, residence, or storage address; describe whether the boat is afloat, blocked, lifted, or trailered; and disclose access limits, balances, liens, and facility deadlines.`;
  const q2Answer = `${content.paperwork} Do not sign a title, cancel storage or insurance, or release the boat on the strength of an inquiry alone.`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
        {
          "@type": "ListItem",
          position: 2,
          name: "Boat Donation by State",
          item: `${ORIGIN}/boat-donation-by-state`,
        },
        { "@type": "ListItem", position: 3, name: stateName, item: `${ORIGIN}${route}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "NGO",
      "@id": `${ORIGIN}/#organization`,
      name: "Boats for Charity",
      url: `${ORIGIN}/`,
      logo: `${ORIGIN}/assets/logo.png`,
      nonprofitStatus: "https://schema.org/Nonprofit501c3",
      taxID: "41-2487552",
      telephone: "+18555573703",
      email: "info@boatsforcharity.org",
      areaServed: { "@type": "State", name: stateName },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: getTitle(output),
      description: getDescription(output),
      url: `${ORIGIN}${route}`,
      isPartOf: { "@type": "WebSite", name: "Boats for Charity", url: `${ORIGIN}/` },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: content.localQuestion,
          acceptedAnswer: {
            "@type": "Answer",
            text: q1Answer,
          },
        },
        {
          "@type": "Question",
          name: `Which ${stateName} ownership records should I gather?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: q2Answer,
          },
        },
      ],
    },
  ];
  const script = `<script id="state-page-schema" type="application/ld+json">${JSON.stringify(schema)}<\/script>`;
  return output.replace(/<\/head>/i, `${script}\n<\/head>`);
}

function addCitySchema(html, cityRecord, route) {
  const marker = 'id="city-page-schema"';
  let output = html;
  if (output.includes(marker)) {
    output = output.replace(/<script\s+id=["']city-page-schema["'][^>]*>[\s\S]*?<\/script>\s*/i, "");
  }
  output = output.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, "");

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
        {
          "@type": "ListItem",
          position: 2,
          name: "Boat Donation by City",
          item: `${ORIGIN}/boat-donation-by-city/`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: `${cityRecord.city}, ${cityRecord.state}`,
          item: `${ORIGIN}${route}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "NGO",
      name: `Boats for Charity - ${cityRecord.city} Service Area`,
      url: `${ORIGIN}${route}`,
      logo: `${ORIGIN}/assets/logo.png`,
      nonprofitStatus: "https://schema.org/Nonprofit501c3",
      taxID: "41-2487552",
      telephone: "+18555573703",
      email: "info@boatsforcharity.org",
      areaServed: {
        "@type": "City",
        name: cityRecord.city,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: getTitle(output),
      description: getDescription(output),
      url: `${ORIGIN}${route}`,
      isPartOf: { "@type": "WebSite", name: "Boats for Charity", url: `${ORIGIN}/` },
    },
  ];

  const script = `<script id="city-page-schema" type="application/ld+json">${JSON.stringify(schema)}<\/script>`;
  return output.replace(/<\/head>/i, `${script}\n<\/head>`);
}

function addGuideSchema(html, relative, route) {
  if (!relative.startsWith("guides/") || relative === "guides/index.html") return html;
  const marker = 'id="guide-page-schema"';
  let output = html;
  if (output.includes(marker)) {
    output = output.replace(/<script\s+id=["']guide-page-schema["'][^>]*>[\s\S]*?<\/script>\s*/i, "");
  }

  const title = getTitle(output);
  const description = getDescription(output);
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${ORIGIN}/guides/` },
        { "@type": "ListItem", position: 3, name: title, item: `${ORIGIN}${route}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description: description,
      url: `${ORIGIN}${route}`,
      mainEntityOfPage: { "@type": "WebPage", "@id": `${ORIGIN}${route}` },
      publisher: {
        "@type": "NGO",
        name: "Boats for Charity",
        url: `${ORIGIN}/`,
        logo: { "@type": "ImageObject", url: `${ORIGIN}/assets/logo.png` },
      },
    },
  ];

  const script = `<script id="guide-page-schema" type="application/ld+json">${JSON.stringify(schema)}<\/script>`;
  return output.replace(/<\/head>/i, `${script}\n<\/head>`);
}

function syncStructuredData(html, route) {
  const answers = new Map(
    [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>\s*<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => [
      normalizeQuestion(match[1]),
      stripInlineMarkup(match[2]),
    ]),
  );
  const title = getTitle(html);
  const description = getDescription(html);
  const url = `${ORIGIN}${route}`;

  function update(item) {
    if (Array.isArray(item)) {
      for (const child of item) update(child);
      return;
    }
    if (!item || typeof item !== "object") return;
    if (item["@type"] === "WebPage" || item["@type"] === "CollectionPage") {
      item.name = title;
      item.description = description;
      item.url = url;
    }
    if (item["@type"] === "FAQPage" && Array.isArray(item.mainEntity)) {
      for (const question of item.mainEntity) {
        const answer = answers.get(normalizeQuestion(question?.name || ""));
        if (answer && question.acceptedAnswer && typeof question.acceptedAnswer === "object") {
          question.acceptedAnswer.text = answer;
        }
      }
    }
    if (Array.isArray(item["@graph"])) update(item["@graph"]);
  }

  return html.replace(
    /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (whole, open, raw, close) => {
      try {
        const data = JSON.parse(raw);
        update(data);
        return `${open}${JSON.stringify(data)}${close}`;
      } catch {
        return whole;
      }
    },
  );
}

function removeCityFaq(html) {
  const faqSection = /\s*<section class="section alt"><div class="wrap">\s*<h2>Questions from\b[\s\S]*?<\/section>/i;
  let output = html.replace(faqSection, "");

  function withoutFaqPage(value) {
    if (Array.isArray(value)) {
      return value.map(withoutFaqPage).filter((item) => item !== null);
    }
    if (!value || typeof value !== "object") return value;
    if (value["@type"] === "FAQPage") return null;
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object") value[key] = withoutFaqPage(child);
    }
    return value;
  }

  output = output.replace(
    /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (whole, open, raw, close) => {
      try {
        const filtered = withoutFaqPage(JSON.parse(raw));
        if (filtered === null || (Array.isArray(filtered) && filtered.length === 0)) return "";
        return `${open}${JSON.stringify(filtered)}${close}`;
      } catch {
        return whole;
      }
    },
  );
  return output;
}

function rewriteLinks(html) {
  let output = html.replace(/\b(href|action)=(['"])(.*?)\2/gi, (match, name, quote, value) => {
    return `${name}=${quote}${normalizeInternalTarget(value)}${quote}`;
  });
  output = output.replace(/https:\/\/boatsforcharity\.org(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]*)?/g, (value) =>
    normalizeInternalTarget(value),
  );
  return output;
}

function fixCityCtaAndDeadLinks(html, cityRecord) {
  let output = html;
  if (cityRecord.slug !== "annapolis") {
    output = output.replace(
      /<h2>Ready for a No-Cost Boat Donation Review in Annapolis\?</h2>/gi,
      `<h2>Ready for a No-Cost Boat Donation Review in ${cityRecord.city}?</h2>`,
    );
  }

  output = output.replace(/href=["']\/city\/cape-cod\/?["']/gi, 'href="/city/gloucester/"');
  output = output.replace(/href=["']\/city\/south-padre-island\/?["']/gi, 'href="/city/port-aransas/"');
  output = output.replace(/href=["']\/city\/st-augustine\/?["']/gi, 'href="/city/daytona-beach/"');
  output = output.replace(/href=["']\/city\/springfield\/?["']/gi, 'href="/city/st-louis/"');
  output = output.replace(/href=["']\/city\/huntington-beach\/?["']/gi, 'href="/city/dana-point/"');
  output = output.replace(/href=["']\/city\/melbourne\/?["']/gi, 'href="/city/tampa/"');

  if (cityRecord.slug === "annapolis") {
    output = output.replace(/href=["']\/city\/alexandria\/?["']/gi, 'href="/city/washington/"');
  }

  return output;
}

function refreshStateSections() {
  for (const [slug, stateName] of Object.entries(STATE_NAMES)) {
    const content = STATE_CONTENT[slug];
    if (!content || content.state !== stateName || !content.conditions) {
      throw new Error(`Missing reviewed state content for ${stateName}.`);
    }
    const file = `state-${slug}.html`;
    let html = read(file);
    const heroExpression = new RegExp(
      `(<h1>Boat Donation in ${stateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} With Clear Local Guidance<\/h1>\s*<p class="sub">)[\s\S]*?(<\/p>)`,
      "i",
    );
    if (heroExpression.test(html)) {
      html = html.replace(heroExpression, `$1${escapeHtmlText(content.intro)}$2`);
    }
    const preflight = content.preflight
      ? `
      <h3>${escapeHtmlText(content.preflightHeading)}</h3>
      <p>${escapeHtmlText(content.preflight)}</p>`
      : "";
    const guide = `<section class="section state-guide" data-seo-module="state-local">
    <div class="wrap">
      <h2>Water, Storage, and Access Factors</h2>
      <p>${escapeHtmlText(content.conditions)}</p>
      <h3>Waterways and storage settings</h3>
      <p>${escapeHtmlText(content.areas)}</p>${preflight}
    </div>
  </section>`;
    const guideExpression = /<section class="section state-guide"[^>]*>[\s\S]*?<\/section>/i;
    if (guideExpression.test(html)) {
      html = html.replace(guideExpression, guide);
    }

    const questions = `<section class="section alt" data-seo-module="state-questions">
    <div class="wrap">
      <h2>Two ${stateName} Questions to Settle Early</h2>
      <div class="cards answer-cards">
        <article class="card"><h3>${escapeHtmlText(content.localQuestion)}</h3><p>You may submit it for individual review. ${escapeHtmlText(content.comparison)} Give the exact marina, yard, mooring, residence, or storage address; describe whether the boat is afloat, blocked, lifted, or trailered; and disclose access limits, balances, liens, and facility deadlines.</p></article>
        <article class="card"><h3>Which ${stateName} ownership records should I gather?</h3><p>${escapeHtmlText(content.paperwork)} Do not sign a title, cancel storage or insurance, or release the boat on the strength of an inquiry alone.</p></article>
      </div>
      <nav class="state-link-grid compact" aria-label="Related ${stateName} boat donation resources"><a href="/guides/boat-donation-paperwork/">Paperwork checklist</a><a href="/guides/how-to-donate-a-boat/">Review steps</a><a href="/faq">Tax and acceptance FAQ</a></nav>
    </div>
  </section>`;
    const questionExpression = /<section class="section alt"\s+data-seo-module="state-(?:question|questions)"[^>]*>[\s\S]*?<\/section>/i;
    if (questionExpression.test(html)) {
      html = html.replace(questionExpression, questions);
    }

    const trust = `<ul class="trust">
        <li><span class="trust-num">1</span><strong>Share the facts</strong><span>Owner, condition, records, storage, and access.</span></li>
        <li><span class="trust-num">2</span><strong>Individual review</strong><span>A submission is a request, not acceptance.</span></li>
        <li><span class="trust-num">3</span><strong>Owner keeps custody</strong><span>Boats for Charity does not move or store the boat.</span></li>
        <li><span class="trust-num">4</span><strong>Buyer arranges pickup</strong><span>After a sale and cleared payment, the buyer coordinates directly with the owner.</span></li>
      </ul>`;
    const trustExpression = /<ul class="trust">[\s\S]*?<\/ul>/i;
    if (trustExpression.test(html)) {
      html = html.replace(trustExpression, trust);
    }
    const compactFooterNavigation = `<nav class="state-footer-links" aria-label="Boat donation resources">
      <h2>Boat Donation Resources</h2>
      <div class="state-link-grid compact"><a href="/boat-donation-by-state">All states</a><a href="/boat-donation-by-city/">City guides</a><a href="/guides/">Donation guides</a><a href="/faq">FAQ</a></div>
    </nav>`;
    const footerNavigationExpression = /<nav class="state-footer-links"[\s\S]*?<\/nav>/i;
    if (footerNavigationExpression.test(html)) {
      html = html.replace(footerNavigationExpression, compactFooterNavigation);
    }
    html = html.replace(
      /\s*<p class="form-reassure tiny">Simply tell us about your boat\.[\s\S]*?<\/p>/i,
      "",
    );
    write(file, html);
  } 
}

function refreshCityDirectory() {
  const relative = "boat-donation-by-city/index.html";
  let html = read(relative);
  html = html
    .replace(/\b\d+ U\.S\. boating communities\b/g, `${cityRecords.length} U.S. boating communities`)
    .replace(/paperwork, and transport questions/gi, "paperwork, and buyer-access questions")
    .replace(/"numberOfItems":\d+/g, `"numberOfItems":${cityRecords.length}`);

  for (const [stateName, records] of citiesByState) {
    const escapedState = stateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sectionExpression = new RegExp(
      `(<section><h2>${escapedState}<\/h2><ul class="state-link-grid">)[\s\S]*?(<\/ul>)`,
      "i",
    );
    if (sectionExpression.test(html)) {
      const links = records
        .map((record) => `<li><a href="/city/${record.slug}/">${escapeHtmlText(record.city)}</a></li>`)
        .join("");
      html = html.replace(sectionExpression, `$1${links}$2`);
    }
  }
  write(relative, html);
}

function addStateCityLinks(html, stateName) {
  const records = citiesByState.get(stateName) || [];
  if (!records.length) return html;
  const featuredRecords = records.slice(0, 4);
  const remainingRecords = records.slice(4);
  const links = remainingRecords
    .map((record) => `<a href="/city/${record.slug}/">${record.city}</a>`)
    .join("");
  const snapshots = featuredRecords
    .map((record) => `<article class="card"><h3><a href="/city/${record.slug}/">${record.city}</a></h3><p>${escapeHtmlText(record.description)}</p></article>`)
    .join("");
  const additionalCities = remainingRecords.length
    ? `
      <h3>More ${stateName} city guides</h3><div class="state-link-grid compact">${links}</div>`
    : "";
  const section = `  <section class="section alt in-state-cities" data-seo-module="state-cities">
    <div class="wrap">
      <h2>Boat Donation Guides for ${stateName} Cities</h2>
      <div class="cards">${snapshots}</div>${additionalCities}
    </div>
  </section>\n`;
  const existing = /\s*<section class="section alt in-state-cities" data-seo-module="state-cities">[\s\S]*?<\/section>/i;
  if (existing.test(html)) return html.replace(existing, `\n${section.trimEnd()}`);
  const nearby = /\s*<section class="section nearby-states">/i;
  if (nearby.test(html)) return html.replace(nearby, `\n${section}$&`);
  return html.replace(/<\/main>/i, `${section}</main>`);
}

function addCityStateLink(html, stateName) {
  const stateSlug = STATE_SLUGS.get(stateName);
  if (!stateSlug) return html;
  const stateRoute = `/state-${stateSlug}`;
  if (new RegExp(`href=["']${stateRoute}["']`, "i").test(html)) return html;
  const section = `<section class="section alt" data-seo-module="city-state"><div class="wrap"><h2>Statewide ${stateName} Boat Donation Information</h2><p>For statewide paperwork, storage, access, and review guidance, see our <a href="${stateRoute}">${stateName} boat donation guide</a>.</p></div></section>`;
  return html.replace(/<section class="section donate">/i, `${section}<section class="section donate">`);
}

function addContentPageNavigation(html) {
  const headerExpression = /<header class="site-header">[\s\S]*?<\/header>/i;
  if (!headerExpression.test(html)) return html;
  const header = `<header class="site-header">
  <div class="wrap">
    <a href="/" aria-label="Boats for Charity home">
      <img src="/assets/logo.png" alt="Boats for Charity logo" class="logo" width="280" height="80" fetchpriority="high" decoding="async">
    </a>
    <button id="menuToggle" class="hamburger" aria-label="Toggle navigation" aria-controls="primaryNav" aria-expanded="false">Menu</button>
    <nav id="primaryNav" class="nav" aria-label="Primary" hidden>
      <a href="/#how">How It Works</a>
      <a href="/#accept">What We Accept</a>
      <a href="/boat-donation-by-state">By State</a>
      <a href="/guides/">Guides</a>
      <a href="/faq">FAQ</a>
      <a href="tel:+18555573703" class="nav-phone" aria-label="Call Boats for Charity">Call (855) 557-3703</a>
      <a href="/donate-a-boat" class="btn btn-primary" aria-label="Donate a Boat">Donate a Boat</a>
    </nav>
  </div>
</header>`;
  let output = html.replace(headerExpression, header).replace(/src=(["'])\/?script\.v12[23]\.js\1/gi, 'src=$1/script.v123.js$1');
  if (!/script\.v123\.js/i.test(output)) {
    output = output.replace(/<\/body>/i, '<script defer src="/script.v123.js"></script>\n</body>');
  }
  return output;
}

function repairHtml(relative) {
  const route = preferredRoute(relative);
  if (!route) return;
  let html = read(relative).replace(/src=(["'])\/?script\.v12[23]\.js\1/gi, 'src=$1/script.v123.js$1');
  html = ensureLangAttribute(html);
  html = ensureOttoPixel(html);
  html = optimizeSearchSnippet(html, relative);
  html = rewriteLinks(html);
  html = setCanonical(html, route);
  html = addSocialMetadata(html, route);

  const stateMatch = relative.match(/^state-([a-z-]+)\.html$/);
  if (stateMatch) {
    html = addStateSchema(html, stateMatch[1], route);
    html = addStateCityLinks(html, STATE_NAMES[stateMatch[1]]);
  }

  const cityRecord = cityRecords.find((record) => record.file === relative);
  if (cityRecord) {
    html = removeCityFaq(html);
    html = addCitySchema(html, cityRecord, route);
    html = addCityStateLink(html, cityRecord.state);
    html = fixCityCtaAndDeadLinks(html, cityRecord);
  }

  if (relative.startsWith("guides/")) {
    html = addGuideSchema(html, relative, route);
  }

  if (relative.startsWith("city/") || relative.startsWith("guides/") || relative === "boat-donation-by-city/index.html") {
    html = addContentPageNavigation(html);
  }

  if (relative === "thanks.html") {
    const robots = '<meta name="robots" content="noindex,follow,noarchive">';
    if (/<meta\s+name=["']robots["'][^>]*>/i.test(html)) {
      html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, robots);
    } else {
      html = html.replace(/</head>/i, `${robots}\n</head>`);
    }
  }

  if (/script\.v123\.js/i.test(html)) {
    html = html.replace(/\s*<script\b[^>]*src=["']\/?track\.v1\.js["'][^>]*><\/script>/gi, "");
  }

  html = syncStructuredData(html, route);

  write(relative, html);
}

const preferredHtml = listFiles(ROOT, (file) => file.endsWith(".html"))
  .map((file) => toPosix(path.relative(ROOT, file)))
  .filter((relative) => preferredRoute(relative));

refreshCityDirectory();
refreshStateSections();
for (const relative of preferredHtml) repairHtml(relative);

for (const file of LEGACY_PAGE_TARGETS.keys()) {
  const absolute = path.join(ROOT, file);
  if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
}

const redirectLines = [...REDIRECT_TARGETS.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([source, target]) => `${source}  ${target}  301!`);
write(
  "_redirects",
  `# Canonical, one-hop redirects. Generated by scripts/repair-seo.mjs.\n${redirectLines.join("\n")}\n`,
);

const sitemapRoutes = preferredHtml
  .filter((file) => file !== "thanks.html")
  .map((file) => preferredRoute(file));
const uniqueSitemapRoutes = [...new Set(sitemapRoutes)].sort((a, b) => {
  if (a === "/") return -1;
  if (b === "/") return 1;
  return a.localeCompare(b);
});
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...uniqueSitemapRoutes.map((route) => `  <url><loc>${ORIGIN}${route}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
write("sitemap.xml", xml);

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "NGO",
  name: "Boats for Charity",
  url: `${ORIGIN}/`,
  description:
    "Boats for Charity is a 501(c)(3) nonprofit that reviews boat donation requests individually and provides clear transfer and donation documentation when a donation is completed.",
  areaServed: { "@type": "Country", name: "United States" },
  nonprofitStatus: "https://schema.org/Nonprofit501c3",
  taxID: "41-2487552",
};
write("schema.json", `${JSON.stringify(organizationSchema, null, 2)}\n`);

console.log(
  `Repaired ${preferredHtml.length} preferred HTML pages, generated ${redirectLines.length} redirects and ${uniqueSitemapRoutes.length} sitemap URLs, and removed ${LEGACY_PAGE_TARGETS.size} legacy files.`,
);
