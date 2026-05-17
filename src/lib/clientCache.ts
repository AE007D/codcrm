// Simple client-side in-memory cache for API GET responses.
// Avoids re-fetching the same data within the TTL when navigating between pages.

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Fetch with cache. On cache hit within TTL returns cached data instantly.
 * On miss, fetches from network, stores result, returns data.
 */
export async function cachedFetch(url: string, ttlMs = 20_000): Promise<Response> {
  const entry = cache.get(url);
  if (entry && Date.now() - entry.fetchedAt < ttlMs) {
    // Return a synthetic Response with cached data
    return new Response(JSON.stringify(entry.data), {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
    });
  }

  const res = await fetch(url);
  if (res.ok) {
    try {
      const cloned = res.clone();
      const data = await cloned.json();
      cache.set(url, { data, fetchedAt: Date.now() });
    } catch { /* non-JSON, skip caching */ }
  }
  return res;
}

/** Invalidate a specific URL or all URLs matching a prefix. */
export function invalidateCache(urlOrPrefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(urlOrPrefix)) cache.delete(key);
  }
}
