import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { IAuthPayload } from "../../types/auth.js";

import { supabase } from "../../index.js";
import { ApiError } from "../../shared/exceptions/api-error.js";
import { UserDto } from "../../shared/dto/userDto.js";

class AuthService {
  private generateTokens(payload: object) {
    const accessToken = jwt.sign(
      payload,
      process.env.JWT_ACCESS_SECRET as string,
      {
        expiresIn: "15m",
      },
    );

    const refreshToken = jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET as string,
      {
        expiresIn: "30d",
      },
    );

    return { accessToken, refreshToken };
  }

  private async saveToken(userId: string, refreshToken: string) {
    const { data: existing, error: findError } = await supabase
      .from("tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (findError && findError.code !== "PGRST116") {
      throw findError;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("tokens")
        .update({ refresh_token: refreshToken })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      return;
    }

    const { error: insertError } = await supabase
      .from("tokens")
      .insert({ user_id: userId, refresh_token: refreshToken });

    if (insertError) throw insertError;
  }

  async login({ email, password }: IAuthPayload) {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      throw ApiError.NotFound("User not found");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw ApiError.UnauthorizedError("Incorrect password");
    }

    const userDto = new UserDto(user);
    const tokens = this.generateTokens({ ...userDto });

    await this.saveToken(userDto.id, tokens.refreshToken);

    return {
      ...tokens,
      user: userDto,
    };
  }

  async registration({ email, password }: IAuthPayload) {
    const { data: existing } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (existing) throw ApiError.BadRequest("User already exists");

    const hashPassword = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from("users")
      .insert({ email, password: hashPassword })
      .select("*")
      .single();

    if (error || !user) throw ApiError.BadRequest("Registration failed");

    const userDto = new UserDto(user);
    const tokens = this.generateTokens({ ...userDto });

    await this.saveToken(userDto.id, tokens.refreshToken);

    return {
      ...tokens,
      user: userDto,
    };
  }

  async logout(refreshToken: string) {
    const { error } = await supabase
      .from("tokens")
      .delete()
      .eq("refresh_token", refreshToken);

    if (error) throw error;

    return;
  }

  async refresh(refreshToken: string) {
    try {
      const userData = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET as string,
      ) as { id: string; email: string };

      const { data: tokenRecord } = await supabase
        .from("tokens")
        .select("*")
        .eq("refresh_token", refreshToken)
        .single();

      if (!tokenRecord) {
        throw ApiError.UnauthorizedError("Invalid refresh token");
      }

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("id", userData.id)
        .single();

      if (!user) throw ApiError.NotFound("User not found");

      const userDto = new UserDto(user);
      const tokens = this.generateTokens({ ...userDto });

      await this.saveToken(userDto.id, tokens.refreshToken);

      return { ...tokens, user: userDto };
    } catch {
      throw ApiError.UnauthorizedError("Token verification failed");
    }
  }
}

export { AuthService };
