import type { IPixel, IEnergyResult } from "../../types/canvas.js";
import type { IUserStats } from "../../types/shop.js";

import { supabase } from "../../index.js";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { CANVAS_ERRORS } from "../utils/errors/errors-messages.js";

interface IEnergyResultWithSpeed extends IEnergyResult {
  recoverySpeed?: number;
}

class CanvasService {
  private readonly DEFAULT_MAX_ENERGY = 10;
  private readonly BASE_RECOVERY_INTERVAL_SECONDS = 60;
  private readonly MIN_RECOVERY_INTERVAL_SECONDS = 24;

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

  private async ensureUserStats(userId: string): Promise<IUserStats> {
    const { data: userStats, error } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single<IUserStats>();

    if (error || !userStats) {
      const { data: newStats, error: insertError } = await supabase
        .from("user_stats")
        .insert({
          user_id: userId,
          currency: 0,
          energyLimitLevel: 0,
          recoverySpeedLevel: 0,
          pixelRewardLevel: 0,
        })
        .select("*")
        .single<IUserStats>();

      if (insertError || !newStats) {
        console.error("Error creating user_stats:", insertError);
        throw ApiError.BadRequest("Failed to create user stats");
      }
      return newStats;
    }
    return userStats;
  }

  private async getUserStats(userId: string): Promise<IUserStats> {
    return await this.ensureUserStats(userId);
  }

  private async getUserEnergyRow(userId: string) {
    try {
      const { data, error } = await supabase
        .from("user_energy")
        .select("*")
        .eq("user_id", userId)
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Supabase error [getUserEnergyRow]:", error);
      }

      if (!data) {
        const now = new Date();
        const { data: newRow, error: insertError } = await supabase
          .from("user_energy")
          .insert({
            user_id: userId,
            energy: this.DEFAULT_MAX_ENERGY,
            max_energy: this.DEFAULT_MAX_ENERGY,
            updated_at: now.toISOString(),
          })
          .select("*")
          .single();

        if (insertError) {
          console.error("Supabase error [insertUserEnergyRow]:", insertError);
          throw ApiError.BadRequest(
            `${CANVAS_ERRORS.dbError}: ${insertError.message}`,
          );
        }
        return newRow;
      }
      return data;
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
    const { error } = await supabase
      .from("user_energy")
      .update({ energy, updated_at: now.toISOString() })
      .eq("user_id", userId);

    if (error) console.error("Supabase error [updateEnergyRow]:", error);
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
    const { error } = await supabase
      .from("user_stats")
      .update({ currency: userStats.currency + amount })
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating currency:", error);
      throw ApiError.BadRequest("Failed to update currency");
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
      userStats.recoverySpeedLevel,
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
      this.calculatePixelReward(userStats.pixelRewardLevel) * pixelCount;

    const pixelsToInsert = pixels.map((pixel) => ({
      ...pixel,
      user_id: userId,
      placed_at: new Date().toISOString(),
    }));

    const [pixelsError, currencyError] = await Promise.allSettled([
      supabase.from("pixels").upsert(pixelsToInsert, { onConflict: "x, y" }),
      this.addCurrencyReward(userId, currencyReward),
    ]);

    if (pixelsError.status === "rejected" || pixelsError.value.error) {
      const error =
        pixelsError.status === "rejected"
          ? pixelsError.reason
          : pixelsError.value.error;
      console.error("Supabase error [placePixelsBatch]:", error);
      throw ApiError.BadRequest(`${CANVAS_ERRORS.dbError}: ${error.message}`);
    }

    if (currencyError.status === "rejected") {
      console.error("Currency update error:", currencyError.reason);
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
    const { data, error } = await supabase
      .from("pixels")
      .select("x, y, color, user_id");

    if (error) {
      console.error("Supabase error [getAllPixels]:", error);
      throw ApiError.BadRequest(`${CANVAS_ERRORS.dbError}: ${error.message}`);
    }

    return (data || []).map((p) => ({
      x: p.x,
      y: p.y,
      color: p.color,
      userId: p.user_id,
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
      userStats.recoverySpeedLevel,
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

    if (regeneratedEnergy !== row.energy) {
      await this.updateEnergyRow(userId, regeneratedEnergy, now);
    }

    return {
      energy: regeneratedEnergy,
      maxEnergy,
      recoverySpeed: recoveryIntervalSeconds,
    };
  }
}

export { CanvasService };
