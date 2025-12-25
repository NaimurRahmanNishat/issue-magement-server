"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIssueByUser = exports.deleteIssueById = exports.updateIssueById = exports.getIssueById = exports.getAllIssues = exports.createIssue = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const cache_1 = require("../../utils/cache");
const errorHandler_1 = require("../../utils/errorHandler");
const email_1 = require("../../utils/email");
const issue_model_1 = __importStar(require("./issue.model"));
const UploadImage_1 = require("../../utils/UploadImage");
const image_1 = require("../../utils/image");
// 1. create issue with zod validation
exports.createIssue = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { title, category, description, location, division, date, images } = req.body;
    if (!title || !category || !description || !location || !division) {
        return res.status(400).json({
            success: false,
            message: "All fields are required",
        });
    }
    let uploadedImages = [];
    /* ======================================
      CASE 1: multipart/form-data (BEST)
    ====================================== */
    if (req.files && Array.isArray(req.files)) {
        const files = req.files;
        console.log(`📸 Uploading ${files.length} images...`);
        uploadedImages = await Promise.all(files.map(async (file, index) => {
            console.log(`🔄 Processing image ${index + 1}/${files.length}...`);
            // ✅ Step 1: Compress image (MB → KB)
            const compressed = await (0, image_1.compressImage)(file.buffer);
            console.log(`✅ Compressed: ${(file.size / 1024).toFixed(2)} KB → ${(compressed.length / 1024).toFixed(2)} KB`);
            // ✅ Step 2: Upload to Cloudinary
            const uploaded = await (0, UploadImage_1.uploadBufferImage)(compressed, "issue-reports");
            console.log(`☁️ Uploaded to Cloudinary: ${uploaded.url}`);
            return uploaded;
        }));
    }
    /* ======================================
      CASE 2: Base64 (fallback only)
    ====================================== */
    else if (Array.isArray(images) && images.length > 0) {
        console.log(`📸 Uploading ${images.length} base64 images...`);
        uploadedImages = await Promise.all(images.map(async (img, index) => {
            console.log(`🔄 Processing base64 image ${index + 1}/${images.length}...`);
            const uploaded = await (0, UploadImage_1.uploadImageBase64)(img, "issue-reports");
            console.log(`☁️ Uploaded to Cloudinary: ${uploaded.url}`);
            return uploaded;
        }));
    }
    const newIssue = await issue_model_1.default.create({
        title,
        category,
        description,
        images: uploadedImages,
        location,
        division,
        author: req.user._id,
        date: date || Date.now(),
    });
    // Invalidate issue list cache
    await (0, cache_1.invalidateIssueCache)(newIssue._id.toString());
    res.status(201).json({ success: true, message: "Issue created successfully!", issue: newIssue });
});
// 2. get all issues with pagination
exports.getAllIssues = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { page = 1, limit = 10, sort = "-createdAt", status, division, category, search } = req.query;
    const user = req.user;
    // Dynamic query
    const query = {};
    if (status)
        query.status = status;
    if (division)
        query.division = division;
    if (category)
        query.category = category;
    if (search)
        query.$text = { $search: search };
    // Category-admin can only see own category
    if (user?.role === "category-admin") {
        if (!user.category)
            throw new errorHandler_1.AppError(403, "Your admin account has no assigned category");
        query.category = user.category;
    }
    // Generate cache key
    const cacheKey = (0, cache_1.generateIssuesCacheKey)({ ...query, page, limit, sort });
    const cachedData = await (0, cache_1.getCache)(cacheKey);
    if (cachedData)
        return res.status(200).json({ success: true, message: "Issues fetched (from cache)", ...cachedData });
    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.min(50, Math.max(1, parseInt(limit, 10)));
    // MongoDB query with pagination and index-friendly sort
    const [issues, totalIssues] = await Promise.all([
        issue_model_1.default.find(query)
            .populate({ path: "reviews", populate: { path: "author replies.author", select: "name email" } })
            .populate("author", "name email")
            .populate("approvedBy", "name email role avatar")
            .sort(sort)
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber)
            .lean(),
        issue_model_1.default.countDocuments(query)
    ]);
    const responseData = {
        issues,
        totalIssues,
        totalPages: Math.ceil(totalIssues / limitNumber),
    };
    await (0, cache_1.setCache)(cacheKey, responseData);
    res.status(200).json({
        success: true,
        message: "All issues fetched successfully",
        ...responseData,
    });
});
// 3. get issue by id  (issue details)
exports.getIssueById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { issueId } = req.params;
    if (!issueId)
        throw new errorHandler_1.AppError(400, "Issue ID is required");
    const cacheKey = (0, cache_1.generateIssueCacheKey)(issueId);
    const cached = await (0, cache_1.getCache)(cacheKey);
    if (cached)
        return res.status(200).json({ success: true, message: "Issue fetched (from cache)", ...cached });
    const issue = await issue_model_1.default.findById(issueId)
        .populate({ path: "reviews", populate: { path: "author replies.author", select: "name email" } })
        .populate("author", "name email")
        .lean();
    if (!issue)
        throw new errorHandler_1.AppError(404, "Issue not found");
    await (0, cache_1.setCache)(cacheKey, { success: true, issue }, 600);
    res.status(200).json({ message: "Issue fetched successfully", issue });
});
// 4. Update Issue by ID (category-admin or super-admin)
exports.updateIssueById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { issueId } = req.params;
    const { status } = req.body;
    const user = req.user;
    // Validate status
    if (!Object.values(issue_model_1.IssueStatus).includes(status)) {
        throw new errorHandler_1.AppError(400, "Invalid status value! Must be pending, in-progress or solved.");
    }
    // Atomic update with permission check
    const filter = { _id: issueId };
    if (user.role === "category-admin")
        filter.category = user.category;
    const update = { status, approvedBy: user._id, approvedAt: new Date() };
    const issue = await issue_model_1.default.findOneAndUpdate(filter, update, { new: true })
        .populate("author", "name email")
        .populate("approvedBy", "name email role avatar");
    if (!issue)
        throw new errorHandler_1.AppError(403, "Access denied or issue not found");
    // Invalidate cache
    (0, cache_1.invalidateCacheAsync)((0, cache_1.CATEGORY_STATS_KEY)(issue.category));
    (0, cache_1.invalidateCacheAsync)("issues:list"); // optional: issue list refresh
    // Send Email Notification to issue author
    const author = issue.author;
    const userEmail = author?.email;
    const issueTitle = issue.title;
    if (userEmail) {
        try {
            await (0, email_1.sendIssueStatusEmail)(userEmail, issueTitle, status);
            console.log(`Email sent to ${userEmail} about status: ${status}`);
        }
        catch (err) {
            console.error("Failed to send issue status email:", err);
        }
    }
    res.status(200).json({
        success: true,
        message: `Issue status updated to '${status}' and email sent to user.`,
        issue,
    });
});
// 5. delete issue by id (category-admin access only)
exports.deleteIssueById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    if (!user)
        throw new errorHandler_1.AppError(401, "Unauthorized");
    // Delete with filter for category-admin
    const filter = { _id: id };
    if (user.role === "category-admin")
        filter.category = user.category;
    const issue = await issue_model_1.default.findOneAndDelete(filter);
    if (!issue)
        throw new errorHandler_1.AppError(404, "Issue not found or access denied");
    await (0, cache_1.invalidateIssueCache)(issue._id.toString());
    res.status(200).json({
        success: true,
        message: "Issue deleted successfully and cache invalidated",
    });
});
// 6. get issue for (single user)
exports.getIssueByUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { userId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const cacheKey = `user:${userId}:issues:page:${page}`;
    const cached = await (0, cache_1.getCache)(cacheKey);
    if (cached)
        return res.status(200).json({ success: true, message: "Issues fetched (from cache)", ...cached });
    const issues = await issue_model_1.default.find({ author: userId })
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    await (0, cache_1.setCache)(cacheKey, { success: true, issues }, 600);
    res.status(200).json({ success: true, message: "Issues fetched successfully", issues });
});
//# sourceMappingURL=issue.controller.js.map