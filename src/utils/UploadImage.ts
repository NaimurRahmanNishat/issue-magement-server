// src/utils/UploadImage.ts
import { v2 as cloudinary } from "cloudinary";
import config from "../config";

cloudinary.config({
  cloud_name: config.cloudinary_cloud_name,
  api_key: config.cloudinary_api_key,
  api_secret: config.cloudinary_api_secret,
});

/* ==============================
  Upload BUFFER (RECOMMENDED)
================================ */
export const uploadBufferImage = (buffer: Buffer,folder = "issue-reports"): Promise<{ public_id: string; url: string }> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1280, height: 1280, crop: "limit" },
          { quality: "auto:eco", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Upload failed"));
        }
        resolve({
          public_id: result.public_id,
          url: result.secure_url,
        });
      }
    );

    stream.end(buffer);
  });
};


/* ==============================
  Base64 Upload (Fallback only)
================================ */
export const uploadImageBase64 = async (
  image: string,
  folder = "issue-reports"
): Promise<{ public_id: string; url: string }> => {
  if (!image.startsWith("data:image/")) {
    throw new Error("Invalid base64 image format");
  }

  const result = await cloudinary.uploader.upload(image, {
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


/* ==============================
  Delete single image
================================ */
export const deleteImageFromCloudinary = async (
  publicId: string
): Promise<boolean> => {
  if (!publicId) {
    console.warn("No public_id provided for deletion");
    return false;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error(`Failed to delete image ${publicId}:`, error);
    return false;
  }
};


/* ==============================
  Delete multiple images
================================ */
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
