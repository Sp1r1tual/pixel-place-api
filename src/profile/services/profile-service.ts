import type {
  IProfileData,
  IUpdateProfilePayload,
} from "../../types/profile.js";

import { ProfileRModel } from "../models/profile-model.js";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { formatDate } from "../../shared/utils/format-date.js";
import { deleteOldAvatarIfNeeded } from "../utils/delete-old-user-avatar.js";

class ProfileService {
  private readonly MAX_LEVEL = 100;
  private readonly BASE_EXP_REQUIRED = 10;
  private readonly profileRModel: ProfileRModel;

  constructor() {
    this.profileRModel = new ProfileRModel();
  }

  private calculateExpForLevel(level: number): number {
    return this.BASE_EXP_REQUIRED + (level - 1);
  }

  private calculateLevelFromRepaints(repaints: number): number {
    let level = 1;
    let remainingExp = repaints;

    for (let i = 1; i <= this.MAX_LEVEL; i++) {
      const expForLevel = this.calculateExpForLevel(i);

      if (remainingExp >= expForLevel) {
        remainingExp -= expForLevel;
        level = i + 1;
      } else {
        break;
      }
    }

    return Math.min(level, this.MAX_LEVEL);
  }

  private async updateUserLevel(
    userId: string,
    repaints: number,
  ): Promise<number> {
    const level = this.calculateLevelFromRepaints(repaints);
    await this.profileRModel.updateUserLevel(userId, level);
    return level;
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

    const [profile, repaints, createdAt] = await Promise.all([
      this.ensureUserProfile(userId),
      this.profileRModel.getRepaintsCount(userId),
      this.profileRModel.getUserCreatedAt(userId),
    ]);

    const level = await this.updateUserLevel(userId, repaints);

    return {
      userId: userId,
      username: profile.username || undefined,
      bio: profile.bio || undefined,
      avatarSrc: profile.avatar_src || undefined,
      level: level,
      repaints: repaints,
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

    const [profile, repaints] = await Promise.all([
      this.ensureUserProfile(userId),
      this.profileRModel.getRepaintsCount(userId),
    ]);

    const level = await this.updateUserLevel(userId, repaints);

    return {
      userId: userId,
      username: profile.username || undefined,
      bio: profile.bio || undefined,
      avatarSrc: profile.avatar_src || undefined,
      level: level,
      repaints: repaints,
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
