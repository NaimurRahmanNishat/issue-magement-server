// src/utils/cache.ts
import { CACHE_PREFIX, DEFAULT_TTL } from "../config/cacheConfig";
import { redis } from "../config/redis";

/* -------------------------------------------------------
  Namespace handler
------------------------------------------------------- */
export const namespacedKey = (key: string) => {
  return `${CACHE_PREFIX}${key}`;
};

/* -------------------------------------------------------
  SET Cache
------------------------------------------------------- */
export const setCache = async (key: string, value: any, ttlSeconds = DEFAULT_TTL) => {
  const namespacedKeyValue = namespacedKey(key);
  await redis.set(namespacedKeyValue, JSON.stringify(value), "EX", ttlSeconds);
};

/* -------------------------------------------------------
  GET Cache
------------------------------------------------------- */
export const getCache = async <T = any>(key: string): Promise<T | null> => {
  const namespacedKeyValue = namespacedKey(key);
  const raw = await redis.get(namespacedKeyValue);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("getCache parse error:", err);
    return null;
  }
};

/* -------------------------------------------------------
  GET Cache with TTL
------------------------------------------------------- */
export const getCacheWithTTL = async<T=any>(key: string): Promise<{data: T | null; ttl: number} | null> => {
    const namespacedKeyValue = namespacedKey(key);
    const result = await redis.multi().get(namespacedKeyValue).ttl(namespacedKeyValue).exec() as [string | null, string | null][];

    if(!result || !result[0] || !result[1]) return null;
    
    // distructure result
    const [data, ttl] = [result[0][1], result[1][1]];

    // check data
    if(!data) return null;

    // return data
    return {
        data: JSON.parse(data),
        ttl: Number(ttl),
    }

}

/* -------------------------------------------------------
  Delete cache by pattern
------------------------------------------------------- */
export const invalidateCache = async (pattern: string): Promise<number> => {
  try {
    let cursor = "0";
    let deleteCount = 0;
    const searchPattern = namespacedKey(`${pattern}*`);

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", searchPattern, "COUNT", 100);

      if (keys.length > 0) {
        const result = await redis.del(...keys);
        deleteCount += result;
      }

      cursor = nextCursor;
    } while (cursor !== "0");

    return deleteCount;
  } catch (err) {
    console.error("invalidateCache failed:", err);
    return 0;
  }
};

export const invalidateCacheAsync = (pattern: string): void => {
  invalidateCache(pattern).catch((e) => console.error("invalidateCacheAsync Error:", e));
};

/* -------------------------------------------------------
  Global cache delete
------------------------------------------------------- */
export const invalidateAllCache = async (patterns: string[]) => {
  const results = await Promise.allSettled(patterns.map((p) => invalidateCache(p)));

  return results.reduce((count, r) => {
    if (r.status === "fulfilled") count += r.value;
    return count;
  }, 0);
};

/* -------------------------------------------------------
  Issue Cache Key Generators
------------------------------------------------------- */
export const generateIssuesCacheKey = (query: any) =>
  `issues:list:${JSON.stringify(query)}`;

export const generateIssueCacheKey = (issueId: string) => `issues:${issueId}`;

/* -------------------------------------------------------
  Delete Single Issue Cache
------------------------------------------------------- */
async function delCache(key: string): Promise<void> {
  const namespacedKeyValue = namespacedKey(key);
  await redis.del(namespacedKeyValue);
}

/* -------------------------------------------------------
  Invalidate Issue List Cache
------------------------------------------------------- */
export const invalidateIssueListCache = async () => {
  try {
    await invalidateCache("issues:list:");
    console.log("🗑️ All issue list cache deleted");
  } catch (e) {
    console.error("Failed to invalidate issue list cache:", e);
  }
};

/* -------------------------------------------------------
  Full Issue Cache Invalidation(Single Issue + All Issue List)
------------------------------------------------------- */
export const invalidateIssueCache = async (issueId: string) => {
  try {
    // delete single issue cache
    await delCache(generateIssueCacheKey(issueId));

    // delete all list caches
    await invalidateIssueListCache();

    console.log("🔄 Issue cache invalidated successfully");
  } catch (err) {
    console.error("Error invalidating issue cache:", err);
  }
};


// category stats cache key
export const CATEGORY_STATS_KEY = (category: string) =>
  `stats:category:${category}`;


