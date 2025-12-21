// src/modules/issues/issue.validation.ts
import {z} from "zod";

// 1. create issue validation
// export const createIssueSchema = z.object({
//     body: z.object({
//         title: z.string().min(3, "Name must be at least 3 characters long"),
//         category: z.enum(["broken_road", "water", "gas", "electricity", "other"]),
//         description: z.string().min(10, "Description must be at least 10 characters long"),
//         images: z.array(z.object({ url: z.string(), public_id: z.string() })),
//         location: z.string().min(3, "Location must be at least 3 characters long"),
//         division: z.enum(["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"]),
//         author: z.string().optional(), 
//         status: z.enum(["pending", "in-progress", "solved"]).optional(),
//         date: z.string().or(z.date()).optional(), 
//     })
// });