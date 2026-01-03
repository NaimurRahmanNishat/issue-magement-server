// src/server.ts

import app from "./app";
import config from "./config";
import dbConnect from "./config/db";
import http from "http";
import { initializeSocket } from "./config/socket";

const server = http.createServer(app);
initializeSocket(server);

async function main() {
  try {
    dbConnect();
    server.listen(config.port, () => {
      console.log(`🚀 Server is running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

main();
