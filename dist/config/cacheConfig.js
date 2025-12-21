"use strict";
// src/config/cacheConfig.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_CACHE_TTL = exports.DEFAULT_TTL = exports.CACHE_PREFIX = void 0;
// storage-management:devlopment:user-123 (development stage)
// storage-management:production:user-123 (production stage)
const _1 = __importDefault(require("."));
exports.CACHE_PREFIX = _1.default.nodeEnv === "production" ? "stm:prod:" : "stm:dev:";
exports.DEFAULT_TTL = 10 * 60;
exports.USER_CACHE_TTL = 7 * 24 * 60 * 60;
//# sourceMappingURL=cacheConfig.js.map