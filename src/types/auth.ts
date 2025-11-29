import { Request } from "express";

export interface IUser {
  id: string;
  email: string;
  password?: string;
}

export interface IAuthRequest extends Request {
  user: IUser;
}
