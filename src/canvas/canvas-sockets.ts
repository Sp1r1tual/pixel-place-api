import { Server as IOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";

import { ITokenPayload } from "../types/auth.js";
import { IPixel } from "../types/canvas.js";

import { socketErrorMiddleware } from "./middlewares/socket-error-middleware.js";

import { AuthService } from "../auth/services/auth-service.js";
import { CanvasService } from "./services/canvas-service.js";

import { ApiError } from "../shared/exceptions/api-error.js";

const authService = new AuthService();
const canvasService = new CanvasService();

interface CanvasSocket extends Socket {
  user?: { id: string; email: string };
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;

const canvasState: Record<string, string> = {};

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
      if (!authHeader) return next(ApiError.UnauthorizedError());

      const token = authHeader.split(" ")[1];
      if (!token) return next(ApiError.UnauthorizedError());

      const payload = authService.validateAccessToken(token) as ITokenPayload;
      if (!payload?.exp) return next(ApiError.UnauthorizedError());

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

  io.on("connection", async (socket: CanvasSocket) => {
    console.log("User connected:", socket.user?.email || socket.id);

    const pixelsFromDb = await canvasService.getAllPixels();
    pixelsFromDb.forEach((p) => {
      canvasState[`${p.x}:${p.y}`] = p.color;
    });

    socket.emit("canvasState", canvasState);

    if (socket.user) {
      const { energy, maxEnergy } = await canvasService.getEnergy(
        socket.user.id,
      );
      socket.emit("energyUpdate", energy, maxEnergy);
    }

    socket.on(
      "getEnergy",
      socketErrorMiddleware(async (_, callback) => {
        if (!socket.user) throw new Error("Unauthorized");
        const { energy, maxEnergy } = await canvasService.getEnergy(
          socket.user.id,
        );
        callback?.(energy, maxEnergy);
      }),
    );

    socket.on(
      "sendBatch",
      socketErrorMiddleware<[IPixel[] | undefined]>(
        async (
          pixels?: IPixel[],
          callback?: (
            err?: string,
            energyLeft?: number,
            maxEnergy?: number,
          ) => void,
        ) => {
          if (!socket.user) throw new Error("Unauthorized");
          if (!pixels || !Array.isArray(pixels) || pixels.length === 0)
            throw new Error("No pixels sent");

          for (const p of pixels) {
            if (
              p.x < 0 ||
              p.x >= CANVAS_WIDTH ||
              p.y < 0 ||
              p.y >= CANVAS_HEIGHT
            ) {
              throw new Error(`Pixel out of bounds: x=${p.x}, y=${p.y}`);
            }
          }

          let lastEnergyResult = null;
          for (const pixel of pixels) {
            lastEnergyResult = await canvasService.placePixel(
              socket.user.id,
              pixel,
            );
          }

          io.emit("updatePixels", pixels);
          socket.emit(
            "energyUpdate",
            lastEnergyResult?.energy,
            lastEnergyResult?.maxEnergy,
          );

          callback?.(
            undefined,
            lastEnergyResult?.energy,
            lastEnergyResult?.maxEnergy,
          );
        },
      ),
    );

    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.user?.email || socket.id);
    });
  });

  return io;
};

export { initCanvasSocket };
