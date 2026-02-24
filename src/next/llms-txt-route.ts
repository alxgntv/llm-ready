import { NextResponse, type NextRequest } from 'next/server';
import { generateLlmsTxt } from '../core/llms-txt';
import type { LlmReadyConfig } from '../core/types';

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
export function createLlmsTxtHandler(config: LlmReadyConfig) {
  return async function GET(_request: NextRequest): Promise<NextResponse> {
    console.log('[llm-ready] llms.txt route handler called');

    try {
      const content = generateLlmsTxt(config);

      console.log(`[llm-ready] Serving llms.txt: ${content.length} chars`);

      return new NextResponse(content, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': `public, s-maxage=${config.cache?.ttl || 86400}, stale-while-revalidate`,
        },
      });
    } catch (err) {
      console.log(`[llm-ready] Error generating llms.txt: ${err}`);
      return new NextResponse('Error generating llms.txt', { status: 500 });
    }
  };
}
