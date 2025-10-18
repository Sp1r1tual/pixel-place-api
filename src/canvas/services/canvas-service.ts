import { supabase } from "../../index.js";

import { IPixel, IEnergyResult } from "../../types/canvas.js";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { CANVAS_ERRORS } from "../utils/errors/errors-messages.js";

class CanvasService {
  private readonly DEFAULT_MAX_ENERGY = 10;

  private calculateElapsedMinutes(lastUpdated: Date, now: Date) {
    return Math.floor((now.getTime() - lastUpdated.getTime()) / 60000);
  }

  private async getUserEnergyRow(userId: string) {
    const { data, error } = await supabase
      .from("user_energy")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116")
      throw ApiError.BadRequest(`${CANVAS_ERRORS.dbError}: ${error.message}`);
    return data;
  }

  private async updateEnergyRow(userId: string, energy: number, now: Date) {
    const { error } = await supabase
      .from("user_energy")
      .update({ energy, updated_at: now.toISOString() })
      .eq("user_id", userId);

    if (error)
      throw ApiError.BadRequest(`${CANVAS_ERRORS.dbError}: ${error.message}`);
  }

  private validatePixel(pixel: IPixel) {
    const { x, y, color } = pixel;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !color.startsWith("#")
    ) {
      throw ApiError.BadRequest(CANVAS_ERRORS.invalidPixel);
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
    let maxEnergy = this.DEFAULT_MAX_ENERGY;
    let newEnergy: number;

    if (!row) {
      newEnergy = maxEnergy - amount;
      if (newEnergy < 0)
        throw ApiError.Forbidden(CANVAS_ERRORS.notEnoughEnergy);

      await supabase.from("user_energy").insert({
        user_id: userId,
        energy: newEnergy,
        max_energy: maxEnergy,
        updated_at: now.toISOString(),
      });
      return { energy: newEnergy, maxEnergy };
    }

    maxEnergy = row.max_energy;
    const elapsedMinutes = this.calculateElapsedMinutes(
      new Date(row.updated_at),
      now,
    );
    const energyAfterRegen = Math.min(row.energy + elapsedMinutes, maxEnergy);
    newEnergy = energyAfterRegen - amount;
    if (newEnergy < 0) throw ApiError.Forbidden(CANVAS_ERRORS.notEnoughEnergy);

    await this.updateEnergyRow(userId, newEnergy, now);
    return { energy: newEnergy, maxEnergy };
  }

  public async placePixel(
    userId: string,
    pixel: IPixel,
  ): Promise<IEnergyResult> {
    this.validatePixel(pixel);
    const energyResult = await this.useEnergy(userId, 1);

    const { error } = await supabase
      .from("pixels")
      .upsert(
        { ...pixel, user_id: userId, placed_at: new Date().toISOString() },
        { onConflict: "x, y" },
      );

    if (error)
      throw ApiError.BadRequest(`${CANVAS_ERRORS.dbError}: ${error.message}`);
    return energyResult;
  }

  public async getAllPixels(): Promise<IPixel[]> {
    const { data, error } = await supabase
      .from("pixels")
      .select("x, y, color, user_id");
    if (error)
      throw ApiError.BadRequest(`${CANVAS_ERRORS.dbError}: ${error.message}`);

    return (data || []).map((p) => ({
      x: p.x,
      y: p.y,
      color: p.color,
      userId: p.user_id,
    }));
  }

  public async getEnergy(userId: string): Promise<IEnergyResult> {
    const now = new Date();
    const row = await this.getUserEnergyRow(userId);

    if (!row) {
      await supabase.from("user_energy").insert({
        user_id: userId,
        energy: this.DEFAULT_MAX_ENERGY,
        max_energy: this.DEFAULT_MAX_ENERGY,
        updated_at: now.toISOString(),
      });
      return {
        energy: this.DEFAULT_MAX_ENERGY,
        maxEnergy: this.DEFAULT_MAX_ENERGY,
      };
    }

    const elapsedMinutes = this.calculateElapsedMinutes(
      new Date(row.updated_at),
      now,
    );
    const regenerated = Math.min(row.energy + elapsedMinutes, row.max_energy);

    if (regenerated !== row.energy)
      await this.updateEnergyRow(userId, regenerated, now);

    return { energy: regenerated, maxEnergy: row.max_energy };
  }
}

export { CanvasService };
