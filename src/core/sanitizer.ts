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

const INVISIBLE_UNICODE_REGEX =
  /[\u200B\u200C\u200D\u200E\u200F\u2028\u2029\u2060\u2061\u2062\u2063\u2064\u2066\u2067\u2068\u2069\u206A\u206B\u206C\u206D\u206E\u206F\uFEFF\uFFF9\uFFFA\uFFFB]/g;

const ELEMENTS_TO_REMOVE = [
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'svg',
  'canvas',
  'template',
  'link[rel="stylesheet"]',
  'link[rel="preload"]',
  'link[rel="prefetch"]',
  'meta',
];

const HIDDEN_CSS_PATTERNS = [
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /opacity\s*:\s*0(?:[;\s]|$)/i,
  /font-size\s*:\s*0(?:px|em|rem|%)?(?:[;\s]|$)/i,
  /height\s*:\s*0(?:px|em|rem)?(?:[;\s]|$)/i,
  /width\s*:\s*0(?:px|em|rem)?(?:[;\s]|$)/i,
  /overflow\s*:\s*hidden/i,
  /clip\s*:\s*rect\s*\(\s*0/i,
  /position\s*:\s*absolute[^;]*left\s*:\s*-\d{4,}/i,
  /position\s*:\s*absolute[^;]*top\s*:\s*-\d{4,}/i,
];

export interface SanitizeOptions {
  stripHiddenContent?: boolean;
  maxContentSize?: number;
  additionalRemoveSelectors?: string[];
}

/**
 * Sanitizes raw HTML string. Works without DOM parser (regex-based)
 * to stay compatible with edge runtimes (Vercel Edge, Cloudflare Workers).
 */
export function sanitizeHtml(
  html: string,
  options: SanitizeOptions = {}
): string {
  const { stripHiddenContent = true, maxContentSize = 2 * 1024 * 1024 } =
    options;

  if (html.length > maxContentSize) {
    console.log(
      `[llm-ready] Content too large (${html.length} bytes > ${maxContentSize}), skipping`
    );
    return '';
  }

  let result = html;

  // 1. Remove HTML comments (potential prompt injection vector)
  result = result.replace(/<!--[\s\S]*?-->/g, '');
  console.log('[llm-ready] Sanitizer: removed HTML comments');

  // 2. Remove dangerous elements
  for (const tag of ELEMENTS_TO_REMOVE) {
    const tagName = tag.replace(/\[.*\]/, '');
    const regex = new RegExp(
      `<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`,
      'gi'
    );
    result = result.replace(regex, '');

    const selfClosing = new RegExp(`<${tagName}\\b[^>]*/?>`, 'gi');
    result = result.replace(selfClosing, '');
  }
  console.log('[llm-ready] Sanitizer: removed script/style/iframe/meta elements');

  // 3. Remove elements with hidden CSS inline styles
  if (stripHiddenContent) {
    for (const pattern of HIDDEN_CSS_PATTERNS) {
      const styleAttrRegex = new RegExp(
        `<(\\w+)\\b[^>]*style\\s*=\\s*"[^"]*${pattern.source}[^"]*"[^>]*>[\\s\\S]*?<\\/\\1>`,
        'gi'
      );
      result = result.replace(styleAttrRegex, '');

      const singleQuoteRegex = new RegExp(
        `<(\\w+)\\b[^>]*style\\s*=\\s*'[^']*${pattern.source}[^']*'[^>]*>[\\s\\S]*?<\\/\\1>`,
        'gi'
      );
      result = result.replace(singleQuoteRegex, '');
    }
    console.log('[llm-ready] Sanitizer: removed CSS-hidden elements');
  }

  // 4. Remove elements with aria-hidden="true"
  result = result.replace(
    /<(\w+)\b[^>]*aria-hidden\s*=\s*["']true["'][^>]*>[\s\S]*?<\/\1>/gi,
    ''
  );

  // 5. Remove hidden input fields
  result = result.replace(/<input\b[^>]*type\s*=\s*["']hidden["'][^>]*\/?>/gi, '');

  // 6. Remove invisible Unicode characters
  result = result.replace(INVISIBLE_UNICODE_REGEX, '');
  console.log('[llm-ready] Sanitizer: removed invisible Unicode characters');

  // 7. Remove data attributes (sometimes used for tracking/injection)
  result = result.replace(/\s+data-[\w-]+=["'][^"']*["']/gi, '');

  return result;
}

/**
 * Extracts the main content area from full HTML page.
 * Tries semantic selectors first, falls back to <body>.
 */
export function extractMainContent(
  html: string,
  contentSelector?: string
): string {
  // If custom selector specified, try to extract by tag/id/class
  if (contentSelector) {
    const extracted = extractBySelector(html, contentSelector);
    if (extracted) {
      console.log(
        `[llm-ready] Extracted content using custom selector: ${contentSelector}`
      );
      return extracted;
    }
  }

  // Auto-detect: try <main>, then <article> (only if single), then [role="main"]
  const mainExtracted = extractBySelector(html, 'main');
  if (mainExtracted) {
    console.log('[llm-ready] Auto-detected main content using <main>');
    return mainExtracted;
  }

  // Only use <article> if there is exactly one on the page
  const articleCount = (html.match(/<article\b/gi) || []).length;
  if (articleCount === 1) {
    const articleExtracted = extractBySelector(html, 'article');
    if (articleExtracted) {
      console.log('[llm-ready] Auto-detected main content using single <article>');
      return articleExtracted;
    }
  } else if (articleCount > 1) {
    console.log(`[llm-ready] Found ${articleCount} <article> tags, skipping — falling back to <body>`);
  }

  // Try role="main"
  const roleMainMatch = html.match(
    /<(\w+)\b[^>]*role\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/\1>/i
  );
  if (roleMainMatch) {
    console.log('[llm-ready] Auto-detected main content using [role="main"]');
    return roleMainMatch[2];
  }

  // Fallback: extract <body>
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    console.log('[llm-ready] Falling back to <body> content');
    return bodyMatch[1];
  }

  console.log('[llm-ready] No content container found, using full HTML');
  return html;
}

function extractBySelector(html: string, selector: string): string | null {
  const regex = new RegExp(
    `<${selector}\\b[^>]*>([\\s\\S]*?)<\\/${selector}>`,
    'i'
  );
  const match = html.match(regex);
  return match ? match[1] : null;
}

/** Remove common non-content elements: nav, header, footer, aside */
export function removeChrome(html: string): string {
  let result = html;
  const chromeTags = ['nav', 'header', 'footer', 'aside'];
  for (const tag of chromeTags) {
    const regex = new RegExp(
      `<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,
      'gi'
    );
    result = result.replace(regex, '');
  }
  console.log('[llm-ready] Removed nav/header/footer/aside chrome');
  return result;
}
