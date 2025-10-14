import { Socket } from "socket.io";

import { ApiError } from "../../shared/exceptions/api-error.js";

const socketErrorMiddleware = <T extends unknown[]>(
  handler: (...args: T) => Promise<void>,
) =>
  async function (this: Socket, ...args: T) {
    try {
      await handler.apply(this, args);
    } catch (err) {
      console.error(err);

      if (err instanceof ApiError) {
        this.emit("error", { message: err.message, errors: err.errors });
      } else {
        this.emit("error", { message: "Something went wrong" });
      }
    }
  };

export { socketErrorMiddleware };
