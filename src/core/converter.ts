import TurndownService from 'turndown';
import {
  sanitizeHtml,
  extractMainContent,
  removeChrome,
  type SanitizeOptions,
} from './sanitizer';
import type { ConvertResult } from './types';

export interface ConverterOptions {
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
export function convertHtmlToMarkdown(
  html: string,
  pageUrl: string,
  options: ConverterOptions = {}
): ConvertResult {
  console.log(`[llm-ready] Converting page: ${pageUrl}`);

  // 1. Extract metadata before sanitizing (meta tags will be removed)
  const title = extractTitle(html);
  const description = extractDescription(html);
  const canonical = extractCanonical(html) || pageUrl;

  console.log(
    `[llm-ready] Page metadata: title="${title.substring(0, 60)}", description="${description.substring(0, 60)}"`
  );

  // 2. Sanitize
  const sanitized = sanitizeHtml(html, options.sanitize);
  if (!sanitized) {
    console.log('[llm-ready] Sanitizer returned empty content, aborting');
    return {
      markdown: '',
      title,
      description,
      canonicalUrl: canonical,
      tokenEstimate: 0,
    };
  }

  // 3. Extract main content
  let content = extractMainContent(sanitized, options.contentSelector);

  // 4. Remove chrome
  content = removeChrome(content);

  // 5. Remove user-specified selectors
  if (options.removeSelectors) {
    for (const sel of options.removeSelectors) {
      const regex = new RegExp(
        `<${sel}\\b[^>]*>[\\s\\S]*?<\\/${sel}>`,
        'gi'
      );
      content = content.replace(regex, '');
    }
    console.log(
      `[llm-ready] Removed ${options.removeSelectors.length} custom selectors`
    );
  }

  // 6. Convert to Markdown
  const turndown = createTurndownService();
  let markdown = turndown.turndown(content);

  // 7. Clean up markdown
  markdown = cleanMarkdown(markdown);

  // 8. Add frontmatter
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
    tokenEstimate,
  };
}

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    hr: '---',
  });

  // Skip buttons and form elements — not useful for LLMs
  td.remove(['button', 'form', 'input', 'select', 'textarea', 'label']);

  // Skip images by default — LLM bots consume text
  td.addRule('skipImages', {
    filter: 'img',
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const alt = el.getAttribute('alt');
      return alt ? `[Image: ${alt}]` : '';
    },
  });

  // Better table handling
  td.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: (content) => {
      return ` ${content.trim().replace(/\n/g, ' ')} |`;
    },
  });

  td.addRule('tableRow', {
    filter: 'tr',
    replacement: (content) => {
      return `|${content}\n`;
    },
  });

  td.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const rows = el.querySelectorAll?.('tr');
      if (!rows || rows.length === 0) return _content;
      return `\n${_content}\n`;
    },
  });

  // Convert <details>/<summary> to readable format
  td.addRule('details', {
    filter: 'details',
    replacement: (content) => {
      return `\n${content}\n`;
    },
  });

  td.addRule('summary', {
    filter: 'summary',
    replacement: (content) => {
      return `\n**${content.trim()}**\n`;
    },
  });

  return td;
}

function extractTitle(html: string): string {
  // Try og:title first
  const ogTitle = html.match(
    /<meta\s[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  if (ogTitle) return ogTitle[1];

  // Fallback to <title>
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : '';
}

function extractDescription(html: string): string {
  // Try og:description first
  const ogDesc = html.match(
    /<meta\s[^>]*property\s*=\s*["']og:description["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  if (ogDesc) return ogDesc[1];

  // Fallback to meta description
  const descMatch = html.match(
    /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  return descMatch ? descMatch[1] : '';
}

function extractCanonical(html: string): string | null {
  const match = html.match(
    /<link\s[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']*)["']/i
  );
  return match ? match[1] : null;
}

function buildFrontmatter(
  title: string,
  description: string,
  canonical: string
): string {
  const lines = ['---'];
  if (title) lines.push(`title: "${title.replace(/"/g, '\\"')}"`);
  if (description)
    lines.push(`description: "${description.replace(/"/g, '\\"')}"`);
  lines.push(`canonical: ${canonical}`);
  lines.push('---\n\n');
  return lines.join('\n');
}

function cleanMarkdown(md: string): string {
  let result = md;

  // Collapse 3+ newlines into 2
  result = result.replace(/\n{3,}/g, '\n\n');

  // Remove leading/trailing whitespace per line
  result = result
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

  // Remove leading/trailing whitespace from whole document
  result = result.trim();

  return result;
}

/** Rough token estimate: ~4 chars per token for English text */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
