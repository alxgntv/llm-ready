# llm-ready

Universal npm library that makes any website LLM-ready. Drop it into your Next.js project and it will:

- **Auto-detect LLM bots** (GPTBot, ClaudeBot, PerplexityBot, etc.) via User-Agent and `Accept: text/markdown` headers
- **Serve Markdown versions** of your pages to AI crawlers instead of HTML (~80% token reduction)
- **Generate `/llms.txt`** automatically from your sitemap — per [llmstxt.org](https://llmstxt.org) spec
- **Sanitize content** against prompt injection attacks (hidden CSS content, invisible Unicode, HTML comments)

Zero knowledge of your site structure required. Install, add 3 files, done.

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
  // LLM bot detection — must be first
  const llmResponse = llmReady(request, config);
  if (llmResponse) return llmResponse;

  // ... your existing middleware logic ...
}
```

### 4. Create route handlers

**Markdown endpoint** — `app/_llm/[...path]/route.ts`:

```typescript
import { createMarkdownHandler } from 'llm-ready/next';
import config from '../../../../llm-ready.config';

export const GET = createMarkdownHandler(config);
export const revalidate = 86400; // ISR: regenerate every 24h
```

**llms.txt endpoint** — `app/llms.txt/route.ts`:

```typescript
import { createLlmsTxtHandler } from 'llm-ready/next';
import config from '../../../llm-ready.config';

export const GET = createLlmsTxtHandler(config);
export const revalidate = 86400;
```

Done. Your site is now LLM-ready.

## How It Works

Two triggers serve markdown:

**1. Stripe-style `.md` URL** (works for anyone):
```
GET /twitter/like.md  →  markdown version of /twitter/like
```

**2. LLM bot auto-detection** (transparent):
```
GET /twitter/like  (User-Agent: GPTBot)  →  markdown automatically
```

Both paths use the same pipeline:

```
request → middleware detects .md URL or LLM bot
  → rewrite to internal /llm-md/[...path] route handler
  → handler fetches original HTML (with bypass header to avoid loop)
  → sanitize → extract main content → convert to markdown
  → Response: text/markdown with canonical link header
```

The library fetches your page's HTML (the same HTML users see), strips navigation/footer/scripts, sanitizes against prompt injection, and converts to clean Markdown.

## Configuration

```typescript
const config: LlmReadyConfig = {
  // Required: your site's base URL
  siteUrl: 'https://yoursite.com',

  // Path to sitemap. Auto-discovered if not set
  sitemap: '/sitemap.xml',

  // Glob patterns for paths to exclude from markdown conversion
  exclude: ['/dashboard/*', '/api/*', '/admin/*'],

  // llms.txt settings
  llmsTxt: {
    // Custom sections for llms.txt
    sections: {
      'Documentation': ['/docs/*'],
      'Blog': ['/blog/*'],
    },
    // URL patterns that go into ## Optional section
    optional: ['/terms', '/privacy', '/about'],
    // Override auto-detected site description
    description: 'Your site description for AI bots',
  },

  // Cache TTL in seconds (default: 86400 = 24h)
  cache: { ttl: 86400 },

  // Bot detection
  bots: {
    // Add custom bot User-Agents to detect
    additionalUserAgents: ['MyCustomBot'],
    // Block specific bots with 403
    blockUserAgents: ['Bytespider'],
  },

  // HTML-to-Markdown converter
  converter: {
    // CSS selector for main content (default: auto-detect)
    contentSelector: 'main',
    // Additional selectors to remove before conversion
    removeSelectors: ['[data-ad]', '.cookie-banner'],
  },

  // Security
  security: {
    maxContentSize: 2 * 1024 * 1024, // 2MB
    stripHiddenContent: true,
  },
};
```

## What Gets Detected

The library detects bots via two signals:

| Signal | How |
|--------|-----|
| `Accept: text/markdown` | Client explicitly requests markdown (used by Claude Code, OpenCode) |
| User-Agent | Matches known LLM bot strings |

Built-in User-Agent list:

| Bot | Company |
|-----|---------|
| GPTBot | OpenAI |
| ChatGPT-User | OpenAI |
| ClaudeBot | Anthropic |
| Claude-Web | Anthropic |
| anthropic-ai | Anthropic |
| Google-Extended | Google |
| CCBot | Common Crawl |
| PerplexityBot | Perplexity |
| Applebot-Extended | Apple |
| Meta-ExternalAgent | Meta |
| Amazonbot | Amazon |
| OAI-SearchBot | OpenAI |
| cohere-ai | Cohere |
| YouBot | You.com |
| Bytespider | ByteDance |
| Diffbot | Diffbot |

## Security

The sanitizer protects against known attack vectors on HTML-to-markdown pipelines:

- **CSS-hidden content** — removes elements with `display:none`, `visibility:hidden`, `opacity:0`, `font-size:0`
- **HTML comments** — strips `<!-- potential prompt injection -->`
- **Invisible Unicode** — filters zero-width spaces, BOM, directional overrides
- **Dangerous elements** — removes `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`
- **Size limits** — rejects content over 2MB (configurable)

## llms.txt Format

Generated per [llmstxt.org spec](https://llmstxt.org) (v1.1.1). It's a **Markdown file**, not robots.txt directives:

```markdown
# Your Site Name

> Your site description from meta tags

## Blog

- [Article Title](https://yoursite.com/blog/article): Article description

## Pages

- [Product Page](https://yoursite.com/product): Product description

## Optional

- [Terms of Service](https://yoursite.com/terms): Terms and conditions
- [Privacy Policy](https://yoursite.com/privacy): Privacy policy
```

## Response Headers

Markdown responses include:

| Header | Value |
|--------|-------|
| `Content-Type` | `text/markdown; charset=utf-8` |
| `Link` | `<canonical-url>; rel="canonical"` |
| `X-Markdown-Tokens` | Estimated token count |
| `Cache-Control` | `public, s-maxage=86400, stale-while-revalidate` |

## robots.txt Recommendation

The library doesn't modify your `robots.txt`. We recommend adding:

```
User-agent: GPTBot
Crawl-delay: 10

User-agent: ClaudeBot
Crawl-delay: 10

User-agent: Bytespider
Disallow: /
```

## License

MIT
