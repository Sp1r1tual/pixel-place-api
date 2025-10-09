import { Request, Response, NextFunction } from "express";

import { ApiError } from "../../shared/exceptions/api-error.js";

import {
  validateEmail,
  validatePassword,
} from "../utils/validations/authValidators.js";

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !validateEmail(email)) {
    throw ApiError.BadRequest("Invalid email format");
  }

  if (!password || !validatePassword(password)) {
    throw ApiError.BadRequest(
      "Password must be 8-32 characters, include an uppercase letter, and contain only allowed symbols",
    );
  }
  next();
};

export { authMiddleware };
