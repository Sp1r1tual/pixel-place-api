import { Request, Response, NextFunction } from "express";

import { IAuthRequest } from "../../types/index.js";
import { ProfileService } from "../services/profile-service.js";
import { uploadAvatarToCloudinary } from "../utils/upload-avatar.js";

const profileService = new ProfileService();

class ProfileController {
  getCurrentProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = (req as IAuthRequest).user;

      return res.json(await profileService.getCurrentProfile(id));
    } catch (error) {
      next(error);
    }
  };

  getPublicProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const profile = await profileService.getPublicProfile(
        req.params.userId as string,
      );

      return res.json(profile);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as IAuthRequest).user;
      const { username, bio } = req.body ?? {};

      // Validated first so that a rejected request uploads nothing.
      profileService.validateProfileText({ username, bio });

      const avatarSrc = req.file
        ? await uploadAvatarToCloudinary(req.file.buffer, id)
        : undefined;

      const updatedProfile = await profileService.updateProfile(id, {
        username,
        bio,
        avatarSrc,
      });

      return res.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  };
}

export { ProfileController };
