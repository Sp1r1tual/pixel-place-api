import type {
  IUserStats,
  IShopItemRecord,
  IUserEnergy,
} from "../../types/index.js";

import { supabase } from "../../index.js";

class ShopModel {
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
      .select()
      .single<IUserStats>();

    if (error || !data) {
      throw new Error("Failed to create user stats");
    }
    return data;
  }

  async updateUserStats(
    userId: string,
    updates: Partial<IUserStats>,
  ): Promise<void> {
    const { error } = await supabase
      .from("user_stats")
      .update(updates)
      .eq("user_id", userId);

    if (error) {
      throw new Error("Failed to update user stats");
    }
  }

  async getAllShopItems(): Promise<IShopItemRecord[]> {
    const { data, error } = await supabase.from("shop_items").select("*");

    if (error || !data) {
      throw new Error("Failed to fetch shop items");
    }
    return data as IShopItemRecord[];
  }

  async findShopItemByType(
    type: "energy_limit" | "recovery_speed" | "pixel_reward",
  ): Promise<IShopItemRecord | null> {
    const { data, error } = await supabase
      .from("shop_items")
      .select("*")
      .eq("type", type)
      .single<IShopItemRecord>();

    if (error || !data) {
      return null;
    }
    return data;
  }

  async findUserEnergy(userId: string): Promise<IUserEnergy | null> {
    const { data, error } = await supabase
      .from("user_energy")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return null;
    }
    return data;
  }

  async updateUserEnergy(
    energyId: string,
    updates: Partial<Omit<IUserEnergy, "id" | "user_id">>,
  ): Promise<void> {
    const { error } = await supabase
      .from("user_energy")
      .update(updates)
      .eq("id", energyId);

    if (error) {
      throw new Error("Failed to update user energy");
    }
  }

  async createUserEnergy(
    userId: string,
    energy: number,
    maxEnergy: number,
  ): Promise<void> {
    const { error } = await supabase.from("user_energy").insert({
      user_id: userId,
      energy,
      max_energy: maxEnergy,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error("Failed to create user energy");
    }
  }
}

export { ShopModel };
