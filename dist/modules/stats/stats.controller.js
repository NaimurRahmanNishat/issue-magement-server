"use strict";
// src/modules/stats/stats.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryAdminStats = exports.adminStats = exports.userStats = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const errorHandler_1 = require("../../utils/errorHandler");
const user_model_1 = __importDefault(require("../users/user.model"));
const issue_model_1 = __importDefault(require("../issues/issue.model"));
const review_model_1 = __importDefault(require("../comments/review.model"));
const redisCache_1 = require("../../helper/redisCache");
// 1. User Stats (cached)
exports.userStats = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const userId = req.user?._id;
    if (!userId)
        throw new errorHandler_1.AppError(401, "Authentication required!");
    const cacheKey = `user_stats_${userId}`;
    const cached = await (0, redisCache_1.getCache)(cacheKey);
    if (cached) {
        return res.status(200).json({
            success: true,
            message: "User stats fetched from cache!",
            data: cached,
        });
    }
    const user = await user_model_1.default.findOne({ _id: userId });
    if (!user)
        throw new errorHandler_1.AppError(404, "User not found!");
    // Basic Stats
    const totalIssues = await issue_model_1.default.countDocuments({ author: user._id });
    const userReviews = await review_model_1.default.find({ author: user._id });
    const totalReviews = userReviews.length;
    const totalReplies = userReviews.reduce((acc, r) => acc + (r.replies?.length || 0), 0);
    const totalReviewAndComment = totalReviews + totalReplies;
    // Count issues by status
    const [totalPending, totalApproved, totalInProgress, totalResolved, totalRejected] = await Promise.all([
        issue_model_1.default.countDocuments({ author: user._id, status: "pending" }),
        issue_model_1.default.countDocuments({ author: user._id, status: "approved" }),
        issue_model_1.default.countDocuments({ author: user._id, status: "in-progress" }),
        issue_model_1.default.countDocuments({ author: user._id, status: "resolved" }),
        issue_model_1.default.countDocuments({ author: user._id, status: "rejected" }),
    ]);
    // Calculate totalSolved (resolved issues)
    const totalSolved = totalResolved;
    // Monthly Issues Aggregation
    const monthlyIssues = await issue_model_1.default.aggregate([
        { $match: { author: user._id } },
        {
            $group: {
                _id: { month: { $month: "$createdAt" } },
                count: { $sum: 1 },
            },
        },
        {
            $project: {
                month: "$_id.month",
                count: 1,
                _id: 0,
            },
        },
        { $sort: { month: 1 } }
    ]);
    const stats = {
        totalIssues,
        totalReviewAndComment,
        totalPending,
        totalApproved,
        totalInProgress,
        totalResolved,
        totalRejected,
        totalSolved,
        monthlyIssues,
    };
    await (0, redisCache_1.setCache)(cacheKey, stats, 600);
    res.status(200).json({
        success: true,
        message: "User stats fetched successfully!",
        data: stats,
    });
});
// 2. Super Admin Stats (cached)
exports.adminStats = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const userId = req.user?._id;
    if (!userId)
        throw new errorHandler_1.AppError(401, "Authentication required!");
    const cacheKey = `super_admin_stats`;
    // Check cache first
    const cached = await (0, redisCache_1.getCache)(cacheKey);
    if (cached) {
        return res.status(200).json({
            success: true,
            message: "Admin stats fetched from cache!",
            data: cached,
        });
    }
    // Total issues count
    const totalIssues = await issue_model_1.default.countDocuments();
    // Count issues by status
    const [pendingIssues, approvedIssues, inProgressIssues, resolvedIssues, rejectedIssues] = await Promise.all([
        issue_model_1.default.countDocuments({ status: "pending" }),
        issue_model_1.default.countDocuments({ status: "approved" }),
        issue_model_1.default.countDocuments({ status: "in-progress" }),
        issue_model_1.default.countDocuments({ status: "resolved" }),
        issue_model_1.default.countDocuments({ status: "rejected" }),
    ]);
    // Monthly issues aggregation
    const currentYear = new Date().getFullYear();
    // Template literal syntax
    const monthlyAggregation = await issue_model_1.default.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
                    $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`),
                },
            },
        },
        {
            $group: {
                _id: { month: { $month: "$createdAt" } },
                count: { $sum: 1 },
            },
        },
        { $sort: { "_id.month": 1 } },
    ]);
    const monthlyPostIssue = Array.from({ length: 12 }, (_, idx) => {
        const monthData = monthlyAggregation.find((m) => m._id.month === idx + 1);
        return { month: idx + 1, count: monthData ? monthData.count : 0 };
    });
    const stats = {
        totalIssues,
        pendingIssues,
        approvedIssues,
        inProgressIssues,
        resolvedIssues,
        rejectedIssues,
        monthlyIssues: monthlyPostIssue,
    };
    await (0, redisCache_1.setCache)(cacheKey, stats, 600);
    res.status(200).json({
        success: true,
        message: "Admin stats fetched successfully!",
        data: stats,
    });
});
// 3. Category Admin Stats (cached) 
exports.categoryAdminStats = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const userId = req.user?._id;
    if (!userId)
        throw new errorHandler_1.AppError(401, "Authentication required!");
    if (req.user?.role !== "category-admin") {
        throw new errorHandler_1.AppError(403, "Unauthorized");
    }
    const category = req.user.category;
    if (!category) {
        throw new errorHandler_1.AppError(400, "Category not assigned");
    }
    const cacheKey = `category_stats:${category}`;
    // cache first
    const cached = await (0, redisCache_1.getCache)(cacheKey);
    if (cached) {
        return res.status(200).json({
            success: true,
            message: "Category stats from cache",
            data: cached,
        });
    }
    // database parallel queries
    const year = new Date().getFullYear();
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year}-12-31`);
    const [totalIssues, pendingIssues, approvedIssues, inProgressIssues, resolvedIssues, rejectedIssues, monthlyAgg,] = await Promise.all([
        issue_model_1.default.countDocuments({ category }),
        issue_model_1.default.countDocuments({ category, status: "pending" }),
        issue_model_1.default.countDocuments({ category, status: "approved" }),
        issue_model_1.default.countDocuments({ category, status: "in-progress" }),
        issue_model_1.default.countDocuments({ category, status: "resolved" }),
        issue_model_1.default.countDocuments({ category, status: "rejected" }),
        issue_model_1.default.aggregate([
            {
                $match: { category, createdAt: { $gte: start, $lte: end } },
            },
            {
                $group: {
                    _id: { month: { $month: "$createdAt" } },
                    count: { $sum: 1 },
                },
            },
        ]),
    ]);
    // month normalization
    const monthMap = new Map();
    monthlyAgg.forEach(m => monthMap.set(m._id.month, m.count));
    const monthlyPostIssue = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        count: monthMap.get(i + 1) || 0,
    }));
    const stats = {
        category,
        totalIssues,
        pendingIssues,
        approvedIssues,
        inProgressIssues,
        resolvedIssues,
        rejectedIssues,
        monthlyPostIssue,
    };
    // set cache
    await (0, redisCache_1.setCache)(cacheKey, stats, 600);
    res.status(200).json({
        success: true,
        message: "Category stats fetched successfully",
        data: stats,
    });
});
//# sourceMappingURL=stats.controller.js.map