// middleware/multer.ts
import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req: any,file: Express.Multer.File,cb: multer.FileFilterCallback) => {
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Only image files allowed"));
  } else {
    cb(null, true);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
