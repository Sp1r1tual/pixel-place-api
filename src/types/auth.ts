import { Request } from "express";

export interface IUser {
  id: string;
  email: string;
  password: string;
  activation_link: string;
  is_activated: boolean;
  created_at?: string;
}

export interface IAuthRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

export interface IToken {
  id: string;
  user_id: string;
  refresh_token: string;
}

export interface IResetToken {
  id: string;
  user_id: string;
  reset_token: string;
  created_at: string;
}

export interface IUserInsert {
  email: string;
  password: string;
  activation_link: string;
  is_activated: boolean;
}

export interface ITokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthPayload {
  email: string;
  password: string;
}
