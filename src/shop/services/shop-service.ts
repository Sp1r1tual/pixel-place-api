import type {
  IUserStats,
  IShopResponse,
  ItemType,
  StatLevelKey,
} from "../../types/index.js";

import { ShopModel } from "../models/shop-model.js";

import { ApiError } from "../../shared/exceptions/api-error.js";

class ShopService {
  private priceMultiplier = 1.25;
  private maxLevel = 12;
  private baseMaxEnergy = 10;
  private readonly shopModel: ShopModel;

  constructor() {
    this.shopModel = new ShopModel();
  }

  private getStatKey(itemType: ItemType): StatLevelKey {
    const mapping: Record<ItemType, StatLevelKey> = {
      energy_limit: "energy_limit_level",
      recovery_speed: "recovery_speed_level",
      pixel_reward: "pixel_reward_level",
    };
    return mapping[itemType];
  }

  private calculatePrice(basePrice: number, currentLevel: number): number {
    return Math.floor(basePrice * Math.pow(this.priceMultiplier, currentLevel));
  }

  private calculateEffectValue(itemType: ItemType, level: number): number {
    switch (itemType) {
      case "energy_limit":
        return this.baseMaxEnergy + level;
      case "recovery_speed":
        return Math.max(60 - level * 3, 24);
      case "pixel_reward":
        return level + 1;
    }
  }

  private async ensureUserStats(userId: string): Promise<IUserStats> {
    let userStats = await this.shopModel.findUserStats(userId);

    if (!userStats) {
      try {
        userStats = await this.shopModel.createUserStats(userId);
      } catch {
        throw ApiError.BadRequest("shop.user-stats-not-found");
      }
    }

    return userStats;
  }

  async getShopItems(userId: string): Promise<IShopResponse> {
    const userStats = await this.ensureUserStats(userId);

    let shopDefaults;
    try {
      shopDefaults = await this.shopModel.getAllShopItems();
    } catch {
      throw ApiError.BadRequest("shop.cannot-fetch");
    }

    const items = shopDefaults.map((item) => {
      const statKey = this.getStatKey(item.type);
      const level = userStats[statKey] || 0;
      const price = this.calculatePrice(item.base_price, level);
      const effectValue = this.calculateEffectValue(item.type, level);

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
    const userStats = await this.shopModel.findUserStats(userId);

    if (!userStats) {
      throw ApiError.BadRequest("shop.user-stats-not-found");
    }

    if (userStats.currency == null) {
      throw ApiError.BadRequest("shop.invalid-currency-state");
    }

    const statKey = this.getStatKey(itemType);
    const currentLevel = userStats[statKey] || 0;

    if (currentLevel >= this.maxLevel) {
      throw ApiError.BadRequest("shop.item-max-level");
    }

    const shopItem = await this.shopModel.findShopItemByType(itemType);

    if (!shopItem) {
      throw ApiError.BadRequest("shop.shop-item-not-found");
    }

    const price = this.calculatePrice(shopItem.base_price, currentLevel);

    if (userStats.currency < price) {
      throw ApiError.BadRequest("shop.not-enough-currency");
    }

    const newCurrency = userStats.currency - price;
    const newLevel = currentLevel + 1;

    const updateData: Partial<IUserStats> = {
      currency: newCurrency,
      [statKey]: newLevel,
    };

    if (itemType === "energy_limit") {
      await this.updateEnergyLimit(userId);
    }

    try {
      await this.shopModel.updateUserStats(userId, updateData);
    } catch {
      throw ApiError.BadRequest("Failed to upgrade item");
    }

    const effectValue = this.calculateEffectValue(itemType, newLevel);

    return {
      updatedStat: newLevel,
      currency: newCurrency,
      effectValue,
      recoverySpeed: itemType === "recovery_speed" ? effectValue : undefined,
    };
  }

  private async updateEnergyLimit(userId: string): Promise<void> {
    const energyRow = await this.shopModel.findUserEnergy(userId);

    const currentMax = energyRow?.max_energy ?? this.baseMaxEnergy;
    const currentEnergy = energyRow?.energy ?? this.baseMaxEnergy;

    const newMax = currentMax + 1;
    const newEnergy = currentEnergy + 1;

    if (energyRow) {
      await this.shopModel.updateUserEnergy(energyRow.id, {
        max_energy: newMax,
        energy: newEnergy,
        updated_at: new Date().toISOString(),
      });
    } else {
      await this.shopModel.createUserEnergy(userId, newEnergy, newMax);
    }
  }
}

export { ShopService };
