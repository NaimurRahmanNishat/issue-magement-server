"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUserSchema = exports.activateUserSchema = exports.registerUserSchema = void 0;
// src/modules/users/user.validation.ts
const zod_1 = require("zod");
// 1. register user validation
exports.registerUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(3, "Name must be at least 3 characters long"),
        email: zod_1.z.string().email("Invalid email format"),
        password: zod_1.z.string().min(6, "Password must be at least 6 characters long"),
        confirmPassword: zod_1.z.string().min(6, "Password must be at least 6 characters long"),
        phone: zod_1.z.string().min(11, "Phone number must be at least 11 characters long"),
        nid: zod_1.z.string().min(10, "NID number must be at least 10 characters long"),
        role: zod_1.z.enum(["user", "category-admin", "super-admin"]).optional(),
        category: zod_1.z.enum(["broken_road", "water", "gas", "electricity", "other"]).optional(),
        division: zod_1.z.enum(["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"]).optional(),
    })
        // confirmPassword & password match validation
        .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    }),
});
// 2. activate user validation
exports.activateUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
        activationCode: zod_1.z.string().min(6, "Activation code must be at least 6 characters long"),
    }),
});
// 3. login user validation
exports.loginUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
        password: zod_1.z.string().min(6, "Password must be at least 6 characters long"),
    }),
});
// 4. Validation for editProfile
// export const editProfileSchema = z.object({
//   body: z.object({
//     name: z.string().min(2, "Name must be at least 2 characters").optional(),
//     email: z.string().email("Invalid email format").optional(),
//     phone: z.string().regex(/^(\+8801|01)[3-9]\d{8}$/, "Invalid Bangladeshi phone number").optional(),
//     zipCode: z.string().regex(/^\d{4}$/, "Zip code must be 4 digits").optional(),
//     profession: z.string().min(2, "Profession must be at least 2 characters").optional(),
//     division: z.string().min(1, "Division is required").optional(),
//     // Optional: base64 fallback
//     avatar: z.string().startsWith("data:image/").optional(),
//     nidPic: z.array(z.string().startsWith("data:image/")).max(3, "Maximum 3 NID pictures allowed").optional(),
//   }),
// });
//# sourceMappingURL=user.validation.js.map