"use strict";
// src/config/socket.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitUnreadCountUpdate = exports.emitToCategoryAdmin = exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const config_1 = __importDefault(require("../config"));
let io;
const initializeSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: [config_1.default.client_url, "http://localhost:5173"],
            methods: ["GET", "POST"],
            credentials: true,
        },
    });
    io.on("connection", (socket) => {
        console.log("✅ User connected:", socket.id);
        socket.on("disconnect", () => {
            console.log("❌ User disconnected:", socket.id);
        });
    });
    console.log("🔌 Socket.IO initialized");
    return io;
};
exports.initializeSocket = initializeSocket;
const getIO = () => {
    if (!io) {
        throw new Error("Socket.IO not initialized");
    }
    return io;
};
exports.getIO = getIO;
// message emission function to category admin
const emitToCategoryAdmin = (category, event, data) => {
    const io = (0, exports.getIO)();
    const room = `category-admin:${category}`;
    console.log(`👥 User joined room: ${room}`);
    io.to(room).emit(event, data);
    console.log(`📢 Emitted '${event}' to room: ${room}`);
};
exports.emitToCategoryAdmin = emitToCategoryAdmin;
// Emit unread count update to specific category admin
const emitUnreadCountUpdate = (category, type, count) => {
    const io = (0, exports.getIO)();
    // Emit to all admins in that category room
    io.to(`category-admin-${category}`).emit('unreadCountUpdate', {
        type,
        count,
        category,
        timestamp: new Date(),
    });
    console.log(`🔔 Unread ${type} count (${count}) emitted to category: ${category}`);
};
exports.emitUnreadCountUpdate = emitUnreadCountUpdate;
//# sourceMappingURL=socket.js.map