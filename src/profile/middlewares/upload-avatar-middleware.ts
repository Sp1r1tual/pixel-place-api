import multer, { FileFilterCallback } from "multer";
import path from "path";
import { Request } from "express";

import { ApiError } from "../../shared/exceptions/api-error.js";

const ALLOWED_EXTENSIONS = [".jpeg", ".jpg", ".png", ".gif", ".webp"];
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    ALLOWED_EXTENSIONS.includes(extension) &&
    ALLOWED_MIME_TYPES.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(ApiError.BadRequest("Only image files are allowed"));
  }
};

const uploadAvatarMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter,
});

export { uploadAvatarMiddleware };
