import type {
  IProfileData,
  IUpdateProfilePayload,
} from "../../types/profile.js";

import { supabase } from "../../index.js";

import { ApiError } from "../../shared/exceptions/api-error.js";

import { formatDate } from "../../shared/utils/format-date.js";
import { deleteOldAvatarIfNeeded } from "../utils/delete-old-user-avatar.js";

class ProfileService {
  private readonly MAX_LEVEL = 100;
  private readonly BASE_EXP_REQUIRED = 10;

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

    const { error } = await supabase
      .from("user_stats")
      .update({ level })
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating user level:", error);
    }

    return level;
  }

  private async ensureUserProfile(userId: string) {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !profile) {
      const { data: newProfile, error: insertError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: userId,
          username: null,
          bio: null,
          avatar_src: null,
        })
        .select("*")
        .single();

      if (insertError || !newProfile) {
        console.error("Error creating user_profile:", insertError);
        throw ApiError.BadRequest("Failed to create user profile");
      }
      return newProfile;
    }
    return profile;
  }

  private async getRepaintsCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from("pixels")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      console.error("Error getting repaints count:", error);
      return 0;
    }
    return count || 0;
  }

  private async getUserCreatedAt(userId: string): Promise<string> {
    const { data: user, error } = await supabase
      .from("users")
      .select("created_at")
      .eq("id", userId)
      .single();

    if (error || !user) {
      console.error("Error getting user created_at:", error);
      return new Date().toISOString();
    }
    return user.created_at;
  }

  public async getCurrentProfile(userId: string): Promise<IProfileData> {
    if (!userId) {
      throw ApiError.UnauthorizedError();
    }

    const [profile, repaints, createdAt] = await Promise.all([
      this.ensureUserProfile(userId),
      this.getRepaintsCount(userId),
      this.getUserCreatedAt(userId),
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

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, created_at")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      throw ApiError.NotFound("User not found");
    }

    const [profile, repaints] = await Promise.all([
      this.ensureUserProfile(userId),
      this.getRepaintsCount(userId),
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

    const { data: updatedProfile, error } = await supabase
      .from("user_profiles")
      .update(updateData)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !updatedProfile) {
      console.error("Error updating profile:", error);
      throw ApiError.BadRequest("Failed to update profile");
    }

    return this.getCurrentProfile(userId);
  }
}

export { ProfileService };
