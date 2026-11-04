import { Request, Response, NextFunction } from "express";
import multer from "multer";

import { ApiError } from "../exceptions/api-error.js";

const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): Response => {
  if (err instanceof multer.MulterError) {
    return err.code === "LIMIT_FILE_SIZE"
      ? res.status(413).json({ message: "profile.image-too-large", errors: [] })
      : res.status(400).json({ message: err.message, errors: [] });
  }

  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json({ message: err.message, errors: err.errors });
  }

  console.error(err);

  return res.status(500).json({ message: "errors.something-went-wrong" });
};

export { errorMiddleware };
