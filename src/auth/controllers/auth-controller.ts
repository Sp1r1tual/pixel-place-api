import { Request, Response, NextFunction } from "express";

import { IAuthPayload } from "../../types/auth.js";

import { AuthService } from "../services/auth-service.js";

const authService = new AuthService();

class AuthController {
  private setRefreshTokenCookie = (res: Response, token: string): void => {
    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as IAuthPayload;
      const userData = await authService.login({ email, password });

      this.setRefreshTokenCookie(res, userData.refreshToken);

      return res.json(userData);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.cookies as { refreshToken?: string };
      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token is missing" });
      }

      const token = await authService.logout(refreshToken);
      res.clearCookie("refreshToken");

      return res.json(token);
    } catch (error) {
      next(error);
    }
  };

  registration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as IAuthPayload;
      const userData = await authService.registration({ email, password });

      this.setRefreshTokenCookie(res, userData.refreshToken);

      return res.json(userData);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.cookies;
      const userData = await authService.refresh(refreshToken);

      this.setRefreshTokenCookie(res, userData.refreshToken);

      return res.json(userData);
    } catch (error) {
      next(error);
    }
  };
}

export { AuthController };
