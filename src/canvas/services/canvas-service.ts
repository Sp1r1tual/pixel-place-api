import { supabase } from "../../index.js";

import { ApiError } from "../../shared/exceptions/api-error.js";

class CanvasService {
  public async getEnergy(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from("user_energy")
      .select("energy, updated_at")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw ApiError.BadRequest(error.message);
    }

    if (!data) {
      await supabase.from("user_energy").insert({
        user_id: userId,
        energy: 10,
        updated_at: new Date().toISOString(),
      });
      return 10;
    }

    const now = new Date();
    const lastUpdated = new Date(data.updated_at);
    const diffMinutes = Math.floor(
      (now.getTime() - lastUpdated.getTime()) / (1000 * 60),
    );
    const regenerated = Math.min(data.energy + diffMinutes, 10);

    return regenerated;
  }

  public async useEnergy(userId: string, amount: number): Promise<number> {
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

    return data as number;
  }
}

export { CanvasService };
