export interface IPixelRow {
  x: number;
  y: number;
  color: string;
  user_id: string;
  placed_at: string;
}

export interface IPixelInput {
  x: number;
  y: number;
  color: string;
}

export interface IEnergyState {
  energy: number;
  maxEnergy: number;
  recoverySpeed: number;
  updatedAt: string;
}

export interface IPlacePixelsResult extends IEnergyState {
  placedAt: string;
  currencyEarned: number;
}

export interface IPixel extends IPixelInput {
  userId: string;
  placedAt: string;
}
