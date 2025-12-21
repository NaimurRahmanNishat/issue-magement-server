"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
// src/config/redis.ts
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = __importDefault(require("../config"));
if (!config_1.default.redis_url) {
    throw new Error("Redis connection failed! Please set REDIS URL in config");
}
const redis = new ioredis_1.default(config_1.default.redis_url);
exports.redis = redis;
redis.on("connect", () => {
    console.log("Redis: connected");
});
redis.on("ready", () => {
    console.log("Redis: ready");
});
redis.on("error", (err) => {
    console.error("Redis error:", err);
});
redis.on("close", () => {
    console.log("Redis: connection closed");
});
//# sourceMappingURL=redis.js.map