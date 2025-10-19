export interface IPixel {
  x: number;
  y: number;
  color: string;
  userId?: string;
}

export interface IEnergyResult {
  energy: number;
  maxEnergy: number;
}
