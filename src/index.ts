import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import cookieParser from "cookie-parser";
import { createClient } from "@supabase/supabase-js";

import { initCanvasSocket } from "./canvas/canvas-sockets.js";

import { router } from "./router.js";
import { errorMiddleware } from "./shared/middlewares/error-middleware.js";

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PORT = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

router(app);

app.use(errorMiddleware);

initCanvasSocket(server);

const start = async () => {
  try {
    const { error } = await supabase.from("users").select("*").limit(1);

    if (error) throw error;

    console.log("Supabase connected");

    server.listen(PORT, () => {
      console.log(`Server started on PORT: ${PORT}`);
    });
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
};

start();
