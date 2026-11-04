import type {
  IEnergyState,
  IPixelInput,
  IPixelRow,
  IPlacePixelsResult,
} from "../../types/index.js";

import { supabase } from "../../shared/configs/supabase.js";
import { toRpcError } from "../../shared/utils/rpc-error.js";

class CanvasModel {
  async getEnergy(userId: string): Promise<IEnergyState> {
    const { data, error } = await supabase.rpc("get_energy", {
      p_user_id: userId,
    });

    if (error) throw toRpcError(error);
    return data;
  }

  async placePixels(
    userId: string,
    pixels: IPixelInput[],
  ): Promise<IPlacePixelsResult> {
    const { data, error } = await supabase.rpc("place_pixels", {
      p_user_id: userId,
      p_pixels: pixels,
    });

    if (error) throw toRpcError(error);
    return data;
  }

  async getPixelsPage(from: number, batchSize: number): Promise<IPixelRow[]> {
    const { data, error } = await supabase
      .from("pixels")
      .select("x, y, color, user_id, placed_at")
      .order("id", { ascending: true })
      .range(from, from + batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch pixels: ${error.message}`);
    }

    return (data as IPixelRow[]) || [];
  }
}

export { CanvasModel };
