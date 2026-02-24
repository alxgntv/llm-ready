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

Cloudflare launched [Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) in February 2026 — it does the same thing (HTML → Markdown via `Accept: text/markdown`) but requires a Cloudflare Pro plan (**$200+/month**).

| | Cloudflare Markdown for Agents | llm-ready |
|---|---|---|
| **Price** | $200+/month (Pro plan required) | **Free and open-source** |
| **How it works** | Edge conversion at CDN level | Application-level conversion |
| **Requires Cloudflare** | Yes | No — works anywhere |
| **Framework support** | Any (CDN-level) | Next.js (more coming) |
| **`.md` URL support** | No (Accept header only) | Yes — Stripe-style `/page.md` URLs |
| **`llms.txt` generation** | No | Yes — auto-generated from sitemap |
| **Bot auto-detection** | No (manual config) | Yes — 17+ LLM bots detected |
| **Content sanitization** | Basic | Advanced — prompt injection protection |
| **Self-hosted** | No | Yes — runs on your server |

## What It Does

1. **Stripe-style `.md` URLs** — append `.md` to any page URL to get Markdown (`/about` → `/about.md`)
2. **Auto-detect LLM bots** — GPTBot, ClaudeBot, PerplexityBot and 14 more — serves them Markdown transparently
3. **Accept header support** — responds to `Accept: text/markdown` (used by Claude Code, OpenCode)
4. **Generate `/llms.txt`** — auto-generated catalog of your site per [llmstxt.org](https://llmstxt.org) spec
5. **Security** — strips hidden CSS content, invisible Unicode, HTML comments (prompt injection protection)

## Quick Start

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

That's it for minimal config. The library auto-discovers your sitemap from `robots.txt` or standard paths.

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

Make sure your middleware matcher includes `.md` paths:

```typescript
export const config = {
  matcher: [
    '/(.*)\\.md',  // All .md requests
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

## Integration Prompt

Copy this prompt into **Cursor**, **Claude Code**, or any AI coding assistant to automatically integrate `llm-ready` into your project:

```
Integrate the npm library "llm-ready" into my Next.js project. Follow these steps:

1. Run: npm install llm-ready
2. Analyze my project:
   - Find my middleware.ts file
   - Find my next.config.js/ts
   - Find my sitemap (sitemap.xml, server-sitemap.xml, or similar)
   - Identify which paths are public pages and which are private (dashboard, admin, api routes)
   - Check my .env files for the production site URL

3. Create llm-ready.config.ts in the project root with:
   - siteUrl from my environment variables or package.json homepage
   - sitemap path (auto-detect from robots.txt or project files)
   - exclude patterns for all private/authenticated routes (dashboard, admin, api, etc.)
   - llmsTxt.optional patterns for legal pages (terms, privacy, cookie-policy, etc.)

4. Update my middleware.ts:
   - Add import for llmReady from 'llm-ready/next' and my config
   - Add llmReady() check as the FIRST thing in the middleware function (before any other logic)
   - Add '/(.*)\\.md' to the middleware matcher array so .md URLs are processed

5. Create two route handler files:
   - app/llm-md/[...path]/route.ts — with createMarkdownHandler and revalidate = 86400
   - app/llms.txt/route.ts — with createLlmsTxtHandler and revalidate = 86400
   - Adjust import paths to match my project structure

6. Update my robots.txt:
   - Add Crawl-delay: 10 rules for GPTBot, ClaudeBot, Google-Extended, PerplexityBot
   - Add Disallow: / for Bytespider
   - Keep all existing rules unchanged

7. Test by starting the dev server and running:
   - curl http://localhost:3000/ .md (replace with an actual page from my site)
   - curl http://localhost:3000/llms.txt
   - Verify both return clean content, not HTML or errors

Important: Do NOT break any existing functionality. The llmReady() middleware check returns null for normal users, so existing behavior is completely unchanged.
```

## How It Works

Two triggers serve markdown:

**1. Stripe-style `.md` URL** (works for anyone):
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

MIT
