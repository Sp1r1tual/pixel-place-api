import type {
  IUserEnergy,
  IPixelRow,
  IPixelInsert,
  IUserStats,
} from "../../types/index.js";

import { supabase } from "../../index.js";

class CanvasModel {
  async findUserStats(userId: string): Promise<IUserStats | null> {
    const { data, error } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single<IUserStats>();

    if (error || !data) {
      return null;
    }
    return data;
  }

  async createUserStats(userId: string): Promise<IUserStats> {
    const { data, error } = await supabase
      .from("user_stats")
      .insert({
        user_id: userId,
        currency: 0,
        energy_limit_level: 0,
        recovery_speed_level: 0,
        pixel_reward_level: 0,
      })
      .select("*")
      .single<IUserStats>();

    if (error || !data) {
      throw new Error("Failed to create user stats");
    }
    return data;
  }

  async updateUserCurrency(userId: string, currency: number): Promise<void> {
    const { error } = await supabase
      .from("user_stats")
      .update({ currency })
      .eq("user_id", userId);

    if (error) {
      throw new Error("Failed to update currency");
    }
  }

  async findUserEnergy(userId: string): Promise<IUserEnergy | null> {
    const { data, error } = await supabase
      .from("user_energy")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Supabase error [findUserEnergy]:", error);
    }

    return data || null;
  }

  async createUserEnergy(
    userId: string,
    energy: number,
    maxEnergy: number,
    updatedAt: string,
  ): Promise<IUserEnergy> {
    const { data, error } = await supabase
      .from("user_energy")
      .insert({
        user_id: userId,
        energy,
        max_energy: maxEnergy,
        updated_at: updatedAt,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error("Failed to create user energy");
    }
    return data;
  }

  async updateUserEnergy(
    userId: string,
    energy: number,
    updatedAt: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("user_energy")
      .update({ energy, updated_at: updatedAt })
      .eq("user_id", userId);

    if (error) {
      console.error("Supabase error [updateUserEnergy]:", error);
    }
  }

  async upsertPixels(pixels: IPixelInsert[]): Promise<void> {
    const { error } = await supabase
      .from("pixels")
      .upsert(pixels, { onConflict: "x, y" });

    if (error) {
      throw new Error(`Failed to upsert pixels: ${error.message}`);
    }
  }

  async getAllPixels(from: number, batchSize: number): Promise<IPixelRow[]> {
    const { data, error } = await supabase
      .from("pixels")
      .select("x, y, color, user_id, placed_at")
      .order("placed_at", { ascending: true })
      .range(from, from + batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch pixels: ${error.message}`);
    }

    return (data as IPixelRow[]) || [];
  }
}

export { CanvasModel };
