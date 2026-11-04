import type {
  IProfileData,
  IUpdateProfilePayload,
} from "../../types/profile.js";

import { ProfileRModel } from "../models/profile-model.js";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { formatDate } from "../../shared/utils/format-date.js";
import { deleteOldAvatarIfNeeded } from "../utils/delete-old-user-avatar.js";

const MAX_USERNAME_LENGTH = 21;
const MAX_BIO_LENGTH = 500;

class ProfileService {
  private readonly profileRModel = new ProfileRModel();

  /** A user who never saved a profile simply has empty fields. */
  private async getProfile(userId: string): Promise<IProfileData> {
    const user = await this.profileRModel.findUserById(userId);

    if (!user) throw ApiError.NotFound("profile.not-found");

    const [profile, stats] = await Promise.all([
      this.profileRModel.findProfileByUserId(userId),
      this.profileRModel.getUserStats(userId),
    ]);

    return {
      userId,
      username: profile?.username || undefined,
      bio: profile?.bio || undefined,
      avatarSrc: profile?.avatar_src || undefined,
      level: stats?.level || 1,
      repaints: stats?.repaints || 0,
      joined: formatDate(user.created_at),
    };
  }

  public getCurrentProfile(userId: string): Promise<IProfileData> {
    return this.getProfile(userId);
  }

  public getPublicProfile(userId: string): Promise<IProfileData> {
    return this.getProfile(userId);
  }

  public validateProfileText({ username, bio }: IUpdateProfilePayload): void {
    if (
      username !== undefined &&
      (typeof username !== "string" || username.length > MAX_USERNAME_LENGTH)
    ) {
      throw ApiError.BadRequest("profile.username-too-long");
    }

    if (
      bio !== undefined &&
      (typeof bio !== "string" || bio.length > MAX_BIO_LENGTH)
    ) {
      throw ApiError.BadRequest("profile.bio-too-long");
    }
  }

  public async updateProfile(
    userId: string,
    updates: IUpdateProfilePayload,
  ): Promise<IProfileData> {
    const current = await this.profileRModel.findProfileByUserId(userId);

    await this.profileRModel.saveProfile(userId, {
      ...(updates.username !== undefined && { username: updates.username }),
      ...(updates.bio !== undefined && { bio: updates.bio }),
      ...(updates.avatarSrc !== undefined && {
        avatar_src: updates.avatarSrc,
      }),
    });

    // Only after the save: a failed update must not cost the user their avatar.
    if (updates.avatarSrc && current?.avatar_src) {
      await deleteOldAvatarIfNeeded(
        current.avatar_src,
        updates.avatarSrc,
      ).catch((error) => console.error("Failed to delete old avatar:", error));
    }

    return this.getProfile(userId);
  }
}

export { ProfileService };
