import { Request, Response, NextFunction } from "express";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { validateEmail } from "../utils/validations/authValidators.js";
import { AUTH_ERRORS } from "../utils/errors/errors-messages.js";

const validateForgotPassword = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email } = req.body;

  if (!email || !validateEmail(email)) {
    throw ApiError.BadRequest(AUTH_ERRORS.invalidEmail);
  }

  next();
};

export { validateForgotPassword };
