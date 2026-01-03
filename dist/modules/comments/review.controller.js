"use strict";
// src/modules/comments/review.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReviewsByUser = exports.getReviewById = exports.getCommentsByIssue = exports.getAllCommentsForAdmin = exports.deleteComment = exports.editComment = exports.replyToComment = exports.createComment = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const errorHandler_1 = require("../../utils/errorHandler");
const issue_model_1 = __importDefault(require("../issues/issue.model"));
const review_model_1 = __importDefault(require("./review.model"));
const mongoose_1 = require("mongoose");
const redisCache_1 = require("../../helper/redisCache");
const cursorPagination_1 = require("../../helper/cursorPagination");
// 1. Create First Comment on Issue
exports.createComment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { issueId } = req.params;
    const { comment } = req.body;
    // Validate inputs
    if (!issueId) {
        throw new errorHandler_1.AppError(400, "Issue ID is required!");
    }
    if (!comment || comment.trim().length < 3) {
        throw new errorHandler_1.AppError(400, "Comment must be at least 3 characters long!");
    }
    // Check if issue exists
    const issue = await issue_model_1.default.findById(issueId);
    if (!issue) {
        throw new errorHandler_1.AppError(404, "Issue not found!");
    }
    // Create review/comment
    const review = await review_model_1.default.create({
        issue: new mongoose_1.Types.ObjectId(issueId),
        author: req.user._id,
        comment: comment.trim(),
    });
    // Populate author details for response
    await review.populate("author", "name email avatar");
    // Add review to issue
    issue.reviews.push(review._id);
    await issue.save();
    // Invalidate caches
    await (0, redisCache_1.invalidateCache)({
        entity: "issue",
        entityId: issueId,
        userId: req.user._id.toString(),
        role: req.user.role,
    });
    // Invalidate review caches for this issue
    await (0, redisCache_1.deleteCache)(`reviews:issue:${issueId}:*`);
    res.status(201).json({
        success: true,
        message: "Comment added successfully!",
        data: review,
    });
});
// 2. Reply to Comment (Nested Replies Support)
exports.replyToComment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { reviewId } = req.params;
    const { comment, parentReplyId } = req.body;
    // Validate input
    if (!comment || comment.trim().length < 3) {
        throw new errorHandler_1.AppError(400, "Reply must be at least 3 characters long!");
    }
    // Find the review
    const review = await review_model_1.default.findById(reviewId)
        .populate("author", "name email avatar");
    if (!review) {
        throw new errorHandler_1.AppError(404, "Review not found!");
    }
    // Create new reply object
    const newReply = {
        _id: new mongoose_1.Types.ObjectId(),
        author: req.user._id,
        comment: comment.trim(),
        replies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    // If parentReplyId exists, add as nested reply
    if (parentReplyId) {
        const addNestedReply = (replies) => {
            for (let reply of replies) {
                if (reply._id.toString() === parentReplyId) {
                    if (!reply.replies)
                        reply.replies = [];
                    reply.replies.push(newReply);
                    return true;
                }
                if (reply.replies && reply.replies.length > 0) {
                    if (addNestedReply(reply.replies))
                        return true;
                }
            }
            return false;
        };
        const found = addNestedReply(review.replies);
        if (!found) {
            throw new errorHandler_1.AppError(404, "Parent reply not found!");
        }
    }
    else {
        // Add as direct reply to review
        review.replies.push(newReply);
    }
    // Save review with new reply
    await review.save();
    // Populate the newly added reply's author
    await review.populate("replies.author", "name email avatar");
    // Invalidate caches
    await (0, redisCache_1.invalidateCache)({
        entity: "issue",
        entityId: review.issue.toString(),
        userId: req.user._id.toString(),
        role: req.user.role,
    });
    // Invalidate review caches
    await (0, redisCache_1.deleteCache)(`reviews:issue:${review.issue}:*`);
    res.status(201).json({
        success: true,
        message: "Reply added successfully!",
        data: review,
    });
});
// 3. Edit a Review or Reply
exports.editComment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { reviewId } = req.params;
    const { comment, replyId } = req.body;
    // Validate input
    if (!comment || comment.trim().length < 3) {
        throw new errorHandler_1.AppError(400, "Comment must be at least 3 characters long!");
    }
    // Find review
    const review = await review_model_1.default.findById(reviewId)
        .populate("author", "name email avatar");
    if (!review) {
        throw new errorHandler_1.AppError(404, "Review not found!");
    }
    // Edit main review (no replyId)
    if (!replyId) {
        // Check authorization
        if (review.author._id.toString() !== req.user._id.toString()) {
            throw new errorHandler_1.AppError(403, "You are not authorized to edit this review!");
        }
        review.comment = comment.trim();
        review.updatedAt = new Date();
    }
    // Edit nested reply
    else {
        const editNestedReply = (replies) => {
            for (let reply of replies) {
                if (reply._id.toString() === replyId) {
                    // Check authorization
                    if (reply.author.toString() !== req.user._id.toString()) {
                        throw new errorHandler_1.AppError(403, "You are not authorized to edit this reply!");
                    }
                    reply.comment = comment.trim();
                    reply.updatedAt = new Date();
                    return true;
                }
                if (reply.replies && reply.replies.length > 0) {
                    if (editNestedReply(reply.replies))
                        return true;
                }
            }
            return false;
        };
        const found = editNestedReply(review.replies);
        if (!found) {
            throw new errorHandler_1.AppError(404, "Reply not found!");
        }
    }
    // Save updated review
    await review.save();
    // Populate all authors in replies
    await review.populate("replies.author", "name email avatar");
    // Invalidate caches
    await (0, redisCache_1.invalidateCache)({
        entity: "issue",
        entityId: review.issue.toString(),
        userId: review.author._id.toString(),
        role: req.user.role,
    });
    // Invalidate review caches
    await (0, redisCache_1.deleteCache)(`reviews:issue:${review.issue}:*`);
    res.status(200).json({
        success: true,
        message: replyId ? "Reply updated successfully!" : "Review updated successfully!",
        data: review,
    });
});
// 4. Delete Review or Reply
exports.deleteComment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { reviewId } = req.params;
    const { replyId } = req.body;
    // Find review
    const review = await review_model_1.default.findById(reviewId)
        .populate("author", "name email avatar");
    if (!review) {
        throw new errorHandler_1.AppError(404, "Review not found!");
    }
    // Delete entire review (no replyId)
    if (!replyId) {
        // Check authorization
        if (review.author._id.toString() !== req.user._id.toString()) {
            throw new errorHandler_1.AppError(403, "You are not authorized to delete this review!");
        }
        // Store issueId before deletion
        const issueId = review.issue.toString();
        const authorId = review.author._id.toString();
        // Delete review
        await review_model_1.default.findByIdAndDelete(reviewId);
        // Remove review reference from issue
        await issue_model_1.default.findByIdAndUpdate(issueId, {
            $pull: { reviews: review._id }
        });
        // Invalidate caches
        await (0, redisCache_1.invalidateCache)({
            entity: "issue",
            entityId: issueId,
            userId: authorId,
            role: req.user.role,
        });
        // Invalidate review caches
        await (0, redisCache_1.deleteCache)(`reviews:issue:${issueId}:*`);
        return res.status(200).json({
            success: true,
            message: "Review deleted successfully!",
        });
    }
    // Delete nested reply
    const deleteNestedReply = (replies) => {
        for (let i = 0; i < replies.length; i++) {
            if (replies[i]._id.toString() === replyId) {
                // Check authorization
                if (replies[i].author.toString() !== req.user._id.toString()) {
                    throw new errorHandler_1.AppError(403, "You are not authorized to delete this reply!");
                }
                replies.splice(i, 1);
                return true;
            }
            if (replies[i].replies && replies[i].replies.length > 0) {
                if (deleteNestedReply(replies[i].replies))
                    return true;
            }
        }
        return false;
    };
    const found = deleteNestedReply(review.replies);
    if (!found) {
        throw new errorHandler_1.AppError(404, "Reply not found!");
    }
    // Save review after removing reply
    await review.save();
    // Invalidate caches
    await (0, redisCache_1.invalidateCache)({
        entity: "issue",
        entityId: review.issue.toString(),
        userId: review.author._id.toString(),
        role: req.user.role,
    });
    // Invalidate review caches
    await (0, redisCache_1.deleteCache)(`reviews:issue:${review.issue}:*`);
    res.status(200).json({
        success: true,
        message: "Reply deleted successfully!",
    });
});
// 5. Get All Comments for Admin (Cursor Pagination)
exports.getAllCommentsForAdmin = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    // Permission check
    if (user.role !== "category-admin" && user.role !== "super-admin") {
        throw new errorHandler_1.AppError(403, "Access denied! Only admins can view all comments.");
    }
    const { cursor, limit = 10, sortOrder = "desc" } = req.query;
    const adminCategory = user.category || null;
    const cacheKey = `reviews:admin:${user.role}:${adminCategory || "all"}:${cursor || 'first'}:${limit}:${sortOrder}`;
    // Try cache first
    try {
        const cached = await (0, redisCache_1.getCache)(cacheKey);
        if (cached) {
            console.log(`⚡ Cache hit: ${cacheKey}`);
            return res.status(200).json({
                success: true,
                message: "Comments fetched (from cache)",
                ...cached,
            });
        }
    }
    catch (cacheError) {
        console.error("Cache retrieval error:", cacheError);
    }
    // Build base query
    let baseQuery = {};
    // Category admin sees only their category's reviews
    if (user.role === "category-admin") {
        if (!adminCategory) {
            throw new errorHandler_1.AppError(400, "Category-admin must have a category assigned!");
        }
        // Get all issues for this category
        const issues = await issue_model_1.default.find({ category: adminCategory }).select("_id").lean();
        const issueIds = issues.map((i) => i._id);
        baseQuery = { issue: { $in: issueIds } };
    }
    // Calculate cursor pagination
    const paginationOptions = (0, cursorPagination_1.calculateCursorPagination)({
        limit: parseInt(limit),
        cursor: cursor,
        sortBy: 'createdAt',
        sortOrder: sortOrder,
    });
    // Combine base query with cursor filter
    const finalQuery = {
        ...baseQuery,
        ...paginationOptions.filter,
    };
    // Fetch reviews from database
    const reviews = await review_model_1.default.find(finalQuery)
        .populate("author", "name avatar email")
        .populate({
        path: "replies.author",
        select: "name avatar email",
    })
        .populate("issue", "title category status")
        .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
        .limit(paginationOptions.limit + 1)
        .lean();
    // Create cursor pagination metadata
    const { data, meta } = (0, cursorPagination_1.createCursorPaginationMeta)(reviews, paginationOptions.limit, paginationOptions.sortBy, paginationOptions.sortOrder);
    const responseData = { data, meta };
    // Cache for 5 minutes
    await (0, redisCache_1.setCache)(cacheKey, responseData, 600);
    res.status(200).json({
        success: true,
        message: "Comments fetched successfully",
        ...responseData,
    });
});
// 6. Get Comments by Issue ID (Cursor Pagination)
exports.getCommentsByIssue = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { issueId } = req.params;
    const { cursor, limit = 10, sortOrder = "desc" } = req.query;
    // Validate issueId
    if (!issueId) {
        throw new errorHandler_1.AppError(400, "Issue ID is required!");
    }
    // Check if issue exists
    const issue = await issue_model_1.default.findById(issueId).lean();
    if (!issue) {
        throw new errorHandler_1.AppError(404, "Issue not found!");
    }
    // Calculate cursor pagination
    const paginationOptions = (0, cursorPagination_1.calculateCursorPagination)({
        limit: parseInt(limit),
        cursor: cursor,
        sortBy: 'createdAt',
        sortOrder: sortOrder,
    });
    // Build query with cursor filter
    const query = {
        issue: issueId,
        ...paginationOptions.filter,
    };
    // Fetch reviews with cursor pagination
    const reviews = await review_model_1.default.find(query)
        .populate("author", "name avatar email")
        .populate({
        path: "replies.author",
        select: "name avatar email",
    })
        .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
        .limit(paginationOptions.limit + 1)
        .lean();
    // Create cursor pagination metadata
    const { data, meta } = (0, cursorPagination_1.createCursorPaginationMeta)(reviews, paginationOptions.limit, paginationOptions.sortBy, paginationOptions.sortOrder);
    // Get total count for this issue
    const total = await review_model_1.default.countDocuments({ issue: issueId });
    const responseData = {
        data,
        meta: {
            ...meta,
            total,
        },
    };
    console.log(`✅ Found ${data.length} reviews for issue ${issueId}`);
    res.status(200).json({
        success: true,
        message: "Comments fetched successfully",
        ...responseData,
    });
});
// 7. Get Single Review by ID
exports.getReviewById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { reviewId } = req.params;
    if (!reviewId) {
        throw new errorHandler_1.AppError(400, "Review ID is required!");
    }
    const cacheKey = `review:${reviewId}`;
    // Try cache first
    try {
        const cached = await (0, redisCache_1.getCache)(cacheKey);
        if (cached) {
            console.log(`⚡ Cache hit: ${cacheKey}`);
            return res.status(200).json({
                success: true,
                message: "Review fetched (from cache)",
                data: cached,
            });
        }
    }
    catch (cacheError) {
        console.error("Cache retrieval error:", cacheError);
    }
    // Fetch from database
    const review = await review_model_1.default.findById(reviewId)
        .populate("author", "name avatar email")
        .populate({
        path: "replies.author",
        select: "name avatar email",
    })
        .populate("issue", "title category status")
        .lean();
    if (!review) {
        throw new errorHandler_1.AppError(404, "Review not found!");
    }
    // Cache for 10 minutes
    await (0, redisCache_1.setCache)(cacheKey, review, 600);
    res.status(200).json({
        success: true,
        message: "Review fetched successfully",
        data: review,
    });
});
// 8. Get Reviews by User ID (Cursor Pagination)
exports.getReviewsByUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { userId } = req.params;
    const { cursor, limit = 10, sortOrder = "desc" } = req.query;
    const currentUser = req.user;
    // Permission check: user can only view own reviews (unless admin)
    if (currentUser._id.toString() !== userId &&
        currentUser.role !== "super-admin" &&
        currentUser.role !== "category-admin") {
        throw new errorHandler_1.AppError(403, "You can only view your own reviews");
    }
    const cacheKey = `reviews:user:${userId}:${cursor || 'first'}:${limit}:${sortOrder}`;
    // Try cache first
    try {
        const cached = await (0, redisCache_1.getCache)(cacheKey);
        if (cached) {
            console.log(`⚡ Cache hit: ${cacheKey}`);
            return res.status(200).json({
                success: true,
                message: "Reviews fetched (from cache)",
                ...cached,
            });
        }
    }
    catch (cacheError) {
        console.error("Cache retrieval error:", cacheError);
    }
    // Calculate cursor pagination
    const paginationOptions = (0, cursorPagination_1.calculateCursorPagination)({
        limit: parseInt(limit),
        cursor: cursor,
        sortBy: 'createdAt',
        sortOrder: sortOrder,
    });
    // Build query
    const query = {
        author: userId,
        ...paginationOptions.filter,
    };
    // Fetch reviews
    const reviews = await review_model_1.default.find(query)
        .populate("author", "name avatar email")
        .populate({
        path: "replies.author",
        select: "name avatar email",
    })
        .populate("issue", "title category status")
        .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
        .limit(paginationOptions.limit + 1)
        .lean();
    // Create pagination metadata
    const { data, meta } = (0, cursorPagination_1.createCursorPaginationMeta)(reviews, paginationOptions.limit, paginationOptions.sortBy, paginationOptions.sortOrder);
    // Get total count
    const total = await review_model_1.default.countDocuments({ author: userId });
    const responseData = {
        data,
        meta: {
            ...meta,
            total,
        },
    };
    // Cache for 10 minutes
    await (0, redisCache_1.setCache)(cacheKey, responseData, 600);
    res.status(200).json({
        success: true,
        message: "Reviews fetched successfully",
        ...responseData,
    });
});
//# sourceMappingURL=review.controller.js.map