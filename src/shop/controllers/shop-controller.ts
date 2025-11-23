import { Request, Response, NextFunction } from "express";

import { IAuthRequest } from "../../types/auth.js";

import { ShopService } from "../services/shop-service.js";

const shopService = new ShopService();

class ShopController {
  getShop = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as IAuthRequest;
      const userId = authReq.user?.id;

      const shopItems = await shopService.getShopItems(userId);

      return res.json(shopItems);
    } catch (error) {
      next(error);
    }
  };

  upgradeItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as IAuthRequest;
      const userId = authReq.user?.id;

      const { statId } = req.body as { statId: string };

      const result = await shopService.upgradeItem(
        userId,
        statId as "energy_limit" | "recovery_speed" | "pixel_reward",
      );

      return res.json({
        success: true,
        updatedStat: result.updatedStat,
        currency: result.currency,
        recoverySpeed: result.recoverySpeed,
      });
    } catch (error) {
      next(error);
    }
  };
}

export { ShopController };
