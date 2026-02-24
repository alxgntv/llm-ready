import { NextRequest, NextResponse } from 'next/server';

interface LlmReadyConfig {
    /** Base URL of the site (e.g. 'https://example.com') */
    siteUrl: string;
    /** Path to sitemap.xml. If not set, auto-discovered from robots.txt or standard paths */
    sitemap?: string;
    /** Glob patterns for paths to exclude from markdown conversion */
    exclude?: string[];
    /** llms.txt generation settings */
    llmsTxt?: {
        /** Site name for llms.txt header. If not set, extracted from siteUrl hostname */
        siteName?: string;
        /** Site description for llms.txt header */
        description?: string;
        /** Static list of page paths to always include in llms.txt (e.g. ['/pricing', '/docs']) */
        pages?: string[];
        /** Custom sections: key = section title, value = glob patterns for URLs */
        sections?: Record<string, string[]>;
        /** URL patterns that go into the ## Optional section */
        optional?: string[];
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
    /** @internal Used by Next.js adapter to pass actual server origin for HTTP calls */
    _fetchOrigin?: string;
}

declare const BYPASS_HEADER = "x-llm-ready-bypass";
declare const LLM_PATH_PREFIX = "/llm-md";
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
declare function llmReady(request: NextRequest, config: LlmReadyConfig): NextResponse | null;

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
declare function createMarkdownHandler(config: LlmReadyConfig): (request: NextRequest, { params }: {
    params: {
        path?: string[];
    };
}) => Promise<NextResponse>;

/**
 * Creates a Next.js Route Handler that serves the llms.txt file.
 *
 * Usage — create file: app/llms.txt/route.ts
 *
 *   import { createLlmsTxtHandler } from 'llm-ready/next';
 *   import config from '../../../llm-ready.config';
 *   export const GET = createLlmsTxtHandler(config);
 *   export const revalidate = 86400;
 */
declare function createLlmsTxtHandler(config: LlmReadyConfig): (_request: NextRequest) => Promise<NextResponse>;

export { BYPASS_HEADER, LLM_PATH_PREFIX, createLlmsTxtHandler, createMarkdownHandler, llmReady };
