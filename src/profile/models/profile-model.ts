import { supabase } from "../../index.js";

import { IUserProfile, IProfileUser } from "../../types/profile.js";

class ProfileRModel {
  async findProfileByUserId(userId: string): Promise<IUserProfile | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return null;
    }
    return data;
  }

  async createProfile(userId: string): Promise<IUserProfile> {
    const { data, error } = await supabase
      .from("user_profiles")
      .insert({
        user_id: userId,
        username: null,
        bio: null,
        avatar_src: null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error("Failed to create user profile");
    }
    return data;
  }

  async updateProfile(
    userId: string,
    updates: Partial<Omit<IUserProfile, "user_id">>,
  ): Promise<IUserProfile> {
    const { data, error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error("Failed to update profile");
    }
    return data;
  }

  async updateUserLevel(userId: string, level: number): Promise<void> {
    const { error } = await supabase
      .from("user_stats")
      .update({ level })
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating user level:", error);
    }
  }

  async getRepaintsCount(userId: string): Promise<number> {
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

  async findUserById(userId: string): Promise<IProfileUser | null> {
    const { data, error } = await supabase
      .from("users")
      .select("id, created_at")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return null;
    }
    return data;
  }

  async getUserCreatedAt(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from("users")
      .select("created_at")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.error("Error getting user created_at:", error);
      return new Date().toISOString();
    }
    return data.created_at;
  }
}

export { ProfileRModel };
