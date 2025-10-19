import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

import { IAuthPayload } from "../../types/auth.js";

import { supabase } from "../../index.js";
import { mailService } from "./mail-service.js";
import { ApiError } from "../../shared/exceptions/api-error.js";
import { UserDto } from "../../shared/dto/userDto.js";
import { AUTH_ERRORS } from "../utils/errors/errors-messages.js";

interface ITokens {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  private generateTokens(payload: object): ITokens {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret || !refreshSecret) {
      throw new Error("JWT secrets are not defined in environment variables");
    }

    const accessToken = jwt.sign(payload, accessSecret, { expiresIn: "15m" });
    const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: "30d" });

    return { accessToken, refreshToken };
  }

  private async saveToken(userId: string, refreshToken: string): Promise<void> {
    const { data: existing, error: findError } = await supabase
      .from("tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

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

  public validateAccessToken(
    token: string,
  ): { id: string; email: string } | null {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error("JWT_ACCESS_SECRET not set");

    try {
      const userData = jwt.verify(token, secret) as {
        id: string;
        email: string;
      };
      return userData;
    } catch {
      return null;
    }
  }

  private generateResetToken(payload: object): string {
    const resetSecret = process.env.JWT_RESET_SECRET;

    if (!resetSecret) {
      throw new Error("JWT_RESET_SECRET not defined in environment variables");
    }

    const resetToken = jwt.sign(payload, resetSecret, {
      expiresIn: "15m",
    });

    return resetToken;
  }

  private async saveResetToken(
    userId: string,
    resetToken: string,
  ): Promise<void> {
    const { error } = await supabase.from("reset_tokens").insert({
      user_id: userId,
      reset_token: resetToken,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
  }

  private async validateResetToken(resetToken: string): Promise<{
    id: string;
    email: string;
  } | null> {
    const resetSecret = process.env.JWT_RESET_SECRET;

    if (!resetSecret) {
      throw new Error("JWT_RESET_SECRET not defined in environment variables");
    }

    try {
      const userData = jwt.verify(resetToken, resetSecret) as {
        id: string;
        email: string;
      };
      return userData;
    } catch {
      return null;
    }
  }

  private async findResetToken(resetToken: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("reset_tokens")
      .select("*")
      .eq("reset_token", resetToken)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;

    return !!data;
  }

  private async removeResetToken(resetToken: string): Promise<void> {
    const { error } = await supabase
      .from("reset_tokens")
      .delete()
      .eq("reset_token", resetToken);

    if (error) throw error;
  }

  public async login({ email, password }: IAuthPayload) {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) throw ApiError.NotFound(AUTH_ERRORS.userNotFound);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.incorrectPassword);

    if (!user.is_activated) {
      throw ApiError.UnauthorizedError(AUTH_ERRORS.userNotActivated);
    }

    const userDto = new UserDto(user);
    const tokens = this.generateTokens({ ...userDto });

    await this.saveToken(userDto.id, tokens.refreshToken);

    return { ...tokens, user: userDto };
  }

  public async registration({ email, password }: IAuthPayload) {
    const { data: existing } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (existing) throw ApiError.BadRequest(AUTH_ERRORS.userAlreadyExists);

    const hashPassword = await bcrypt.hash(password, 10);
    const activationLink = uuidv4();

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        email,
        password: hashPassword,
        activation_link: activationLink,
        is_activated: false,
      })
      .select("*")
      .single();

    if (error || !user) {
      console.error("Supabase insert error:", error);
      throw ApiError.BadRequest(AUTH_ERRORS.registrationFailed);
    }

    await mailService.sendActivationMail(
      email,
      `${process.env.API_URL}/activate/${activationLink}`,
    );

    const userDto = new UserDto(user);
    const tokens = this.generateTokens({ ...userDto });
    await this.saveToken(userDto.id, tokens.refreshToken);

    return { ...tokens, user: userDto };
  }

  public async logout(refreshToken: string): Promise<void> {
    const { error } = await supabase
      .from("tokens")
      .delete()
      .eq("refresh_token", refreshToken);

    if (error) throw error;
  }

  public async activate(activationLink: string): Promise<void> {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("activation_link", activationLink)
      .single();

    if (error || !user)
      throw ApiError.NotFound(AUTH_ERRORS.invalidActivationLink);

    if (user.is_activated) return;

    const { error: updateError } = await supabase
      .from("users")
      .update({ is_activated: true })
      .eq("id", user.id);

    if (updateError) throw updateError;
  }

  public async refresh(refreshToken: string) {
    if (!refreshToken)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.missingRefreshToken);

    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error("JWT_REFRESH_SECRET not set");

    try {
      const userData = jwt.verify(refreshToken, secret) as {
        id: string;
        email: string;
      };

      const { data: tokenRecord } = await supabase
        .from("tokens")
        .select("*")
        .eq("refresh_token", refreshToken)
        .single();

      if (!tokenRecord)
        throw ApiError.UnauthorizedError(AUTH_ERRORS.invalidRefreshToken);

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("id", userData.id)
        .single();

      if (!user) throw ApiError.NotFound(AUTH_ERRORS.userNotFound);

      const userDto = new UserDto(user);
      const tokens = this.generateTokens({ ...userDto });
      await this.saveToken(userDto.id, tokens.refreshToken);

      return { ...tokens, user: userDto };
    } catch {
      throw ApiError.UnauthorizedError(AUTH_ERRORS.tokenVerificationFailed);
    }
  }

  public async forgotPassword(email: string): Promise<void> {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    if (error || !user) {
      throw ApiError.NotFound(AUTH_ERRORS.userNotFound);
    }

    const resetToken = this.generateResetToken({
      id: user.id,
      email: user.email,
    });

    await this.saveResetToken(user.id, resetToken);

    try {
      await mailService.sendPasswordResetMail(
        user.email,
        `${process.env.CLIENT_URL}/reset-password/${resetToken}`,
      );
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      throw ApiError.BadRequest(AUTH_ERRORS.passwordResetFailed);
    }
  }

  public async resetPassword(
    resetToken: string,
    newPassword: string,
  ): Promise<void> {
    if (!resetToken || !newPassword) {
      throw ApiError.BadRequest(AUTH_ERRORS.tokenAndPasswordRequired);
    }

    const userData = await this.validateResetToken(resetToken);

    if (!userData)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.resetTokenInvalid);

    const tokenExists = await this.findResetToken(resetToken);

    if (!tokenExists)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.resetTokenUsed);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userData.id)
      .single();

    if (userError || !user) {
      throw ApiError.NotFound(AUTH_ERRORS.userNotFound);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("id", user.id);

    if (updateError) {
      throw ApiError.BadRequest(AUTH_ERRORS.resetPasswordFailed);
    }

    await this.removeResetToken(resetToken);
  }
}

export { AuthService };
