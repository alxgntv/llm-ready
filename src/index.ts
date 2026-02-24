// Core
export { convertHtmlToMarkdown } from './core/converter';
export { sanitizeHtml, extractMainContent, removeChrome } from './core/sanitizer';
export { generateLlmsTxt } from './core/llms-txt';
export {
  discoverSitemap,
  parseSitemap,
  crawlHomepage,
  discoverPages,
} from './core/sitemap-parser';

// Detection
export { detectBot, isLlmBot } from './detect/bot';

// Types
export type {
  LlmReadyConfig,
  LlmsTxtPage,
  LlmsTxtSection,
  ConvertResult,
} from './core/types';
export type { BotDetectOptions, BotDetectResult } from './detect/bot';
export type { SitemapPage } from './core/sitemap-parser';

// Constants
export { DEFAULT_CONFIG } from './core/types';
