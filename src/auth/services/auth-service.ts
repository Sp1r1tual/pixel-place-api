import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import axios from "axios";

import { IAuthPayload } from "../../types/auth.js";

import { supabase } from "../../index.js";
import { UserDto } from "../../shared/dto/userDto.js";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { AUTH_ERRORS } from "../utils/errors/errors-messages.js";

interface ITokens {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  private getMailServiceUrl(): string {
    const url = process.env.MAIL_SERVICE_URL;
    if (!url)
      throw new Error(
        "MAIL_SERVICE_URL is not defined in environment variables",
      );
    return url;
  }

  private generateTokens(payload: object): ITokens {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret || !refreshSecret) throw new Error("JWT secrets not set");

    return {
      accessToken: jwt.sign(payload, accessSecret, { expiresIn: "15m" }),
      refreshToken: jwt.sign(payload, refreshSecret, { expiresIn: "30d" }),
    };
  }

  private async saveToken(userId: string, refreshToken: string): Promise<void> {
    const { data: existing, error: findError } = await supabase
      .from("tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (findError && findError.code !== "PGRST116") throw findError;

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

  private async sendActivationMail(email: string, link: string) {
    const mailServiceUrl = this.getMailServiceUrl();
    await axios.post(`${mailServiceUrl}/activation`, { email, link });
  }

  private async sendResetPasswordMail(email: string, link: string) {
    const mailServiceUrl = this.getMailServiceUrl();
    await axios.post(`${mailServiceUrl}/reset`, { email, link });
  }

  public validateAccessToken(token: string) {
    if (!token) throw ApiError.UnauthorizedError("Access token missing");

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error("JWT_ACCESS_SECRET not set");

    try {
      const userData = jwt.verify(token, secret) as {
        id: string;
        email: string;
      };
      return userData;
    } catch {
      throw ApiError.UnauthorizedError("Invalid access token");
    }
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
    if (!user.is_activated)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.userNotActivated);

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
    if (error || !user)
      throw ApiError.BadRequest(AUTH_ERRORS.registrationFailed);

    await this.sendActivationMail(
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
  }

  public async forgotPassword(email: string): Promise<void> {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();
    if (error || !user) throw ApiError.NotFound(AUTH_ERRORS.userNotFound);

    const resetToken = uuidv4();
    await supabase.from("reset_tokens").insert({
      user_id: user.id,
      reset_token: resetToken,
      created_at: new Date().toISOString(),
    });

    await this.sendResetPasswordMail(
      email,
      `${process.env.CLIENT_URL}/reset-password/${resetToken}`,
    );
  }

  public async resetPassword(
    resetToken: string,
    newPassword: string,
  ): Promise<void> {
    const { data: tokenRecord } = await supabase
      .from("reset_tokens")
      .select("*")
      .eq("reset_token", resetToken)
      .maybeSingle();
    if (!tokenRecord)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.resetTokenUsed);

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", tokenRecord.user_id)
      .single();
    if (!user) throw ApiError.NotFound(AUTH_ERRORS.userNotFound);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("id", user.id);

    await supabase.from("reset_tokens").delete().eq("reset_token", resetToken);
  }
}

export { AuthService };
