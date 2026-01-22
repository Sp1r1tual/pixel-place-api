import { Request, Response, NextFunction } from "express";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { validatePassword } from "../utils/validations/authValidators.js";
import { AUTH_ERRORS } from "../utils/errors/errors-messages.js";

const validateResetPassword = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { password } = req.body;

  if (!password || !validatePassword(password)) {
    throw ApiError.BadRequest(AUTH_ERRORS.invalidPassword);
  }

  next();
};

export { validateResetPassword };
