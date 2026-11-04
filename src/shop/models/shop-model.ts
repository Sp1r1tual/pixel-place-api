import type {
  IUserStats,
  IShopItemRecord,
  IUpgradeResult,
  ItemType,
} from "../../types/index.js";

import { supabase } from "../../shared/configs/supabase.js";
import { toRpcError } from "../../shared/utils/rpc-error.js";

class ShopModel {
  /** Safe under concurrent calls: an existing row is left untouched. */
  async ensureUserStats(userId: string): Promise<IUserStats> {
    const { error: upsertError } = await supabase
      .from("user_stats")
      .upsert(
        { user_id: userId },
        { onConflict: "user_id", ignoreDuplicates: true },
      );

    if (upsertError) throw toRpcError(upsertError);

    const { data, error } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single<IUserStats>();

    if (error) throw toRpcError(error);
    return data;
  }

  async getAllShopItems(): Promise<IShopItemRecord[]> {
    const { data, error } = await supabase
      .from("shop_items")
      .select("*")
      .order("base_price", { ascending: true });

    if (error) throw toRpcError(error);
    return data as IShopItemRecord[];
  }

  async upgradeItem(
    userId: string,
    itemType: ItemType,
  ): Promise<IUpgradeResult> {
    const { data, error } = await supabase.rpc("upgrade_item", {
      p_user_id: userId,
      p_item_type: itemType,
    });

    if (error) throw toRpcError(error);
    return data;
  }
}

export { ShopModel };
