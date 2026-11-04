import { Request, Response, NextFunction } from "express";

import { IAuthRequest } from "../../types/index.js";

import { AuthService } from "../../auth/services/auth-service.js";
import { ApiError } from "../exceptions/api-error.js";

const authService = new AuthService();

const checkAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return next(ApiError.UnauthorizedError());
    }

    (req as IAuthRequest).user = authService.validateAccessToken(token);

    next();
  } catch (err) {
    next(err instanceof ApiError ? err : ApiError.UnauthorizedError());
  }
};

export { checkAuthMiddleware };
