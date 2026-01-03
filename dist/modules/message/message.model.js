"use strict";
// src/modules/message/message.model.ts
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
exports.Message = exports.CategoryType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var CategoryType;
(function (CategoryType) {
    CategoryType["BROKEN_ROAD"] = "broken_road";
    CategoryType["WATER"] = "water";
    CategoryType["GAS"] = "gas";
    CategoryType["ELECTRICITY"] = "electricity";
    CategoryType["OTHER"] = "other";
})(CategoryType || (exports.CategoryType = CategoryType = {}));
const messageSchema = new mongoose_1.Schema({
    sender: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    senderName: { type: String },
    senderEmail: { type: String },
    category: {
        type: String,
        required: true,
        enum: Object.values(CategoryType),
        immutable: true,
    },
    message: { type: String, required: true, trim: true, minlength: 2 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
}, { timestamps: true });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ category: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ sender: 1, category: 1, createdAt: -1 });
exports.Message = mongoose_1.default.model("Message", messageSchema);
//# sourceMappingURL=message.model.js.map