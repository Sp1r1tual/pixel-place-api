import { Router } from "express";

import { checkAuthMiddleware } from "../../shared/middlewares/check-auth-middleware.js";

import { ProfileController } from "../controllers/profile-controller.js";

const profileRouter = Router();

const profileController = new ProfileController();

profileRouter.get(
  "/profile",
  checkAuthMiddleware,
  profileController.getCurrentProfile,
);

profileRouter.get("/profile/:userId", profileController.getPublicProfile);

profileRouter.patch(
  "/profile",
  checkAuthMiddleware,
  profileController.updateProfile,
);

export { profileRouter };
