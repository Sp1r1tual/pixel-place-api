import { Router } from "express";

import { authValidation } from "../middlewares/auth-validation-middleware.js";
import { validateForgotPassword } from "../middlewares/forgot-password-middleware.js";
import { validateResetPassword } from "../middlewares/reset-password-middleware.js";

import { AuthController } from "../controllers/auth-controller.js";

import {
  forgotPasswordLimiter,
  loginLimiter,
  registrationLimiter,
  resetPasswordLimiter,
} from "../utils/auth-rate-limits.js";

const authRouter = Router();
const authController = new AuthController();

authRouter.post("/validate-token", authController.validateToken);

authRouter.post("/login", loginLimiter, authValidation, authController.login);
authRouter.post("/logout", authController.logout);

authRouter.post(
  "/registration",
  registrationLimiter,
  authValidation,
  authController.registration,
);
authRouter.get("/activate/:link", authController.activate);

authRouter.get("/refresh", authController.refresh);

authRouter.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validateForgotPassword,
  authController.forgotPassword,
);
authRouter.post(
  "/reset-password/:token",
  resetPasswordLimiter,
  validateResetPassword,
  authController.resetPassword,
);

export { authRouter };
