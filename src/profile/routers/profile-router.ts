import { Router } from "express";

import { checkAuthMiddleware } from "../../shared/middlewares/check-auth-middleware.js";
import { uploadAvatarMiddleware } from "../middlewares/upload-avatar-middleware.js";

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
  uploadAvatarMiddleware.single("avatar"),
  profileController.updateProfile,
);

export { profileRouter };
