# llm-ready: Stability Fixes Plan

Post-mortem after cascading 504 errors on upvote.club (2026-02-24).
The library's middleware consumed all Vercel serverless slots, taking down the entire site.

---

## Root Cause

Each `.md` request triggers a **self-fetch** of the original HTML page.
This means **2 serverless function slots per `.md` request** — one for the `.md` handler, one for the self-fetch.
A bot repeatedly requesting `/index.md` every 20 seconds created a cascade: 12+ slots blocked → all other pages queued → site-wide 504.

Additional factors:
- Vercel cached the old library version (without the 5s timeout fix) — changes pushed to GitHub never reached production.
- Exclude pattern `'/'` didn't match `/index` (same page, different path representation).
- `detectBot()` ran on every single request including normal browsers.

---

## Fix 1: Vercel doesn't pick up new library versions

**Problem**: `"llm-ready": "github:alxgntv/llm-ready"` — no commit hash.
Vercel caches `node_modules` and does not re-download the library on redeploy.
All fixes in the library never reached production.

**Solution**:
- Option A: Publish to npm with proper semver (`0.1.2`, `0.1.3`, etc.)
- Option B: Pin to commit hash: `"llm-ready": "github:alxgntv/llm-ready#abc1234"`
- Option C: Add `postinstall` script or clear Vercel build cache on dependency updates

**Priority**: Critical — without this, no other fix matters.

---

## Fix 2: Exclude pattern `/` doesn't match `/index`

**Problem**: Request `/index.md` → stripped to `/index`.
Config has `exclude: ['/']`. `matchGlob('/index', '/')` returns `false`.
Homepage `.md` requests bypass the exclude and trigger the full self-fetch chain.

**Solution** (in `src/next/middleware.ts`):
```typescript
// After stripping .md suffix, normalize /index → /
let originalPath = pathname.slice(0, -3);
if (originalPath === '/index') originalPath = '/';
```

Also fix `matchGlob` to handle trailing slashes:
```typescript
function matchGlob(path: string, pattern: string): boolean {
  const normPath = path.replace(/\/+$/, '') || '/';
  const normPattern = pattern.replace(/\/+$/, '') || '/';
  if (normPattern.endsWith('/*')) {
    return normPath.startsWith(normPattern.slice(0, -2));
  }
  if (normPattern.endsWith('*')) {
    return normPath.startsWith(normPattern.slice(0, -1));
  }
  return normPath === normPattern;
}
```

**Priority**: Critical

---

## Fix 3: Blog posts not excluded

**Problem**: Config has `/blog/` (with trailing slash) but not `/blog/*`.
Blog posts like `/blog/some-slug` pass through and generate `.md`.

**Solution**: Document that exclude patterns should NOT use trailing slashes.
Normalize both path and pattern in `matchGlob` (see Fix 2).

**Priority**: High

---

## Fix 4: Self-fetch timeout must be enforced on consumer side

**Problem**: Even with `AbortController` timeout in the library, if the old version is cached (Fix 1),
there's no timeout at all. The function hangs for the full Vercel limit (15s hobby / 60s pro).

**Solution**: The `createMarkdownHandler` wrapper in the consumer project should add its own timeout guard:
```typescript
// In front-upvote-club/src/app/llm-md/[...path]/route.ts
import { createMarkdownHandler } from 'llm-ready/next';
import config from '../../../../llm-ready.config';

const handler = createMarkdownHandler(config);

export async function GET(request: NextRequest, context: any) {
  const timeoutPromise = new Promise<NextResponse>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 5000)
  );
  try {
    return await Promise.race([handler(request, context), timeoutPromise]);
  } catch {
    return new NextResponse('Timeout', { status: 504 });
  }
}
```

Also keep the `AbortController` inside the library as defense-in-depth.

**Priority**: High

---

## Fix 5: `detectBot()` runs on every request

**Problem**: Middleware calls `detectBot()` for all requests, even normal browsers.
Parses User-Agent + logs result. Wasteful edge compute, pollutes logs.

**Solution**:
- Skip bot detection entirely if `config.bots?.blockUserAgents` is empty/undefined
- Move `llmReady()` call in consumer's middleware AFTER static file checks
- Remove the verbose log line for non-bot results (only log when isBot=true)

```typescript
// In llmReady():
if (!config.bots?.blockUserAgents?.length) {
  return null; // No bots to block, skip detection entirely
}
```

**Priority**: Medium

---

## Fix 6: No protection against repeated requests to same URL

**Problem**: A bot hammered `/index.md` every 20 seconds.
Each request created a fresh self-fetch, no deduplication.

**Solution options**:
- A) In-memory request deduplication: if `.md` generation is already in progress for a URL, return 429 or wait for the existing promise
- B) Leverage Next.js ISR (`revalidate = 86400`) so after first successful render, subsequent requests are served from cache
- C) Add `Cache-Control: public, s-maxage=86400` to `.md` responses (already done) — but this only works after first successful response

Recommended: Option A + B combined.

```typescript
const inflight = new Map<string, Promise<NextResponse>>();

export function createMarkdownHandler(config: LlmReadyConfig) {
  return async function GET(request, context) {
    const key = originalPath;
    if (inflight.has(key)) {
      console.log(`[llm-ready] Dedup: ${key} already in flight, waiting`);
      return inflight.get(key)!;
    }
    const promise = handleMarkdown(request, context, config);
    inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      inflight.delete(key);
    }
  };
}
```

**Priority**: Medium

---

## Safe Re-enable Checklist

1. [ ] Apply Fixes 1-6 in `llm-ready` library
2. [ ] Build library, push with version bump or tagged commit
3. [ ] Update `front-upvote-club/package.json` with pinned commit hash
4. [ ] Run `npm install` to update `package-lock.json`
5. [ ] Move `llmReady()` call in `middleware.ts` AFTER static file checks
6. [ ] Add consumer-side timeout wrapper (Fix 4)
7. [ ] Test locally: `curl localhost:3000/twitter/like.md`, `curl localhost:3000/index.md` (should be blocked)
8. [ ] Deploy to Vercel
9. [ ] Monitor logs for 10 minutes — check for 504s, check middleware duration
10. [ ] Verify: `curl -I https://upvote.club/twitter/like.md` returns 200 with markdown
11. [ ] Verify: `curl -I https://upvote.club/index.md` returns 404 or redirect (excluded)
12. [ ] Verify: `curl -I https://upvote.club/blog/some-post.md` returns 404 (excluded)
