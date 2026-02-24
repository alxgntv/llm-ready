import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { detectBot } from '../detect/bot';
import type { LlmReadyConfig } from '../core/types';

export const BYPASS_HEADER = 'x-llm-ready-bypass';
export const LLM_PATH_PREFIX = '/llm-md';

/**
 * Call this at the top of your Next.js middleware.
 * Returns a NextResponse if the request should serve markdown, or null for normal flow.
 *
 * Two triggers:
 * 1. URL ends with .md (e.g. /twitter/like.md) — Stripe-style, works for anyone
 * 2. LLM bot detected via User-Agent or Accept header — auto-serves markdown
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

  // Never intercept internal routes or bypass requests
  if (
    pathname.startsWith(LLM_PATH_PREFIX) ||
    request.headers.get(BYPASS_HEADER) === 'true'
  ) {
    return null;
  }

  // For /llms.txt, pass origin header so it can fetch sitemap correctly
  if (pathname === '/llms.txt') {
    const origin = request.nextUrl.origin;
    const headers = new Headers(request.headers);
    headers.set('x-llm-ready-origin', origin);
    return NextResponse.next({ request: { headers } });
  }

  // --- Trigger 1: .md suffix (Stripe-style) ---
  if (pathname.endsWith('.md')) {
    const originalPath = pathname.slice(0, -3); // strip .md

    if (isStaticFile(originalPath)) return null;

    const excludePatterns = config.exclude || [];
    if (excludePatterns.some((p) => matchGlob(originalPath, p))) return null;

    console.log(
      `[llm-ready] .md URL requested: ${pathname} → serving markdown for ${originalPath}`
    );
    return rewriteToMarkdown(request, originalPath);
  }

  // Skip static files for bot detection
  if (isStaticFile(pathname)) return null;

  // Check exclusions
  const excludePatterns = config.exclude || [];
  if (excludePatterns.some((p) => matchGlob(pathname, p))) return null;

  // --- Trigger 2: LLM bot detection ---
  const userAgent = request.headers.get('user-agent');
  const acceptHeader = request.headers.get('accept');
  const result = detectBot(userAgent, acceptHeader, config.bots);

  if (!result.isBot) return null;

  if (result.isBlocked) {
    console.log(`[llm-ready] Blocked bot: ${result.botName}, returning 403`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  console.log(
    `[llm-ready] LLM bot detected (${result.botName || 'Accept:text/markdown'}), serving markdown for ${pathname}`
  );
  return rewriteToMarkdown(request, pathname);
}

/** Rewrite request to the internal markdown route handler */
function rewriteToMarkdown(
  request: NextRequest,
  originalPath: string
): NextResponse {
  const llmPath = `${LLM_PATH_PREFIX}${originalPath}`;
  const rewriteUrl = new URL(llmPath, request.url);
  rewriteUrl.search = request.nextUrl.search;

  const origin = request.nextUrl.origin;
  const headers = new Headers(request.headers);
  headers.set('x-llm-ready-origin', origin);

  return NextResponse.rewrite(rewriteUrl, { request: { headers } });
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
