/**
 * Discovers and parses sitemap to get a list of all site pages.
 *
 * Discovery chain:
 * 1. Config-provided sitemap path
 * 2. robots.txt Sitemap: directive
 * 3. Standard paths: /sitemap.xml, /sitemap_index.xml
 * 4. Crawl homepage for internal links (fallback)
 */

export interface SitemapPage {
  url: string;
  lastmod?: string;
}

/**
 * Discovers sitemap URL from available sources.
 * Returns the first working sitemap URL or null.
 */
export async function discoverSitemap(
  siteUrl: string,
  configSitemap?: string
): Promise<string | null> {
  const base = siteUrl.replace(/\/+$/, '');

  // 1. Config-provided
  if (configSitemap) {
    const url = configSitemap.startsWith('http')
      ? configSitemap
      : `${base}${configSitemap.startsWith('/') ? '' : '/'}${configSitemap}`;
    console.log(`[llm-ready] Trying config sitemap: ${url}`);
    if (await urlExists(url)) {
      console.log(`[llm-ready] Found sitemap from config: ${url}`);
      return url;
    }
  }

  // 2. Check robots.txt for Sitemap: directive
  try {
    const robotsUrl = `${base}/robots.txt`;
    console.log(`[llm-ready] Checking robots.txt for Sitemap directive: ${robotsUrl}`);
    const res = await fetch(robotsUrl);
    if (res.ok) {
      const text = await res.text();
      const sitemapLines = text
        .split('\n')
        .filter((line) => line.toLowerCase().startsWith('sitemap:'))
        .map((line) => line.replace(/^sitemap:\s*/i, '').trim());

      if (sitemapLines.length > 0) {
        console.log(
          `[llm-ready] Found ${sitemapLines.length} sitemap(s) in robots.txt: ${sitemapLines[0]}`
        );
        return sitemapLines[0];
      }
    }
  } catch (err) {
    console.log(`[llm-ready] Could not fetch robots.txt: ${err}`);
  }

  // 3. Try standard paths
  const standardPaths = ['/sitemap.xml', '/sitemap_index.xml'];
  for (const path of standardPaths) {
    const url = `${base}${path}`;
    console.log(`[llm-ready] Trying standard sitemap path: ${url}`);
    if (await urlExists(url)) {
      console.log(`[llm-ready] Found sitemap at standard path: ${url}`);
      return url;
    }
  }

  console.log('[llm-ready] No sitemap found anywhere');
  return null;
}

/**
 * Parses a sitemap XML and returns all page URLs.
 * Handles both regular sitemaps and sitemap index files.
 */
export async function parseSitemap(sitemapUrl: string): Promise<SitemapPage[]> {
  console.log(`[llm-ready] Parsing sitemap: ${sitemapUrl}`);

  try {
    const res = await fetch(sitemapUrl);
    if (!res.ok) {
      console.log(
        `[llm-ready] Sitemap fetch failed: ${res.status} ${res.statusText}`
      );
      return [];
    }

    const xml = await res.text();

    // Check if this is a sitemap index
    if (xml.includes('<sitemapindex')) {
      console.log('[llm-ready] Detected sitemap index, parsing child sitemaps');
      const childUrls = extractXmlValues(xml, 'loc');
      const allPages: SitemapPage[] = [];

      for (const childUrl of childUrls) {
        const childPages = await parseSitemap(childUrl);
        allPages.push(...childPages);
      }

      console.log(
        `[llm-ready] Sitemap index total: ${allPages.length} pages from ${childUrls.length} sitemaps`
      );
      return allPages;
    }

    // Regular sitemap
    const pages = parseUrlset(xml);
    console.log(`[llm-ready] Parsed ${pages.length} pages from sitemap`);
    return pages;
  } catch (err) {
    console.log(`[llm-ready] Sitemap parse error: ${err}`);
    return [];
  }
}

/**
 * Fallback: crawl homepage and collect internal links.
 * Limited depth to avoid excessive crawling.
 */
export async function crawlHomepage(
  siteUrl: string,
  maxPages: number = 100
): Promise<SitemapPage[]> {
  const base = siteUrl.replace(/\/+$/, '');
  console.log(
    `[llm-ready] No sitemap found, crawling homepage for links (max ${maxPages})`
  );

  try {
    const res = await fetch(base);
    if (!res.ok) return [{ url: base }];

    const html = await res.text();
    const links = extractInternalLinks(html, base);
    const unique = [...new Set([base, ...links])].slice(0, maxPages);

    console.log(`[llm-ready] Crawled ${unique.length} internal links from homepage`);
    return unique.map((url) => ({ url }));
  } catch (err) {
    console.log(`[llm-ready] Homepage crawl failed: ${err}`);
    return [{ url: base }];
  }
}

/**
 * Full discovery pipeline: sitemap → robots.txt → standard paths → crawl.
 * Returns list of all discovered pages.
 */
export async function discoverPages(
  siteUrl: string,
  configSitemap?: string
): Promise<SitemapPage[]> {
  const sitemapUrl = await discoverSitemap(siteUrl, configSitemap);

  if (sitemapUrl) {
    const pages = await parseSitemap(sitemapUrl);
    if (pages.length > 0) return pages;
  }

  return crawlHomepage(siteUrl);
}

// --- Internal helpers ---

function parseUrlset(xml: string): SitemapPage[] {
  const pages: SitemapPage[] = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/gi) || [];

  for (const block of urlBlocks) {
    const loc = extractFirstXmlValue(block, 'loc');
    if (!loc) continue;

    const lastmod = extractFirstXmlValue(block, 'lastmod');
    pages.push({ url: loc, lastmod: lastmod || undefined });
  }

  return pages;
}

function extractXmlValues(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'gi');
  const values: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    values.push(match[1].trim());
  }
  return values;
}

function extractFirstXmlValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const hrefRegex = /href\s*=\s*["']([^"'#]+)["']/gi;
  const links: string[] = [];
  let match;

  const baseDomain = new URL(baseUrl).origin;

  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1].trim();

    // Skip external, mailto, tel, javascript
    if (
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) {
      continue;
    }

    // Relative → absolute
    if (href.startsWith('/')) {
      href = `${baseDomain}${href}`;
    }

    // Only same-domain links
    if (href.startsWith(baseDomain)) {
      // Skip static assets
      if (/\.(png|jpg|jpeg|gif|svg|css|js|ico|webp|woff|pdf)$/i.test(href)) {
        continue;
      }
      links.push(href.replace(/\/+$/, ''));
    }
  }

  return links;
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}
