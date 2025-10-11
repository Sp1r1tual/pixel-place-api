import { Request, Response, NextFunction } from "express";

import { IAuthPayload } from "../../types/auth.js";

import { AuthService } from "../services/auth-service.js";

import { activationSuccessHTML } from "../views/activation-success.js";
import { activationErrorHTML } from "../views/activation-fail.js";

const authService = new AuthService();

class AuthController {
  private setRefreshTokenCookie = (res: Response, token: string): void => {
    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
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

  activate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.activate(req.params.link);

      res
        .type("html")
        .send(activationSuccessHTML(`${process.env.CLIENT_URL}/login`));
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Activation failed";

      res
        .status(400)
        .type("html")
        .send(activationErrorHTML(`${process.env.CLIENT_URL}/login`, errMsg));
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

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      await authService.forgotPassword(email);

      return res.json();
    } catch (error) {
      return next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { password } = req.body;
      const { token } = req.params;

      await authService.resetPassword(token, password);

      return res.json();
    } catch (error) {
      return next(error);
    }
  };
}

export { AuthController };
