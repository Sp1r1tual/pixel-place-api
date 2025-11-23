export interface IUserStats {
  user_id: string;
  currency: number;
  energy_limit_level: number;
  recovery_speed_level: number;
  pixel_reward_level: number;
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
