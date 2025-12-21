// src/config/cacheConfig.ts

// storage-management:devlopment:user-123 (development stage)
// storage-management:production:user-123 (production stage)

import config from ".";


export const CACHE_PREFIX = config.nodeEnv === "production" ? "stm:prod:" : "stm:dev:";
export const DEFAULT_TTL = 10 * 60;
export const USER_CACHE_TTL = 7 * 24 * 60 * 60;