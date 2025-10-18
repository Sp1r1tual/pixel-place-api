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
        this.emit("server_error", { message: err.message, errors: err.errors });
      } else if (err instanceof Error) {
        this.emit("server_error", { message: err.message });
      } else {
        this.emit("server_error", { message: "errors.something-went-wrong" });
      }
    }
  };

export { socketErrorMiddleware };
