export interface ICursorPaginationOptions {
    limit?: number;
    cursor?: string | Date;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}
export interface ICursorPaginationResult {
    limit: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    filter: any;
}
export declare const calculateCursorPagination: (options: ICursorPaginationOptions) => ICursorPaginationResult;
export interface ICursorPaginationMeta<T> {
    limit: number;
    hasMore: boolean;
    nextCursor: Date | string | null;
    sortBy: string;
    sortOrder: "asc" | "desc";
}
export declare const createCursorPaginationMeta: <T extends Record<string, any>>(data: T[], limit: number, sortBy?: string, sortOrder?: "asc" | "desc") => {
    data: T[];
    meta: ICursorPaginationMeta<T>;
};
//# sourceMappingURL=cursorPagination.d.ts.map