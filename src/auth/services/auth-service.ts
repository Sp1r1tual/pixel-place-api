import axios, { AxiosInstance } from "axios";

import { ApiError } from "../../shared/exceptions/api-error.js";

interface IValidateTokenResponse {
  id: string;
  email: string;
}

class AuthService {
  private client: AxiosInstance;

  constructor() {
    const authApiUrl = process.env.AUTH_API_URL;

    if (!authApiUrl) {
      throw new Error("AUTH_API_URL is not defined in environment variables");
    }

    this.client = axios.create({
      baseURL: authApiUrl,
    });
  }

  public async validateAccessToken(
    token: string,
  ): Promise<IValidateTokenResponse> {
    try {
      const response = await this.client.post<IValidateTokenResponse>(
        "/validate-token",
        { token },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw ApiError.UnauthorizedError("Invalid access token");
        }
        if (error.code === "ECONNREFUSED") {
          console.error("[AuthApiClient] Auth service unavailable");

          throw ApiError.ServiceUnavailable(
            "Authentication service unavailable",
          );
        }
      }

      console.error("[AuthApiClient] Token validation error:", error);

      throw ApiError.UnauthorizedError("Token validation failed");
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.get("/health");
      return true;
    } catch {
      return false;
    }
  }
}

export const authService = new AuthService();
