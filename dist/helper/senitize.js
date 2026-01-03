"use strict";
// backend/src/helper/senitize.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeBody = void 0;
const mongo_sanitize_1 = __importDefault(require("mongo-sanitize"));
const sanitizeBody = (obj) => {
    const cleaned = {};
    for (const key of Object.keys(obj)) {
        const safeKey = (0, mongo_sanitize_1.default)(key);
        cleaned[safeKey] = (0, mongo_sanitize_1.default)(obj[key]);
    }
    return cleaned;
};
exports.sanitizeBody = sanitizeBody;
//# sourceMappingURL=senitize.js.map