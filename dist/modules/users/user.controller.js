"use strict";
// src/modules/users/user.controller.ts
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
exports.deleteCategoryAdminRole = exports.updateCategoryAdminRole = exports.getAllCategoryAdmins = exports.getAllUsers = exports.getProfileById = exports.editProfileById = exports.resetPassword = exports.forgetPassword = exports.logout = exports.refreshToken = exports.login = exports.activateUser = exports.register = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const user_model_1 = __importStar(require("./user.model"));
const errorHandler_1 = require("../../utils/errorHandler");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const email_1 = require("../../utils/email");
const redis_1 = require("../../config/redis");
const token_1 = require("../../utils/token");
const cookie_1 = require("../../utils/cookie");
const senitize_1 = require("../../helper/senitize");
const redisCache_1 = require("../../helper/redisCache");
const cursorPagination_1 = require("../../helper/cursorPagination");
const sharp_1 = __importDefault(require("sharp"));
const uploadToCloudinary_1 = require("../../utils/uploadToCloudinary");
// 1. Register User time complexity: O(1)
exports.register = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const body = (0, senitize_1.sanitizeBody)(req.body);
    const { name, email, password, confirmPassword, phone, nid, role, category, division } = body;
    // Validate password match
    if (password !== confirmPassword) {
        throw new errorHandler_1.AppError(400, "Passwords do not match!");
    }
    // Check for duplicate email/phone/nid in ONE query
    const existing = await user_model_1.default.findOne({ $or: [{ email }, { phone }, { nid }] }).select("email phone nid").lean();
    if (existing) {
        if (existing.email === email)
            throw new errorHandler_1.AppError(400, "Email already exists!");
        if (existing.phone === phone)
            throw new errorHandler_1.AppError(400, "Phone already exists!");
        if (existing.nid === nid)
            throw new errorHandler_1.AppError(400, "NID already exists!");
    }
    // First registered user becomes super-admin
    const userCount = await user_model_1.default.estimatedDocumentCount();
    if (userCount === 0) {
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const superAdmin = await user_model_1.default.create({
            name,
            email,
            password: hashedPassword,
            phone,
            nid,
            isVerified: true,
            role: "super-admin",
        });
        return res.status(201).json({
            success: true,
            message: "Super admin created successfully!",
            data: {
                id: superAdmin._id,
                name: superAdmin.name,
                email: superAdmin.email,
                role: superAdmin.role,
            },
        });
    }
    // Category-admin registration (Only super-admin can create)
    if (role === "category-admin") {
        if (!req.user || req.user.role !== "super-admin") {
            throw new errorHandler_1.AppError(403, "Only super-admin can register category-admins!");
        }
        if (!category) {
            throw new errorHandler_1.AppError(400, "Category is required for category-admin!");
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const categoryAdmin = await user_model_1.default.create({
            name,
            email,
            password: hashedPassword,
            phone,
            nid,
            division,
            role: "category-admin",
            isVerified: true,
            category,
        });
        return res.status(201).json({
            success: true,
            message: "Category admin created successfully!",
            data: {
                id: categoryAdmin._id,
                name: categoryAdmin.name,
                email: categoryAdmin.email,
                role: categoryAdmin.role,
                category: categoryAdmin.category,
            },
        });
    }
    // Regular user registration with activation code
    const hashedPassword = await bcryptjs_1.default.hash(password, 12);
    const activationCode = crypto_1.default.randomBytes(3).toString("hex").toUpperCase();
    const activationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    // Store user data temporarily in Redis
    const userData = {
        name,
        email,
        password: hashedPassword,
        phone,
        nid,
        role: "user",
        activationCode,
        activationCodeExpiry: activationCodeExpiry.toISOString(),
    };
    await redis_1.redis.set(`activation:${email}`, JSON.stringify(userData), "EX", 600);
    // Send activation email
    try {
        await (0, email_1.sendActivationEmail)(email, activationCode);
    }
    catch (error) {
        await redis_1.redis.del(`activation:${email}`);
        throw new errorHandler_1.AppError(500, "Failed to send activation email!");
    }
    res.status(200).json({
        success: true,
        message: "Registration successful! Check your email to activate your account.",
        data: {
            email,
            expiresIn: "10 minutes",
        },
    });
});
// 2. Activate User Account time complexity: O(1)
exports.activateUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const body = (0, senitize_1.sanitizeBody)(req.body);
    const { email, activationCode } = body;
    if (!email || !activationCode) {
        throw new errorHandler_1.AppError(400, "Email and activation code are required!");
    }
    // Get user data from Redis
    const userDataString = await redis_1.redis.get(`activation:${email}`);
    if (!userDataString) {
        throw new errorHandler_1.AppError(400, "Activation code expired or invalid!");
    }
    const userData = JSON.parse(userDataString);
    // Verify activation code
    if (userData.activationCode !== activationCode.toUpperCase()) {
        throw new errorHandler_1.AppError(400, "Invalid activation code!");
    }
    // Check if activation code expired
    const expiryTime = new Date(userData.activationCodeExpiry);
    if (new Date() > expiryTime) {
        await redis_1.redis.del(`activation:${email}`);
        throw new errorHandler_1.AppError(400, "Activation code has expired!");
    }
    // Create user in database
    const newUser = await user_model_1.default.create({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        phone: userData.phone,
        nid: userData.nid,
        role: userData.role,
        isVerified: true,
    });
    // Delete from Redis after successful activation
    await redis_1.redis.del(`activation:${email}`);
    // Generate tokens
    const accessToken = (0, token_1.generateAccessToken)({ id: newUser._id.toString(), role: newUser.role });
    const refreshToken = (0, token_1.generateRefreshToken)({ id: newUser._id.toString(), role: newUser.role });
    // Set cookies
    (0, cookie_1.setAuthCookies)(res, accessToken, refreshToken);
    // Cache user data
    const safeUser = {
        _id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isVerified: newUser.isVerified,
    };
    res.status(201).json({
        success: true,
        message: "Account activated successfully!",
        data: safeUser,
    });
});
// 3. Login User time complexity: O(1)
exports.login = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const body = (0, senitize_1.sanitizeBody)(req.body);
    const { email, password } = body;
    // Validation
    if (!email || !user_model_1.emailRegex.test(email)) {
        throw new errorHandler_1.AppError(400, "Please provide a valid email!");
    }
    if (!password || password.length < 6) {
        throw new errorHandler_1.AppError(400, "Password must be at least 6 characters!");
    }
    const user = await user_model_1.default.findOne({ email }).select("+password").lean();
    if (!user)
        throw new errorHandler_1.AppError(404, "User not found!");
    const isMatch = await bcryptjs_1.default.compare(password, user.password);
    if (!isMatch)
        throw new errorHandler_1.AppError(401, "Invalid password!");
    // Check if user is verified
    if (!user.isVerified) {
        throw new errorHandler_1.AppError(403, "Please verify your email before logging in!");
    }
    // Generate tokens
    const accessToken = (0, token_1.generateAccessToken)({ id: user._id.toString(), role: user.role });
    const refreshToken = (0, token_1.generateRefreshToken)({ id: user._id.toString(), role: user.role });
    // Set cookies
    (0, cookie_1.setAuthCookies)(res, accessToken, refreshToken);
    // Prepare safe user data
    const safeUser = {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        category: user.category,
        isVerified: user.isVerified,
        phone: user.phone,
        zipCode: user.zipCode,
        profession: user.profession,
        division: user.division,
        nidPic: user.nidPic,
        avatar: user.avatar,
    };
    res.status(200).json({
        success: true,
        message: "Login successful!",
        data: safeUser,
    });
});
// 4. Refresh Access Token time complexity: O(1)
exports.refreshToken = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const oldRefreshToken = req.cookies?.refreshToken;
    if (!oldRefreshToken) {
        throw new errorHandler_1.AppError(401, "Refresh token missing");
    }
    let decoded;
    try {
        decoded = (0, token_1.verifyRefreshToken)(oldRefreshToken);
    }
    catch {
        throw new errorHandler_1.AppError(401, "Invalid refresh token");
    }
    const user = await user_model_1.default.findById(decoded.id).select("role").lean();
    if (!user) {
        throw new errorHandler_1.AppError(401, "User no longer exists");
    }
    // Generate new access token
    const newAccessToken = (0, token_1.generateAccessToken)({ id: decoded.id, role: user.role });
    // Update access token cookie
    (0, cookie_1.setAccessTokenCookie)(res, newAccessToken);
    res.status(200).json({
        success: true,
        message: "Access token refreshed successfully",
    });
});
// 5. Logout User time complexity: O(1)
exports.logout = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const userId = req.user?._id;
    // Clear cookies
    res.clearCookie("accessToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });
    res.status(200).json({
        success: true,
        message: "Logged out successfully",
    });
});
// 6. Forget Password (OTP Based) time complexity: O(1)
exports.forgetPassword = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const body = (0, senitize_1.sanitizeBody)(req.body);
    const { email } = body;
    if (!email)
        throw new errorHandler_1.AppError(400, "Email is required!");
    const user = await user_model_1.default.findOne({ email });
    if (!user)
        throw new errorHandler_1.AppError(404, "User not found!");
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save({ validateBeforeSave: false });
    try {
        await (0, email_1.sendActivationEmail)(email, `Your password reset OTP is: ${otp}`);
    }
    catch (err) {
        user.resetPasswordOtp = null;
        user.resetPasswordOtpExpiry = null;
        await user.save({ validateBeforeSave: false });
        throw new errorHandler_1.AppError(500, "Failed to send reset OTP. Please try again later.");
    }
    res.status(200).json({
        success: true,
        message: "Password reset OTP sent successfully to your email.",
        data: {
            email,
            expiresIn: "10 minutes",
        },
    });
});
// 7. Reset Password time complexity: O(1)
exports.resetPassword = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const body = (0, senitize_1.sanitizeBody)(req.body);
    const { otp, newPassword } = body;
    if (!otp || !newPassword) {
        throw new errorHandler_1.AppError(400, "OTP and new password are required!");
    }
    if (newPassword.length < 6) {
        throw new errorHandler_1.AppError(400, "Password must be at least 6 characters!");
    }
    // Find user by OTP
    const user = await user_model_1.default.findOne({
        resetPasswordOtp: otp,
        resetPasswordOtpExpiry: { $gt: new Date() },
    });
    if (!user)
        throw new errorHandler_1.AppError(400, "Invalid or expired OTP!");
    // Hash new password
    user.password = await bcryptjs_1.default.hash(newPassword, 12);
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpiry = null;
    await user.save();
    // Invalidate user cache
    await (0, redisCache_1.deleteCache)(`user:${user._id}`);
    res.status(200).json({
        success: true,
        message: "Password reset successfully!",
    });
});
// 8. Edit Profile by ID time complexity: O(n)
exports.editProfileById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const userId = req.user?._id;
    if (!userId)
        throw new errorHandler_1.AppError(401, "Unauthorized");
    const { name, email, phone, zipCode, profession, division } = req.body;
    const existingUser = await user_model_1.default.findById(userId);
    if (!existingUser)
        throw new errorHandler_1.AppError(404, "User not found");
    const updateData = {};
    // ================= BASIC FIELDS =================
    if (name)
        updateData.name = name;
    if (email)
        updateData.email = email;
    if (phone)
        updateData.phone = phone;
    if (zipCode)
        updateData.zipCode = zipCode;
    if (profession)
        updateData.profession = profession;
    if (division)
        updateData.division = division;
    // ================= AVATAR (SINGLE IMAGE) =================
    const avatarFile = req.files?.avatar?.[0];
    if (avatarFile) {
        const avatarBuffer = await (0, sharp_1.default)(avatarFile.buffer)
            .resize(500, 500)
            .webp({ quality: 70 })
            .toBuffer();
        const avatarUpload = await (0, uploadToCloudinary_1.uploadToCloudinary)(avatarBuffer, "users/avatar");
        updateData.avatar = {
            public_id: avatarUpload.public_id,
            url: avatarUpload.secure_url,
        };
        // delete old avatar
        if (existingUser.avatar?.public_id &&
            existingUser.avatar.public_id.startsWith("users/avatar")) {
            await (0, uploadToCloudinary_1.deleteMultipleImagesFromCloudinary)([
                existingUser.avatar.public_id,
            ]).catch(() => { });
        }
    }
    // ================= NID PICTURES (MULTIPLE) =================
    const nidFiles = req.files?.nidPic;
    if (nidFiles && nidFiles.length > 0) {
        if (nidFiles.length > 3) {
            throw new errorHandler_1.AppError(400, "Maximum 3 NID images allowed");
        }
        const compressedBuffers = await Promise.all(nidFiles.map((file) => (0, sharp_1.default)(file.buffer)
            .resize({ width: 1200 })
            .webp({ quality: 65 })
            .toBuffer()));
        const uploads = await Promise.all(compressedBuffers.map((buffer) => (0, uploadToCloudinary_1.uploadToCloudinary)(buffer, "users/nid")));
        updateData.nidPic = uploads.map((img) => ({
            public_id: img.public_id,
            url: img.secure_url,
        }));
        // delete old nid images
        if (existingUser.nidPic?.length) {
            const oldIds = existingUser.nidPic
                .filter((i) => i.public_id.startsWith("users/nid"))
                .map((i) => i.public_id);
            if (oldIds.length) {
                await (0, uploadToCloudinary_1.deleteMultipleImagesFromCloudinary)(oldIds).catch(() => { });
            }
        }
    }
    if (Object.keys(updateData).length === 0) {
        throw new errorHandler_1.AppError(400, "No valid fields to update");
    }
    const updatedUser = await user_model_1.default.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
        select: "-password -activationCode -resetPasswordOtp",
    });
    res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: updatedUser,
    });
});
// 9. Get User Profile by ID time complexity: O(1)
exports.getProfileById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const userId = req.user?._id;
    if (!userId)
        throw new errorHandler_1.AppError(401, "Unauthorized");
    const user = await user_model_1.default.findById(userId)
        .select("-password -refreshToken -refreshTokenExpiry -activationCode -activationCodeExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
        .lean();
    if (!user)
        throw new errorHandler_1.AppError(404, "User not found");
    res.status(200).json({
        success: true,
        message: "Profile fetched successfully",
        data: user,
    });
});
// 10. Get All Users (Cursor Pagination) time complexity: O(n)
exports.getAllUsers = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const role = req.user?.role;
    if (role !== "category-admin" && role !== "super-admin") {
        throw new errorHandler_1.AppError(403, "You are not authorized to access user list!");
    }
    const { cursor, limit = 10, sortOrder = "desc" } = req.query;
    const cacheKey = `users:list:role=user:${cursor || 'first'}:${limit}:${sortOrder}`;
    // Try cache first
    try {
        const cached = await (0, redisCache_1.getCache)(cacheKey);
        if (cached) {
            console.log(`⚡ Cache hit: ${cacheKey}`);
            return res.status(200).json({
                success: true,
                message: "User list fetched (from cache)",
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
        role: "user",
        ...paginationOptions.filter,
    };
    // Fetch users
    const users = await user_model_1.default.find(query)
        .select("-password -refreshToken -refreshTokenExpiry -activationCode -activationCodeExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
        .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
        .limit(paginationOptions.limit + 1)
        .lean();
    // Create pagination metadata
    const { data, meta } = (0, cursorPagination_1.createCursorPaginationMeta)(users, paginationOptions.limit, paginationOptions.sortBy, paginationOptions.sortOrder);
    // Get total count
    const total = await user_model_1.default.countDocuments({ role: "user" });
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
        message: "User list fetched successfully",
        ...responseData,
    });
});
// 11. Get All Category Admins (Cursor Pagination) time complexity: O(n)
exports.getAllCategoryAdmins = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const role = req.user?.role;
    if (role !== "super-admin") {
        throw new errorHandler_1.AppError(403, "You are not authorized to access category admin list!");
    }
    const { cursor, limit = 10, sortOrder = "desc" } = req.query;
    const cacheKey = `users:list:role=category-admin:${cursor || 'first'}:${limit}:${sortOrder}`;
    // Try cache first
    try {
        const cached = await (0, redisCache_1.getCache)(cacheKey);
        if (cached) {
            console.log(`⚡ Cache hit: ${cacheKey}`);
            return res.status(200).json({
                success: true,
                message: "Category admin list fetched (from cache)",
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
        role: "category-admin",
        ...paginationOptions.filter,
    };
    // Fetch category admins
    const categoryAdmins = await user_model_1.default.find(query)
        .select("-password -refreshToken -refreshTokenExpiry -activationCode -activationCodeExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
        .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
        .limit(paginationOptions.limit + 1)
        .lean();
    // Create pagination metadata
    const { data, meta } = (0, cursorPagination_1.createCursorPaginationMeta)(categoryAdmins, paginationOptions.limit, paginationOptions.sortBy, paginationOptions.sortOrder);
    // Get total count
    const total = await user_model_1.default.countDocuments({ role: "category-admin" });
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
        message: "Category admin list fetched successfully",
        ...responseData,
    });
});
// 12. Update Category Admin Role time complexity: O(1)
exports.updateCategoryAdminRole = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    const { category, division } = req.body;
    if (req.user?.role !== "super-admin") {
        throw new errorHandler_1.AppError(403, "Only super-admin can update category admin!");
    }
    // Find the user to update
    const user = await user_model_1.default.findById(id);
    if (!user)
        throw new errorHandler_1.AppError(404, "User not found");
    // Ensure the target user is category-admin
    if (user.role !== "category-admin") {
        throw new errorHandler_1.AppError(400, "Only category-admin can be updated!");
    }
    // Update fields
    if (category)
        user.category = category;
    if (division)
        user.division = division;
    await user.save();
    // Invalidate cache
    await (0, redisCache_1.deleteCache)(`user:${id}`);
    await (0, redisCache_1.deleteCache)(`users:list:role=category-admin:*`);
    res.status(200).json({
        success: true,
        message: "Category admin updated successfully!",
        data: {
            id: user._id,
            name: user.name,
            email: user.email,
            category: user.category,
            division: user.division,
        },
    });
});
// 13. Delete Category Admin time complexity: O(1)
exports.deleteCategoryAdminRole = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    if (req.user?.role !== "super-admin") {
        throw new errorHandler_1.AppError(403, "Only super-admin can delete a category admin!");
    }
    const user = await user_model_1.default.findById(id);
    if (!user)
        throw new errorHandler_1.AppError(404, "User not found");
    if (user.role !== "category-admin") {
        throw new errorHandler_1.AppError(400, "Only category-admin accounts can be deleted!");
    }
    if (req.user._id.toString() === id) {
        throw new errorHandler_1.AppError(400, "Super-admin cannot delete themselves!");
    }
    await user_model_1.default.findByIdAndDelete(id);
    // Invalidate cache
    await (0, redisCache_1.deleteCache)(`user:${id}`);
    await (0, redisCache_1.deleteCache)(`users:list:role=category-admin:*`);
    res.status(200).json({
        success: true,
        message: "Category admin deleted successfully!",
    });
});
//# sourceMappingURL=user.controller.js.map