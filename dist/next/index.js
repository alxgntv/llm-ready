"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/next/index.ts
var next_exports = {};
__export(next_exports, {
  BYPASS_HEADER: () => BYPASS_HEADER,
  LLM_PATH_PREFIX: () => LLM_PATH_PREFIX,
  createLlmsTxtHandler: () => createLlmsTxtHandler,
  createMarkdownHandler: () => createMarkdownHandler,
  llmReady: () => llmReady
});
module.exports = __toCommonJS(next_exports);

// src/next/middleware.ts
var import_server = require("next/server");

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

// src/next/middleware.ts
var BYPASS_HEADER = "x-llm-ready-bypass";
var LLM_PATH_PREFIX = "/llm-md";
function llmReady(request, config) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith(LLM_PATH_PREFIX) || request.headers.get(BYPASS_HEADER) === "true") {
    return null;
  }
  if (pathname === "/llms.txt") {
    const origin = request.nextUrl.origin;
    const headers = new Headers(request.headers);
    headers.set("x-llm-ready-origin", origin);
    return import_server.NextResponse.next({ request: { headers } });
  }
  if (pathname.endsWith(".md")) {
    const originalPath = pathname.slice(0, -3);
    if (isStaticFile(originalPath)) return null;
    const excludePatterns2 = config.exclude || [];
    if (excludePatterns2.some((p) => matchGlob(originalPath, p))) return null;
    console.log(
      `[llm-ready] .md URL requested: ${pathname} \u2192 serving markdown for ${originalPath}`
    );
    return rewriteToMarkdown(request, originalPath);
  }
  if (isStaticFile(pathname)) return null;
  const excludePatterns = config.exclude || [];
  if (excludePatterns.some((p) => matchGlob(pathname, p))) return null;
  const userAgent = request.headers.get("user-agent");
  const acceptHeader = request.headers.get("accept");
  const result = detectBot(userAgent, acceptHeader, config.bots);
  if (!result.isBot) return null;
  if (result.isBlocked) {
    console.log(`[llm-ready] Blocked bot: ${result.botName}, returning 403`);
    return new import_server.NextResponse("Forbidden", { status: 403 });
  }
  console.log(
    `[llm-ready] LLM bot detected (${result.botName || "Accept:text/markdown"}), serving markdown for ${pathname}`
  );
  return rewriteToMarkdown(request, pathname);
}
function rewriteToMarkdown(request, originalPath) {
  const llmPath = `${LLM_PATH_PREFIX}${originalPath}`;
  const rewriteUrl = new URL(llmPath, request.url);
  rewriteUrl.search = request.nextUrl.search;
  const origin = request.nextUrl.origin;
  const headers = new Headers(request.headers);
  headers.set("x-llm-ready-origin", origin);
  return import_server.NextResponse.rewrite(rewriteUrl, { request: { headers } });
}
function isStaticFile(pathname) {
  return /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|json|woff|woff2|ttf|eot|webmanifest|xml|txt)$/i.test(
    pathname
  );
}
function matchGlob(path, pattern) {
  if (pattern.endsWith("/*")) {
    return path.startsWith(pattern.slice(0, -2));
  }
  if (pattern.endsWith("*")) {
    return path.startsWith(pattern.slice(0, -1));
  }
  return path === pattern;
}

// src/next/markdown-route.ts
var import_server2 = require("next/server");

// src/core/converter.ts
var import_turndown = __toESM(require("turndown"));

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
  const td = new import_turndown.default({
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

// src/next/markdown-route.ts
function createMarkdownHandler(config) {
  return async function GET(request, { params }) {
    const pathSegments = params.path || [];
    const originalPath = "/" + pathSegments.join("/");
    const origin = request.headers.get("x-llm-ready-origin") || config.siteUrl.replace(/\/+$/, "");
    const pageUrl = `${origin}${originalPath}`;
    const canonicalUrl = `${config.siteUrl.replace(/\/+$/, "")}${originalPath}`;
    console.log(`[llm-ready] Markdown route handler called for: ${originalPath}`);
    try {
      const SELF_FETCH_TIMEOUT_MS = 5e3;
      console.log(`[llm-ready] Fetching original HTML from: ${pageUrl} (timeout: ${SELF_FETCH_TIMEOUT_MS}ms)`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SELF_FETCH_TIMEOUT_MS);
      let htmlResponse;
      try {
        htmlResponse = await fetch(pageUrl, {
          headers: {
            [BYPASS_HEADER]: "true",
            "User-Agent": "llm-ready/self-fetch"
          },
          redirect: "manual",
          signal: controller.signal
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr.name === "AbortError") {
          console.log(`[llm-ready] Self-fetch timed out after ${SELF_FETCH_TIMEOUT_MS}ms for: ${originalPath}`);
          return new import_server2.NextResponse("Page fetch timed out", { status: 504 });
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);
      if (htmlResponse.status === 301 || htmlResponse.status === 302 || htmlResponse.status === 308) {
        const location = htmlResponse.headers.get("location");
        console.log(
          `[llm-ready] Original page redirects to: ${location}, passing through`
        );
        if (location) {
          return import_server2.NextResponse.redirect(location, htmlResponse.status);
        }
      }
      if (htmlResponse.status === 404) {
        console.log(`[llm-ready] Original page not found: ${pageUrl}`);
        return new import_server2.NextResponse("Not Found", { status: 404 });
      }
      if (!htmlResponse.ok) {
        console.log(
          `[llm-ready] Original page returned ${htmlResponse.status}, forwarding`
        );
        return new import_server2.NextResponse("Error fetching page", {
          status: htmlResponse.status
        });
      }
      const html = await htmlResponse.text();
      console.log(
        `[llm-ready] Fetched ${html.length} bytes of HTML, converting to markdown`
      );
      const result = convertHtmlToMarkdown(html, canonicalUrl, {
        contentSelector: config.converter?.contentSelector,
        removeSelectors: config.converter?.removeSelectors,
        sanitize: {
          stripHiddenContent: config.security?.stripHiddenContent ?? true,
          maxContentSize: config.security?.maxContentSize
        }
      });
      if (!result.markdown) {
        console.log("[llm-ready] Conversion produced empty markdown");
        return new import_server2.NextResponse("No content", { status: 204 });
      }
      const response = new import_server2.NextResponse(result.markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Link": `<${result.canonicalUrl}>; rel="canonical"`,
          "X-Markdown-Tokens": String(result.tokenEstimate),
          "X-Content-Source": pageUrl,
          "Cache-Control": `public, s-maxage=${config.cache?.ttl || 86400}, stale-while-revalidate`
        }
      });
      console.log(
        `[llm-ready] Serving markdown: ${result.markdown.length} chars, ~${result.tokenEstimate} tokens`
      );
      return response;
    } catch (err) {
      console.log(`[llm-ready] Error in markdown route handler: ${err}`);
      return new import_server2.NextResponse("Internal Server Error", { status: 500 });
    }
  };
}

// src/next/llms-txt-route.ts
var import_server3 = require("next/server");

// src/core/llms-txt.ts
function generateLlmsTxt(config) {
  const siteUrl = config.siteUrl.replace(/\/+$/, "");
  console.log(`[llm-ready] Generating llms.txt for ${siteUrl} (static mode, zero HTTP)`);
  const siteName = config.llmsTxt?.siteName || extractHostname(siteUrl);
  const description = config.llmsTxt?.description || "";
  const configPages = config.llmsTxt?.pages || [];
  const optionalPaths = config.llmsTxt?.optional || [];
  const excludePatterns = config.exclude || [];
  const mainPages = [
    { url: siteUrl, title: "Home" }
  ];
  for (const pagePath of configPages) {
    const path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
    if (isExcluded(path, excludePatterns)) continue;
    mainPages.push({
      url: `${siteUrl}${path}`,
      title: pathToTitle(path)
    });
  }
  const optionalPages = [];
  for (const pagePath of optionalPaths) {
    const path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
    if (isExcluded(path, excludePatterns)) continue;
    optionalPages.push({
      url: `${siteUrl}${path}`,
      title: pathToTitle(path)
    });
  }
  const sections = [];
  const customSections = config.llmsTxt?.sections;
  if (customSections && Object.keys(customSections).length > 0) {
    const assigned = /* @__PURE__ */ new Set();
    for (const [title, patterns] of Object.entries(customSections)) {
      const sectionPages = mainPages.filter((page) => {
        const path = new URL(page.url).pathname;
        return patterns.some((p) => matchGlob2(path, p));
      });
      if (sectionPages.length > 0) {
        sections.push({ title, pages: sectionPages });
        sectionPages.forEach((p) => assigned.add(p.url));
      }
    }
    const unassigned = mainPages.filter((p) => !assigned.has(p.url));
    if (unassigned.length > 0) {
      sections.push({ title: "Pages", pages: unassigned });
    }
  } else {
    sections.push({ title: "Pages", pages: mainPages });
  }
  if (optionalPages.length > 0) {
    sections.push({ title: "Optional", pages: optionalPages });
  }
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
      lines.push(`- [${page.title}](${page.url})`);
    }
    lines.push("");
  }
  const result = lines.join("\n").trim() + "\n";
  console.log(`[llm-ready] llms.txt generated: ${result.length} chars, ${sections.length} sections, ${mainPages.length + optionalPages.length} pages`);
  return result;
}
function extractHostname(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function pathToTitle(path) {
  if (path === "/" || path === "") return "Home";
  return path.split("/").filter(Boolean).map((s) => s.replace(/-/g, " ")).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" \u2014 ");
}
function isExcluded(path, patterns) {
  return patterns.some((p) => matchGlob2(path, p));
}
function matchGlob2(path, pattern) {
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

// src/next/llms-txt-route.ts
function createLlmsTxtHandler(config) {
  return async function GET(_request) {
    console.log("[llm-ready] llms.txt route handler called");
    try {
      const content = generateLlmsTxt(config);
      console.log(`[llm-ready] Serving llms.txt: ${content.length} chars`);
      return new import_server3.NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": `public, s-maxage=${config.cache?.ttl || 86400}, stale-while-revalidate`
        }
      });
    } catch (err) {
      console.log(`[llm-ready] Error generating llms.txt: ${err}`);
      return new import_server3.NextResponse("Error generating llms.txt", { status: 500 });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BYPASS_HEADER,
  LLM_PATH_PREFIX,
  createLlmsTxtHandler,
  createMarkdownHandler,
  llmReady
});
//# sourceMappingURL=index.js.map