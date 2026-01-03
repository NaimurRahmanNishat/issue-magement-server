import { z } from "zod";
export declare const createIssueSchema: z.ZodObject<{
    body: z.ZodObject<{
        title: z.ZodString;
        category: z.ZodEnum<{
            broken_road: "broken_road";
            water: "water";
            gas: "gas";
            electricity: "electricity";
            other: "other";
        }>;
        description: z.ZodString;
        images: z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            public_id: z.ZodString;
        }, z.core.$strip>>;
        location: z.ZodString;
        division: z.ZodEnum<{
            Dhaka: "Dhaka";
            Chattogram: "Chattogram";
            Rajshahi: "Rajshahi";
            Khulna: "Khulna";
            Barishal: "Barishal";
            Sylhet: "Sylhet";
            Rangpur: "Rangpur";
            Mymensingh: "Mymensingh";
        }>;
        author: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<{
            pending: "pending";
            "in-progress": "in-progress";
            solved: "solved";
        }>>;
        date: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDate]>>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=issue.validation.d.ts.map