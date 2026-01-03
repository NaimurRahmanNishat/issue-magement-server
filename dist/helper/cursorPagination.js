"use strict";
// src/helper/cursorPagination.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCursorPaginationMeta = exports.calculateCursorPagination = void 0;
const calculateCursorPagination = (options) => {
    const limit = options.limit && options.limit > 0 ? options.limit : 10;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    let filter = {};
    // Cursor filtering
    if (options.cursor) {
        const cursorDate = typeof options.cursor === 'string'
            ? new Date(options.cursor)
            : options.cursor;
        if (sortOrder === 'desc') {
            filter[sortBy] = { $lt: cursorDate };
        }
        else {
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
exports.calculateCursorPagination = calculateCursorPagination;
const createCursorPaginationMeta = (data, limit, sortBy = 'createdAt', sortOrder = 'desc') => {
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
exports.createCursorPaginationMeta = createCursorPaginationMeta;
//# sourceMappingURL=cursorPagination.js.map