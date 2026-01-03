"use strict";
// src/modules/issues/issue.controller.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllIssuesAsRead = exports.markIssueAsRead = exports.getUnreadIssuesCount = exports.getIssueByUser = exports.deleteIssueById = exports.updateIssueById = exports.getIssueById = exports.getAllIssues = exports.createIssue = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const errorHandler_1 = require("../../utils/errorHandler");
const email_1 = require("../../utils/email");
const issue_model_1 = __importStar(require("./issue.model"));
const redisCache_1 = require("../../helper/redisCache");
const cursorPagination_1 = require("../../helper/cursorPagination");
const socket_1 = require("../../config/socket");
const response_1 = require("../../utils/response");
const sharp_1 = __importDefault(require("sharp"));
const uploadToCloudinary_1 = require("../../utils/uploadToCloudinary");
// 1. Create Issue with Real-time Notification
exports.createIssue = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { title, category, description, location, division, date } = req.body;
    // Validate required fields
    if (!title || !category || !description || !location || !division) {
        throw new errorHandler_1.AppError(400, "All fields are required");
    }
    // Upload images
    const files = req.files?.images;
    if (!files || files.length === 0) {
        return (0, response_1.sendError)(res, "Please upload at least one image", 400);
    }
    if (files.length > 3) {
        return (0, response_1.sendError)(res, "Maximum 3 images allowed", 400);
    }
    // compress images
    const compressedBuffers = await Promise.all(files.map((file) => (0, sharp_1.default)(file.buffer)
        .resize({ width: 1200 })
        .webp({ quality: 65 })
        .toBuffer()));
    // upload to cloudinary
    const uploadedImages = await Promise.all(compressedBuffers.map((buffer) => (0, uploadToCloudinary_1.uploadToCloudinary)(buffer, "services/images")));
    const images = uploadedImages.map((img) => ({
        public_id: img.public_id,
        url: img.secure_url,
    }));
    // Create new issue in database
    const newIssue = await issue_model_1.default.create({
        title,
        category,
        description,
        images,
        location,
        division,
        author: req.user._id,
        date: date || Date.now(),
        isReadByAdmin: false, // Default unread
    });
    // Populate author details for response
    await newIssue.populate("author", "name email");
    // Invalidate related caches
    await (0, redisCache_1.invalidateCache)({
        entity: "issue",
        entityId: newIssue._id.toString(),
        userId: req.user._id.toString(),
        category: category,
        division: division,
        role: req.user.role,
    });
    // Invalidate stats caches
    await (0, redisCache_1.deleteCache)(`user_stats_${req.user._id}`);
    if (category) {
        await (0, redisCache_1.deleteCache)(`category_stats:${category}`);
    }
    // Cache the new issue
    await (0, redisCache_1.setCache)(`issue:${newIssue._id}`, newIssue, 600);
    // Real-time notification to category admin
    try {
        // Get updated unread count
        const unreadCount = await issue_model_1.default.countDocuments({
            category: category,
            isReadByAdmin: false,
        });
        // Emit new issue notification
        (0, socket_1.emitToCategoryAdmin)(category, "newIssue", {
            _id: newIssue._id,
            title: newIssue.title,
            category: newIssue.category,
            status: newIssue.status,
            author: {
                _id: req.user._id,
                name: req.user.name,
                email: req.user.email,
            },
            createdAt: newIssue.createdAt,
        });
        // Emit unread count update
        (0, socket_1.emitUnreadCountUpdate)(category, 'issue', unreadCount);
        console.log(`🔔 New issue notification sent to ${category} admins`);
    }
    catch (socketError) {
        console.error("Socket emit error:", socketError);
    }
    res.status(201).json({
        success: true,
        message: "Issue created successfully!",
        data: newIssue
    });
});
// 2. Get All Issues with Filters & Pagination
exports.getAllIssues = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const { cursor, limit = 10, sortOrder = "desc", status, division, category, search } = req.query;
    // Build dynamic query
    const query = {};
    if (status)
        query.status = status;
    if (division)
        query.division = division;
    if (category)
        query.category = category;
    if (search)
        query.$text = { $search: search };
    // Category-admin can only see their own category
    if (user?.role === "category-admin") {
        if (!user.category) {
            throw new errorHandler_1.AppError(403, "Your admin account has no assigned category");
        }
        query.category = user.category;
    }
    // Generate cache key with all filters
    const cacheKey = `issues:${user?._id || 'public'}:${user?.role || 'guest'}:${user?.category || 'all'}:${cursor || 'first'}:${limit}:${sortOrder}:${status || 'all'}:${division || 'all'}:${category || 'all'}:${search || 'none'}`;
    // Try cache first
    try {
        const cachedData = await (0, redisCache_1.getCache)(cacheKey);
        if (cachedData) {
            console.log(`⚡ Cache hit: ${cacheKey}`);
            return res.status(200).json({
                success: true,
                message: "Issues fetched (from cache)",
                ...cachedData,
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
    // Combine filters with cursor pagination
    const finalQuery = {
        ...query,
        ...paginationOptions.filter,
    };
    // Query database with pagination
    const issues = await issue_model_1.default.find(finalQuery)
        .populate({
        path: "reviews",
        populate: {
            path: "author replies.author",
            select: "name email avatar"
        }
    })
        .populate("author", "name email avatar")
        .populate("approvedBy", "name email role avatar")
        .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
        .limit(paginationOptions.limit + 1)
        .lean();
    // Create pagination metadata
    const { data, meta } = (0, cursorPagination_1.createCursorPaginationMeta)(issues, paginationOptions.limit, paginationOptions.sortBy, paginationOptions.sortOrder);
    const responseData = { data, meta };
    // Cache the response for 10 minutes
    await (0, redisCache_1.setCache)(cacheKey, responseData, 600);
    res.status(200).json({
        success: true,
        message: "Issues fetched successfully",
        ...responseData,
    });
});
// 3. Get Issue by ID (with Details)
exports.getIssueById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { issueId } = req.params;
    // Try cache first
    const cacheKey = `issue:${issueId}`;
    try {
        const cachedIssue = await (0, redisCache_1.getCache)(cacheKey);
        if (cachedIssue) {
            console.log(`⚡ Cache hit for issue: ${issueId}`);
            return res.status(200).json({
                success: true,
                message: "Issue fetched from cache",
                data: cachedIssue,
            });
        }
    }
    catch (cacheError) {
        console.error("Cache retrieval error:", cacheError);
    }
    // Fetch from database
    const issue = await issue_model_1.default.findById(issueId)
        .populate({
        path: "reviews",
        populate: {
            path: "author replies.author",
            select: "name email avatar"
        }
    })
        .populate("author", "name email avatar")
        .populate("approvedBy", "name email role avatar")
        .lean();
    if (!issue) {
        throw new errorHandler_1.AppError(404, "Issue not found");
    }
    // Cache the result for 10 minutes
    await (0, redisCache_1.setCache)(cacheKey, issue, 600);
    res.status(200).json({
        success: true,
        message: "Issue fetched successfully",
        data: issue,
    });
});
// 4. Update Issue Status (Admin Only)
exports.updateIssueById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { issueId } = req.params;
    const { status } = req.body;
    const user = req.user;
    // Validate status
    if (!Object.values(issue_model_1.IssueStatus).includes(status)) {
        throw new errorHandler_1.AppError(400, `Invalid status! Must be one of: ${Object.values(issue_model_1.IssueStatus).join(", ")}`);
    }
    // Build filter with permission check
    const filter = { _id: issueId };
    if (user.role === "category-admin") {
        if (!user.category) {
            throw new errorHandler_1.AppError(403, "Your admin account has no assigned category");
        }
        filter.category = user.category;
    }
    // Atomic update
    const update = {
        status,
        approvedBy: user._id,
        approvedAt: new Date()
    };
    const issue = await issue_model_1.default.findOneAndUpdate(filter, update, { new: true })
        .populate("author", "name email")
        .populate("approvedBy", "name email role avatar")
        .lean();
    if (!issue) {
        throw new errorHandler_1.AppError(404, "Issue not found or access denied");
    }
    // Invalidate caches
    await (0, redisCache_1.invalidateCache)({
        entity: "issue",
        entityId: issueId,
        userId: issue.author._id.toString(),
        category: issue.category,
        division: issue.division,
        role: user.role,
    });
    // Invalidate stats caches
    await (0, redisCache_1.deleteCache)(`user_stats_${issue.author._id}`);
    if (issue.category) {
        await (0, redisCache_1.deleteCache)(`category_stats:${issue.category}`);
    }
    // Cache the updated issue
    await (0, redisCache_1.setCache)(`issue:${issueId}`, issue, 600);
    // Send email notification to issue author
    const author = issue.author;
    if (author?.email) {
        try {
            await (0, email_1.sendIssueStatusEmail)(author.email, issue.title, status);
            console.log(`📧 Email sent to ${author.email} about status: ${status}`);
        }
        catch (emailError) {
            console.error("❌ Failed to send issue status email:", emailError);
        }
    }
    res.status(200).json({
        success: true,
        message: `Issue status updated to '${status}'`,
        data: issue,
    });
});
// 5. Delete Issue by ID (Admin Only)
exports.deleteIssueById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    // Build filter with permission check
    const filter = { _id: id };
    if (user.role === "category-admin") {
        if (!user.category) {
            throw new errorHandler_1.AppError(403, "Your admin account has no assigned category");
        }
        filter.category = user.category;
    }
    // Get issue metadata before deletion
    const issue = await issue_model_1.default.findOne(filter).lean();
    if (!issue) {
        throw new errorHandler_1.AppError(404, "Issue not found or access denied");
    }
    // Extract metadata for cache invalidation
    const authorId = issue.author.toString();
    const category = issue.category;
    const division = issue.division;
    // Delete the issue from database
    await issue_model_1.default.findByIdAndDelete(id);
    // Invalidate caches
    await (0, redisCache_1.invalidateCache)({
        entity: "issue",
        entityId: id,
        userId: authorId,
        category,
        division,
        role: user.role,
    });
    // Invalidate stats caches
    await (0, redisCache_1.deleteCache)(`user_stats_${authorId}`);
    if (category) {
        await (0, redisCache_1.deleteCache)(`category_stats:${category}`);
        // Update unread count for category admin
        try {
            const unreadCount = await issue_model_1.default.countDocuments({
                category: category,
                isReadByAdmin: false,
            });
            (0, socket_1.emitUnreadCountUpdate)(category, 'issue', unreadCount);
        }
        catch (socketError) {
            console.error("Socket emit error:", socketError);
        }
    }
    res.status(200).json({
        success: true,
        message: "Issue deleted successfully",
    });
});
// 6. Get Issues by User ID (User Dashboard)
exports.getIssueByUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { userId } = req.params;
    const currentUser = req.user;
    const limit = Number(req.query.limit) || 10;
    const cursor = req.query.cursor;
    const status = req.query.status;
    const sortOrder = req.query.sortOrder || "desc";
    // Permission check: user can only view own issues (unless super-admin)
    if (currentUser._id.toString() !== userId && currentUser.role !== "super-admin") {
        throw new errorHandler_1.AppError(403, "You can only view your own issues");
    }
    // Generate cache key
    const cacheKey = `user:${userId}:issues:${cursor || 'first'}:${limit}:${sortOrder}:${status || 'all'}`;
    // Try cache first
    try {
        const cached = await (0, redisCache_1.getCache)(cacheKey);
        if (cached) {
            console.log(`⚡ Cache hit: ${cacheKey}`);
            return res.status(200).json({
                success: true,
                message: "Issues fetched (from cache)",
                ...cached,
            });
        }
    }
    catch (cacheError) {
        console.error("Cache retrieval error:", cacheError);
    }
    // Calculate cursor pagination
    const paginationOptions = (0, cursorPagination_1.calculateCursorPagination)({
        limit,
        cursor,
        sortBy: 'createdAt',
        sortOrder,
    });
    // Build query filter
    const query = {
        author: userId,
        ...paginationOptions.filter
    };
    // Add status filter if provided
    if (status) {
        query.status = status;
    }
    // Fetch issues from database
    const issues = await issue_model_1.default.find(query)
        .populate({
        path: "reviews",
        populate: {
            path: "author replies.author",
            select: "name email avatar"
        }
    })
        .populate("author", "name email avatar")
        .populate("approvedBy", "name email role avatar")
        .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
        .limit(paginationOptions.limit + 1)
        .lean();
    // Create pagination metadata
    const { data, meta } = (0, cursorPagination_1.createCursorPaginationMeta)(issues, paginationOptions.limit, paginationOptions.sortBy, paginationOptions.sortOrder);
    const responseData = {
        data,
        meta: {
            ...meta,
            status: status || null,
        },
    };
    // Cache for 10 minutes
    await (0, redisCache_1.setCache)(cacheKey, responseData, 600);
    res.status(200).json({
        success: true,
        message: "Issues fetched successfully",
        ...responseData,
    });
});
// 7. Get Unread Issues Count (Admin Only)
exports.getUnreadIssuesCount = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    // Permission check
    if (user.role !== "category-admin" && user.role !== "super-admin") {
        throw new errorHandler_1.AppError(403, "Only admins can access this endpoint");
    }
    // Build query based on role
    const query = { isReadByAdmin: false };
    if (user.role === "category-admin") {
        if (!user.category) {
            throw new errorHandler_1.AppError(403, "Your admin account has no assigned category");
        }
        query.category = user.category;
    }
    // Generate cache key
    const cacheKey = `unread_issues_count:${user._id}:${user.role}:${user.category || 'all'}`;
    // Try cache first
    try {
        const cached = await (0, redisCache_1.getCache)(cacheKey);
        if (cached !== null && cached !== undefined) {
            console.log(`⚡ Cache hit: ${cacheKey}`);
            return res.status(200).json({
                success: true,
                message: "Unread issues count fetched (from cache)",
                count: cached,
            });
        }
    }
    catch (cacheError) {
        console.error("Cache retrieval error:", cacheError);
    }
    // Count unread issues
    const count = await issue_model_1.default.countDocuments(query);
    // Cache for 10 minutes
    await (0, redisCache_1.setCache)(cacheKey, count, 600);
    res.status(200).json({
        success: true,
        message: "Unread issues count fetched successfully",
        count,
    });
});
// 8. Mark Single Issue as Read (Admin Only)
exports.markIssueAsRead = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { issueId } = req.params;
    const user = req.user;
    // Permission check
    if (user.role !== "category-admin" && user.role !== "super-admin") {
        throw new errorHandler_1.AppError(403, "Only admins can mark issues as read");
    }
    // Build filter with permission check
    const filter = { _id: issueId };
    if (user.role === "category-admin") {
        if (!user.category) {
            throw new errorHandler_1.AppError(403, "Your admin account has no assigned category");
        }
        filter.category = user.category;
    }
    // Update issue
    const issue = await issue_model_1.default.findOneAndUpdate(filter, {
        isReadByAdmin: true,
        readByAdminAt: new Date()
    }, { new: true }).lean();
    if (!issue) {
        throw new errorHandler_1.AppError(404, "Issue not found or access denied");
    }
    // Invalidate unread count cache
    await (0, redisCache_1.deleteCache)(`unread_issues_count:${user._id}:${user.role}:${user.category || 'all'}`);
    // Invalidate issue cache
    await (0, redisCache_1.deleteCache)(`issue:${issueId}`);
    // Invalidate issue list caches
    await (0, redisCache_1.invalidateCache)({
        entity: "issue",
        entityId: issueId,
        userId: issue.author.toString(),
        category: issue.category,
        division: issue.division,
        role: user.role,
    });
    // Update unread count via socket
    try {
        const unreadCount = await issue_model_1.default.countDocuments({
            category: issue.category,
            isReadByAdmin: false,
        });
        (0, socket_1.emitUnreadCountUpdate)(issue.category, 'issue', unreadCount);
    }
    catch (socketError) {
        console.error("Socket emit error:", socketError);
    }
    res.status(200).json({
        success: true,
        message: "Issue marked as read",
        data: issue,
    });
});
// 9. Mark All Issues as Read (Admin Only)
exports.markAllIssuesAsRead = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    // Permission check
    if (user.role !== "category-admin" && user.role !== "super-admin") {
        throw new errorHandler_1.AppError(403, "Only admins can mark issues as read");
    }
    // Build query
    const query = { isReadByAdmin: false };
    if (user.role === "category-admin") {
        if (!user.category) {
            throw new errorHandler_1.AppError(403, "Your admin account has no assigned category");
        }
        query.category = user.category;
    }
    // Update all unread issues
    const result = await issue_model_1.default.updateMany(query, {
        isReadByAdmin: true,
        readByAdminAt: new Date()
    });
    // Invalidate unread count cache
    await (0, redisCache_1.deleteCache)(`unread_issues_count:${user._id}:${user.role}:${user.category || 'all'}`);
    // Invalidate all issues list caches
    await (0, redisCache_1.invalidateCache)({
        entity: "issue",
        userId: user._id.toString(),
        category: user.category,
        role: user.role,
    });
    // Update unread count via socket
    if (user.category) {
        try {
            (0, socket_1.emitUnreadCountUpdate)(user.category, 'issue', 0);
        }
        catch (socketError) {
            console.error("Socket emit error:", socketError);
        }
    }
    res.status(200).json({
        success: true,
        message: `${result.modifiedCount} issue(s) marked as read`,
        modifiedCount: result.modifiedCount,
    });
});
//# sourceMappingURL=issue.controller.js.map