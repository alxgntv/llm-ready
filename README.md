# llm-ready

**Make your website a favorite of AI.** This library converts your HTML pages into clean Markdown so LLMs can read them faster, cheaper, and recommend your site more often in their answers.

LLMs don't need your navigation bars, cookie banners, JavaScript bundles, or styled buttons. They need **structured text in the fewest tokens possible**. Every extra token costs money — both for training and inference. The cleaner and smaller the content, the more likely AI models will crawl, index, and cite your site.

`llm-ready` strips away everything LLMs don't need and serves them a clean Markdown version of every page on your site. Automatically.

## Before & After

Here's what happens to a real page when `llm-ready` processes it:

| | HTML (what users see) | Markdown (what LLMs get) |
|---|---|---|
| **Content** | Navigation, footer, scripts, styles, tracking pixels, cookie banners, images, SVGs, JSON-LD, ads | Pure text: headings, paragraphs, lists, links, tables |
| **Size** | ~85 KB | ~4 KB |
| **Tokens** | ~21,000 | ~1,000 |
| **Cost to process** | ~$0.06 per page (GPT-4o) | ~$0.003 per page (GPT-4o) |
| **Parse time** | Needs HTML parser + cleanup | Ready to use instantly |
| **LLM preference** | Low — noisy, expensive, hard to parse | High — clean, cheap, structured |

Real example — `https://yoursite.com/pricing`:

**HTML version** (what GPTBot currently sees):
```html
<!DOCTYPE html><html><head><script src="analytics.js">...
<nav class="sticky top-0 z-50">...200 lines of navigation...</nav>
<div class="hero-section bg-gradient-to-r from-blue-500">
  <h1 class="text-5xl font-bold text-white">Pricing</h1>
  <img src="hero.webp" width="1200" loading="lazy" />
</div>
...600 more lines of styled HTML, scripts, tracking...
<footer>...150 lines of footer...</footer>
<script>window.dataLayer=[...]</script></html>
```

**Markdown version** (what GPTBot gets with `llm-ready`):
```markdown
---
title: "Pricing"
description: "Simple, transparent pricing for teams of all sizes."
canonical: https://yoursite.com/pricing
---

# Pricing

Simple, transparent pricing for teams of all sizes.

## Starter — $9/month
- 1,000 API calls
- 5 team members
- Email support

## Pro — $49/month
- 50,000 API calls
- Unlimited team members
- Priority support
- Custom integrations

## Enterprise — Contact us
- Unlimited API calls
- Dedicated account manager
- SLA guarantee
- SSO & SAML
```

**20x fewer tokens. 20x cheaper. Infinitely easier for LLMs to understand and cite.**

## Free Alternative to Cloudflare

Cloudflare launched [Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) in February 2026 — it does the same thing (HTML → Markdown via `Accept: text/markdown`) but requires a Cloudflare Pro plan (**$25+/month**).

| | Cloudflare Markdown for Agents | llm-ready |
|---|---|---|
| **Price** | $25+/month (Pro or Business only) | **Free and open-source** |
| **How it works** | Edge conversion at CDN level | Application-level conversion |
| **Requires Cloudflare** | Yes | No — works anywhere |
| **Framework support** | Any (CDN-level) | Next.js (more coming) |
| **`.md` URL support** | No (Accept header only) | Yes — `/page.md` URLs for any page |
| **`llms.txt` generation** | No | Yes — auto-generated from sitemap |
| **Bot auto-detection** | No (manual config) | Yes — 17+ LLM bots detected (list is actively maintained) |
| **Content sanitization** | Basic | Advanced — prompt injection protection |
| **Self-hosted** | No | Yes — runs on your server |

## Who Already Does This

The `.md` URL pattern and Markdown-first approach for AI bots is already used in production by major companies:

**Stripe** serves Markdown versions of their entire documentation. Any docs URL + `.md` returns clean Markdown:
- [https://docs.stripe.com/mcp](https://docs.stripe.com/mcp) — HTML for humans
- [https://docs.stripe.com/mcp.md](https://docs.stripe.com/mcp.md) — Markdown for LLMs

Stripe authors content in [Markdoc](https://markdoc.dev/) (their open-source framework) and renders two outputs from the same source: styled HTML for browsers and plain Markdown for AI tools. Their [Building with LLMs](https://docs.stripe.com/building-with-llms) guide explains why: Markdown contains fewer formatting tokens, includes collapsed content that HTML hides, and lets LLMs parse document hierarchy naturally.

**Vercel / Next.js** serves their full documentation as a single file for LLMs:
- [https://nextjs.org/docs/llms-full.txt](https://nextjs.org/docs/llms-full.txt)

**Cloudflare** converts HTML to Markdown at the edge for Pro/Business customers via `Accept: text/markdown` content negotiation.

`llm-ready` brings this same capability to any Next.js site — for free, without rewriting your content pipeline.

## Integration Prompt (Cursor / Claude Code)

Copy this prompt into **Cursor**, **Claude Code**, **Windsurf**, or any AI coding assistant to automatically integrate `llm-ready` into your project:

```
Integrate the npm library "llm-ready" (https://github.com/alxgntv/llm-ready) into my Next.js project.

## What llm-ready does

llm-ready is a library that automatically converts your HTML pages into clean Markdown for LLM bots. It works via:
- `.md` URLs — append .md to any page URL to get its Markdown version (/about → /about.md)
- Auto-detection of LLM bots by User-Agent (GPTBot, ClaudeBot, PerplexityBot, etc.) — serves them Markdown transparently
- Accept header — responds to Accept: text/markdown
- /llms.txt — auto-generated site catalog per llmstxt.org spec

The pipeline: middleware detects .md URL or LLM bot → rewrites to internal /llm-md/[...path] route handler → handler fetches original HTML (with bypass header to avoid loop) → sanitize → extract main content → convert to markdown → respond with text/markdown and canonical link header.

## Configuration reference (LlmReadyConfig)

The config file is llm-ready.config.ts in the project root. Here is the full interface with all available options:

interface LlmReadyConfig {
  // REQUIRED. Base URL of the site (e.g. 'https://example.com').
  // Use environment variable like process.env.NEXT_PUBLIC_SITE_URL or hardcode.
  siteUrl: string;

  // OPTIONAL. Path to sitemap.xml (e.g. '/sitemap.xml', '/server-sitemap.xml').
  // If not set, auto-discovered: checks robots.txt → tries /sitemap.xml, /sitemap_index.xml → crawls homepage links.
  sitemap?: string;

  // OPTIONAL. Glob patterns for paths to EXCLUDE from markdown conversion.
  // Default: ['/api/*', '/_next/*']
  // Add all private/authenticated routes here: dashboard, admin, onboarding, internal API routes, etc.
  // The /llm-md/* path should always be excluded to prevent recursion.
  exclude?: string[];

  // OPTIONAL. llms.txt generation settings.
  llmsTxt?: {
    // Custom sections: key = section title, value = glob patterns for URLs.
    // Pages matching patterns are grouped under that heading in llms.txt.
    // Example: { 'Documentation': ['/docs/*'], 'Blog': ['/blog/*'] }
    sections?: Record<string, string[]>;

    // URL patterns placed into the "## Optional" section of llms.txt.
    // Use for legal/secondary pages: terms, privacy, cookie-policy, about, etc.
    optional?: string[];

    // Manual site description. Overrides auto-detected <meta description> from homepage.
    description?: string;
  };

  // OPTIONAL. Cache settings.
  cache?: {
    // TTL in seconds for cached markdown responses. Default: 86400 (24 hours).
    ttl?: number;
  };

  // OPTIONAL. Bot detection settings.
  bots?: {
    // Additional User-Agent substrings to detect as LLM bots (on top of the built-in list).
    additionalUserAgents?: string[];

    // User-Agent substrings to block with 403 Forbidden. Example: ['Bytespider']
    blockUserAgents?: string[];
  };

  // OPTIONAL. HTML-to-Markdown converter settings.
  converter?: {
    // CSS selector for main content area. Default: auto-detect (main, article, [role=main]).
    // Set if your site uses a non-standard layout container.
    contentSelector?: string;

    // Additional CSS selectors to remove from HTML before conversion.
    // Example: ['[data-ad]', '.cookie-banner', '.sidebar']
    removeSelectors?: string[];
  };

  // OPTIONAL. Security settings.
  security?: {
    // Max HTML content size in bytes. Default: 2MB (2 * 1024 * 1024).
    // Rejects pages larger than this to prevent abuse.
    maxContentSize?: number;

    // Strip CSS-hidden content (display:none, visibility:hidden, opacity:0).
    // Default: true. Protects against prompt injection via hidden text.
    stripHiddenContent?: boolean;
  };
}

## Steps

1. Run: npm install llm-ready

2. Analyze my project:
   - Find my middleware.ts file
   - Find my next.config.js/ts
   - Find my sitemap (sitemap.xml, server-sitemap.xml, or similar)
   - Identify which paths are public pages and which are private (dashboard, admin, api routes)
   - Check my .env files for the production site URL

3. Create llm-ready.config.ts in the project root:
   - siteUrl from my environment variables (e.g. process.env.NEXT_PUBLIC_SITE_URL) or package.json homepage
   - sitemap path if my project has a non-standard sitemap location
   - exclude patterns for all private/authenticated routes (dashboard, admin, onboarding, etc.) + /llm-md/*
   - llmsTxt.optional for legal pages (terms, privacy, cookie-policy, about, etc.)
   - bots.blockUserAgents for any bots I want to block (e.g. ['Bytespider'])
   - converter.contentSelector if my pages use a non-standard main content container
   - converter.removeSelectors for ads, banners, or other elements that should not appear in markdown

4. Update my middleware.ts:
   - Add import: import { llmReady } from 'llm-ready/next';
   - Add import: import llmReadyConfig from '../llm-ready.config'; (adjust path based on project structure)
   - Add llmReady(request, llmReadyConfig) check as the FIRST thing in the middleware function (before any other logic)
   - If the result is not null, return it immediately
   - Add '/(.*)\\.md' to the middleware matcher array so .md URLs are processed
   - Do NOT remove or change any existing middleware logic

5. Create two route handler files:
   - app/llm-md/[...path]/route.ts:
     import { createMarkdownHandler } from 'llm-ready/next';
     import config from '../../../../llm-ready.config'; // adjust relative path
     export const GET = createMarkdownHandler(config);
     export const revalidate = 86400;

   - app/llms.txt/route.ts:
     import { createLlmsTxtHandler } from 'llm-ready/next';
     import config from '../../../llm-ready.config'; // adjust relative path
     export const GET = createLlmsTxtHandler(config);
     export const revalidate = 86400;

6. Update my robots.txt:
   - Add User-agent + Crawl-delay: 10 rules for GPTBot, ClaudeBot, Google-Extended, PerplexityBot
   - Add Disallow: / for Bytespider (or any bots specified in config.bots.blockUserAgents)
   - Add Allow: /llms.txt
   - Keep all existing rules unchanged

7. Test by starting the dev server and running:
   - curl http://localhost:3000/<some-real-page>.md (use an actual page from my site)
   - curl http://localhost:3000/llms.txt
   - curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/<some-real-page>
   - Verify all three return clean markdown content, not HTML or errors

8. Check HTML structure:
   - Verify that public pages wrap their primary content in a <main> tag
   - If pages don't use <main>, set config.converter.contentSelector to the CSS selector of the main content container
   - Without <main> or contentSelector, the converter falls back to <body> which includes nav, footer, and other chrome

Important: Do NOT break any existing functionality. The llmReady() middleware check returns null for normal users — existing behavior is completely unchanged.
```

## What It Does

1. **`.md` URLs for every page** — append `.md` to any URL to get its Markdown version (`/about` → `/about.md`)
2. **Auto-detect LLM bots** — GPTBot, ClaudeBot, PerplexityBot and 14+ more — serves them Markdown transparently
3. **Accept header support** — responds to `Accept: text/markdown` (used by Claude Code, OpenCode)
4. **Generate `/llms.txt`** — auto-generated site catalog per [llmstxt.org](https://llmstxt.org) spec
5. **Security** — strips hidden CSS content, invisible Unicode, HTML comments (prompt injection protection)

## Manual Setup

### 1. Install

```bash
npm install llm-ready
```

### 2. Create config

Create `llm-ready.config.ts` in your project root:

```typescript
import type { LlmReadyConfig } from 'llm-ready';

const config: LlmReadyConfig = {
  siteUrl: 'https://yoursite.com',
};

export default config;
```

The library auto-discovers your sitemap from `robots.txt` or standard paths.

### 3. Add to middleware

Add one check at the top of your `middleware.ts`:

```typescript
import { llmReady } from 'llm-ready/next';
import config from './llm-ready.config';

export async function middleware(request: NextRequest) {
  const llmResponse = llmReady(request, config);
  if (llmResponse) return llmResponse;

  // ... your existing middleware logic ...
}
```

Add `.md` to your middleware matcher:

```typescript
export const config = {
  matcher: [
    '/(.*)\\.md',
    // ... your existing matchers
  ],
};
```

### 4. Create route handlers

**Markdown endpoint** — `app/llm-md/[...path]/route.ts`:

```typescript
import { createMarkdownHandler } from 'llm-ready/next';
import config from '../../../../llm-ready.config';

export const GET = createMarkdownHandler(config);
export const revalidate = 86400;
```

**llms.txt endpoint** — `app/llms.txt/route.ts`:

```typescript
import { createLlmsTxtHandler } from 'llm-ready/next';
import config from '../../../llm-ready.config';

export const GET = createLlmsTxtHandler(config);
export const revalidate = 86400;
```

Done. Visit `https://yoursite.com/any-page.md` to see it in action.

## How It Works

Two triggers serve markdown:

**1. `.md` URL** (works for anyone):
```
GET /pricing.md  →  markdown version of /pricing
```

**2. LLM bot auto-detection** (transparent):
```
GET /pricing  (User-Agent: GPTBot)  →  markdown automatically
```

Both use the same pipeline:

```
request
  → middleware detects .md URL or LLM bot
  → rewrite to internal /llm-md/[...path] route handler
  → handler fetches original HTML (with bypass header to avoid loop)
  → sanitize → extract main content → convert to markdown
  → Response: text/markdown with canonical link header
```

### Content extraction priority

The converter looks for main content in this order:

1. **Custom selector** — `config.converter.contentSelector` (if set)
2. **`<main>`** — the semantic HTML5 main content element
3. **Single `<article>`** — only if there is exactly one `<article>` on the page
4. **`[role="main"]`** — ARIA role attribute
5. **`<body>`** — fallback: entire body content

For best results, wrap your page content in a `<main>` tag. If there is no `<main>` and the page has multiple `<article>` elements (e.g. blog cards, product listings), the converter skips them and falls back to `<body>`, which includes everything — navigation, footer, sidebars. You can avoid this by either:
- Adding a `<main>` tag around your primary content (recommended for semantics and accessibility anyway)
- Setting `config.converter.contentSelector` to target your content container (e.g. `'div.page-content'`)

## Configuration

```typescript
const config: LlmReadyConfig = {
  siteUrl: 'https://yoursite.com',

  // Path to sitemap. Auto-discovered from robots.txt if not set
  sitemap: '/sitemap.xml',

  // Paths to exclude from markdown conversion
  exclude: ['/dashboard/*', '/admin/*'],

  // llms.txt settings
  llmsTxt: {
    sections: {
      'Documentation': ['/docs/*'],
      'Blog': ['/blog/*'],
    },
    optional: ['/terms', '/privacy', '/about'],
    description: 'Your site description for AI bots',
  },

  // Cache TTL in seconds (default: 86400 = 24h)
  cache: { ttl: 86400 },

  // Bot detection
  bots: {
    additionalUserAgents: ['MyCustomBot'],
    blockUserAgents: ['Bytespider'],
  },

  // HTML-to-Markdown converter
  converter: {
    contentSelector: 'main',
    removeSelectors: ['[data-ad]', '.cookie-banner'],
  },

  // Security
  security: {
    maxContentSize: 2 * 1024 * 1024,
    stripHiddenContent: true,
  },
};
```

## Detected Bots

The list is actively maintained and updated as new AI crawlers appear.

| Bot | Company |
|-----|---------|
| GPTBot, ChatGPT-User, OAI-SearchBot | OpenAI |
| ClaudeBot, Claude-Web, anthropic-ai | Anthropic |
| Google-Extended, GoogleOther | Google |
| PerplexityBot | Perplexity |
| Applebot-Extended | Apple |
| Meta-ExternalAgent | Meta |
| CCBot | Common Crawl |
| Amazonbot | Amazon |
| cohere-ai | Cohere |
| YouBot | You.com |
| Bytespider | ByteDance |
| Diffbot | Diffbot |

Also detects `Accept: text/markdown` header (used by Claude Code, OpenCode, and other AI tools).

Missing a bot? [Open an issue](https://github.com/alxgntv/llm-ready/issues) or submit a PR.

## Security

Protects against known attack vectors on HTML-to-markdown pipelines:

- **CSS-hidden content** — `display:none`, `visibility:hidden`, `opacity:0`, `font-size:0`
- **HTML comments** — `<!-- potential prompt injection -->`
- **Invisible Unicode** — zero-width spaces, BOM, directional overrides
- **Dangerous elements** — `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`
- **Size limits** — rejects content over 2MB (configurable)

## Response Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `text/markdown; charset=utf-8` |
| `Link` | `<canonical-url>; rel="canonical"` |
| `X-Markdown-Tokens` | Estimated token count |
| `Cache-Control` | `public, s-maxage=86400, stale-while-revalidate` |

## License

MIT — with attribution.

You are free to use, modify, and distribute this library in any project (commercial or otherwise), provided you include a visible link back to the original repository:

```
https://github.com/alxgntv/llm-ready
```

This can be in your project's README, documentation, or a comment in the source code where the library is imported. The attribution requirement ensures the open-source community can discover and benefit from the project.
