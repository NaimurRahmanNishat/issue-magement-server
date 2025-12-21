"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRefreshToken = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
// src/utils/token.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
// generate access token for (15 minutes)
const generateAccessToken = (payload) => {
    const secret = config_1.default.jwt_access_secret;
    if (!secret) {
        throw new Error("JWT_ACCESS_SECRET is not defined");
    }
    const expiresIn = config_1.default.access_token_expires || "10m";
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
};
exports.generateAccessToken = generateAccessToken;
// generate refresh token for (7 days)
const generateRefreshToken = (payload) => {
    const secret = config_1.default.refresh_token_secret;
    if (!secret) {
        throw new Error("JWT_REFRESH_SECRET is not defined");
    }
    const expiresIn = config_1.default.refresh_token_expires || "7d";
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
};
exports.generateRefreshToken = generateRefreshToken;
// verify access token
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
};
exports.verifyAccessToken = verifyAccessToken;
// verify refresh token
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, config_1.default.refresh_token_secret);
};
exports.verifyRefreshToken = verifyRefreshToken;
// update refresh token
const updateRefreshToken = (user, refreshToken, expiry) => {
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = expiry;
    return user.save();
};
exports.updateRefreshToken = updateRefreshToken;
//# sourceMappingURL=token.js.map