import { IUser } from "../../types/auth.js";

class UserDto {
  id: string;
  email: string;

  constructor(model: IUser) {
    this.id = model.id;
    this.email = model.email;
  }
}

export { UserDto };
