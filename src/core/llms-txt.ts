import type { LlmReadyConfig, LlmsTxtPage, LlmsTxtSection } from './types';

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

export function generateLlmsTxt(config: LlmReadyConfig): string {
  const siteUrl = config.siteUrl.replace(/\/+$/, '');
  console.log(`[llm-ready] Generating llms.txt for ${siteUrl} (static mode, zero HTTP)`);

  const siteName = config.llmsTxt?.siteName || extractHostname(siteUrl);
  const description = config.llmsTxt?.description || '';

  // Collect all pages from config
  const configPages = config.llmsTxt?.pages || [];
  const optionalPaths = config.llmsTxt?.optional || [];
  const excludePatterns = config.exclude || [];

  // Build main pages list (always includes homepage)
  const mainPages: LlmsTxtPage[] = [
    { url: siteUrl, title: 'Home' },
  ];

  // Add configured pages
  for (const pagePath of configPages) {
    const path = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
    if (isExcluded(path, excludePatterns)) continue;
    mainPages.push({
      url: `${siteUrl}${path}`,
      title: pathToTitle(path),
    });
  }

  // Build optional pages list
  const optionalPages: LlmsTxtPage[] = [];
  for (const pagePath of optionalPaths) {
    const path = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
    if (isExcluded(path, excludePatterns)) continue;
    optionalPages.push({
      url: `${siteUrl}${path}`,
      title: pathToTitle(path),
    });
  }

  // Group main pages into sections
  const sections: LlmsTxtSection[] = [];
  const customSections = config.llmsTxt?.sections;

  if (customSections && Object.keys(customSections).length > 0) {
    const assigned = new Set<string>();

    for (const [title, patterns] of Object.entries(customSections)) {
      const sectionPages = mainPages.filter((page) => {
        const path = new URL(page.url).pathname;
        return patterns.some((p) => matchGlob(path, p));
      });
      if (sectionPages.length > 0) {
        sections.push({ title, pages: sectionPages });
        sectionPages.forEach((p) => assigned.add(p.url));
      }
    }

    const unassigned = mainPages.filter((p) => !assigned.has(p.url));
    if (unassigned.length > 0) {
      sections.push({ title: 'Pages', pages: unassigned });
    }
  } else {
    sections.push({ title: 'Pages', pages: mainPages });
  }

  if (optionalPages.length > 0) {
    sections.push({ title: 'Optional', pages: optionalPages });
  }

  // Build output
  const lines: string[] = [];
  lines.push(`# ${siteName}`);
  lines.push('');
  if (description) {
    lines.push(`> ${description}`);
    lines.push('');
  }

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    for (const page of section.pages) {
      lines.push(`- [${page.title}](${page.url})`);
    }
    lines.push('');
  }

  const result = lines.join('\n').trim() + '\n';
  console.log(`[llm-ready] llms.txt generated: ${result.length} chars, ${sections.length} sections, ${mainPages.length + optionalPages.length} pages`);
  return result;
}

function extractHostname(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function pathToTitle(path: string): string {
  if (path === '/' || path === '') return 'Home';
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/-/g, ' '))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' — ');
}

function isExcluded(path: string, patterns: string[]): boolean {
  return patterns.some((p) => matchGlob(path, p));
}

function matchGlob(path: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return path.startsWith(prefix);
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return path.startsWith(prefix);
  }
  return path === pattern;
}
