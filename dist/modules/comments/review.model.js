"use strict";
// src/modules/comments/review.model.ts
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
exports.Review = exports.CommentType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var CommentType;
(function (CommentType) {
    CommentType["COMMENT"] = "comment";
    CommentType["REPLY"] = "reply";
})(CommentType || (exports.CommentType = CommentType = {}));
const replySchema = new mongoose_1.Schema({
    author: {
        type: mongoose_1.Schema.Types.ObjectId, ref: "User"
    },
    comment: {
        type: String,
        required: true,
        trim: true,
    },
}, {
    timestamps: true,
    _id: true,
});
replySchema.add({
    replies: [replySchema],
});
const reviewSchema = new mongoose_1.Schema({
    issue: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Issue",
        required: true,
    },
    author: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    comment: {
        type: String,
        required: true,
        trim: true,
    },
    replies: {
        type: [replySchema],
        default: [],
    },
    parentReview: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Review",
        default: null,
    },
    commentType: {
        type: String,
        enum: Object.values(CommentType),
        default: CommentType.COMMENT,
    },
}, {
    timestamps: true,
});
// index
reviewSchema.index({ issue: 1, createdAt: -1 });
reviewSchema.index({ parentReview: 1 });
exports.Review = mongoose_1.default.model("Review", reviewSchema);
exports.default = exports.Review;
//# sourceMappingURL=review.model.js.map