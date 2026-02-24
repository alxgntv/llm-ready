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
        /** Site name for llms.txt header. If not set, extracted from siteUrl hostname */
        siteName?: string;
        /** Site description for llms.txt header */
        description?: string;
        /** Static list of page paths to always include in llms.txt (e.g. ['/pricing', '/docs']) */
        pages?: string[];
        /** Custom sections: key = section title, value = glob patterns for URLs */
        sections?: Record<string, string[]>;
        /** URL patterns that go into the ## Optional section */
        optional?: string[];
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
 * Generates llms.txt content per llmstxt.org spec (v1.1.1).
 *
 * Zero HTTP requests — everything is derived from config.
 * Pages come from config.llmsTxt.pages and config.llmsTxt.optional.
 *
 * Format is Markdown:
 *   # Site Name
 *   > Short description
 *   ## Section
 *   - [Title](url)
 *   ## Optional
 *   - [Title](url)
 */
declare function generateLlmsTxt(config: LlmReadyConfig): string;

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

export { type BotDetectOptions, type BotDetectResult, type ConvertResult, DEFAULT_CONFIG, type LlmReadyConfig, type LlmsTxtPage, type LlmsTxtSection, convertHtmlToMarkdown, detectBot, extractMainContent, generateLlmsTxt, isLlmBot, removeChrome, sanitizeHtml };
