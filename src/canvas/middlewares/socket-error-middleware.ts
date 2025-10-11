import { Socket } from "socket.io";

import { ApiError } from "../../shared/exceptions/api-error.js";

const socketErrorMiddleware =
  <T extends unknown[]>(
    handler: (...args: T) => Promise<void>,
    socket: Socket,
  ) =>
  async (...args: T) => {
    try {
      await handler(...args);
    } catch (err) {
      console.error(err);

      if (err instanceof ApiError) {
        socket.emit("error", { message: err.message, errors: err.errors });
      } else {
        socket.emit("error", { message: "Something went wrong" });
      }
    }
  };

export { socketErrorMiddleware };
