// src/helper/cursorPagination.ts

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

export const calculateCursorPagination = (options: ICursorPaginationOptions): ICursorPaginationResult => {
    const limit = options.limit && options.limit > 0 ? options.limit : 10;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    
    let filter: any = {};
    
    // Cursor filtering
    if (options.cursor) {
        const cursorDate = typeof options.cursor === 'string' 
            ? new Date(options.cursor) 
            : options.cursor;
        
        if (sortOrder === 'desc') {
            filter[sortBy] = { $lt: cursorDate };
        } else {
            filter[sortBy] = { $gt: cursorDate };
        }
    }

    return {
        limit,
        sortBy,
        sortOrder,
        filter,
    };
};

export interface ICursorPaginationMeta<T> {
    limit: number;
    hasMore: boolean;
    nextCursor: Date | string | null;
    sortBy: string;
    sortOrder: "asc" | "desc";
}

export const createCursorPaginationMeta = <T extends Record<string, any>>(
    data: T[],
    limit: number,
    sortBy: string = 'createdAt',
    sortOrder: "asc" | "desc" = 'desc'
): { data: T[]; meta: ICursorPaginationMeta<T> } => {
    const hasMore = data.length > limit;
    const paginatedData = hasMore ? data.slice(0, -1) : data;
    
    const lastItem = paginatedData[paginatedData.length - 1];
    const nextCursor = hasMore && lastItem?.[sortBy] ? lastItem[sortBy] : null;

    return {
        data: paginatedData,
        meta: {
            limit,
            hasMore,
            nextCursor,
            sortBy,
            sortOrder,
        },
    };
};
