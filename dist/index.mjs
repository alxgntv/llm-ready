// src/core/converter.ts
import TurndownService from "turndown";

// src/core/sanitizer.ts
var INVISIBLE_UNICODE_REGEX = /[\u200B\u200C\u200D\u200E\u200F\u2028\u2029\u2060\u2061\u2062\u2063\u2064\u2066\u2067\u2068\u2069\u206A\u206B\u206C\u206D\u206E\u206F\uFEFF\uFFF9\uFFFA\uFFFB]/g;
var ELEMENTS_TO_REMOVE = [
  "script",
  "style",
  "noscript",
  "iframe",
  "object",
  "embed",
  "svg",
  "canvas",
  "template",
  'link[rel="stylesheet"]',
  'link[rel="preload"]',
  'link[rel="prefetch"]',
  "meta"
];
var HIDDEN_CSS_PATTERNS = [
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /opacity\s*:\s*0(?:[;\s]|$)/i,
  /font-size\s*:\s*0(?:px|em|rem|%)?(?:[;\s]|$)/i,
  /height\s*:\s*0(?:px|em|rem)?(?:[;\s]|$)/i,
  /width\s*:\s*0(?:px|em|rem)?(?:[;\s]|$)/i,
  /overflow\s*:\s*hidden/i,
  /clip\s*:\s*rect\s*\(\s*0/i,
  /position\s*:\s*absolute[^;]*left\s*:\s*-\d{4,}/i,
  /position\s*:\s*absolute[^;]*top\s*:\s*-\d{4,}/i
];
function sanitizeHtml(html, options = {}) {
  const { stripHiddenContent = true, maxContentSize = 2 * 1024 * 1024 } = options;
  if (html.length > maxContentSize) {
    console.log(
      `[llm-ready] Content too large (${html.length} bytes > ${maxContentSize}), skipping`
    );
    return "";
  }
  let result = html;
  result = result.replace(/<!--[\s\S]*?-->/g, "");
  console.log("[llm-ready] Sanitizer: removed HTML comments");
  for (const tag of ELEMENTS_TO_REMOVE) {
    const tagName = tag.replace(/\[.*\]/, "");
    const regex = new RegExp(
      `<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`,
      "gi"
    );
    result = result.replace(regex, "");
    const selfClosing = new RegExp(`<${tagName}\\b[^>]*/?>`, "gi");
    result = result.replace(selfClosing, "");
  }
  console.log("[llm-ready] Sanitizer: removed script/style/iframe/meta elements");
  if (stripHiddenContent) {
    for (const pattern of HIDDEN_CSS_PATTERNS) {
      const styleAttrRegex = new RegExp(
        `<(\\w+)\\b[^>]*style\\s*=\\s*"[^"]*${pattern.source}[^"]*"[^>]*>[\\s\\S]*?<\\/\\1>`,
        "gi"
      );
      result = result.replace(styleAttrRegex, "");
      const singleQuoteRegex = new RegExp(
        `<(\\w+)\\b[^>]*style\\s*=\\s*'[^']*${pattern.source}[^']*'[^>]*>[\\s\\S]*?<\\/\\1>`,
        "gi"
      );
      result = result.replace(singleQuoteRegex, "");
    }
    console.log("[llm-ready] Sanitizer: removed CSS-hidden elements");
  }
  result = result.replace(
    /<(\w+)\b[^>]*aria-hidden\s*=\s*["']true["'][^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );
  result = result.replace(/<input\b[^>]*type\s*=\s*["']hidden["'][^>]*\/?>/gi, "");
  result = result.replace(INVISIBLE_UNICODE_REGEX, "");
  console.log("[llm-ready] Sanitizer: removed invisible Unicode characters");
  result = result.replace(/\s+data-[\w-]+=["'][^"']*["']/gi, "");
  return result;
}
function extractMainContent(html, contentSelector) {
  if (contentSelector) {
    const extracted = extractBySelector(html, contentSelector);
    if (extracted) {
      console.log(
        `[llm-ready] Extracted content using custom selector: ${contentSelector}`
      );
      return extracted;
    }
  }
  const mainExtracted = extractBySelector(html, "main");
  if (mainExtracted) {
    console.log("[llm-ready] Auto-detected main content using <main>");
    return mainExtracted;
  }
  const articleCount = (html.match(/<article\b/gi) || []).length;
  if (articleCount === 1) {
    const articleExtracted = extractBySelector(html, "article");
    if (articleExtracted) {
      console.log("[llm-ready] Auto-detected main content using single <article>");
      return articleExtracted;
    }
  } else if (articleCount > 1) {
    console.log(`[llm-ready] Found ${articleCount} <article> tags, skipping \u2014 falling back to <body>`);
  }
  const roleMainMatch = html.match(
    /<(\w+)\b[^>]*role\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/\1>/i
  );
  if (roleMainMatch) {
    console.log('[llm-ready] Auto-detected main content using [role="main"]');
    return roleMainMatch[2];
  }
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    console.log("[llm-ready] Falling back to <body> content");
    return bodyMatch[1];
  }
  console.log("[llm-ready] No content container found, using full HTML");
  return html;
}
function extractBySelector(html, selector) {
  const regex = new RegExp(
    `<${selector}\\b[^>]*>([\\s\\S]*?)<\\/${selector}>`,
    "i"
  );
  const match = html.match(regex);
  return match ? match[1] : null;
}
function removeChrome(html) {
  let result = html;
  const chromeTags = ["nav", "header", "footer", "aside"];
  for (const tag of chromeTags) {
    const regex = new RegExp(
      `<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,
      "gi"
    );
    result = result.replace(regex, "");
  }
  console.log("[llm-ready] Removed nav/header/footer/aside chrome");
  return result;
}

// src/core/converter.ts
function convertHtmlToMarkdown(html, pageUrl, options = {}) {
  console.log(`[llm-ready] Converting page: ${pageUrl}`);
  const title = extractTitle(html);
  const description = extractDescription(html);
  const canonical = extractCanonical(html) || pageUrl;
  console.log(
    `[llm-ready] Page metadata: title="${title.substring(0, 60)}", description="${description.substring(0, 60)}"`
  );
  const sanitized = sanitizeHtml(html, options.sanitize);
  if (!sanitized) {
    console.log("[llm-ready] Sanitizer returned empty content, aborting");
    return {
      markdown: "",
      title,
      description,
      canonicalUrl: canonical,
      tokenEstimate: 0
    };
  }
  let content = extractMainContent(sanitized, options.contentSelector);
  content = removeChrome(content);
  if (options.removeSelectors) {
    for (const sel of options.removeSelectors) {
      const regex = new RegExp(
        `<${sel}\\b[^>]*>[\\s\\S]*?<\\/${sel}>`,
        "gi"
      );
      content = content.replace(regex, "");
    }
    console.log(
      `[llm-ready] Removed ${options.removeSelectors.length} custom selectors`
    );
  }
  const turndown = createTurndownService();
  let markdown = turndown.turndown(content);
  markdown = cleanMarkdown(markdown);
  const fullMarkdown = buildFrontmatter(title, description, canonical) + markdown;
  const tokenEstimate = estimateTokens(fullMarkdown);
  console.log(
    `[llm-ready] Conversion complete: ${fullMarkdown.length} chars, ~${tokenEstimate} tokens`
  );
  return {
    markdown: fullMarkdown,
    title,
    description,
    canonicalUrl: canonical,
    tokenEstimate
  };
}
function createTurndownService() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
    hr: "---"
  });
  td.remove(["button", "form", "input", "select", "textarea", "label"]);
  td.addRule("skipImages", {
    filter: "img",
    replacement: (_content, node) => {
      const el = node;
      const alt = el.getAttribute("alt");
      return alt ? `[Image: ${alt}]` : "";
    }
  });
  td.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: (content) => {
      return ` ${content.trim().replace(/\n/g, " ")} |`;
    }
  });
  td.addRule("tableRow", {
    filter: "tr",
    replacement: (content) => {
      return `|${content}
`;
    }
  });
  td.addRule("table", {
    filter: "table",
    replacement: (_content, node) => {
      const el = node;
      const rows = el.querySelectorAll?.("tr");
      if (!rows || rows.length === 0) return _content;
      return `
${_content}
`;
    }
  });
  td.addRule("details", {
    filter: "details",
    replacement: (content) => {
      return `
${content}
`;
    }
  });
  td.addRule("summary", {
    filter: "summary",
    replacement: (content) => {
      return `
**${content.trim()}**
`;
    }
  });
  return td;
}
function extractTitle(html) {
  const ogTitle = html.match(
    /<meta\s[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  if (ogTitle) return ogTitle[1];
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : "";
}
function extractDescription(html) {
  const ogDesc = html.match(
    /<meta\s[^>]*property\s*=\s*["']og:description["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  if (ogDesc) return ogDesc[1];
  const descMatch = html.match(
    /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  return descMatch ? descMatch[1] : "";
}
function extractCanonical(html) {
  const match = html.match(
    /<link\s[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']*)["']/i
  );
  return match ? match[1] : null;
}
function buildFrontmatter(title, description, canonical) {
  const lines = ["---"];
  if (title) lines.push(`title: "${title.replace(/"/g, '\\"')}"`);
  if (description)
    lines.push(`description: "${description.replace(/"/g, '\\"')}"`);
  lines.push(`canonical: ${canonical}`);
  lines.push("---\n\n");
  return lines.join("\n");
}
function cleanMarkdown(md) {
  let result = md;
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.split("\n").map((line) => line.trimEnd()).join("\n");
  result = result.trim();
  return result;
}
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// src/core/sitemap-parser.ts
async function discoverSitemap(siteUrl, configSitemap) {
  const base = siteUrl.replace(/\/+$/, "");
  if (configSitemap) {
    const url = configSitemap.startsWith("http") ? configSitemap : `${base}${configSitemap.startsWith("/") ? "" : "/"}${configSitemap}`;
    console.log(`[llm-ready] Trying config sitemap: ${url}`);
    if (await urlExists(url)) {
      console.log(`[llm-ready] Found sitemap from config: ${url}`);
      return url;
    }
  }
  try {
    const robotsUrl = `${base}/robots.txt`;
    console.log(`[llm-ready] Checking robots.txt for Sitemap directive: ${robotsUrl}`);
    const res = await fetch(robotsUrl);
    if (res.ok) {
      const text = await res.text();
      const sitemapLines = text.split("\n").filter((line) => line.toLowerCase().startsWith("sitemap:")).map((line) => line.replace(/^sitemap:\s*/i, "").trim());
      if (sitemapLines.length > 0) {
        console.log(
          `[llm-ready] Found ${sitemapLines.length} sitemap(s) in robots.txt: ${sitemapLines[0]}`
        );
        return sitemapLines[0];
      }
    }
  } catch (err) {
    console.log(`[llm-ready] Could not fetch robots.txt: ${err}`);
  }
  const standardPaths = ["/sitemap.xml", "/sitemap_index.xml"];
  for (const path of standardPaths) {
    const url = `${base}${path}`;
    console.log(`[llm-ready] Trying standard sitemap path: ${url}`);
    if (await urlExists(url)) {
      console.log(`[llm-ready] Found sitemap at standard path: ${url}`);
      return url;
    }
  }
  console.log("[llm-ready] No sitemap found anywhere");
  return null;
}
async function parseSitemap(sitemapUrl) {
  console.log(`[llm-ready] Parsing sitemap: ${sitemapUrl}`);
  try {
    const res = await fetch(sitemapUrl);
    if (!res.ok) {
      console.log(
        `[llm-ready] Sitemap fetch failed: ${res.status} ${res.statusText}`
      );
      return [];
    }
    const xml = await res.text();
    if (xml.includes("<sitemapindex")) {
      console.log("[llm-ready] Detected sitemap index, parsing child sitemaps");
      const childUrls = extractXmlValues(xml, "loc");
      const allPages = [];
      for (const childUrl of childUrls) {
        const childPages = await parseSitemap(childUrl);
        allPages.push(...childPages);
      }
      console.log(
        `[llm-ready] Sitemap index total: ${allPages.length} pages from ${childUrls.length} sitemaps`
      );
      return allPages;
    }
    const pages = parseUrlset(xml);
    console.log(`[llm-ready] Parsed ${pages.length} pages from sitemap`);
    return pages;
  } catch (err) {
    console.log(`[llm-ready] Sitemap parse error: ${err}`);
    return [];
  }
}
async function crawlHomepage(siteUrl, maxPages = 100) {
  const base = siteUrl.replace(/\/+$/, "");
  console.log(
    `[llm-ready] No sitemap found, crawling homepage for links (max ${maxPages})`
  );
  try {
    const res = await fetch(base);
    if (!res.ok) return [{ url: base }];
    const html = await res.text();
    const links = extractInternalLinks(html, base);
    const unique = [.../* @__PURE__ */ new Set([base, ...links])].slice(0, maxPages);
    console.log(`[llm-ready] Crawled ${unique.length} internal links from homepage`);
    return unique.map((url) => ({ url }));
  } catch (err) {
    console.log(`[llm-ready] Homepage crawl failed: ${err}`);
    return [{ url: base }];
  }
}
async function discoverPages(siteUrl, configSitemap) {
  const sitemapUrl = await discoverSitemap(siteUrl, configSitemap);
  if (sitemapUrl) {
    const pages = await parseSitemap(sitemapUrl);
    if (pages.length > 0) return pages;
  }
  return crawlHomepage(siteUrl);
}
function parseUrlset(xml) {
  const pages = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/gi) || [];
  for (const block of urlBlocks) {
    const loc = extractFirstXmlValue(block, "loc");
    if (!loc) continue;
    const lastmod = extractFirstXmlValue(block, "lastmod");
    pages.push({ url: loc, lastmod: lastmod || void 0 });
  }
  return pages;
}
function extractXmlValues(xml, tag) {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, "gi");
  const values = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    values.push(match[1].trim());
  }
  return values;
}
function extractFirstXmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}
function extractInternalLinks(html, baseUrl) {
  const hrefRegex = /href\s*=\s*["']([^"'#]+)["']/gi;
  const links = [];
  let match;
  const baseDomain = new URL(baseUrl).origin;
  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      continue;
    }
    if (href.startsWith("/")) {
      href = `${baseDomain}${href}`;
    }
    if (href.startsWith(baseDomain)) {
      if (/\.(png|jpg|jpeg|gif|svg|css|js|ico|webp|woff|pdf)$/i.test(href)) {
        continue;
      }
      links.push(href.replace(/\/+$/, ""));
    }
  }
  return links;
}
async function urlExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

// src/core/llms-txt.ts
var OPTIONAL_PATTERNS_DEFAULT = [
  "/terms",
  "/privacy",
  "/cookie",
  "/about",
  "/contacts",
  "/career",
  "/affiliate",
  "/refund",
  "/payment-methods"
];
async function generateLlmsTxt(config) {
  const siteUrl = config.siteUrl.replace(/\/+$/, "");
  const fetchOrigin = (config._fetchOrigin || siteUrl).replace(/\/+$/, "");
  console.log(`[llm-ready] Generating llms.txt for ${siteUrl} (fetching via ${fetchOrigin})`);
  const sitemapPages = await discoverPages(fetchOrigin, config.sitemap);
  console.log(`[llm-ready] Discovered ${sitemapPages.length} pages for llms.txt`);
  const excludePatterns = config.exclude || [];
  const filteredPages = sitemapPages.filter(
    (page) => !isExcluded(page.url, siteUrl, excludePatterns)
  );
  console.log(
    `[llm-ready] After exclusions: ${filteredPages.length} pages (excluded ${sitemapPages.length - filteredPages.length})`
  );
  const canonicalPages = filteredPages.map((page) => ({
    ...page,
    url: page.url.replace(fetchOrigin, siteUrl)
  }));
  const pagesWithMeta = await fetchPageMetadata(filteredPages, canonicalPages, fetchOrigin, siteUrl);
  const optionalPatterns = config.llmsTxt?.optional || OPTIONAL_PATTERNS_DEFAULT;
  const customSections = config.llmsTxt?.sections;
  const sections = groupIntoSections(pagesWithMeta, siteUrl, optionalPatterns, customSections);
  const siteName = await fetchSiteName(fetchOrigin);
  const siteDescription = config.llmsTxt?.description || await fetchSiteDescription(fetchOrigin);
  const llmsTxt = buildLlmsTxt(siteName, siteDescription, sections);
  console.log(
    `[llm-ready] llms.txt generated: ${llmsTxt.length} chars, ${sections.length} sections`
  );
  return llmsTxt;
}
function buildLlmsTxt(siteName, description, sections) {
  const lines = [];
  lines.push(`# ${siteName}`);
  lines.push("");
  if (description) {
    lines.push(`> ${description}`);
    lines.push("");
  }
  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    for (const page of section.pages) {
      const desc = page.description ? `: ${page.description}` : "";
      lines.push(`- [${page.title}](${page.url})${desc}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}
function groupIntoSections(pages, siteUrl, optionalPatterns, customSections) {
  if (customSections && Object.keys(customSections).length > 0) {
    return groupByCustomSections(pages, siteUrl, customSections, optionalPatterns);
  }
  return autoGroupSections(pages, siteUrl, optionalPatterns);
}
function groupByCustomSections(pages, siteUrl, customSections, optionalPatterns) {
  const sections = [];
  const assigned = /* @__PURE__ */ new Set();
  for (const [title, patterns] of Object.entries(customSections)) {
    const sectionPages = [];
    for (const page of pages) {
      const path = getPath(page.url, siteUrl);
      if (patterns.some((p) => matchGlob(path, p))) {
        sectionPages.push(page);
        assigned.add(page.url);
      }
    }
    if (sectionPages.length > 0) {
      sections.push({ title, pages: sectionPages });
    }
  }
  const optional = [];
  const other = [];
  for (const page of pages) {
    if (assigned.has(page.url)) continue;
    const path = getPath(page.url, siteUrl);
    if (optionalPatterns.some((p) => path.startsWith(p))) {
      optional.push(page);
    } else {
      other.push(page);
    }
  }
  if (other.length > 0) {
    sections.push({ title: "Pages", pages: other });
  }
  if (optional.length > 0) {
    sections.push({ title: "Optional", pages: optional });
  }
  return sections;
}
function autoGroupSections(pages, siteUrl, optionalPatterns) {
  const groups = {};
  const optional = [];
  const homepage = [];
  for (const page of pages) {
    const path = getPath(page.url, siteUrl);
    if (path === "" || path === "/") {
      homepage.push(page);
      continue;
    }
    if (optionalPatterns.some((p) => path.startsWith(p))) {
      optional.push(page);
      continue;
    }
    const firstSegment = path.split("/").filter(Boolean)[0] || "pages";
    const groupName = firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(page);
  }
  const sections = [];
  if (homepage.length > 0) {
    sections.push({ title: "Main", pages: homepage });
  }
  const sortedGroups = Object.entries(groups).sort(
    (a, b) => b[1].length - a[1].length
  );
  for (const [title, groupPages] of sortedGroups) {
    sections.push({ title, pages: groupPages });
  }
  if (optional.length > 0) {
    sections.push({ title: "Optional", pages: optional });
  }
  return sections;
}
async function fetchPageMetadata(fetchPages, canonicalPages, fetchOrigin, siteUrl) {
  console.log(
    `[llm-ready] Fetching metadata for ${fetchPages.length} pages (batched)`
  );
  const BATCH_SIZE = 10;
  const results = [];
  for (let i = 0; i < fetchPages.length; i += BATCH_SIZE) {
    const fetchBatch = fetchPages.slice(i, i + BATCH_SIZE);
    const canonicalBatch = canonicalPages.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      fetchBatch.map(async (page, idx) => {
        const canonicalUrl = canonicalBatch[idx].url;
        try {
          const res = await fetch(page.url, {
            headers: { "User-Agent": "llm-ready/metadata-fetch" }
          });
          if (!res.ok) return null;
          const html = await res.text();
          const title = extractMetaTitle(html) || getPathLabel(canonicalUrl, siteUrl);
          const description = extractMetaDescription(html);
          return { url: canonicalUrl, title, description };
        } catch {
          return {
            url: canonicalUrl,
            title: getPathLabel(canonicalUrl, siteUrl),
            description: void 0
          };
        }
      })
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }
  console.log(`[llm-ready] Fetched metadata for ${results.length} pages`);
  return results;
}
async function fetchSiteName(siteUrl) {
  try {
    const res = await fetch(siteUrl);
    if (!res.ok) return new URL(siteUrl).hostname;
    const html = await res.text();
    const title = extractMetaTitle(html);
    const siteName = html.match(
      /<meta\s[^>]*property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']*)["']/i
    )?.[1] || html.match(
      /<meta\s[^>]*name\s*=\s*["']application-name["'][^>]*content\s*=\s*["']([^"']*)["']/i
    )?.[1];
    return siteName || title || new URL(siteUrl).hostname;
  } catch {
    return new URL(siteUrl).hostname;
  }
}
async function fetchSiteDescription(siteUrl) {
  try {
    const res = await fetch(siteUrl);
    if (!res.ok) return "";
    const html = await res.text();
    return extractMetaDescription(html) || "";
  } catch {
    return "";
  }
}
function extractMetaTitle(html) {
  const ogTitle = html.match(
    /<meta\s[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  if (ogTitle) return ogTitle[1];
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return titleTag ? titleTag[1].trim() : "";
}
function extractMetaDescription(html) {
  const ogDesc = html.match(
    /<meta\s[^>]*property\s*=\s*["']og:description["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  if (ogDesc) return ogDesc[1];
  const desc = html.match(
    /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  return desc ? desc[1] : void 0;
}
function getPath(url, siteUrl) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url.replace(siteUrl, "").replace(/\/+$/, "") || "/";
  }
}
function getPathLabel(url, siteUrl) {
  const path = getPath(url, siteUrl);
  if (path === "/" || path === "") return "Home";
  return path.split("/").filter(Boolean).map((s) => s.replace(/-/g, " ")).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" \u2014 ");
}
function isExcluded(url, siteUrl, patterns) {
  const path = getPath(url, siteUrl);
  return patterns.some((p) => matchGlob(path, p));
}
function matchGlob(path, pattern) {
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return path.startsWith(prefix);
  }
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return path.startsWith(prefix);
  }
  return path === pattern;
}

// src/detect/bot.ts
var DEFAULT_LLM_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "GoogleOther",
  "CCBot",
  "PerplexityBot",
  "Applebot-Extended",
  "cohere-ai",
  "Meta-ExternalAgent",
  "Amazonbot",
  "AI2Bot",
  "OAI-SearchBot",
  "YouBot",
  "Bytespider",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot"
];
function detectBot(userAgent, acceptHeader, options = {}) {
  const ua = userAgent || "";
  const accept = acceptHeader || "";
  const acceptsMarkdown = accept.includes("text/markdown") || accept.includes("text/x-markdown");
  const allBots = [...DEFAULT_LLM_USER_AGENTS, ...options.additionalUserAgents || []];
  const blockList = options.blockUserAgents || [];
  let matchedBot = null;
  for (const bot of allBots) {
    if (ua.includes(bot)) {
      matchedBot = bot;
      break;
    }
  }
  let isBlocked = false;
  if (matchedBot) {
    for (const blocked of blockList) {
      if (ua.includes(blocked)) {
        isBlocked = true;
        break;
      }
    }
  }
  const isBot = acceptsMarkdown || matchedBot !== null;
  console.log(
    `[llm-ready] Bot detection: isBot=${isBot}, botName=${matchedBot}, acceptsMarkdown=${acceptsMarkdown}, isBlocked=${isBlocked}, ua="${ua.substring(0, 80)}"`
  );
  return {
    isBot,
    isBlocked,
    botName: matchedBot,
    acceptsMarkdown
  };
}
function isLlmBot(userAgent, acceptHeader, options = {}) {
  return detectBot(userAgent, acceptHeader, options).isBot;
}

// src/core/types.ts
var DEFAULT_CONFIG = {
  cache: { ttl: 86400 },
  security: { maxContentSize: 2 * 1024 * 1024, stripHiddenContent: true },
  exclude: ["/api/*", "/_next/*"]
};
export {
  DEFAULT_CONFIG,
  convertHtmlToMarkdown,
  crawlHomepage,
  detectBot,
  discoverPages,
  discoverSitemap,
  extractMainContent,
  generateLlmsTxt,
  isLlmBot,
  parseSitemap,
  removeChrome,
  sanitizeHtml
};
//# sourceMappingURL=index.mjs.map