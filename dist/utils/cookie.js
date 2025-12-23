"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAccessTokenCookie = exports.setAuthCookies = void 0;
const config_1 = __importDefault(require("../config"));
const isProduction = config_1.default.nodeEnv === "production";
const setCookie = (res, name, token, maxAge) => {
    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge,
        path: "/",
    };
    res.cookie(name, token, cookieOptions);
};
const setAuthCookies = (res, accessToken, refreshToken) => {
    setCookie(res, "accessToken", accessToken, 10 * 60 * 1000); // 10 minute
    setCookie(res, "refreshToken", refreshToken, 7 * 24 * 60 * 60 * 1000); // 7 days
};
exports.setAuthCookies = setAuthCookies;
const setAccessTokenCookie = (res, accessToken) => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 10 * 60 * 1000,
        path: "/",
    });
};
exports.setAccessTokenCookie = setAccessTokenCookie;
//# sourceMappingURL=cookie.js.map