export interface IUserEnergy {
  id: string;
  user_id: string;
  energy: number;
  max_energy: number;
  updated_at: string;
}

export interface IPixelRow {
  x: number;
  y: number;
  color: string;
  user_id: string;
  placed_at: string;
}

export interface IPixelInsert {
  x: number;
  y: number;
  color: string;
  user_id: string;
  placed_at: string;
}

export interface IEnergyResultWithSpeed extends IEnergyResult {
  recoverySpeed: number;
  updatedAt: string;
}

export interface IEnergyResult {
  energy: number;
  maxEnergy: number;
}

export interface IPixel {
  x: number;
  y: number;
  color: string;
  userId: string;
  placedAt: string;
}
