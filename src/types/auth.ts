import { Request } from "express";

export interface IAuthPayload {
  email: string;
  password: string;
}

export interface IUser {
  id: string;
  email: string;
  password?: string;
}

export interface IAuthRequest extends Request {
  user: IUser;
}

export interface ITokenPayload {
  id: string;
  email: string;
  exp: number;
}
