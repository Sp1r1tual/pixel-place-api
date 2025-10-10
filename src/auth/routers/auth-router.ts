import { Router } from "express";

import { authMiddleware } from "../middlewares/auth-middleware.js";

import { AuthController } from "../controllers/auth-controller.js";

const authRouter = Router();

const authController = new AuthController();

authRouter.post("/login", authMiddleware, authController.login);
authRouter.post("/logout", authController.logout);

authRouter.post("/registration", authMiddleware, authController.registration);
authRouter.get("/activate/:link", authController.activate);

authRouter.get("/refresh", authController.refresh);

export { authRouter };
