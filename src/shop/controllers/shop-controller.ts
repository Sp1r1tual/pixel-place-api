import { Request, Response, NextFunction } from "express";

import { IAuthRequest } from "../../types/index.js";

import { ShopService, isItemType } from "../services/shop-service.js";

import { ApiError } from "../../shared/exceptions/api-error.js";

const shopService = new ShopService();

class ShopController {
  getShop = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as IAuthRequest).user;

      return res.json(await shopService.getShopItems(id));
    } catch (error) {
      next(error);
    }
  };

  upgradeItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = (req as IAuthRequest).user;
      const { statId } = req.body ?? {};

      if (!isItemType(statId)) {
        throw ApiError.BadRequest("shop.shop-item-not-found");
      }

      const result = await shopService.upgradeItem(id, statId);

      return res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}

export { ShopController };
