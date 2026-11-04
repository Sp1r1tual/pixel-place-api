import { Server as IOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";

import { IEnergyState, IPixel } from "../types/canvas.js";

import { AuthService } from "../auth/services/auth-service.js";
import { CanvasService } from "./services/canvas-service.js";

import { ApiError } from "../shared/exceptions/api-error.js";
import { parsePixelBatch } from "./utils/parse-pixel-batch.js";

const canvasService = new CanvasService();
const authService = new AuthService();

const GENERIC_ERROR = "errors.something-went-wrong";
const MAX_INCOMING_MESSAGE_BYTES = 64 * 1024;

type CanvasSocket = Socket & {
  user?: { id: string; email: string };
};

type SendBatchAck = (err?: string, energy?: number, maxEnergy?: number) => void;

const canvasState = new Map<string, IPixel>();

const emitEnergy = (socket: Socket, state: IEnergyState) => {
  socket.emit(
    "energyUpdate",
    state.energy,
    state.maxEnergy,
    state.recoverySpeed,
    state.updatedAt,
  );
};

const toClientError = (err: unknown): string => {
  if (err instanceof ApiError) return err.message;

  console.error("[socket]", err);
  return GENERIC_ERROR;
};

const initCanvasSocket = async (server: HttpServer) => {
  const pixelsFromDb = await canvasService.getAllPixels();

  for (const pixel of pixelsFromDb) {
    canvasState.set(`${pixel.x}:${pixel.y}`, pixel);
  }

  console.log(`[Canvas] Loaded ${pixelsFromDb.length} pixels from database`);

  const io = new IOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
    path: "/canvas/socket.io",
    maxHttpBufferSize: MAX_INCOMING_MESSAGE_BYTES,
  });

  io.use((socket: CanvasSocket, next) => {
    try {
      const authHeader = String(socket.handshake.auth?.authorization ?? "");
      const token = authHeader.split(" ")[1];

      if (!token) return next(new Error("Unauthorized"));

      const { id, email } = authService.validateAccessToken(token);
      socket.user = { id, email };

      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: CanvasSocket) => {
    const userId = socket.user!.id;

    // Handlers are attached before any await: socket.io drops events that arrive
    // while no listener exists.
    socket.on("sendBatch", async (input: unknown, callback?: SendBatchAck) => {
      const ack: SendBatchAck =
        typeof callback === "function" ? callback : () => undefined;

      try {
        const pixels = parsePixelBatch(input);
        const result = await canvasService.placePixels(userId, pixels);

        const placed: IPixel[] = pixels.map((pixel) => ({
          ...pixel,
          userId,
          placedAt: result.placedAt,
        }));

        for (const pixel of placed) {
          canvasState.set(`${pixel.x}:${pixel.y}`, pixel);
        }

        io.emit("updatePixels", placed);
        emitEnergy(socket, result);
        ack(undefined, result.energy, result.maxEnergy);
      } catch (err) {
        ack(toClientError(err));
      }
    });

    socket.emit("canvasState", [...canvasState.values()]);

    canvasService
      .getEnergy(userId)
      .then((state) => emitEnergy(socket, state))
      .catch((err) =>
        socket.emit("server_error", { message: toClientError(err) }),
      );
  });

  return io;
};

export { initCanvasSocket };
