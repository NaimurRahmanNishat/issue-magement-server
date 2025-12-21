export declare const namespacedKey: (key: string) => string;
export declare const setCache: (key: string, value: any, ttlSeconds?: number) => Promise<void>;
export declare const getCache: <T = any>(key: string) => Promise<T | null>;
export declare const getCacheWithTTL: <T = any>(key: string) => Promise<{
    data: T | null;
    ttl: number;
} | null>;
export declare const invalidateCache: (pattern: string) => Promise<number>;
export declare const invalidateCacheAsync: (pattern: string) => void;
export declare const invalidateAllCache: (patterns: string[]) => Promise<number>;
export declare const generateIssuesCacheKey: (query: any) => string;
export declare const generateIssueCacheKey: (issueId: string) => string;
export declare const invalidateIssueListCache: () => Promise<void>;
export declare const invalidateIssueCache: (issueId: string) => Promise<void>;
export declare const CATEGORY_STATS_KEY: (category: string) => string;
//# sourceMappingURL=cache.d.ts.map