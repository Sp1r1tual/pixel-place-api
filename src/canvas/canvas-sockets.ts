import { Server as IOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";

import { socketErrorMiddleware } from "./middlewares/socket-error-middleware.js";

import { AuthService } from "../auth/services/auth-service.js";

import { ApiError } from "../shared/exceptions/api-error.js";

const authService = new AuthService();

interface ITokenPayload {
  id: string;
  email: string;
  exp: number;
}

interface IPixel {
  x: number;
  y: number;
  color: string;
}

interface CanvasSocket extends Socket {
  user?: { id: string; email: string };
}

const canvasState: Record<string, string> = {}; // key = "x:y", value = color

const initCanvasSocket = (server: HttpServer) => {
  const io = new IOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
    path: "/canvas/socket.io",
  });

  io.use((socket: CanvasSocket, next) => {
    try {
      const authHeader = socket.handshake.auth?.authorization;
      if (!authHeader) {
        return next(ApiError.UnauthorizedError());
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        return next(ApiError.UnauthorizedError());
      }

      const payload = authService.validateAccessToken(token) as ITokenPayload;
      if (!payload?.exp) {
        return next(ApiError.UnauthorizedError());
      }

      socket.user = { id: payload.id, email: payload.email };

      const msToExpire = payload.exp * 1000 - Date.now();
      if (msToExpire > 0) {
        setTimeout(() => {
          socket.emit("token_expired");
          socket.disconnect(true);
        }, msToExpire);
      }

      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      next(ApiError.UnauthorizedError());
    }
  });

  io.on("connection", (socket: CanvasSocket) => {
    console.log("User connected to canvas:", socket.id);

    socket.emit("canvasState", canvasState);

    socket.on(
      "sendBatch",
      socketErrorMiddleware<[IPixel[] | undefined]>(
        async (pixels?: IPixel[]) => {
          if (!pixels || !Array.isArray(pixels) || pixels.length === 0) {
            throw ApiError.BadRequest("No pixels sent");
          }

          pixels.forEach((p) => {
            canvasState[`${p.x}:${p.y}`] = p.color;
          });

          io.emit("updatePixels", pixels);
        },
        socket,
      ),
    );

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
};

export { initCanvasSocket };
