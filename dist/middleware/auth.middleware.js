"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryAdminGuard = exports.optionalAuth = exports.authorizeRole = exports.isAuthenticated = void 0;
const user_model_1 = __importDefault(require("../modules/users/user.model"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const errorHandler_1 = require("../utils/errorHandler");
const cache_1 = require("../utils/cache");
// Authentication middleware
const isAuthenticated = async (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token)
        return next(new errorHandler_1.AppError(401, "Access token missing"));
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
        // 1. try to get user from cache
        let user = await (0, cache_1.getCache)(`user:${decoded.id}`);
        if (!user) {
            // 2. fallback to DB
            const userDoc = await user_model_1.default.findById(decoded.id).select("-password +category");
            if (!userDoc)
                return next(new errorHandler_1.AppError(404, "User not found"));
            user = userDoc.toObject();
            // 3. store in cache for next time
            await (0, cache_1.setCache)(`user:${decoded.id}`, user);
        }
        req.user = user;
        next();
    }
    catch {
        return next(new errorHandler_1.AppError(401, "Token expired or invalid"));
    }
};
exports.isAuthenticated = isAuthenticated;
// Authorization middleware
const authorizeRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new errorHandler_1.AppError(403, "Not authorized"));
        }
        next();
    };
};
exports.authorizeRole = authorizeRole;
// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
    const token = req.cookies?.accessToken;
    if (!token)
        return next(); // no token, skip silently (public access)
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
        let user = await (0, cache_1.getCache)(decoded.id);
        if (!user) {
            const userDoc = await user_model_1.default.findById(decoded.id).select("-password");
            if (userDoc) {
                user = userDoc.toObject();
                await (0, cache_1.setCache)(decoded.id, user);
            }
        }
        if (user)
            req.user = user;
    }
    catch {
        // ignore invalid token for public users
    }
    next();
};
exports.optionalAuth = optionalAuth;
// role and category admin guard
const categoryAdminGuard = (req, res, next) => {
    const user = req.user;
    if (!user) {
        throw new errorHandler_1.AppError(401, "Unauthorized");
    }
    if (user.role === "category-admin" && !user.category) {
        throw new errorHandler_1.AppError(403, "Category admin has no assigned category");
    }
    next();
};
exports.categoryAdminGuard = categoryAdminGuard;
//# sourceMappingURL=auth.middleware.js.map