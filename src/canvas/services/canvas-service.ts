import type {
  IEnergyResultWithSpeed,
  IPixel,
  IEnergyResult,
  IUserStats,
  IPixelRow,
} from "../../types/index.js";

import { CanvasModel } from "../models/canvas-model.js";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { CANVAS_ERRORS } from "../utils/errors/errors-messages.js";
import { formatDateTime } from "../../shared/utils/format-date.js";

class CanvasService {
  private readonly DEFAULT_MAX_ENERGY = 10;
  private readonly BASE_RECOVERY_INTERVAL_SECONDS = 60;
  private readonly MIN_RECOVERY_INTERVAL_SECONDS = 24;
  private readonly MAX_LEVEL = 100;
  private readonly BASE_EXP_REQUIRED = 10;
  private readonly canvasModel: CanvasModel;

  constructor() {
    this.canvasModel = new CanvasModel();
  }

  private calculateElapsedSeconds(lastUpdated: Date, now: Date): number {
    return Math.max(
      0,
      Math.floor((now.getTime() - lastUpdated.getTime()) / 1000),
    );
  }

  private calculateRecoveryIntervalSeconds(recoverySpeedLevel: number): number {
    const interval =
      this.BASE_RECOVERY_INTERVAL_SECONDS - recoverySpeedLevel * 3;
    return Math.max(interval, this.MIN_RECOVERY_INTERVAL_SECONDS);
  }

  private calculatePixelReward(pixelRewardLevel: number): number {
    return 1 + pixelRewardLevel;
  }

  private calculateExpForLevel(level: number): number {
    return this.BASE_EXP_REQUIRED + (level - 1);
  }

  private calculateLevelFromRepaints(repaints: number): number {
    let level = 1;
    let remainingExp = repaints;

    for (let i = 1; i <= this.MAX_LEVEL; i++) {
      const expForLevel = this.calculateExpForLevel(i);

      if (remainingExp >= expForLevel) {
        remainingExp -= expForLevel;
        level = i + 1;
      } else {
        break;
      }
    }

    return Math.min(level, this.MAX_LEVEL);
  }

  private async ensureUserStats(userId: string): Promise<IUserStats> {
    let userStats = await this.canvasModel.findUserStats(userId);

    if (!userStats) {
      try {
        userStats = await this.canvasModel.createUserStats(userId);
      } catch (error) {
        console.error("Error creating user_stats:", error);
        throw ApiError.BadRequest("Failed to create user stats");
      }
    }
    return userStats;
  }

  private async getUserStats(userId: string): Promise<IUserStats> {
    return await this.ensureUserStats(userId);
  }

  private async getUserEnergyRow(userId: string) {
    try {
      let energyRow = await this.canvasModel.findUserEnergy(userId);

      if (!energyRow) {
        const now = new Date();
        energyRow = await this.canvasModel.createUserEnergy(
          userId,
          this.DEFAULT_MAX_ENERGY,
          this.DEFAULT_MAX_ENERGY,
          now.toISOString(),
        );
      }
      return energyRow;
    } catch (err) {
      console.error("Error getting user energy row:", err);
      throw ApiError.BadRequest(`${CANVAS_ERRORS.dbError}: ${err}`);
    }
  }

  private async updateEnergyRow(
    userId: string,
    energy: number,
    now: Date,
  ): Promise<void> {
    await this.canvasModel.updateUserEnergy(userId, energy, now.toISOString());
  }

  private validatePixel(pixel: IPixel): void {
    const { x, y, color } = pixel;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !color.startsWith("#")
    ) {
      throw ApiError.BadRequest(CANVAS_ERRORS.invalidPixel);
    }
  }

  private async addCurrencyReward(
    userId: string,
    amount: number,
  ): Promise<void> {
    const userStats = await this.ensureUserStats(userId);
    try {
      await this.canvasModel.updateUserCurrency(
        userId,
        userStats.currency + amount,
      );
    } catch (error) {
      console.error("Error updating currency:", error);
      throw ApiError.BadRequest("Failed to update currency");
    }
  }

  private async incrementRepaintsAndUpdateLevel(
    userId: string,
    pixelsCount: number,
  ): Promise<void> {
    try {
      const userStats = await this.getUserStats(userId);
      const currentRepaints = userStats.repaints || 0;
      const newRepaints = currentRepaints + pixelsCount;

      const newLevel = this.calculateLevelFromRepaints(newRepaints);

      await this.canvasModel.updateRepaintsAndLevel(
        userId,
        newRepaints,
        newLevel,
      );
    } catch (error) {
      console.error("Error updating repaints and level:", error);
      throw ApiError.BadRequest("Failed to update repaints and level");
    }
  }

  public async useEnergy(
    userId: string,
    amount: number,
  ): Promise<IEnergyResult> {
    if (amount <= 0)
      throw ApiError.BadRequest(CANVAS_ERRORS.invalidEnergyAmount);

    const now = new Date();
    const row = await this.getUserEnergyRow(userId);
    const userStats = await this.getUserStats(userId);

    const maxEnergy = row.max_energy || this.DEFAULT_MAX_ENERGY;
    const recoveryInterval = this.calculateRecoveryIntervalSeconds(
      userStats.recovery_speed_level,
    );
    const elapsedSeconds = this.calculateElapsedSeconds(
      new Date(row.updated_at),
      now,
    );
    const regeneratedAmount = Math.max(
      0,
      Math.floor(elapsedSeconds / recoveryInterval),
    );
    const regeneratedEnergy = Math.min(
      row.energy + regeneratedAmount,
      maxEnergy,
    );
    const newEnergy = regeneratedEnergy - amount;

    if (newEnergy < 0) throw ApiError.Forbidden(CANVAS_ERRORS.notEnoughEnergy);

    await this.updateEnergyRow(userId, newEnergy, now);
    return { energy: newEnergy, maxEnergy };
  }

  public async placePixelsBatch(
    userId: string,
    pixels: IPixel[],
  ): Promise<IEnergyResult & { currencyEarned: number }> {
    pixels.forEach((pixel) => this.validatePixel(pixel));

    const pixelCount = pixels.length;

    const [userStats, energyResult] = await Promise.all([
      this.getUserStats(userId),
      this.useEnergy(userId, pixelCount),
    ]);

    const currencyReward =
      this.calculatePixelReward(userStats.pixel_reward_level) * pixelCount;

    const pixelsToInsert = pixels.map((pixel) => ({
      x: pixel.x,
      y: pixel.y,
      color: pixel.color,
      user_id: userId,
      placed_at: new Date().toISOString(),
    }));

    try {
      await this.canvasModel.upsertPixels(pixelsToInsert);
    } catch (error) {
      console.error("Error placing pixels:", error);
      throw ApiError.BadRequest(`${CANVAS_ERRORS.dbError}: ${error}`);
    }

    try {
      await this.addCurrencyReward(userId, currencyReward);
    } catch (currencyError) {
      console.error("Currency update error:", currencyError);
    }

    try {
      await this.incrementRepaintsAndUpdateLevel(userId, pixelCount);
    } catch (levelError) {
      console.error("Level update error:", levelError);
    }

    return {
      ...energyResult,
      currencyEarned: currencyReward,
    };
  }

  public async placePixel(
    userId: string,
    pixel: IPixel,
  ): Promise<IEnergyResult & { currencyEarned: number }> {
    return this.placePixelsBatch(userId, [pixel]);
  }

  public async getAllPixels(): Promise<IPixel[]> {
    let allPixels: IPixelRow[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      try {
        const data = await this.canvasModel.getAllPixels(from, batchSize);

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allPixels = allPixels.concat(data);
          from += batchSize;

          if (data.length < batchSize) {
            hasMore = false;
          }
        }
      } catch (error) {
        console.error("Error fetching pixels:", error);
        throw ApiError.BadRequest(`${CANVAS_ERRORS.dbError}: ${error}`);
      }
    }

    return allPixels.map((p) => ({
      x: p.x,
      y: p.y,
      color: p.color,
      userId: p.user_id,
      placedAt: formatDateTime(p.placed_at),
    }));
  }

  public async getEnergy(userId: string): Promise<IEnergyResultWithSpeed> {
    const now = new Date();
    const [row, userStats] = await Promise.all([
      this.getUserEnergyRow(userId),
      this.getUserStats(userId),
    ]);

    const maxEnergy = row.max_energy || this.DEFAULT_MAX_ENERGY;
    const recoveryIntervalSeconds = this.calculateRecoveryIntervalSeconds(
      userStats.recovery_speed_level,
    );
    const elapsedSeconds = this.calculateElapsedSeconds(
      new Date(row.updated_at),
      now,
    );
    const regeneratedAmount = Math.max(
      0,
      Math.floor(elapsedSeconds / recoveryIntervalSeconds),
    );
    const regeneratedEnergy = Math.min(
      row.energy + regeneratedAmount,
      maxEnergy,
    );

    const finalUpdatedAt =
      regeneratedEnergy !== row.energy ? now : new Date(row.updated_at);

    if (regeneratedEnergy !== row.energy) {
      await this.updateEnergyRow(userId, regeneratedEnergy, now);
    }

    return {
      energy: regeneratedEnergy,
      maxEnergy,
      recoverySpeed: recoveryIntervalSeconds,
      updatedAt: finalUpdatedAt.toISOString(),
    };
  }
}

export { CanvasService };
