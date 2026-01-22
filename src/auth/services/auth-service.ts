import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

import { IAuthPayload, ITokens } from "../../types/auth.js";

import { AuthModel } from "../models/auth-model.js";

import { EmailService } from "./email-service.js";

import { UserDto } from "../dto/userDto.js";
import { ApiError } from "../../shared/exceptions/api-error.js";
import { AUTH_ERRORS } from "../utils/errors/errors-messages.js";

class AuthService {
  private readonly authModel: AuthModel;

  constructor() {
    this.authModel = new AuthModel();
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
    const existing = await this.authModel.findTokenByUserId(userId);

    if (existing) {
      await this.authModel.updateToken(userId, refreshToken);
    } else {
      await this.authModel.createToken(userId, refreshToken);
    }
  }

  private async deleteUser(userId: string): Promise<void> {
    try {
      await this.authModel.deleteUser(userId);
    } catch (error) {
      console.error("Exception while deleting user:", error);
    }
  }

  public validateAccessToken(token: string): { id: string; email: string } {
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
    const user = await this.authModel.findUserByEmail(email);

    if (!user) throw ApiError.NotFound(AUTH_ERRORS.userNotFound);

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
    const existing = await this.authModel.findUserByEmail(email);
    if (existing) throw ApiError.BadRequest(AUTH_ERRORS.userAlreadyExists);

    const hashPassword = await bcrypt.hash(password, 10);
    const activationLink = uuidv4();

    let user;
    try {
      user = await this.authModel.createUser({
        email,
        password: hashPassword,
        activation_link: activationLink,
        is_activated: false,
      });
    } catch {
      throw ApiError.BadRequest(AUTH_ERRORS.registrationFailed);
    }

    try {
      const emailService = new EmailService();
      await emailService.sendActivationMail(
        email,
        `${process.env.API_URL}/activate/${activationLink}`,
        2,
      );
    } catch (emailError) {
      console.error(
        `Failed to send activation email, deleting user... ${emailError}`,
      );

      await this.deleteUser(user.id);

      throw ApiError.BadRequest(
        "Failed to send activation email. Please try registering again later.",
      );
    }

    const userDto = new UserDto(user);
    const tokens = this.generateTokens({ ...userDto });
    await this.saveToken(userDto.id, tokens.refreshToken);

    return { ...tokens, user: userDto };
  }

  public async logout(refreshToken: string): Promise<void> {
    await this.authModel.deleteTokenByRefreshToken(refreshToken);
  }

  public async activate(activationLink: string): Promise<void> {
    const user = await this.authModel.findUserByActivationLink(activationLink);

    if (!user) throw ApiError.NotFound(AUTH_ERRORS.invalidActivationLink);
    if (user.is_activated) return;

    await this.authModel.updateUser(user.id, { is_activated: true });
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

      const tokenRecord =
        await this.authModel.findTokenByRefreshToken(refreshToken);
      if (!tokenRecord)
        throw ApiError.UnauthorizedError(AUTH_ERRORS.invalidRefreshToken);

      const user = await this.authModel.findUserById(userData.id);
      if (!user) throw ApiError.NotFound(AUTH_ERRORS.userNotFound);

      const userDto = new UserDto(user);
      const tokens = this.generateTokens({ ...userDto });
      await this.saveToken(userDto.id, tokens.refreshToken);

      return { ...tokens, user: userDto };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw ApiError.UnauthorizedError(AUTH_ERRORS.invalidRefreshToken);
      }
      throw error;
    }
  }

  public async forgotPassword(email: string): Promise<void> {
    const user = await this.authModel.findUserByEmail(email);
    if (!user) throw ApiError.NotFound(AUTH_ERRORS.userNotFound);

    const resetToken = uuidv4();

    try {
      await this.authModel.createResetToken(user.id, resetToken);
    } catch {
      throw ApiError.BadRequest("Failed to create reset token");
    }

    try {
      const emailService = new EmailService();
      await emailService.sendResetPasswordMail(
        email,
        `${process.env.CLIENT_URL}/reset-password/${resetToken}`,
        2,
      );
    } catch (emailError) {
      console.error(`Failed to send reset password email... ${emailError}`);

      await this.authModel.deleteResetToken(resetToken);

      throw ApiError.BadRequest(
        "Failed to send reset password email. Please try again later.",
      );
    }
  }

  public async resetPassword(
    resetToken: string,
    newPassword: string,
  ): Promise<void> {
    const tokenRecord = await this.authModel.findResetToken(resetToken);
    if (!tokenRecord)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.resetTokenUsed);

    const user = await this.authModel.findUserById(tokenRecord.user_id);
    if (!user) throw ApiError.NotFound(AUTH_ERRORS.userNotFound);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.authModel.updateUser(user.id, { password: hashedPassword });
    await this.authModel.deleteResetToken(resetToken);
  }
}

export { AuthService };
