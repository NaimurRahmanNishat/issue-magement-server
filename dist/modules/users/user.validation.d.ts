import { z } from "zod";
export declare const registerUserSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        email: z.ZodString;
        password: z.ZodString;
        confirmPassword: z.ZodString;
        phone: z.ZodString;
        nid: z.ZodString;
        role: z.ZodOptional<z.ZodEnum<{
            user: "user";
            "category-admin": "category-admin";
            "super-admin": "super-admin";
        }>>;
        category: z.ZodOptional<z.ZodEnum<{
            broken_road: "broken_road";
            water: "water";
            gas: "gas";
            electricity: "electricity";
            other: "other";
        }>>;
        division: z.ZodOptional<z.ZodEnum<{
            Dhaka: "Dhaka";
            Chattogram: "Chattogram";
            Rajshahi: "Rajshahi";
            Khulna: "Khulna";
            Barishal: "Barishal";
            Sylhet: "Sylhet";
            Rangpur: "Rangpur";
            Mymensingh: "Mymensingh";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const activateUserSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        activationCode: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const loginUserSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=user.validation.d.ts.map