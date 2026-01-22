import { Request, Response, NextFunction } from "express";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { AUTH_ERRORS } from "../utils/errors/errors-messages.js";

import {
  validateEmail,
  validatePassword,
} from "../utils/validations/authValidators.js";

const authValidation = (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !validateEmail(email)) {
    throw ApiError.BadRequest(AUTH_ERRORS.invalidEmail);
  }

  if (!password || !validatePassword(password)) {
    throw ApiError.BadRequest(AUTH_ERRORS.invalidPassword);
  }
  next();
};

export { authValidation };
