import mongoose from "mongoose";
export type Role = "user" | "category-admin" | "super-admin";
export type CategoryType = "broken_road" | "water" | "gas" | "electricity" | "other";
export type Division = "Dhaka" | "Chattogram" | "Rajshahi" | "Khulna" | "Barishal" | "Sylhet" | "Rangpur" | "Mymensingh";
export interface IUser extends mongoose.Document {
    name: string;
    email: string;
    password: string;
    phone?: string;
    nid?: string;
    isVerified: boolean;
    role: Role;
    category?: CategoryType;
    division?: Division;
    avatar?: {
        public_id: string;
        url: string;
    };
    refreshToken?: string | null;
    refreshTokenExpiry?: Date | null;
    activationCode?: string | null;
    activationCodeExpiry?: Date | null;
    lastActivationCodeSentAt?: Date | null;
    resetPasswordOtp?: string | null;
    resetPasswordOtpExpiry?: Date | null;
    nidPic?: {
        public_id: string;
        url: string;
    }[];
    profession?: string;
    zipCode?: string;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(password: string): Promise<boolean>;
}
export declare const emailRegex: RegExp;
export declare const phoneRegex: RegExp;
export declare const nidRegex: RegExp;
declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export default User;
//# sourceMappingURL=user.model.d.ts.map