import { Router } from "express";

import { checkAuthMiddleware } from "../../shared/middlewares/check-auth-middleware.js";

import { ShopController } from "../controllers/shop-controller.js";

const shopRouter = Router();

const shopController = new ShopController();

shopRouter.get("/shop", checkAuthMiddleware, shopController.getShop);

shopRouter.post(
  "/shop/upgrade",
  checkAuthMiddleware,
  shopController.upgradeItem,
);

export { shopRouter };
