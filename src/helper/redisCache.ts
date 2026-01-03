//  src/helper/redisCache.ts

import { CACHE_PREFIX, DEFAULT_TTL } from "../config/cacheConfig";
import { redis } from "../config/redis";


export interface InvalidateOptions {
  entity: "issue" | "comment" | "user" | "category" | "division" | "message";
  entityId?: string | undefined; 
  userId?: string | undefined;   
  category?: string | undefined; 
  division?: string | undefined; 
  status?: string | undefined;
  role?: string | undefined;     
}

// namespace key
export const namespacedKey = (key: string) => {
  return `${CACHE_PREFIX}${key}`;
};


// set cache from redis
export const setCache = async (key: string, value: any, ttlSeconds = DEFAULT_TTL) => {
  const namespacedKeyValue = namespacedKey(key);
  await redis.set(namespacedKeyValue, JSON.stringify(value), "EX", ttlSeconds);
};


// get cache from redis
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


// Delete cache from redis (single key delete)
export const deleteCache = async (key: string): Promise<void> => {
  const namespacedKeyValue = namespacedKey(key);
  await redis.del(namespacedKeyValue);
};


// clear all cache from redis (all key delete)
export const clearAllCache = async (): Promise<void> => {
  await redis.flushall();
};


// Clear all cache with pattern ( user clear all caches with pattern user:* )
export const clearCachePattern = async (pattern: string): Promise<number> => {
  const namespacedPattern = namespacedKey(pattern);
  const keys = await redis.keys(namespacedPattern);
  if (keys.length === 0) return 0;
  const deletedCount = await redis.del(...keys);
  return deletedCount;
};


// Pattern-based invalidation using redis scan (Memory efficient)
export const invalidateByPattern = async (pattern: string): Promise<number> => {
  let cursor = "0";
  let deleted = 0;
  const searchPattern = namespacedKey(pattern);
  
  do {
    const [nextCursor, keys] = await redis.scan( cursor, "MATCH", searchPattern, "COUNT", 100 );
    if (keys.length) {
      deleted += await redis.del(...keys);
    }
    cursor = nextCursor;
  } while (cursor !== "0");
  return deleted;
};

// Main cache invalidation function
export const invalidateCache = async (options: InvalidateOptions): Promise<void> => {
  const patterns: string[] = [];
  console.log(`🔄 Invalidating cache for entity: ${options.entity}`, options);

  switch (options.entity) {
    case "issue":
      // Single issue cache
      if (options.entityId) {
        patterns.push(`issue:${options.entityId}`);
      }
      // All issues lists
      patterns.push("issues:*");
      // User-specific issues
      if (options.userId) {
        patterns.push(`user:${options.userId}:issues:*`);
      }
      // Category-specific issues
      if (options.category) {
        patterns.push(`issues:*:*:*:*:*:*:*:${options.category}:*`);
      }
      // Division-specific issues
      if (options.division) {
        patterns.push(`issues:*:*:*:*:*:*:${options.division}:*`);
      }
      // Status-based caches
      patterns.push("issues:*:*:*:*:*:pending:*");
      patterns.push("issues:*:*:*:*:*:approved:*");
      patterns.push("issues:*:*:*:*:*:in-progress:*");
      patterns.push("issues:*:*:*:*:*:resolved:*");
      patterns.push("issues:*:*:*:*:*:rejected:*");
      break;

    case "comment":
      if (options.entityId) {
        patterns.push(`comments:issue:${options.entityId}:*`);
      }
      // Comments affect issue details
      patterns.push("issues:*");
      break;

    case "user":
      if (options.userId) {
        patterns.push(`user:${options.userId}`);
        patterns.push(`user:${options.userId}:issues:*`);
        patterns.push(`issues:${options.userId}:*`);
        patterns.push(`user_stats_${options.userId}`);
      }
      break;

    case "category":
      if (options.category) {
        patterns.push(`issues:*:*:*:*:*:*:*:${options.category}:*`);
        patterns.push(`category_stats:${options.category}`);
      }
      break;

    case "division":
      if (options.division) {
        patterns.push(`issues:*:*:*:*:*:*:${options.division}:*`);
      }
      break;
  }

  // Role-based cache
  if (options.role === "category-admin") {
    patterns.push("issues:*:category-admin:*");
  }

  // Public caches always affected
  patterns.push("issues:public:*");
  patterns.push("issues:guest:*");

  // Remove duplicates
  const uniquePatterns = [...new Set(patterns)];
  console.log(`🗑️  Patterns to invalidate: ${uniquePatterns.length}`);

  // Invalidate each pattern
  let totalDeleted = 0;
  for (const pattern of uniquePatterns) {
    const deleted = await invalidateByPattern(pattern);
    if (deleted > 0) {
      console.log(`   ✓ Pattern "${pattern}" → ${deleted} keys deleted`);
      totalDeleted += deleted;
    }
  }
  console.log(`✅ Total cache keys deleted: ${totalDeleted}`);
};
