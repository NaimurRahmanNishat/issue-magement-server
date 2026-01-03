export interface InvalidateOptions {
    entity: "issue" | "comment" | "user" | "category" | "division" | "message";
    entityId?: string | undefined;
    userId?: string | undefined;
    category?: string | undefined;
    division?: string | undefined;
    status?: string | undefined;
    role?: string | undefined;
}
export declare const namespacedKey: (key: string) => string;
export declare const setCache: (key: string, value: any, ttlSeconds?: number) => Promise<void>;
export declare const getCache: <T = any>(key: string) => Promise<T | null>;
export declare const deleteCache: (key: string) => Promise<void>;
export declare const clearAllCache: () => Promise<void>;
export declare const clearCachePattern: (pattern: string) => Promise<number>;
export declare const invalidateByPattern: (pattern: string) => Promise<number>;
export declare const invalidateCache: (options: InvalidateOptions) => Promise<void>;
//# sourceMappingURL=redisCache.d.ts.map