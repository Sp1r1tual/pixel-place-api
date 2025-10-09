import { Router } from "express";

import { AuthController } from "../controllers/auth-controller.js";

const authRouter = Router();

const authController = new AuthController();

authRouter.post("/login", authController.login);

authRouter.post("/logout", authController.logout);

authRouter.post("/registration", authController.registration);

authRouter.get("/refresh", authController.refresh);

export { authRouter };
