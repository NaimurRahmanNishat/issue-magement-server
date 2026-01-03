"use strict";
// src/modules/issues/issue.validation.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIssueSchema = void 0;
const zod_1 = require("zod");
// 1. create issue validation
exports.createIssueSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(3, "Name must be at least 3 characters long"),
        category: zod_1.z.enum(["broken_road", "water", "gas", "electricity", "other"]),
        description: zod_1.z.string().min(10, "Description must be at least 10 characters long"),
        images: zod_1.z.array(zod_1.z.object({ url: zod_1.z.string(), public_id: zod_1.z.string() })),
        location: zod_1.z.string().min(3, "Location must be at least 3 characters long"),
        division: zod_1.z.enum(["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"]),
        author: zod_1.z.string().optional(),
        status: zod_1.z.enum(["pending", "in-progress", "solved"]).optional(),
        date: zod_1.z.string().or(zod_1.z.date()).optional(),
    })
});
//# sourceMappingURL=issue.validation.js.map