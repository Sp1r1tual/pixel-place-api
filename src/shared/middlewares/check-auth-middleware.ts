import { Request, Response, NextFunction } from "express";

import { IAuthRequest } from "../../types/auth.js";

import { AuthService } from "../../auth/services/auth-service.js";
import { ApiError } from "../exceptions/api-error.js";

const authService = new AuthService();

const checkAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next(ApiError.UnauthorizedError());

    const token = authHeader.split(" ")[1];
    if (!token) return next(ApiError.UnauthorizedError());

    const userData = authService.validateAccessToken(token);
    if (!userData) return next(ApiError.UnauthorizedError());

    const authReq = req as IAuthRequest;
    authReq.user = userData;

    next();
  } catch {
    next(ApiError.UnauthorizedError());
  }
};

export { checkAuthMiddleware };
