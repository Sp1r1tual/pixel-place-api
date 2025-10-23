import { Request, Response, NextFunction } from "express";

import { IAuthPayload } from "../../types/auth.js";

import { AuthService } from "../services/auth-service.js";

import { ApiError } from "../../shared/exceptions/api-error.js";

import { activationSuccessHTML } from "../views/activation-success.js";
import { activationErrorHTML } from "../views/activation-fail.js";

const authService = new AuthService();

class AuthController {
  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as IAuthPayload;
      const userData = await authService.login({ email, password });

      this.setRefreshTokenCookie(res, userData.refreshToken);

      res.json(userData);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.cookies as { refreshToken?: string };

      if (!refreshToken) throw ApiError.BadRequest("Refresh token missing");

      await authService.logout(refreshToken);

      res.clearCookie("refreshToken").json({ message: "Logged out" });
    } catch (error) {
      next(error);
    }
  };

  registration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as IAuthPayload;
      const userData = await authService.registration({ email, password });

      this.setRefreshTokenCookie(res, userData.refreshToken);

      res.json(userData);
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
      res
        .status(400)
        .type("html")
        .send(
          activationErrorHTML(
            `${process.env.CLIENT_URL}/login`,
            (error as Error).message,
          ),
        );
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.cookies;
      const userData = await authService.refresh(refreshToken);

      this.setRefreshTokenCookie(res, userData.refreshToken);

      res.json(userData);
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);

      res.json({ message: "Reset link sent" });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { password } = req.body;
      const { token } = req.params;

      await authService.resetPassword(token, password);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export { AuthController };
