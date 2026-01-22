import { IUser, IToken, IResetToken, IUserInsert } from "../../types/auth.js";

import { supabase } from "../../index.js";

class AuthModel {
  async findUserByEmail(email: string): Promise<IUser | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data;
  }

  async findUserById(userId: string): Promise<IUser | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      return null;
    }
    return data;
  }

  async findUserByActivationLink(
    activationLink: string,
  ): Promise<IUser | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("activation_link", activationLink)
      .single();

    if (error) {
      return null;
    }
    return data;
  }

  async createUser(userData: IUserInsert): Promise<IUser> {
    const { data, error } = await supabase
      .from("users")
      .insert(userData)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error("Failed to create user");
    }
    return data;
  }

  async updateUser(userId: string, updates: Partial<IUser>): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId);

    if (error) {
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await supabase.from("users").delete().eq("id", userId);

    if (error) {
      throw error;
    }
  }

  async findTokenByUserId(userId: string): Promise<IToken | null> {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }
    return data;
  }

  async findTokenByRefreshToken(refreshToken: string): Promise<IToken | null> {
    const { data } = await supabase
      .from("tokens")
      .select("*")
      .eq("refresh_token", refreshToken)
      .single();

    return data;
  }

  async createToken(userId: string, refreshToken: string): Promise<void> {
    const { error } = await supabase
      .from("tokens")
      .insert({ user_id: userId, refresh_token: refreshToken });

    if (error) {
      throw error;
    }
  }

  async updateToken(userId: string, refreshToken: string): Promise<void> {
    const { error } = await supabase
      .from("tokens")
      .update({ refresh_token: refreshToken })
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
  }

  async deleteTokenByRefreshToken(refreshToken: string): Promise<void> {
    const { error } = await supabase
      .from("tokens")
      .delete()
      .eq("refresh_token", refreshToken);

    if (error) {
      throw error;
    }
  }

  async createResetToken(userId: string, resetToken: string): Promise<void> {
    const { error } = await supabase.from("reset_tokens").insert({
      user_id: userId,
      reset_token: resetToken,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error("Failed to create reset token");
    }
  }

  async findResetToken(resetToken: string): Promise<IResetToken | null> {
    const { data } = await supabase
      .from("reset_tokens")
      .select("*")
      .eq("reset_token", resetToken)
      .maybeSingle();

    return data;
  }

  async deleteResetToken(resetToken: string): Promise<void> {
    await supabase.from("reset_tokens").delete().eq("reset_token", resetToken);
  }
}

export { AuthModel };
