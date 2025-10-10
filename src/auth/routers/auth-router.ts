import { Router } from "express";

import { authValidation } from "../middlewares/auth-validation-middleware.js";
import { validateForgotPassword } from "../middlewares/forgot-password-middleware.js";
import { validateResetPassword } from "../middlewares/reset-password-middleware.js";

import { AuthController } from "../controllers/auth-controller.js";

const authRouter = Router();

const authController = new AuthController();

authRouter.post("/login", authValidation, authController.login);
authRouter.post("/logout", authController.logout);

authRouter.post("/registration", authValidation, authController.registration);
authRouter.get("/activate/:link", authController.activate);

authRouter.get("/refresh", authController.refresh);

authRouter.post(
  "/forgot-password",
  validateForgotPassword,
  authController.forgotPassword,
);
authRouter.post(
  "/reset-password/:token",
  validateResetPassword,
  authController.resetPassword,
);

export { authRouter };
