"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config"));
const db_1 = __importDefault(require("./config/db"));
const socket_1 = require("./config/socket");
const http_1 = __importDefault(require("http"));
const server = http_1.default.createServer(app_1.default);
async function main() {
    try {
        (0, db_1.default)();
        server.listen(config_1.default.port, () => {
            console.log(`🚀 Server is running on http://localhost:${config_1.default.port}`);
            // Socket.io Initialize
            (0, socket_1.initSocket)(server);
        });
        // Initialize Socket.IO
        (0, socket_1.initSocket)(server);
        console.log("🔌 Socket.IO initialized and ready");
    }
    catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=server.js.map