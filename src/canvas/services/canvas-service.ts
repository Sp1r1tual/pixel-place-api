import { supabase } from "../../index.js";

import { IPixel, IEnergyResult } from "../../types/canvas.js";

import { ApiError } from "../../shared/exceptions/api-error.js";

class CanvasService {
  private readonly DEFAULT_MAX_ENERGY = 10;

  public async useEnergy(
    userId: string,
    amount: number,
  ): Promise<IEnergyResult> {
    if (typeof amount !== "number" || amount <= 0) {
      throw ApiError.BadRequest("Invalid energy amount");
    }

    const { data, error } = await supabase.rpc("use_energy_atomic", {
      p_user_id: userId,
      p_amount: amount,
    });

    if (error) {
      if (error.message.includes("Not enough energy")) {
        throw ApiError.Forbidden("Not enough energy");
      }
      throw ApiError.BadRequest(error.message);
    }

    if (
      !data ||
      typeof data.current_energy !== "number" ||
      typeof data.max_energy_value !== "number"
    ) {
      throw ApiError.BadRequest("Invalid energy response");
    }

    return {
      energy: data.current_energy,
      maxEnergy: data.max_energy_value,
    };
  }

  public async getAllPixels(): Promise<IPixel[]> {
    const { data, error } = await supabase
      .from("pixels")
      .select("x, y, color, user_id");

    if (error) throw ApiError.BadRequest(error.message);

    return (data || []).map((pixel) => ({
      x: pixel.x,
      y: pixel.y,
      color: pixel.color,
      userId: pixel.user_id,
    }));
  }

  public async placePixel(
    userId: string,
    pixel: IPixel,
  ): Promise<IEnergyResult> {
    const { x, y, color } = pixel;

    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof color !== "string" ||
      !color.startsWith("#")
    ) {
      throw ApiError.BadRequest("Invalid pixel data");
    }

    const energyResult = await this.useEnergy(userId, 1);

    const { error: upsertError } = await supabase.from("pixels").upsert(
      {
        user_id: userId,
        x,
        y,
        color,
        placed_at: new Date().toISOString(),
      },
      { onConflict: "x, y" },
    );

    if (upsertError) {
      throw ApiError.BadRequest(upsertError.message);
    }

    return energyResult;
  }

  public async getEnergy(userId: string): Promise<IEnergyResult> {
    const now = new Date();

    const { data, error } = await supabase
      .from("user_energy")
      .select("energy, max_energy, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw ApiError.BadRequest(error.message);
    }

    if (!data) {
      const { error: insertError } = await supabase.from("user_energy").insert({
        user_id: userId,
        energy: this.DEFAULT_MAX_ENERGY,
        max_energy: this.DEFAULT_MAX_ENERGY,
        updated_at: now.toISOString(),
      });
      if (insertError) throw ApiError.BadRequest(insertError.message);

      return {
        energy: this.DEFAULT_MAX_ENERGY,
        maxEnergy: this.DEFAULT_MAX_ENERGY,
      };
    }

    const lastUpdated = new Date(data.updated_at);
    const diffMinutes = Math.floor(
      (now.getTime() - lastUpdated.getTime()) / 60000,
    );

    const regenerated = Math.min(data.energy + diffMinutes, data.max_energy);

    if (regenerated !== data.energy) {
      const { error: updateError } = await supabase
        .from("user_energy")
        .update({
          energy: regenerated,
          updated_at: now.toISOString(),
        })
        .eq("user_id", userId);
      if (updateError) throw ApiError.BadRequest(updateError.message);
    }

    return { energy: regenerated, maxEnergy: data.max_energy };
  }
}

export { CanvasService };
