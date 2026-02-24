import type { LlmReadyConfig, LlmsTxtPage, LlmsTxtSection } from './types';
import { discoverPages, type SitemapPage } from './sitemap-parser';

/**
 * Generates llms.txt content per llmstxt.org spec (v1.1.1).
 *
 * Format is Markdown (NOT robots.txt directives):
 *   # Site Name
 *   > Short description
 *   ## Section
 *   - [Title](url): description
 *   ## Optional
 *   - [Title](url): lower-priority content
 */

const OPTIONAL_PATTERNS_DEFAULT = [
  '/terms',
  '/privacy',
  '/cookie',
  '/about',
  '/contacts',
  '/career',
  '/affiliate',
  '/refund',
  '/payment-methods',
];

/**
 * Generates the full llms.txt Markdown string.
 */
export async function generateLlmsTxt(
  config: LlmReadyConfig
): Promise<string> {
  const siteUrl = config.siteUrl.replace(/\/+$/, '');
  console.log(`[llm-ready] Generating llms.txt for ${siteUrl}`);

  // 1. Discover all pages
  const sitemapPages = await discoverPages(siteUrl, config.sitemap);
  console.log(`[llm-ready] Discovered ${sitemapPages.length} pages for llms.txt`);

  // 2. Filter out excluded paths
  const excludePatterns = config.exclude || [];
  const filteredPages = sitemapPages.filter(
    (page) => !isExcluded(page.url, siteUrl, excludePatterns)
  );
  console.log(
    `[llm-ready] After exclusions: ${filteredPages.length} pages (excluded ${sitemapPages.length - filteredPages.length})`
  );

  // 3. Fetch metadata for pages (title + description)
  const pagesWithMeta = await fetchPageMetadata(filteredPages, siteUrl);

  // 4. Group into sections
  const optionalPatterns = config.llmsTxt?.optional || OPTIONAL_PATTERNS_DEFAULT;
  const customSections = config.llmsTxt?.sections;
  const sections = groupIntoSections(pagesWithMeta, siteUrl, optionalPatterns, customSections);

  // 5. Build site header
  const siteName = await fetchSiteName(siteUrl);
  const siteDescription =
    config.llmsTxt?.description || (await fetchSiteDescription(siteUrl));

  // 6. Generate markdown
  const llmsTxt = buildLlmsTxt(siteName, siteDescription, sections);

  console.log(
    `[llm-ready] llms.txt generated: ${llmsTxt.length} chars, ${sections.length} sections`
  );
  return llmsTxt;
}

function buildLlmsTxt(
  siteName: string,
  description: string,
  sections: LlmsTxtSection[]
): string {
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
      const desc = page.description ? `: ${page.description}` : '';
      lines.push(`- [${page.title}](${page.url})${desc}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

function groupIntoSections(
  pages: LlmsTxtPage[],
  siteUrl: string,
  optionalPatterns: string[],
  customSections?: Record<string, string[]>
): LlmsTxtSection[] {
  // If custom sections defined, use them
  if (customSections && Object.keys(customSections).length > 0) {
    return groupByCustomSections(pages, siteUrl, customSections, optionalPatterns);
  }

  // Auto-group by path structure
  return autoGroupSections(pages, siteUrl, optionalPatterns);
}

function groupByCustomSections(
  pages: LlmsTxtPage[],
  siteUrl: string,
  customSections: Record<string, string[]>,
  optionalPatterns: string[]
): LlmsTxtSection[] {
  const sections: LlmsTxtSection[] = [];
  const assigned = new Set<string>();

  for (const [title, patterns] of Object.entries(customSections)) {
    const sectionPages: LlmsTxtPage[] = [];
    for (const page of pages) {
      const path = getPath(page.url, siteUrl);
      if (patterns.some((p) => matchGlob(path, p))) {
        sectionPages.push(page);
        assigned.add(page.url);
      }
    }
    if (sectionPages.length > 0) {
      sections.push({ title, pages: sectionPages });
    }
  }

  // Remaining unassigned pages
  const optional: LlmsTxtPage[] = [];
  const other: LlmsTxtPage[] = [];

  for (const page of pages) {
    if (assigned.has(page.url)) continue;
    const path = getPath(page.url, siteUrl);
    if (optionalPatterns.some((p) => path.startsWith(p))) {
      optional.push(page);
    } else {
      other.push(page);
    }
  }

  if (other.length > 0) {
    sections.push({ title: 'Pages', pages: other });
  }
  if (optional.length > 0) {
    sections.push({ title: 'Optional', pages: optional });
  }

  return sections;
}

function autoGroupSections(
  pages: LlmsTxtPage[],
  siteUrl: string,
  optionalPatterns: string[]
): LlmsTxtSection[] {
  const groups: Record<string, LlmsTxtPage[]> = {};
  const optional: LlmsTxtPage[] = [];
  const homepage: LlmsTxtPage[] = [];

  for (const page of pages) {
    const path = getPath(page.url, siteUrl);

    if (path === '' || path === '/') {
      homepage.push(page);
      continue;
    }

    if (optionalPatterns.some((p) => path.startsWith(p))) {
      optional.push(page);
      continue;
    }

    // Group by first path segment
    const firstSegment = path.split('/').filter(Boolean)[0] || 'pages';
    const groupName = firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);

    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(page);
  }

  const sections: LlmsTxtSection[] = [];

  // Homepage first (if exists)
  if (homepage.length > 0) {
    sections.push({ title: 'Main', pages: homepage });
  }

  // Sort groups by size (largest first)
  const sortedGroups = Object.entries(groups).sort(
    (a, b) => b[1].length - a[1].length
  );
  for (const [title, groupPages] of sortedGroups) {
    sections.push({ title, pages: groupPages });
  }

  // Optional section always last
  if (optional.length > 0) {
    sections.push({ title: 'Optional', pages: optional });
  }

  return sections;
}

async function fetchPageMetadata(
  pages: SitemapPage[],
  siteUrl: string
): Promise<LlmsTxtPage[]> {
  console.log(
    `[llm-ready] Fetching metadata for ${pages.length} pages (batched)`
  );

  const BATCH_SIZE = 10;
  const results: LlmsTxtPage[] = [];

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (page) => {
        try {
          const res = await fetch(page.url, {
            headers: { 'User-Agent': 'llm-ready/metadata-fetch' },
          });
          if (!res.ok) return null;

          const html = await res.text();
          const title = extractMetaTitle(html) || getPathLabel(page.url, siteUrl);
          const description = extractMetaDescription(html);

          return { url: page.url, title, description };
        } catch {
          return {
            url: page.url,
            title: getPathLabel(page.url, siteUrl),
            description: undefined,
          };
        }
      })
    );

    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  console.log(`[llm-ready] Fetched metadata for ${results.length} pages`);
  return results;
}

async function fetchSiteName(siteUrl: string): Promise<string> {
  try {
    const res = await fetch(siteUrl);
    if (!res.ok) return new URL(siteUrl).hostname;
    const html = await res.text();
    const title = extractMetaTitle(html);
    // Use og:site_name or application-name if available
    const siteName =
      html.match(
        /<meta\s[^>]*property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']*)["']/i
      )?.[1] ||
      html.match(
        /<meta\s[^>]*name\s*=\s*["']application-name["'][^>]*content\s*=\s*["']([^"']*)["']/i
      )?.[1];
    return siteName || title || new URL(siteUrl).hostname;
  } catch {
    return new URL(siteUrl).hostname;
  }
}

async function fetchSiteDescription(siteUrl: string): Promise<string> {
  try {
    const res = await fetch(siteUrl);
    if (!res.ok) return '';
    const html = await res.text();
    return extractMetaDescription(html) || '';
  } catch {
    return '';
  }
}

function extractMetaTitle(html: string): string {
  const ogTitle = html.match(
    /<meta\s[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  if (ogTitle) return ogTitle[1];

  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return titleTag ? titleTag[1].trim() : '';
}

function extractMetaDescription(html: string): string | undefined {
  const ogDesc = html.match(
    /<meta\s[^>]*property\s*=\s*["']og:description["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  if (ogDesc) return ogDesc[1];

  const desc = html.match(
    /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  return desc ? desc[1] : undefined;
}

function getPath(url: string, siteUrl: string): string {
  return url.replace(siteUrl, '').replace(/\/+$/, '') || '/';
}

function getPathLabel(url: string, siteUrl: string): string {
  const path = getPath(url, siteUrl);
  if (path === '/' || path === '') return 'Home';
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/-/g, ' '))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' — ');
}

function isExcluded(
  url: string,
  siteUrl: string,
  patterns: string[]
): boolean {
  const path = getPath(url, siteUrl);
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
