export interface IUserStats {
  user_id: string;
  currency: number;
  energy_limit_level: number;
  recovery_speed_level: number;
  pixel_reward_level: number;
  repaints: number;
  level: number;
}

export interface IShopItem {
  id: string;
  name: string;
  type: "energy_limit" | "recovery_speed" | "pixel_reward";
  level: number;
  maxLevel: number;
  price: number;
  effectValue: number;
  image_url: string;
}

export interface IShopResponse {
  items: IShopItem[];
  currency: number;
}

export interface IShopItemRecord {
  id: string;
  name: string;
  type: "energy_limit" | "recovery_speed" | "pixel_reward";
  base_price: number;
  max_level: number;
  image_url: string;
}

export type ItemType = "energy_limit" | "recovery_speed" | "pixel_reward";

export type StatLevelKey =
  | "energy_limit_level"
  | "recovery_speed_level"
  | "pixel_reward_level";
