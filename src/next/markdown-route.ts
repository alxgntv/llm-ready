import { NextResponse, type NextRequest } from 'next/server';
import { convertHtmlToMarkdown } from '../core/converter';
import type { LlmReadyConfig } from '../core/types';
import { BYPASS_HEADER, LLM_PATH_PREFIX } from './middleware';

/**
 * Creates a Next.js Route Handler that serves Markdown versions of pages.
 *
 * Usage — create file: app/_llm/[...path]/route.ts
 *
 *   import { createMarkdownHandler } from 'llm-ready/next';
 *   import config from '../../../../llm-ready.config';
 *   export const GET = createMarkdownHandler(config);
 *   export const revalidate = 86400; // ISR: regenerate every 24h
 */
export function createMarkdownHandler(config: LlmReadyConfig) {
  return async function GET(
    request: NextRequest,
    { params }: { params: { path?: string[] } }
  ): Promise<NextResponse> {
    const pathSegments = params.path || [];
    const originalPath = '/' + pathSegments.join('/');

    // Use the actual origin passed by middleware (works on localhost and prod)
    const origin =
      request.headers.get('x-llm-ready-origin') ||
      config.siteUrl.replace(/\/+$/, '');
    const pageUrl = `${origin}${originalPath}`;
    const canonicalUrl = `${config.siteUrl.replace(/\/+$/, '')}${originalPath}`;

    console.log(`[llm-ready] Markdown route handler called for: ${originalPath}`);

    try {
      const SELF_FETCH_TIMEOUT_MS = 5000;
      console.log(`[llm-ready] Fetching original HTML from: ${pageUrl} (timeout: ${SELF_FETCH_TIMEOUT_MS}ms)`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SELF_FETCH_TIMEOUT_MS);

      let htmlResponse: Response;
      try {
        htmlResponse = await fetch(pageUrl, {
          headers: {
            [BYPASS_HEADER]: 'true',
            'User-Agent': 'llm-ready/self-fetch',
          },
          redirect: 'manual',
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          console.log(`[llm-ready] Self-fetch timed out after ${SELF_FETCH_TIMEOUT_MS}ms for: ${originalPath}`);
          return new NextResponse('Page fetch timed out', { status: 504 });
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);

      // If original page redirects, pass the redirect through
      if (
        htmlResponse.status === 301 ||
        htmlResponse.status === 302 ||
        htmlResponse.status === 308
      ) {
        const location = htmlResponse.headers.get('location');
        console.log(
          `[llm-ready] Original page redirects to: ${location}, passing through`
        );
        if (location) {
          return NextResponse.redirect(location, htmlResponse.status as 301 | 302 | 308);
        }
      }

      // If original page is not found, return 404
      if (htmlResponse.status === 404) {
        console.log(`[llm-ready] Original page not found: ${pageUrl}`);
        return new NextResponse('Not Found', { status: 404 });
      }

      if (!htmlResponse.ok) {
        console.log(
          `[llm-ready] Original page returned ${htmlResponse.status}, forwarding`
        );
        return new NextResponse('Error fetching page', {
          status: htmlResponse.status,
        });
      }

      const html = await htmlResponse.text();
      console.log(
        `[llm-ready] Fetched ${html.length} bytes of HTML, converting to markdown`
      );

      // Convert HTML to Markdown (use canonical URL for frontmatter)
      const result = convertHtmlToMarkdown(html, canonicalUrl, {
        contentSelector: config.converter?.contentSelector,
        removeSelectors: config.converter?.removeSelectors,
        sanitize: {
          stripHiddenContent: config.security?.stripHiddenContent ?? true,
          maxContentSize: config.security?.maxContentSize,
        },
      });

      if (!result.markdown) {
        console.log('[llm-ready] Conversion produced empty markdown');
        return new NextResponse('No content', { status: 204 });
      }

      // Build response with proper headers
      const response = new NextResponse(result.markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Link': `<${result.canonicalUrl}>; rel="canonical"`,
          'X-Markdown-Tokens': String(result.tokenEstimate),
          'X-Content-Source': pageUrl,
          'Cache-Control': `public, s-maxage=${config.cache?.ttl || 86400}, stale-while-revalidate`,
        },
      });

      console.log(
        `[llm-ready] Serving markdown: ${result.markdown.length} chars, ~${result.tokenEstimate} tokens`
      );
      return response;
    } catch (err) {
      console.log(`[llm-ready] Error in markdown route handler: ${err}`);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
  };
}
