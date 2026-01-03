"use strict";
// src/modules/issues/issue.model.ts
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
exports.IssueCategory = exports.IssueStatus = exports.BangladeshDivision = void 0;
const mongoose_1 = __importStar(require("mongoose"));
require("../comments/review.model");
var BangladeshDivision;
(function (BangladeshDivision) {
    BangladeshDivision["DHAKA"] = "Dhaka";
    BangladeshDivision["CHATTOGRAM"] = "Chattogram";
    BangladeshDivision["RAJSHAHI"] = "Rajshahi";
    BangladeshDivision["KHULNA"] = "Khulna";
    BangladeshDivision["BARISHAL"] = "Barishal";
    BangladeshDivision["SYLHET"] = "Sylhet";
    BangladeshDivision["RANGPUR"] = "Rangpur";
    BangladeshDivision["MYMENSINGH"] = "Mymensingh";
})(BangladeshDivision || (exports.BangladeshDivision = BangladeshDivision = {}));
var IssueStatus;
(function (IssueStatus) {
    IssueStatus["PENDING"] = "pending";
    IssueStatus["APPROVED"] = "approved";
    IssueStatus["IN_PROGRESS"] = "in-progress";
    IssueStatus["RESOLVED"] = "resolved";
    IssueStatus["REJECTED"] = "rejected";
})(IssueStatus || (exports.IssueStatus = IssueStatus = {}));
var IssueCategory;
(function (IssueCategory) {
    IssueCategory["ELECTRICITY"] = "electricity";
    IssueCategory["WATER"] = "water";
    IssueCategory["GAS"] = "gas";
    IssueCategory["BROKEN_ROAD"] = "broken_road";
    IssueCategory["OTHER"] = "other";
})(IssueCategory || (exports.IssueCategory = IssueCategory = {}));
const issueSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, "Title is required"],
        trim: true,
        minlength: [3, "Title must be at least 3 characters long"],
    },
    category: {
        type: String,
        enum: Object.values(IssueCategory),
        required: [true, "Category is required"],
        trim: true,
    },
    description: {
        type: String,
        required: [true, "Description is required"],
        trim: true,
        minlength: [10, "Description must be at least 10 characters long"],
    },
    images: [
        {
            public_id: { type: String, required: true },
            url: { type: String, required: true },
        },
    ],
    location: {
        type: String,
        required: [true, "Location is required"],
        trim: true,
    },
    division: {
        type: String,
        enum: Object.values(BangladeshDivision),
        required: [true, "Division is required"],
    },
    status: {
        type: String,
        enum: Object.values(IssueStatus),
        default: IssueStatus.PENDING,
    },
    author: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    reviews: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Review", default: [] }],
    date: { type: Date, default: Date.now },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    isReadByAdmin: { type: Boolean, default: false },
    readByAdminAt: { type: Date },
}, { timestamps: true });
// Full-text search index
issueSchema.index({
    title: "text",
    category: "text",
    description: "text",
    location: "text",
});
issueSchema.index({ category: 1 });
issueSchema.index({ status: 1 });
issueSchema.index({ division: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ category: 1, status: 1 });
issueSchema.index({ "$**": "text" });
issueSchema.index({ author: 1, createdAt: -1 });
const Issue = mongoose_1.default.model("Issue", issueSchema);
exports.default = Issue;
//# sourceMappingURL=issue.model.js.map