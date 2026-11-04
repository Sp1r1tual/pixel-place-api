import { supabase } from "../../shared/configs/supabase.js";

import { IUserProfile, IProfileUser } from "../../types/profile.js";

class ProfileRModel {
  async findProfileByUserId(userId: string): Promise<IUserProfile | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Creates or updates in one statement, so concurrent first writes cannot collide. */
  async saveProfile(
    userId: string,
    updates: Partial<Omit<IUserProfile, "user_id">>,
  ): Promise<void> {
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" });

    if (error) throw error;
  }

  async getUserStats(
    userId: string,
  ): Promise<{ level: number; repaints: number } | null> {
    const { data, error } = await supabase
      .from("user_stats")
      .select("level, repaints")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findUserById(userId: string): Promise<IProfileUser | null> {
    const { data, error } = await supabase
      .from("users")
      .select("id, created_at")
      .eq("id", userId)
      .maybeSingle();

    // 22P02: the id in the URL is not a valid UUID, so no such user exists.
    if (error && error.code !== "22P02") throw error;
    return data;
  }
}

export { ProfileRModel };
