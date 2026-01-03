"use strict";
// utils/uploadToCloudinary.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMultipleImagesFromCloudinary = exports.uploadToCloudinary = void 0;
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const uploadToCloudinary = (buffer, folder) => new Promise((resolve, reject) => {
    cloudinary_1.default.uploader.upload_stream({ folder, resource_type: "image" }, (err, result) => {
        if (err)
            reject(err);
        else
            resolve(result);
    }).end(buffer);
});
exports.uploadToCloudinary = uploadToCloudinary;
// ============================== Delete multiple images ================================
const deleteMultipleImagesFromCloudinary = async (publicIds) => {
    if (!Array.isArray(publicIds) || publicIds.length === 0) {
        console.warn("No public_ids provided for deletion");
        return;
    }
    const deletePromises = publicIds.map(async (publicId) => {
        try {
            await cloudinary_1.default.uploader.destroy(publicId);
        }
        catch (err) {
            console.error(`Failed to delete image ${publicId}:`, err);
        }
    });
    await Promise.allSettled(deletePromises);
};
exports.deleteMultipleImagesFromCloudinary = deleteMultipleImagesFromCloudinary;
//# sourceMappingURL=uploadToCloudinary.js.map