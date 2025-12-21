// src/modules/users/user.validation.ts
import {z} from "zod";


// 1. register user validation
export const registerUserSchema = z.object({
    body: z.object({
        name: z.string().min(3, "Name must be at least 3 characters long"),
        email: z.string().email("Invalid email format"),
        password: z.string().min(6, "Password must be at least 6 characters long"),
        confirmPassword: z.string().min(6, "Password must be at least 6 characters long"),
        phone: z.string().min(11, "Phone number must be at least 11 characters long"),
        nid: z.string().min(10, "NID number must be at least 10 characters long"),
        role: z.enum(["user", "category-admin", "super-admin"]).optional(),
        category: z.enum(["broken_road", "water", "gas", "electricity", "other"]).optional(),
        division: z.enum(["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"]).optional(),
    })
    // confirmPassword & password match validation
    .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
    }),
});


// 2. activate user validation
export const activateUserSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format"),
        activationCode: z.string().min(6, "Activation code must be at least 6 characters long"),
    }),
});


// 3. login user validation
export const loginUserSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format"),
        password: z.string().min(6, "Password must be at least 6 characters long"),
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

