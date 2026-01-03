// src/modules/users/user.model.ts

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
  avatar?: { public_id: string; url: string };
  activationCode?: string | null;
  activationCodeExpiry?: Date | null;
  lastActivationCodeSentAt?: Date | null;
  resetPasswordOtp?: string | null;
  resetPasswordOtpExpiry?: Date | null;
  nidPic?: { public_id: string; url: string }[];
  profession?: string;
  zipCode?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

export const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
export const phoneRegex = /^(\+88)?01[3-9]\d{8}$/;
export const nidRegex = /^\d{10}$|^\d{13}$|^\d{17}$/;

const userSchema = new mongoose.Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: [true, "Email is required"],
      lowercase: true,
      validate: {
        validator: (v: string) => emailRegex.test(v),
        message: (props) => `${props.value} is not a valid email!`,
      },
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      validate: {
        validator: (v: string) => !v || phoneRegex.test(v),
        message: "Please provide a valid Bangladesh phone number",
      },
    },
    nid: {
      type: String,
      unique: true,
      minlength: 10,
      maxlength: 17,
      sparse: true,
      validate: {
        validator: (v: string) => !v || nidRegex.test(v),
        message: "Please provide a valid Bangladesh NID number",
      },
    },
    isVerified: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["user", "category-admin", "super-admin"],
      default: "user",
    },
    category: {
      type: String,
      enum: ["broken_road", "water", "gas", "electricity", "other"],
      default: null,
    },
    division: {
      type: String,
      enum: [ "Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh" ],
    },
    avatar: {
      public_id: { type: String, default: "default_avatar" },
      url: {
        type: String,
        default:
          "https://icons8.com/icons/set/user",
      },
    },
    activationCode: { type: String, default: null, select: false },
    activationCodeExpiry: { type: Date, default: null, select: false },
    lastActivationCodeSentAt: { type: Date, default: null, select: false },
    resetPasswordOtp: { type: String, default: null, index: true, select: false },
    resetPasswordOtpExpiry: { type: Date, default: null, select: false },
    nidPic: {
      type: [
        {
          public_id: { type: String },
          url: { type: String, required: true },
        },
      ],
      default: [],
    },
    profession: { type: String, default: null },
    zipCode: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

  userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    if (this.password.startsWith("$2")) return next(); 
    this.password = await bcrypt.hash(this.password, 10);
    next();
  });

  userSchema.methods.comparePassword = async function (password: string) {
    return await bcrypt.compare(password, this.password);
  };

const User = mongoose.model<IUser>("User", userSchema);
export default User;
