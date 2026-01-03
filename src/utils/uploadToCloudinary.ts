// utils/uploadToCloudinary.ts

import cloudinary from "../config/cloudinary";

export const uploadToCloudinary = (buffer: Buffer, folder: string) =>
  new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    ).end(buffer);
  });


// ============================== Delete multiple images ================================
export const deleteMultipleImagesFromCloudinary = async (
  publicIds: string[]
): Promise<void> => {
  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    console.warn("No public_ids provided for deletion");
    return;
  }

  const deletePromises = publicIds.map(async (publicId) => {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error(`Failed to delete image ${publicId}:`, err);
    }
  });

  await Promise.allSettled(deletePromises);
};