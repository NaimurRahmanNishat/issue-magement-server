// src/utils/image.ts
import sharp from "sharp";

export const compressImage = async (
  buffer: Buffer,
  width = 1280,
  quality = 70
): Promise<Buffer> => {
  return await sharp(buffer)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
};



// Get image metadata

export const getImageMetadata = async (buffer: Buffer) => {
  return await sharp(buffer).metadata();
};


// Convert image to specific format
export const convertImageFormat = async (
  buffer: Buffer,
  format: "jpeg" | "png" | "webp" = "jpeg",
  quality = 80
): Promise<Buffer> => {
  const sharpInstance = sharp(buffer);
  
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