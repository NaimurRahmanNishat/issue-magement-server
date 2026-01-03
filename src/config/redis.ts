// src/config/redis.ts
import Redis from "ioredis";
import config from "../config";

if (!config.redis_url) {
  throw new Error("Redis connection failed! Please set REDIS URL in config");
}

const redis = new Redis(config.redis_url);

redis.on("connect", () => {
  console.log("✅ Redis connected successfully!");
});
redis.on("error", (err) => {
  console.error("Redis error:", err);
});
redis.on("close", () => {
  console.log("❌ Redis connection closed");
});

export { redis };