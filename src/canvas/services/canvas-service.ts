import type {
  IEnergyState,
  IPixel,
  IPixelInput,
  IPlacePixelsResult,
} from "../../types/index.js";

import { CanvasModel } from "../models/canvas-model.js";

const PAGE_SIZE = 1000;

class CanvasService {
  private readonly canvasModel = new CanvasModel();

  public getEnergy(userId: string): Promise<IEnergyState> {
    return this.canvasModel.getEnergy(userId);
  }

  public placePixels(
    userId: string,
    pixels: IPixelInput[],
  ): Promise<IPlacePixelsResult> {
    return this.canvasModel.placePixels(userId, pixels);
  }

  public async getAllPixels(): Promise<IPixel[]> {
    const pixels: IPixel[] = [];

    for (let from = 0; ; from += PAGE_SIZE) {
      const page = await this.canvasModel.getPixelsPage(from, PAGE_SIZE);

      for (const row of page) {
        pixels.push({
          x: row.x,
          y: row.y,
          color: row.color,
          userId: row.user_id,
          placedAt: row.placed_at,
        });
      }

      if (page.length < PAGE_SIZE) return pixels;
    }
  }
}

export { CanvasService };
