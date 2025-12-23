import app from "./app";
import config from "./config";
import dbConnect from "./config/db";
import { initSocket } from "./config/socket";
import http from "http";

const server = http.createServer(app);

async function main() {
  try {
    dbConnect();
    server.listen(config.port, () => {
    console.log(`🚀 Server is running on http://localhost:${config.port}`);
    // Socket.io Initialize
    initSocket(server);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

main();
