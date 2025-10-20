export interface IUserStats {
  user_id: string;
  currency: number;
  energyLimitLevel: number;
  recoverySpeedLevel: number;
  pixelRewardLevel: number;
}

export interface IShopItem {
  id: string;
  name: string;
  type: "energyLimit" | "recoverySpeed" | "pixelReward";
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
