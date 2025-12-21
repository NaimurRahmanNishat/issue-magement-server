"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMultipleImagesFromCloudinary = exports.deleteImageFromCloudinary = exports.uploadImageBase64 = exports.uploadBufferImage = void 0;
// src/utils/UploadImage.ts
const cloudinary_1 = require("cloudinary");
const config_1 = __importDefault(require("../config"));
cloudinary_1.v2.config({
    cloud_name: config_1.default.cloudinary_cloud_name,
    api_key: config_1.default.cloudinary_api_key,
    api_secret: config_1.default.cloudinary_api_secret,
});
/* ==============================
  Upload BUFFER (RECOMMENDED)
================================ */
const uploadBufferImage = (buffer, folder = "issue-reports") => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            resource_type: "image",
            transformation: [
                { width: 1280, height: 1280, crop: "limit" },
                { quality: "auto:eco", fetch_format: "auto" },
            ],
        }, (error, result) => {
            if (error || !result) {
                return reject(error || new Error("Upload failed"));
            }
            resolve({
                public_id: result.public_id,
                url: result.secure_url,
            });
        });
        stream.end(buffer);
    });
};
exports.uploadBufferImage = uploadBufferImage;
/* ==============================
  Base64 Upload (Fallback only)
================================ */
const uploadImageBase64 = async (image, folder = "issue-reports") => {
    if (!image.startsWith("data:image/")) {
        throw new Error("Invalid base64 image format");
    }
    const result = await cloudinary_1.v2.uploader.upload(image, {
        folder,
        resource_type: "image",
        transformation: [
            { width: 1280, height: 1280, crop: "limit" },
            { quality: "auto:eco", fetch_format: "auto" },
        ],
    });
    return {
        public_id: result.public_id,
        url: result.secure_url,
    };
};
exports.uploadImageBase64 = uploadImageBase64;
/* ==============================
  Delete single image
================================ */
const deleteImageFromCloudinary = async (publicId) => {
    if (!publicId) {
        console.warn("No public_id provided for deletion");
        return false;
    }
    try {
        const result = await cloudinary_1.v2.uploader.destroy(publicId);
        return result.result === "ok";
    }
    catch (error) {
        console.error(`Failed to delete image ${publicId}:`, error);
        return false;
    }
};
exports.deleteImageFromCloudinary = deleteImageFromCloudinary;
/* ==============================
  Delete multiple images
================================ */
const deleteMultipleImagesFromCloudinary = async (publicIds) => {
    if (!Array.isArray(publicIds) || publicIds.length === 0) {
        console.warn("No public_ids provided for deletion");
        return;
    }
    const deletePromises = publicIds.map(async (publicId) => {
        try {
            await cloudinary_1.v2.uploader.destroy(publicId);
        }
        catch (err) {
            console.error(`Failed to delete image ${publicId}:`, err);
        }
    });
    await Promise.allSettled(deletePromises);
};
exports.deleteMultipleImagesFromCloudinary = deleteMultipleImagesFromCloudinary;
//# sourceMappingURL=UploadImage.js.map