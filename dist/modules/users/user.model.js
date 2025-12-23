"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nidRegex = exports.phoneRegex = exports.emailRegex = void 0;
// src/modules/users/user.model.ts
// note: nidPic is an array of { public_id: string, url: string }
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
exports.phoneRegex = /^(\+88)?01[3-9]\d{8}$/;
exports.nidRegex = /^\d{10}$|^\d{13}$|^\d{17}$/;
const userSchema = new mongoose_1.default.Schema({
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
            validator: (v) => exports.emailRegex.test(v),
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
            validator: (v) => !v || exports.phoneRegex.test(v),
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
            validator: (v) => !v || exports.nidRegex.test(v),
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
        enum: [
            "Dhaka",
            "Chattogram",
            "Rajshahi",
            "Khulna",
            "Barishal",
            "Sylhet",
            "Rangpur",
            "Mymensingh",
        ],
    },
    avatar: {
        public_id: { type: String, default: "default_avatar" },
        url: {
            type: String,
            default: "https://icons8.com/icons/set/user",
        },
    },
    refreshToken: { type: String, default: null, select: false },
    refreshTokenExpiry: { type: Date, default: null, select: false },
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
}, {
    timestamps: true,
});
userSchema.pre("save", async function (next) {
    if (!this.isModified("password"))
        return next();
    if (this.password.startsWith("$2"))
        return next(); // already hashed
    this.password = await bcryptjs_1.default.hash(this.password, 10);
    next();
});
userSchema.methods.comparePassword = async function (password) {
    return await bcryptjs_1.default.compare(password, this.password);
};
const User = mongoose_1.default.model("User", userSchema);
exports.default = User;
//# sourceMappingURL=user.model.js.map