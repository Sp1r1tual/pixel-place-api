import type { IUserStats, IShopResponse } from "../../types/shop.js";

import { supabase } from "../../index.js";

import { ApiError } from "../../shared/exceptions/api-error.js";

interface IShopItemRecord {
  id: string;
  name: string;
  type: "energyLimit" | "recoverySpeed" | "pixelReward";
  basePrice: number;
  maxLevel: number;
  image_url: string;
}

class ShopService {
  private priceMultiplier = 1.5;
  private maxLevel = 10;
  private baseMaxEnergy = 10;

  async getShopItems(userId: string): Promise<IShopResponse> {
    const { data: userStatsArr, error: statsError } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId);

    let userStats = userStatsArr?.[0];

    if (!userStats) {
      const { data: newStats, error: insertError } = await supabase
        .from("user_stats")
        .insert({
          user_id: userId,
          currency: 0,
          energyLimitLevel: 0,
          recoverySpeedLevel: 0,
          pixelRewardLevel: 0,
        })
        .select()
        .single<IUserStats>();

      if (insertError || !newStats)
        throw ApiError.BadRequest("shop.user-stats-not-found");

      userStats = newStats;
    }

    if (statsError) throw ApiError.BadRequest(statsError.message);

    const { data: shopDefaults, error: shopError } = await supabase
      .from("shop_items")
      .select("*");

    if (shopError || !shopDefaults)
      throw ApiError.BadRequest("shop.cannot-fetch");

    const items = (shopDefaults as IShopItemRecord[]).map((item) => {
      const level = userStats[`${item.type}Level`] || 0;
      const price = Math.floor(
        item.basePrice * Math.pow(this.priceMultiplier, level),
      );

      let effectValue: number;
      switch (item.type) {
        case "energyLimit":
          effectValue = this.baseMaxEnergy + level;
          break;
        case "recoverySpeed":
          effectValue = Math.max(60 - level * 3, 30);
          break;
        case "pixelReward":
          effectValue = level + 1;
          break;
      }

      return {
        id: item.id,
        name: item.name,
        type: item.type,
        level,
        maxLevel: this.maxLevel,
        price,
        effectValue,
        image_url: item.image_url,
      };
    });

    return {
      items,
      currency: userStats.currency,
    };
  }

  async upgradeItem(
    userId: string,
    itemType: "energyLimit" | "recoverySpeed" | "pixelReward",
  ) {
    const { data: userStats, error: statsError } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single<IUserStats>();

    if (statsError || !userStats)
      throw ApiError.BadRequest("shop.user-stats-not-found");

    const currentLevel = userStats[`${itemType}Level`] || 0;

    if (currentLevel >= this.maxLevel)
      throw ApiError.BadRequest("shop.item-max-level");

    const { data: shopItem, error: shopError } = await supabase
      .from("shop_items")
      .select("*")
      .eq("type", itemType)
      .single<IShopItemRecord>();

    if (shopError || !shopItem)
      throw ApiError.BadRequest("shop.shop-item-not-found");

    const price = Math.floor(
      shopItem.basePrice * Math.pow(this.priceMultiplier, currentLevel),
    );

    if (userStats.currency < price)
      throw ApiError.BadRequest("shop.not-enough-currency");

    const updateData: Partial<IUserStats> = {
      currency: userStats.currency - price,
      [`${itemType}Level`]: currentLevel + 1,
    };

    if (itemType === "energyLimit") {
      const { data: energyRow } = await supabase
        .from("user_energy")
        .select("*")
        .eq("user_id", userId)
        .single();

      const newMax = (energyRow?.max_energy ?? this.baseMaxEnergy) + 1;
      const newEnergy = (energyRow?.energy ?? this.baseMaxEnergy) + 1;

      const energyUpdateData = {
        max_energy: newMax,
        energy: newEnergy,
        updated_at: new Date().toISOString(),
      };

      if (energyRow) {
        await supabase
          .from("user_energy")
          .update(energyUpdateData)
          .eq("id", energyRow.id);
      } else {
        await supabase
          .from("user_energy")
          .insert({ ...energyUpdateData, user_id: userId });
      }
    }

    const { error: updateError } = await supabase
      .from("user_stats")
      .update(updateData)
      .eq("user_id", userId);

    if (updateError) throw ApiError.BadRequest(updateError.message);

    let effectValue: number;
    const newLevel = currentLevel + 1;
    switch (itemType) {
      case "energyLimit":
        effectValue = this.baseMaxEnergy + newLevel;
        break;
      case "recoverySpeed":
        effectValue = Math.max(60 - newLevel * 3, 30);
        break;
      case "pixelReward":
        effectValue = newLevel + 1;
        break;
    }

    return {
      updatedStat: newLevel,
      currency: userStats.currency - price,
      effectValue,
    };
  }
}

export { ShopService };
