"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertImageFormat = exports.getImageMetadata = exports.compressImage = void 0;
// src/utils/image.ts
const sharp_1 = __importDefault(require("sharp"));
const compressImage = async (buffer, width = 1280, quality = 70) => {
    return await (0, sharp_1.default)(buffer)
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer();
};
exports.compressImage = compressImage;
// Get image metadata
const getImageMetadata = async (buffer) => {
    return await (0, sharp_1.default)(buffer).metadata();
};
exports.getImageMetadata = getImageMetadata;
// Convert image to specific format
const convertImageFormat = async (buffer, format = "jpeg", quality = 80) => {
    const sharpInstance = (0, sharp_1.default)(buffer);
    switch (format) {
        case "jpeg":
            return await sharpInstance.jpeg({ quality }).toBuffer();
        case "png":
            return await sharpInstance.png({ quality }).toBuffer();
        case "webp":
            return await sharpInstance.webp({ quality }).toBuffer();
        default:
            return await sharpInstance.jpeg({ quality }).toBuffer();
    }
};
exports.convertImageFormat = convertImageFormat;
// Original Image (2.5 MB)
//          ↓
// Multer receives file
//          ↓
// Sharp compresses (1280px width, 70% quality)
//          ↓
// Compressed Image (~200-400 KB)
//          ↓
// Upload to Cloudinary
//          ↓
// Get public_id & URL
//          ↓
// Save to MongoDB
//# sourceMappingURL=image.js.map