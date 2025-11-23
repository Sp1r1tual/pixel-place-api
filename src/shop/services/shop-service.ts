import type { IUserStats, IShopResponse } from "../../types/shop.js";
import { supabase } from "../../index.js";
import { ApiError } from "../../shared/exceptions/api-error.js";

interface IShopItemRecord {
  id: string;
  name: string;
  type: "energy_limit" | "recovery_speed" | "pixel_reward";
  base_price: number;
  max_level: number;
  image_url: string;
}

type ItemType = "energy_limit" | "recovery_speed" | "pixel_reward";
type StatLevelKey =
  | "energy_limit_level"
  | "recovery_speed_level"
  | "pixel_reward_level";

class ShopService {
  private priceMultiplier = 1.25;
  private maxLevel = 12;
  private baseMaxEnergy = 10;

  private getStatKey(itemType: ItemType): StatLevelKey {
    const mapping: Record<ItemType, StatLevelKey> = {
      energy_limit: "energy_limit_level",
      recovery_speed: "recovery_speed_level",
      pixel_reward: "pixel_reward_level",
    };
    return mapping[itemType];
  }

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
          energy_limit_level: 0,
          recovery_speed_level: 0,
          pixel_reward_level: 0,
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
      const statKey = this.getStatKey(item.type);
      const level = userStats[statKey] || 0;
      const price = Math.floor(
        item.base_price * Math.pow(this.priceMultiplier, level),
      );

      let effectValue: number;
      switch (item.type) {
        case "energy_limit":
          effectValue = this.baseMaxEnergy + level;
          break;
        case "recovery_speed":
          effectValue = Math.max(60 - level * 3, 24);
          break;
        case "pixel_reward":
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

  async upgradeItem(userId: string, itemType: ItemType) {
    const { data: userStats, error: statsError } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single<IUserStats>();

    if (statsError || !userStats)
      throw ApiError.BadRequest("shop.user-stats-not-found");

    if (userStats.currency == null) {
      throw ApiError.BadRequest("shop.invalid-currency-state");
    }

    const statKey = this.getStatKey(itemType);
    const currentLevel = userStats[statKey] || 0;

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
      Number(shopItem.base_price) *
        Math.pow(this.priceMultiplier, currentLevel),
    );

    if (userStats.currency < price)
      throw ApiError.BadRequest("shop.not-enough-currency");

    const newCurrency = userStats.currency - price;

    const updateData: Partial<IUserStats> = {
      currency: newCurrency,
      [statKey]: currentLevel + 1,
    };

    if (itemType === "energy_limit") {
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
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      throw ApiError.BadRequest(updateError.message);
    }

    let effectValue: number;
    const newLevel = currentLevel + 1;
    switch (itemType) {
      case "energy_limit":
        effectValue = this.baseMaxEnergy + newLevel;
        break;
      case "recovery_speed":
        effectValue = Math.max(60 - newLevel * 3, 24);
        break;
      case "pixel_reward":
        effectValue = newLevel + 1;
        break;
    }

    return {
      updatedStat: newLevel,
      currency: newCurrency,
      effectValue,
      recoverySpeed: itemType === "recovery_speed" ? effectValue : undefined,
    };
  }
}

export { ShopService };
