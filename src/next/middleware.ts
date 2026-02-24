import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { detectBot } from '../detect/bot';
import type { LlmReadyConfig } from '../core/types';

export const BYPASS_HEADER = 'x-llm-ready-bypass';
export const LLM_PATH_PREFIX = '/_llm';

/**
 * Call this at the top of your Next.js middleware.
 * Returns a NextResponse (rewrite to markdown route) if the request is from an LLM bot,
 * or null if the request should be handled normally.
 *
 * Usage in middleware.ts:
 *
 *   import { llmReady } from 'llm-ready/next';
 *   import llmConfig from '../llm-ready.config';
 *
 *   export async function middleware(request: NextRequest) {
 *     const llmResponse = llmReady(request, llmConfig);
 *     if (llmResponse) return llmResponse;
 *     // ... rest of your middleware
 *   }
 */
export function llmReady(
  request: NextRequest,
  config: LlmReadyConfig
): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  // Never intercept the markdown route itself or bypass requests
  if (
    pathname.startsWith(LLM_PATH_PREFIX) ||
    pathname === '/llms.txt' ||
    request.headers.get(BYPASS_HEADER) === 'true'
  ) {
    return null;
  }

  // Skip static files
  if (isStaticFile(pathname)) {
    return null;
  }

  // Check exclusions
  const excludePatterns = config.exclude || [];
  if (excludePatterns.some((pattern) => matchGlob(pathname, pattern))) {
    return null;
  }

  // Detect bot
  const userAgent = request.headers.get('user-agent');
  const acceptHeader = request.headers.get('accept');
  const result = detectBot(userAgent, acceptHeader, config.bots);

  if (!result.isBot) {
    return null;
  }

  // Blocked bots get 403
  if (result.isBlocked) {
    console.log(
      `[llm-ready] Blocked bot: ${result.botName}, returning 403`
    );
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Rewrite to markdown route handler
  const llmPath = `${LLM_PATH_PREFIX}${pathname}`;
  console.log(
    `[llm-ready] LLM bot detected (${result.botName || 'Accept:text/markdown'}), rewriting ${pathname} → ${llmPath}`
  );

  const rewriteUrl = new URL(llmPath, request.url);
  // Forward query params
  rewriteUrl.search = request.nextUrl.search;

  return NextResponse.rewrite(rewriteUrl);
}

function isStaticFile(pathname: string): boolean {
  return /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map|json|woff|woff2|ttf|eot|webmanifest|xml|txt)$/i.test(
    pathname
  );
}

function matchGlob(path: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    return path.startsWith(pattern.slice(0, -2));
  }
  if (pattern.endsWith('*')) {
    return path.startsWith(pattern.slice(0, -1));
  }
  return path === pattern;
}
