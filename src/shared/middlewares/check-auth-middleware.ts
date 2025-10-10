import { Request, Response, NextFunction } from "express";

import { IUser } from "../../types/auth.js";

import { AuthService } from "../../auth/services/auth-service.js";
import { ApiError } from "../exceptions/api-error.js";

const authService = new AuthService();

interface AuthRequest extends Request {
  user?: IUser;
}

const checkAuthMiddleware = async (
  req: AuthRequest,
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

    req.user = userData;

    next();
  } catch {
    next(ApiError.UnauthorizedError());
  }
};

export { checkAuthMiddleware };
