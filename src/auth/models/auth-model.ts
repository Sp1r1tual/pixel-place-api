import { IUser, IResetToken, IUserInsert } from "../../types/auth.js";

import { supabase } from "../../shared/configs/supabase.js";

class AuthModel {
  async findUserByEmail(email: string): Promise<IUser | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findUserById(userId: string): Promise<IUser | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findUserByActivationLink(
    activationLink: string,
  ): Promise<IUser | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("activation_link", activationLink)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createUser(userData: IUserInsert): Promise<IUser> {
    const { data, error } = await supabase
      .from("users")
      .insert(userData)
      .select("*")
      .single();

    if (error || !data) throw new Error("Failed to create user");
    return data;
  }

  async updateUser(userId: string, updates: Partial<IUser>): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await supabase.from("users").delete().eq("id", userId);

    if (error) throw error;
  }

  async createToken(
    userId: string,
    tokenHash: string,
    expiresAt: string,
  ): Promise<void> {
    const { error } = await supabase.from("tokens").insert({
      user_id: userId,
      refresh_token: tokenHash,
      expires_at: expiresAt,
    });

    if (error) throw error;
  }

  /** Atomic: of two concurrent refreshes with one token, only one gets a row back. */
  async rotateToken(
    tokenHash: string,
    newTokenHash: string,
    expiresAt: string,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from("tokens")
      .update({
        refresh_token: newTokenHash,
        previous_refresh_token: tokenHash,
        rotated_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq("refresh_token", tokenHash)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async wasRotatedAfter(tokenHash: string, after: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("tokens")
      .select("id")
      .eq("previous_refresh_token", tokenHash)
      .gt("rotated_at", after)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async deleteToken(tokenHash: string): Promise<void> {
    const { error } = await supabase
      .from("tokens")
      .delete()
      .eq("refresh_token", tokenHash);

    if (error) throw error;
  }

  async deleteUserTokens(userId: string): Promise<void> {
    const { error } = await supabase
      .from("tokens")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
  }

  async deleteExpiredTokens(userId: string): Promise<void> {
    const { error } = await supabase
      .from("tokens")
      .delete()
      .eq("user_id", userId)
      .lt("expires_at", new Date().toISOString());

    if (error) throw error;
  }

  async createResetToken(userId: string, tokenHash: string): Promise<void> {
    const { error } = await supabase.from("reset_tokens").insert({
      user_id: userId,
      reset_token: tokenHash,
      created_at: new Date().toISOString(),
    });

    if (error) throw new Error("Failed to create reset token");
  }

  async findResetToken(
    tokenHash: string,
    createdAfter: string,
  ): Promise<IResetToken | null> {
    const { data, error } = await supabase
      .from("reset_tokens")
      .select("*")
      .eq("reset_token", tokenHash)
      .gt("created_at", createdAfter)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async hasResetTokenCreatedAfter(
    userId: string,
    createdAfter: string,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from("reset_tokens")
      .select("id")
      .eq("user_id", userId)
      .gt("created_at", createdAfter)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async deleteResetToken(tokenHash: string): Promise<void> {
    const { error } = await supabase
      .from("reset_tokens")
      .delete()
      .eq("reset_token", tokenHash);

    if (error) throw error;
  }

  async deleteUserResetTokens(userId: string): Promise<void> {
    const { error } = await supabase
      .from("reset_tokens")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
  }
}

export { AuthModel };
