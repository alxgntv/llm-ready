/**
 * Sanitizes HTML before markdown conversion.
 * Removes hidden content, scripts, prompt injection vectors.
 *
 * Main threats (arXiv:2509.05831):
 * - CSS-hidden content (display:none, visibility:hidden, opacity:0)
 * - HTML comments with adversarial prompts
 * - Invisible Unicode characters (zero-width spaces, BOM, directional overrides)
 * - <script>, <style>, <noscript>, <iframe> elements
 */
interface SanitizeOptions {
    stripHiddenContent?: boolean;
    maxContentSize?: number;
    additionalRemoveSelectors?: string[];
}
/**
 * Sanitizes raw HTML string. Works without DOM parser (regex-based)
 * to stay compatible with edge runtimes (Vercel Edge, Cloudflare Workers).
 */
declare function sanitizeHtml(html: string, options?: SanitizeOptions): string;
/**
 * Extracts the main content area from full HTML page.
 * Tries semantic selectors first, falls back to <body>.
 */
declare function extractMainContent(html: string, contentSelector?: string): string;
/** Remove common non-content elements: nav, header, footer, aside */
declare function removeChrome(html: string): string;

interface LlmReadyConfig {
    /** Base URL of the site (e.g. 'https://example.com') */
    siteUrl: string;
    /** Path to sitemap.xml. If not set, auto-discovered from robots.txt or standard paths */
    sitemap?: string;
    /** Glob patterns for paths to exclude from markdown conversion */
    exclude?: string[];
    /** llms.txt generation settings */
    llmsTxt?: {
        /** Custom sections: key = section title, value = glob patterns for URLs */
        sections?: Record<string, string[]>;
        /** URL patterns that go into the ## Optional section */
        optional?: string[];
        /** Manual site description (overrides auto-detected <meta description>) */
        description?: string;
    };
    /** Cache settings */
    cache?: {
        /** TTL in seconds. Default: 86400 (24 hours) */
        ttl?: number;
    };
    /** Bot detection settings */
    bots?: {
        /** Additional User-Agent strings to detect as LLM bots */
        additionalUserAgents?: string[];
        /** User-Agent strings to block with 403 */
        blockUserAgents?: string[];
    };
    /** HTML-to-Markdown converter settings */
    converter?: {
        /** CSS selector for main content area. Default: auto-detect (main, article, [role=main]) */
        contentSelector?: string;
        /** Additional CSS selectors to remove before conversion */
        removeSelectors?: string[];
    };
    /** Security settings */
    security?: {
        /** Max HTML content size in bytes. Default: 2MB */
        maxContentSize?: number;
        /** Strip CSS-hidden content. Default: true */
        stripHiddenContent?: boolean;
    };
    /** @internal Used by Next.js adapter to pass actual server origin for HTTP calls */
    _fetchOrigin?: string;
}
interface LlmsTxtPage {
    url: string;
    title: string;
    description?: string;
}
interface LlmsTxtSection {
    title: string;
    pages: LlmsTxtPage[];
}
interface ConvertResult {
    markdown: string;
    title: string;
    description: string;
    canonicalUrl: string;
    tokenEstimate: number;
}
declare const DEFAULT_CONFIG: Required<Pick<LlmReadyConfig, 'cache' | 'security' | 'exclude'>>;

interface ConverterOptions {
    contentSelector?: string;
    removeSelectors?: string[];
    sanitize?: SanitizeOptions;
}
/**
 * Converts a full HTML page into clean Markdown optimized for LLM consumption.
 *
 * Pipeline:
 * 1. Extract page metadata (title, description, canonical)
 * 2. Sanitize HTML (remove hidden content, scripts, prompt injection vectors)
 * 3. Extract main content area (auto-detect <main>/<article> or custom selector)
 * 4. Remove navigation chrome (nav, header, footer, aside)
 * 5. Remove user-specified selectors
 * 6. Convert to Markdown via Turndown
 * 7. Add YAML frontmatter with metadata
 */
declare function convertHtmlToMarkdown(html: string, pageUrl: string, options?: ConverterOptions): ConvertResult;

/**
 * Generates the full llms.txt Markdown string.
 */
declare function generateLlmsTxt(config: LlmReadyConfig): Promise<string>;

/**
 * Discovers and parses sitemap to get a list of all site pages.
 *
 * Discovery chain:
 * 1. Config-provided sitemap path
 * 2. robots.txt Sitemap: directive
 * 3. Standard paths: /sitemap.xml, /sitemap_index.xml
 * 4. Crawl homepage for internal links (fallback)
 */
interface SitemapPage {
    url: string;
    lastmod?: string;
}
/**
 * Discovers sitemap URL from available sources.
 * Returns the first working sitemap URL or null.
 */
declare function discoverSitemap(siteUrl: string, configSitemap?: string): Promise<string | null>;
/**
 * Parses a sitemap XML and returns all page URLs.
 * Handles both regular sitemaps and sitemap index files.
 */
declare function parseSitemap(sitemapUrl: string): Promise<SitemapPage[]>;
/**
 * Fallback: crawl homepage and collect internal links.
 * Limited depth to avoid excessive crawling.
 */
declare function crawlHomepage(siteUrl: string, maxPages?: number): Promise<SitemapPage[]>;
/**
 * Full discovery pipeline: sitemap → robots.txt → standard paths → crawl.
 * Returns list of all discovered pages.
 */
declare function discoverPages(siteUrl: string, configSitemap?: string): Promise<SitemapPage[]>;

interface BotDetectOptions {
    additionalUserAgents?: string[];
    blockUserAgents?: string[];
}
interface BotDetectResult {
    isBot: boolean;
    isBlocked: boolean;
    botName: string | null;
    /** true when client explicitly requested markdown via Accept header */
    acceptsMarkdown: boolean;
}
/**
 * Detects whether a request comes from an LLM bot.
 * Two signals: Accept header (most reliable) and User-Agent string.
 */
declare function detectBot(userAgent: string | null, acceptHeader: string | null, options?: BotDetectOptions): BotDetectResult;
/** Quick check — returns true if request is from an LLM bot */
declare function isLlmBot(userAgent: string | null, acceptHeader: string | null, options?: BotDetectOptions): boolean;

export { type BotDetectOptions, type BotDetectResult, type ConvertResult, DEFAULT_CONFIG, type LlmReadyConfig, type LlmsTxtPage, type LlmsTxtSection, type SitemapPage, convertHtmlToMarkdown, crawlHomepage, detectBot, discoverPages, discoverSitemap, extractMainContent, generateLlmsTxt, isLlmBot, parseSitemap, removeChrome, sanitizeHtml };
