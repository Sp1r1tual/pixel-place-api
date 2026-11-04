import type {
  IShopResponse,
  ItemType,
  StatLevelKey,
} from "../../types/index.js";

import { ShopModel } from "../models/shop-model.js";

const PRICE_MULTIPLIER = 1.25;
const BASE_MAX_ENERGY = 10;

const STAT_KEYS: Record<ItemType, StatLevelKey> = {
  energy_limit: "energy_limit_level",
  recovery_speed: "recovery_speed_level",
  pixel_reward: "pixel_reward_level",
};

// Prices and effects shown here mirror the rules enforced by upgrade_item in the database.
const calculatePrice = (basePrice: number, level: number): number =>
  Math.floor(basePrice * Math.pow(PRICE_MULTIPLIER, level));

const calculateEffectValue = (itemType: ItemType, level: number): number => {
  switch (itemType) {
    case "energy_limit":
      return BASE_MAX_ENERGY + level;
    case "recovery_speed":
      return Math.max(60 - level * 3, 24);
    case "pixel_reward":
      return level + 1;
  }
};

const isItemType = (value: unknown): value is ItemType =>
  typeof value === "string" && Object.hasOwn(STAT_KEYS, value);

class ShopService {
  private readonly shopModel = new ShopModel();

  async getShopItems(userId: string): Promise<IShopResponse> {
    const [userStats, shopItems] = await Promise.all([
      this.shopModel.ensureUserStats(userId),
      this.shopModel.getAllShopItems(),
    ]);

    const items = shopItems.map((item) => {
      const level = userStats[STAT_KEYS[item.type]];

      return {
        id: item.id,
        name: item.name,
        type: item.type,
        level,
        maxLevel: item.max_level,
        price: calculatePrice(item.base_price, level),
        effectValue: calculateEffectValue(item.type, level),
        image_url: item.image_url,
      };
    });

    return { items, currency: userStats.currency };
  }

  async upgradeItem(userId: string, itemType: ItemType) {
    const { level, currency } = await this.shopModel.upgradeItem(
      userId,
      itemType,
    );
    const effectValue = calculateEffectValue(itemType, level);

    return {
      updatedStat: level,
      currency,
      effectValue,
      recoverySpeed: itemType === "recovery_speed" ? effectValue : undefined,
    };
  }
}

export { ShopService, isItemType };
