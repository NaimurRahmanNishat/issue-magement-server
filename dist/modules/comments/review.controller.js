"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommentsByIssue = exports.getAllCommentsForAdmin = exports.deleteComment = exports.editComment = exports.replyToComment = exports.createComment = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const errorHandler_1 = require("../../utils/errorHandler");
const issue_model_1 = __importDefault(require("../issues/issue.model"));
const review_model_1 = __importDefault(require("./review.model"));
const mongoose_1 = require("mongoose");
const cache_1 = require("../../utils/cache");
// 1. create first comment issue
exports.createComment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { issueId } = req.params;
    const { comment } = req.body;
    if (!issueId)
        throw new errorHandler_1.AppError(400, "Issue ID is required!");
    if (!comment || comment.trim().length < 3) {
        throw new errorHandler_1.AppError(400, "Comment must be at least 3 characters long!");
    }
    const issue = await issue_model_1.default.findById(issueId);
    if (!issue)
        throw new errorHandler_1.AppError(404, "Issue not found!");
    const review = await review_model_1.default.create({
        issue: new mongoose_1.Types.ObjectId(issueId),
        author: req.user._id,
        comment,
    });
    issue.reviews.push(review._id);
    await issue.save();
    await (0, cache_1.invalidateIssueCache)(issueId);
    res.status(201).json({
        success: true,
        message: "Review added successfully!",
        review,
    });
});
// 2. reply to comment
exports.replyToComment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { reviewId } = req.params;
    const { comment, parentReplyId } = req.body;
    if (!comment || comment.trim().length < 3) {
        throw new errorHandler_1.AppError(400, "Reply must be at least 3 characters long!");
    }
    const review = await review_model_1.default.findById(reviewId);
    if (!review)
        throw new errorHandler_1.AppError(404, "Review not found!");
    const newReply = {
        _id: new mongoose_1.Types.ObjectId(),
        author: req.user._id,
        comment,
        replies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
    };
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
        if (!found)
            throw new errorHandler_1.AppError(404, "Parent reply not found!");
    }
    else {
        review.replies.push(newReply);
    }
    await review.save();
    await (0, cache_1.invalidateIssueCache)(review.issue.toString());
    res.status(201).json({
        success: true,
        message: "Reply added successfully!",
        review,
    });
});
// 3. Edit a Review or Reply
exports.editComment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { reviewId } = req.params;
    const { comment, replyId } = req.body;
    if (!comment || comment.trim().length < 3) {
        throw new errorHandler_1.AppError(400, "Comment must be at least 3 characters long!");
    }
    const review = await review_model_1.default.findById(reviewId);
    if (!review)
        throw new errorHandler_1.AppError(404, "Review not found!");
    if (!replyId) {
        if (review.author.toString() !== req.user?._id.toString()) {
            throw new errorHandler_1.AppError(403, "You are not authorized to edit this review!");
        }
        review.comment = comment;
    }
    else {
        const editNestedReply = (replies) => {
            for (let reply of replies) {
                if (reply._id.toString() === replyId) {
                    if (reply.author.toString() !== req.user?._id.toString()) {
                        throw new errorHandler_1.AppError(403, "You are not authorized to edit this reply!");
                    }
                    reply.comment = comment;
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
        if (!found)
            throw new errorHandler_1.AppError(404, "Reply not found!");
    }
    await review.save();
    await (0, cache_1.invalidateIssueCache)(review.issue.toString());
    res.status(200).json({
        success: true,
        message: replyId ? "Reply updated successfully!" : "Review updated successfully!",
        review,
    });
});
// 4. Delete Review or Reply
exports.deleteComment = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { reviewId } = req.params;
    const { replyId } = req.body;
    const review = await review_model_1.default.findById(reviewId);
    if (!review)
        throw new errorHandler_1.AppError(404, "Review not found!");
    if (!replyId) {
        if (review.author.toString() !== req.user?._id.toString()) {
            throw new errorHandler_1.AppError(403, "You are not authorized to delete this review!");
        }
        await review_model_1.default.findByIdAndDelete(reviewId);
        await issue_model_1.default.findByIdAndUpdate(review.issue, { $pull: { reviews: review._id } });
        await (0, cache_1.invalidateIssueCache)(review.issue.toString());
        return res.status(200).json({
            success: true,
            message: "Review deleted successfully!",
        });
    }
    const deleteNestedReply = (replies, parentReplies) => {
        for (let i = 0; i < replies.length; i++) {
            if (replies[i]._id.toString() === replyId) {
                if (replies[i].author.toString() !== req.user?._id.toString()) {
                    throw new errorHandler_1.AppError(403, "You are not authorized to delete this reply!");
                }
                replies.splice(i, 1);
                return true;
            }
            if (replies[i].replies && replies[i].replies.length > 0) {
                if (deleteNestedReply(replies[i].replies, replies))
                    return true;
            }
        }
        return false;
    };
    const found = deleteNestedReply(review.replies, review.replies);
    if (!found)
        throw new errorHandler_1.AppError(404, "Reply not found!");
    await review.save();
    await (0, cache_1.invalidateIssueCache)(review.issue.toString());
    res.status(200).json({
        success: true,
        message: "Reply deleted successfully!",
    });
});
// 5. Get all reviews for admin
exports.getAllCommentsForAdmin = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    if (user.role !== "category-admin" && user.role !== "super-admin") {
        throw new errorHandler_1.AppError(403, "Access denied!");
    }
    const adminCategory = user.category || null;
    const cacheKey = `reviews:admin:${user.role}:${adminCategory || "all"}`;
    const cached = await (0, cache_1.getCache)(cacheKey);
    if (cached) {
        return res.status(200).json({
            success: true,
            source: "cache",
            count: JSON.parse(cached).length,
            reviews: JSON.parse(cached),
        });
    }
    let query = {};
    if (user.role === "category-admin") {
        if (!adminCategory) {
            throw new errorHandler_1.AppError(400, "Category-admin must have a category assigned!");
        }
        const issues = await issue_model_1.default.find({ category: adminCategory }).select("_id");
        const issueIds = issues.map((i) => i._id);
        query = { issue: { $in: issueIds } };
    }
    const reviews = await review_model_1.default.find(query)
        .populate("author", "name avatar email")
        .populate({
        path: "replies.author",
        select: "name avatar email",
    })
        .populate("issue", "title category status")
        .sort({ createdAt: -1 });
    await (0, cache_1.setCache)(cacheKey, reviews, 300);
    res.status(200).json({
        success: true,
        source: "db",
        count: reviews.length,
        reviews,
    });
});
// 6. Get reviews for a specific issue (PUBLIC ROUTE)
exports.getCommentsByIssue = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { issueId } = req.params;
    const { page = "1", limit = "10" } = req.query;
    console.log("getCommentsByIssue called for issueId:", issueId); // Debug log
    if (!issueId) {
        throw new errorHandler_1.AppError(400, "Issue ID is required!");
    }
    // Check if issue exists
    const issue = await issue_model_1.default.findById(issueId);
    if (!issue) {
        throw new errorHandler_1.AppError(404, "Issue not found!");
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const cacheKey = `reviews:issue:${issueId}:page:${pageNum}:limit:${limitNum}`;
    // Check cache
    try {
        const cached = await (0, cache_1.getCache)(cacheKey);
        if (cached) {
            console.log("✅ Returning cached reviews");
            return res.status(200).json({
                success: true,
                source: "cache",
                ...JSON.parse(cached),
            });
        }
    }
    catch (err) {
        console.warn("Cache read error:", err);
    }
    const skip = (pageNum - 1) * limitNum;
    // Fetch reviews
    const [reviews, total] = await Promise.all([
        review_model_1.default.find({ issue: issueId })
            .populate("author", "name avatar email")
            .populate({
            path: "replies.author",
            select: "name avatar email",
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
        review_model_1.default.countDocuments({ issue: issueId }),
    ]);
    console.log(`✅ Found ${reviews.length} reviews for issue ${issueId}`);
    const result = {
        count: reviews.length,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        reviews,
    };
    // Cache result
    try {
        await (0, cache_1.setCache)(cacheKey, result, 300);
    }
    catch (err) {
        console.warn("Cache write error:", err);
    }
    res.status(200).json({
        success: true,
        source: "db",
        ...result,
    });
});
//# sourceMappingURL=review.controller.js.map