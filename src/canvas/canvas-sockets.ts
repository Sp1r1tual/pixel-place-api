import { Server as IOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";

import { ITokenPayload } from "../types/auth.js";
import { IPixel } from "../types/canvas.js";

import { socketErrorMiddleware } from "./middlewares/socket-error-middleware.js";

import { AuthService } from "../auth/services/auth-service.js";
import { CanvasService } from "./services/canvas-service.js";

import { ApiError } from "../shared/exceptions/api-error.js";
import { formatDateTime } from "../shared/utils/format-date.js";

const authService = new AuthService();
const canvasService = new CanvasService();

interface CanvasSocket extends Socket {
  user?: { id: string; email: string };
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;
const canvasState: Record<string, IPixel> = {};

const initCanvasSocket = (server: HttpServer) => {
  const io = new IOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
    path: "/canvas/socket.io",
  });

  const initializeCanvas = async () => {
    try {
      const pixelsFromDb = await canvasService.getAllPixels();

      Object.keys(canvasState).forEach((key) => delete canvasState[key]);

      pixelsFromDb.forEach((p) => {
        canvasState[`${p.x}:${p.y}`] = {
          x: p.x,
          y: p.y,
          color: p.color,
          userId: p.userId,
          placedAt: p.placedAt,
        };
      });

      console.log(
        `[Canvas] Loaded ${pixelsFromDb.length} pixels from database`,
      );
    } catch (error) {
      console.error("[Canvas] Failed to load initial state:", error);
    }
  };

  initializeCanvas();

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

    const energyResult = socket.user
      ? await canvasService.getEnergy(socket.user.id)
      : null;

    socket.emit("canvasState", Object.values(canvasState));

    if (energyResult) {
      socket.emit(
        "energyUpdate",
        energyResult.energy,
        energyResult.maxEnergy,
        energyResult.recoverySpeed,
        energyResult.updatedAt,
      );
    }

    socket.on("token_refresh", (newToken: string) => {
      try {
        const payload = authService.validateAccessToken(
          newToken,
        ) as ITokenPayload;
        socket.user = { id: payload.id, email: payload.email };

        const msToExpire = payload.exp * 1000 - Date.now();
        if (msToExpire > 0) {
          setTimeout(() => socket.emit("token_expired"), msToExpire);
        }

        console.log(`[socket] Token refreshed for ${socket.user.email}`);
      } catch (err) {
        console.error("[socket] Invalid refreshed token:", err);
        socket.emit("server_error", {
          message: "Invalid token after refresh",
        });
        socket.disconnect(true);
      }
    });

    socket.on(
      "getEnergy",
      socketErrorMiddleware(async (_, callback) => {
        if (!socket.user) throw new Error("Unauthorized");

        const result = await canvasService.getEnergy(socket.user.id);
        callback(
          result.energy,
          result.maxEnergy,
          result.recoverySpeed,
          result.updatedAt,
        );
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

          if (!pixels || !Array.isArray(pixels) || pixels.length === 0) {
            throw new Error("No pixels sent");
          }

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

          try {
            await canvasService.placePixelsBatch(socket.user.id, pixels);

            const isoDate = new Date().toISOString();
            const placedAt = formatDateTime(isoDate);

            const pixelsWithUserId: IPixel[] = pixels.map((pixel) => {
              const pixelWithUserId: IPixel = {
                x: pixel.x,
                y: pixel.y,
                color: pixel.color,
                userId: socket.user!.id,
                placedAt: placedAt,
              };

              canvasState[`${pixel.x}:${pixel.y}`] = pixelWithUserId;
              return pixelWithUserId;
            });

            const energyResultPromise = canvasService.getEnergy(socket.user.id);
            io.emit("updatePixels", pixelsWithUserId);
            const energyResult = await energyResultPromise;

            socket.emit(
              "energyUpdate",
              energyResult.energy,
              energyResult.maxEnergy,
              energyResult.recoverySpeed,
              energyResult.updatedAt,
            );

            callback?.(undefined, energyResult.energy, energyResult.maxEnergy);
          } catch (err: unknown) {
            console.error("[sendBatch] Error:", err);

            if (err instanceof ApiError) {
              callback?.(err.message);
              socket.emit("server_error", { message: err.message });
            } else {
              callback?.("errors.something-went-wrong");
              socket.emit("server_error", {
                message: "errors.something-went-wrong",
              });
            }
          }
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
