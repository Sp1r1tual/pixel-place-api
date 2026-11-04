import "dotenv/config";
import "./shared/configs/env.js";

import http from "http";

import { app } from "./app.js";
import { initCanvasSocket } from "./canvas/canvas-sockets.js";
import { supabase } from "./shared/configs/supabase.js";

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    const { error } = await supabase
      .from("users")
      .select("id", { head: true })
      .limit(1);

    if (error) throw error;

    console.log("Supabase connected");

    const server = http.createServer(app);

    // The canvas is loaded before accepting connections so that no client
    // receives an empty or partial canvas right after a restart.
    await initCanvasSocket(server);

    server.listen(PORT, () => {
      console.log(`Server started on PORT: ${PORT}`);
    });
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
};

start();

export default app;
