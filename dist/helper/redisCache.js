"use strict";
//  src/helper/redisCache.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateCache = exports.invalidateByPattern = exports.clearCachePattern = exports.clearAllCache = exports.deleteCache = exports.getCache = exports.setCache = exports.namespacedKey = void 0;
const cacheConfig_1 = require("../config/cacheConfig");
const redis_1 = require("../config/redis");
// namespace key
const namespacedKey = (key) => {
    return `${cacheConfig_1.CACHE_PREFIX}${key}`;
};
exports.namespacedKey = namespacedKey;
// set cache from redis
const setCache = async (key, value, ttlSeconds = cacheConfig_1.DEFAULT_TTL) => {
    const namespacedKeyValue = (0, exports.namespacedKey)(key);
    await redis_1.redis.set(namespacedKeyValue, JSON.stringify(value), "EX", ttlSeconds);
};
exports.setCache = setCache;
// get cache from redis
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
// Delete cache from redis (single key delete)
const deleteCache = async (key) => {
    const namespacedKeyValue = (0, exports.namespacedKey)(key);
    await redis_1.redis.del(namespacedKeyValue);
};
exports.deleteCache = deleteCache;
// clear all cache from redis (all key delete)
const clearAllCache = async () => {
    await redis_1.redis.flushall();
};
exports.clearAllCache = clearAllCache;
// Clear all cache with pattern ( user clear all caches with pattern user:* )
const clearCachePattern = async (pattern) => {
    const namespacedPattern = (0, exports.namespacedKey)(pattern);
    const keys = await redis_1.redis.keys(namespacedPattern);
    if (keys.length === 0)
        return 0;
    const deletedCount = await redis_1.redis.del(...keys);
    return deletedCount;
};
exports.clearCachePattern = clearCachePattern;
// Pattern-based invalidation using redis scan (Memory efficient)
const invalidateByPattern = async (pattern) => {
    let cursor = "0";
    let deleted = 0;
    const searchPattern = (0, exports.namespacedKey)(pattern);
    do {
        const [nextCursor, keys] = await redis_1.redis.scan(cursor, "MATCH", searchPattern, "COUNT", 100);
        if (keys.length) {
            deleted += await redis_1.redis.del(...keys);
        }
        cursor = nextCursor;
    } while (cursor !== "0");
    return deleted;
};
exports.invalidateByPattern = invalidateByPattern;
// Main cache invalidation function
const invalidateCache = async (options) => {
    const patterns = [];
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
        const deleted = await (0, exports.invalidateByPattern)(pattern);
        if (deleted > 0) {
            console.log(`   ✓ Pattern "${pattern}" → ${deleted} keys deleted`);
            totalDeleted += deleted;
        }
    }
    console.log(`✅ Total cache keys deleted: ${totalDeleted}`);
};
exports.invalidateCache = invalidateCache;
//# sourceMappingURL=redisCache.js.map