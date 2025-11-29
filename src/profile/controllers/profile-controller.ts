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
      const authReq = req as IAuthRequest;
      const userId = authReq.user?.id;

      const profile = await profileService.getCurrentProfile(userId);

      return res.json(profile);
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
      const { userId } = req.params;

      const profile = await profileService.getPublicProfile(userId);

      return res.json(profile);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as IAuthRequest;
      const userId = authReq.user?.id;

      const { username, bio } = req.body;
      const file = req.file;

      let avatarSrc: string | undefined;

      if (file) {
        avatarSrc = await uploadAvatarToCloudinary(file.buffer, userId);
      }

      const updatedProfile = await profileService.updateProfile(userId, {
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
