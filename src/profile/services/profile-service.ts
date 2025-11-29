import type {
  IProfileData,
  IUpdateProfilePayload,
} from "../../types/profile.js";

import { ProfileRModel } from "../models/profile-model.js";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { formatDate } from "../../shared/utils/format-date.js";
import { deleteOldAvatarIfNeeded } from "../utils/delete-old-user-avatar.js";

class ProfileService {
  private readonly profileRModel: ProfileRModel;

  constructor() {
    this.profileRModel = new ProfileRModel();
  }

  private async ensureUserProfile(userId: string) {
    const profile = await this.profileRModel.findProfileByUserId(userId);

    if (!profile) {
      try {
        return await this.profileRModel.createProfile(userId);
      } catch (error) {
        console.error("Error creating user_profile:", error);
        throw ApiError.BadRequest("Failed to create user profile");
      }
    }
    return profile;
  }

  public async getCurrentProfile(userId: string): Promise<IProfileData> {
    if (!userId) {
      throw ApiError.UnauthorizedError();
    }

    const [profile, stats, createdAt] = await Promise.all([
      this.ensureUserProfile(userId),
      this.profileRModel.getUserStats(userId),
      this.profileRModel.getUserCreatedAt(userId),
    ]);

    return {
      userId: userId,
      username: profile.username || undefined,
      bio: profile.bio || undefined,
      avatarSrc: profile.avatar_src || undefined,
      level: stats?.level || 1,
      repaints: stats?.repaints || 0,
      joined: formatDate(createdAt),
    };
  }

  public async getPublicProfile(userId: string): Promise<IProfileData> {
    if (!userId) {
      throw ApiError.BadRequest("User ID is required");
    }

    const user = await this.profileRModel.findUserById(userId);

    if (!user) {
      throw ApiError.NotFound("User not found");
    }

    const [profile, stats] = await Promise.all([
      this.ensureUserProfile(userId),
      this.profileRModel.getUserStats(userId),
    ]);

    return {
      userId: userId,
      username: profile.username || undefined,
      bio: profile.bio || undefined,
      avatarSrc: profile.avatar_src || undefined,
      level: stats?.level || 1,
      repaints: stats?.repaints || 0,
      joined: formatDate(user.created_at),
    };
  }

  public async updateProfile(
    userId: string,
    updates: IUpdateProfilePayload,
  ): Promise<IProfileData> {
    if (!userId) throw ApiError.UnauthorizedError();

    const current = await this.ensureUserProfile(userId);

    if (updates.avatarSrc && current.avatar_src) {
      await deleteOldAvatarIfNeeded(current.avatar_src, updates.avatarSrc);
    }

    const updateData: Record<string, string | null> = {};

    if (updates.username !== undefined) updateData.username = updates.username;
    if (updates.bio !== undefined) updateData.bio = updates.bio;
    if (updates.avatarSrc !== undefined)
      updateData.avatar_src = updates.avatarSrc;

    try {
      await this.profileRModel.updateProfile(userId, updateData);
    } catch (error) {
      console.error("Error updating profile:", error);
      throw ApiError.BadRequest("Failed to update profile");
    }

    return this.getCurrentProfile(userId);
  }
}

export { ProfileService };
