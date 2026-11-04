import { CookieOptions, Request, Response, NextFunction } from "express";

import { IAuthPayload } from "../../types/auth.js";

import { AuthService } from "../services/auth-service.js";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { REFRESH_TOKEN_TTL_MS } from "../utils/tokens.js";

import { activationSuccessHTML } from "../views/activation-success.js";
import { activationErrorHTML } from "../views/activation-fail.js";

const authService = new AuthService();

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
};

class AuthController {
  /** The refresh token only ever travels in the httpOnly cookie, never in the body. */
  private sendSession(
    res: Response,
    session: { accessToken: string; refreshToken?: string; user: object },
  ) {
    if (session.refreshToken) {
      res.cookie(REFRESH_COOKIE, session.refreshToken, {
        ...REFRESH_COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_TTL_MS,
      });
    }

    res.json({ accessToken: session.accessToken, user: session.user });
  }

  validateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body ?? {};

      if (!token) {
        throw ApiError.BadRequest("Token is required");
      }

      const userData = authService.validateAccessToken(token);

      res.json({
        id: userData.id,
        email: userData.email,
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as IAuthPayload;

      this.sendSession(res, await authService.login({ email, password }));
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.cookies as { refreshToken?: string };

      if (refreshToken) await authService.logout(refreshToken);

      res
        .clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS)
        .json({ message: "Logged out" });
    } catch (error) {
      next(error);
    }
  };

  registration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as IAuthPayload;

      res.json(await authService.registration({ email, password }));
    } catch (error) {
      next(error);
    }
  };

  activate = async (req: Request, res: Response) => {
    try {
      await authService.activate(req.params.link as string);
      res
        .type("html")
        .send(activationSuccessHTML(`${process.env.CLIENT_URL}/login`));
    } catch (error) {
      if (!(error instanceof ApiError)) console.error(error);

      res
        .status(400)
        .type("html")
        .send(
          activationErrorHTML(
            `${process.env.CLIENT_URL}/login`,
            error instanceof ApiError
              ? error.message
              : "errors.something-went-wrong",
          ),
        );
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.cookies as { refreshToken?: string };

      this.sendSession(res, await authService.refresh(refreshToken));
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

      await authService.resetPassword(req.params.token as string, password);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export { AuthController };
