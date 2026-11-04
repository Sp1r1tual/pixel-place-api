import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { IAuthPayload, ITokens, IUser } from "../../types/auth.js";

import { AuthModel } from "../models/auth-model.js";

import { EmailService } from "./email-service.js";

import { UserDto } from "../dto/userDto.js";
import { ApiError } from "../../shared/exceptions/api-error.js";
import { AUTH_ERRORS } from "../utils/errors/errors-messages.js";
import {
  REFRESH_TOKEN_TTL_MS,
  RESET_MAIL_COOLDOWN_MS,
  RESET_TOKEN_TTL_MS,
  ROTATION_GRACE_MS,
  hashToken,
} from "../utils/tokens.js";

const BCRYPT_ROUNDS = 10;

const msAgo = (ms: number) => new Date(Date.now() - ms).toISOString();
const refreshExpiry = () =>
  new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();

class AuthService {
  private readonly authModel = new AuthModel();
  private readonly emailService = new EmailService();
  private dummyHash: Promise<string> | null = null;

  private generateTokens(user: IUser): ITokens & { user: UserDto } {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret || !refreshSecret) throw new Error("JWT secrets not set");

    const userDto = new UserDto(user);
    const payload = { ...userDto };

    return {
      user: userDto,
      accessToken: jwt.sign(payload, accessSecret, { expiresIn: "15m" }),
      refreshToken: jwt.sign(payload, refreshSecret, {
        expiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
        jwtid: randomUUID(),
      }),
    };
  }

  /** Spends the same time as a real check so that timing does not reveal who exists. */
  private async compareWithDummyHash(password: string): Promise<void> {
    this.dummyHash ??= bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);
    await bcrypt.compare(password, await this.dummyHash);
  }

  private verifyRefreshToken(refreshToken: string): { id: string } {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error("JWT_REFRESH_SECRET not set");

    try {
      return jwt.verify(refreshToken, secret) as { id: string };
    } catch {
      throw ApiError.UnauthorizedError(AUTH_ERRORS.invalidRefreshToken);
    }
  }

  public validateAccessToken(token: string): { id: string; email: string } {
    if (!token) throw ApiError.UnauthorizedError("Access token missing");

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error("JWT_ACCESS_SECRET not set");

    try {
      return jwt.verify(token, secret) as { id: string; email: string };
    } catch {
      throw ApiError.UnauthorizedError("Invalid access token");
    }
  }

  public async login({ email, password }: IAuthPayload) {
    const user = await this.authModel.findUserByEmail(email);

    if (!user) {
      await this.compareWithDummyHash(password);
      throw ApiError.UnauthorizedError(AUTH_ERRORS.invalidCredentials);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.invalidCredentials);
    if (!user.is_activated)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.userNotActivated);

    const session = this.generateTokens(user);

    await this.authModel.deleteExpiredTokens(user.id);
    await this.authModel.createToken(
      user.id,
      hashToken(session.refreshToken),
      refreshExpiry(),
    );

    return session;
  }

  /** Issues no tokens: the first session starts at login, after activation. */
  public async registration({ email, password }: IAuthPayload) {
    const existing = await this.authModel.findUserByEmail(email);
    if (existing) throw ApiError.BadRequest(AUTH_ERRORS.userAlreadyExists);

    const hashPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const activationLink = randomUUID();

    let user: IUser;
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
      await this.emailService.sendActivationMail(
        email,
        `${process.env.API_URL}/activate/${activationLink}`,
      );
    } catch (emailError) {
      console.error(`Activation mail failed, deleting user: ${emailError}`);

      await this.authModel
        .deleteUser(user.id)
        .catch((error) => console.error("Failed to delete user:", error));

      throw ApiError.BadRequest(AUTH_ERRORS.registrationFailed);
    }

    return { user: new UserDto(user) };
  }

  public async logout(refreshToken: string): Promise<void> {
    await this.authModel.deleteToken(hashToken(refreshToken));
  }

  public async activate(activationLink: string): Promise<void> {
    const user = await this.authModel.findUserByActivationLink(activationLink);

    if (!user) throw ApiError.NotFound(AUTH_ERRORS.invalidActivationLink);
    if (user.is_activated) return;

    await this.authModel.updateUser(user.id, { is_activated: true });
  }

  public async refresh(
    refreshToken?: string,
  ): Promise<{ accessToken: string; refreshToken?: string; user: UserDto }> {
    if (!refreshToken)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.missingRefreshToken);

    const { id } = this.verifyRefreshToken(refreshToken);

    const user = await this.authModel.findUserById(id);
    if (!user?.is_activated)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.invalidRefreshToken);

    const session = this.generateTokens(user);
    const tokenHash = hashToken(refreshToken);

    const rotated = await this.authModel.rotateToken(
      tokenHash,
      hashToken(session.refreshToken),
      refreshExpiry(),
    );

    if (rotated) return session;

    // Another tab just rotated this token and its response carries the new cookie,
    // so this request only gets an access token and leaves the cookie alone.
    const justRotated = await this.authModel.wasRotatedAfter(
      tokenHash,
      msAgo(ROTATION_GRACE_MS),
    );

    if (!justRotated)
      throw ApiError.UnauthorizedError(AUTH_ERRORS.invalidRefreshToken);

    return { accessToken: session.accessToken, user: session.user };
  }

  /** Always succeeds from the caller's view, so it cannot be used to probe emails. */
  public async forgotPassword(email: string): Promise<void> {
    const user = await this.authModel.findUserByEmail(email);
    if (!user) return;

    const recentlySent = await this.authModel.hasResetTokenCreatedAfter(
      user.id,
      msAgo(RESET_MAIL_COOLDOWN_MS),
    );
    if (recentlySent) return;

    const resetToken = randomUUID();
    const tokenHash = hashToken(resetToken);

    await this.authModel.deleteUserResetTokens(user.id);
    await this.authModel.createResetToken(user.id, tokenHash);

    // Not awaited: a response delayed by SMTP would reveal that the account exists.
    void this.emailService
      .sendResetPasswordMail(
        email,
        `${process.env.CLIENT_URL}/reset-password/${resetToken}`,
      )
      .catch(async (emailError) => {
        console.error(`Reset mail failed: ${emailError}`);
        await this.authModel.deleteResetToken(tokenHash).catch(() => undefined);
      });
  }

  public async resetPassword(
    resetToken: string,
    newPassword: string,
  ): Promise<void> {
    const tokenRecord = await this.authModel.findResetToken(
      hashToken(resetToken),
      msAgo(RESET_TOKEN_TTL_MS),
    );
    if (!tokenRecord) throw ApiError.BadRequest(AUTH_ERRORS.resetTokenInvalid);

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.authModel.updateUser(tokenRecord.user_id, {
      password: hashedPassword,
    });
    await this.authModel.deleteUserResetTokens(tokenRecord.user_id);
    // A changed password must end every session, including a stolen one.
    await this.authModel.deleteUserTokens(tokenRecord.user_id);
  }
}

export { AuthService };
