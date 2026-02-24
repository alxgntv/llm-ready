export interface LlmReadyConfig {
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
}

export interface LlmsTxtPage {
  url: string;
  title: string;
  description?: string;
}

export interface LlmsTxtSection {
  title: string;
  pages: LlmsTxtPage[];
}

export interface ConvertResult {
  markdown: string;
  title: string;
  description: string;
  canonicalUrl: string;
  tokenEstimate: number;
}

export const DEFAULT_CONFIG: Required<
  Pick<LlmReadyConfig, 'cache' | 'security' | 'exclude'>
> = {
  cache: { ttl: 86400 },
  security: { maxContentSize: 2 * 1024 * 1024, stripHiddenContent: true },
  exclude: ['/api/*', '/_next/*'],
};
