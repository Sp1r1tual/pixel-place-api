export interface IAuthPayload {
  email: string;
  password: string;
}

export interface IUser {
  id: string;
  email: string;
  password?: string;
}
