"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastToAll = exports.emitToSuperAdmin = exports.emitToUser = exports.emitToCategoryAdmin = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const _1 = __importDefault(require("."));
let io;
// Init Socket
const initSocket = (server) => {
    if (io)
        return io;
    io = new socket_io_1.Server(server, {
        cors: {
            origin: _1.default.client_url || "http://localhost:5173",
            credentials: true,
        },
        transports: ["websocket"],
        pingTimeout: 60000,
    });
    // Auth Middleware
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token)
                throw new Error("No token");
            const user = jsonwebtoken_1.default.verify(token, process.env.SOCKET_TOKEN_SECRET);
            socket.data.user = user;
            next();
        }
        catch {
            next(new Error("Authentication failed"));
        }
    });
    // Connection
    io.on("connection", (socket) => {
        const user = socket.data.user;
        console.log(`${socket.id} | ${user.role}`);
        // auto Rooms join
        if (user.role === "category-admin" && user.category) {
            join(socket, `admin:${user.category}`);
        }
        if (user.role === "user") {
            join(socket, `user:${user.id}`);
        }
        if (user.role === "super-admin") {
            join(socket, "admin:super");
        }
        // Base Events
        socket.on("ping", () => socket.emit("pong", { timestamp: Date.now() }));
        socket.on("joinRoom", (room) => join(socket, room));
        socket.on("leaveRoom", (room) => socket.leave(room));
        socket.on("disconnect", (r) => console.log(`${socket.id} disconnected: ${r}`));
    });
    console.log("🔌 Socket initialized");
    return io;
};
exports.initSocket = initSocket;
// Helpers
const join = (socket, room) => {
    socket.join(room);
    socket.emit("roomJoined", { success: true, room });
};
// Get IO Instance
const getIO = () => {
    if (!io)
        throw new Error("Socket not initialized");
    return io;
};
exports.getIO = getIO;
// Emit Helpers
const emitToCategoryAdmin = (category, event, data) => (0, exports.getIO)().to(`admin:${category}`).emit(event, data);
exports.emitToCategoryAdmin = emitToCategoryAdmin;
const emitToUser = (userId, event, data) => (0, exports.getIO)().to(`user:${userId}`).emit(event, data);
exports.emitToUser = emitToUser;
const emitToSuperAdmin = (event, data) => (0, exports.getIO)().to("admin:super").emit(event, data);
exports.emitToSuperAdmin = emitToSuperAdmin;
const broadcastToAll = (event, data) => (0, exports.getIO)().emit(event, data);
exports.broadcastToAll = broadcastToAll;
//# sourceMappingURL=socket.js.map