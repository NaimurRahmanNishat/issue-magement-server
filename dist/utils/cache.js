"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_STATS_KEY = exports.invalidateIssueCache = exports.invalidateIssueListCache = exports.generateIssueCacheKey = exports.generateIssuesCacheKey = exports.invalidateAllCache = exports.invalidateCacheAsync = exports.invalidateCache = exports.getCacheWithTTL = exports.getCache = exports.setCache = exports.namespacedKey = void 0;
// src/utils/cache.ts
const cacheConfig_1 = require("../config/cacheConfig");
const redis_1 = require("../config/redis");
/* -------------------------------------------------------
  Namespace handler
------------------------------------------------------- */
const namespacedKey = (key) => {
    return `${cacheConfig_1.CACHE_PREFIX}${key}`;
};
exports.namespacedKey = namespacedKey;
/* -------------------------------------------------------
  SET Cache
------------------------------------------------------- */
const setCache = async (key, value, ttlSeconds = cacheConfig_1.DEFAULT_TTL) => {
    const namespacedKeyValue = (0, exports.namespacedKey)(key);
    await redis_1.redis.set(namespacedKeyValue, JSON.stringify(value), "EX", ttlSeconds);
};
exports.setCache = setCache;
/* -------------------------------------------------------
  GET Cache
------------------------------------------------------- */
const getCache = async (key) => {
    const namespacedKeyValue = (0, exports.namespacedKey)(key);
    const raw = await redis_1.redis.get(namespacedKeyValue);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch (err) {
        console.error("getCache parse error:", err);
        return null;
    }
};
exports.getCache = getCache;
/* -------------------------------------------------------
  GET Cache with TTL
------------------------------------------------------- */
const getCacheWithTTL = async (key) => {
    const namespacedKeyValue = (0, exports.namespacedKey)(key);
    const result = await redis_1.redis.multi().get(namespacedKeyValue).ttl(namespacedKeyValue).exec();
    if (!result || !result[0] || !result[1])
        return null;
    // distructure result
    const [data, ttl] = [result[0][1], result[1][1]];
    // check data
    if (!data)
        return null;
    // return data
    return {
        data: JSON.parse(data),
        ttl: Number(ttl),
    };
};
exports.getCacheWithTTL = getCacheWithTTL;
/* -------------------------------------------------------
  Delete cache by pattern
------------------------------------------------------- */
const invalidateCache = async (pattern) => {
    try {
        let cursor = "0";
        let deleteCount = 0;
        const searchPattern = (0, exports.namespacedKey)(`${pattern}*`);
        do {
            const [nextCursor, keys] = await redis_1.redis.scan(cursor, "MATCH", searchPattern, "COUNT", 100);
            if (keys.length > 0) {
                const result = await redis_1.redis.del(...keys);
                deleteCount += result;
            }
            cursor = nextCursor;
        } while (cursor !== "0");
        return deleteCount;
    }
    catch (err) {
        console.error("invalidateCache failed:", err);
        return 0;
    }
};
exports.invalidateCache = invalidateCache;
const invalidateCacheAsync = (pattern) => {
    (0, exports.invalidateCache)(pattern).catch((e) => console.error("invalidateCacheAsync Error:", e));
};
exports.invalidateCacheAsync = invalidateCacheAsync;
/* -------------------------------------------------------
  Global cache delete
------------------------------------------------------- */
const invalidateAllCache = async (patterns) => {
    const results = await Promise.allSettled(patterns.map((p) => (0, exports.invalidateCache)(p)));
    return results.reduce((count, r) => {
        if (r.status === "fulfilled")
            count += r.value;
        return count;
    }, 0);
};
exports.invalidateAllCache = invalidateAllCache;
/* -------------------------------------------------------
  Issue Cache Key Generators
------------------------------------------------------- */
const generateIssuesCacheKey = (query) => `issues:list:${JSON.stringify(query)}`;
exports.generateIssuesCacheKey = generateIssuesCacheKey;
const generateIssueCacheKey = (issueId) => `issues:${issueId}`;
exports.generateIssueCacheKey = generateIssueCacheKey;
/* -------------------------------------------------------
  Delete Single Issue Cache
------------------------------------------------------- */
async function delCache(key) {
    const namespacedKeyValue = (0, exports.namespacedKey)(key);
    await redis_1.redis.del(namespacedKeyValue);
}
/* -------------------------------------------------------
  Invalidate Issue List Cache
------------------------------------------------------- */
const invalidateIssueListCache = async () => {
    try {
        await (0, exports.invalidateCache)("issues:list:");
        console.log("🗑️ All issue list cache deleted");
    }
    catch (e) {
        console.error("Failed to invalidate issue list cache:", e);
    }
};
exports.invalidateIssueListCache = invalidateIssueListCache;
/* -------------------------------------------------------
  Full Issue Cache Invalidation(Single Issue + All Issue List)
------------------------------------------------------- */
const invalidateIssueCache = async (issueId) => {
    try {
        // delete single issue cache
        await delCache((0, exports.generateIssueCacheKey)(issueId));
        // delete all list caches
        await (0, exports.invalidateIssueListCache)();
        console.log("🔄 Issue cache invalidated successfully");
    }
    catch (err) {
        console.error("Error invalidating issue cache:", err);
    }
};
exports.invalidateIssueCache = invalidateIssueCache;
// category stats cache key
const CATEGORY_STATS_KEY = (category) => `stats:category:${category}`;
exports.CATEGORY_STATS_KEY = CATEGORY_STATS_KEY;
//# sourceMappingURL=cache.js.map