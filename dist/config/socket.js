"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastToAll = exports.emitToSuperAdmin = exports.emitToUser = exports.emitToCategoryAdmin = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const _1 = __importDefault(require("."));
let io = null;
// ============================================
// Socket.IO Initialization
// ============================================
const initSocket = (server) => {
    if (io) {
        console.log("⚠️ Socket.IO already initialized, returning existing instance");
        return io;
    }
    // Create Socket.IO Server
    io = new socket_io_1.Server(server, {
        cors: {
            origin: _1.default.client_url || ["http://localhost:5173"],
            credentials: true,
            methods: ["GET", "POST"],
        },
        // Performance & Connection Settings
        pingTimeout: 60000, // 60 seconds
        pingInterval: 25000, // 25 seconds
        maxHttpBufferSize: 1e6, // 1MB
        transports: ["websocket", "polling"],
    });
    // ============================================
    // Authentication Middleware
    // ============================================
    io.use((socket, next) => {
        const token = socket.handshake?.auth?.token;
        if (!token) {
            console.warn(`❌ Socket connection rejected (no token): ${socket.id}`);
            return next(new Error("Authentication required"));
        }
        try {
            // Verify JWT Token
            const decoded = jsonwebtoken_1.default.verify(token, process.env.SOCKET_TOKEN_SECRET || process.env.REFRESH_TOKEN_SECRET);
            // Validate user data
            if (!decoded.id || !decoded.role) {
                console.warn(`❌ Invalid token payload: ${socket.id}`);
                return next(new Error("Invalid token payload"));
            }
            // Attach user data to socket
            socket.data.user = decoded;
            return next();
        }
        catch (err) {
            console.error(`❌ Socket auth failed: ${socket.id}`, err.message);
            return next(new Error("Invalid or expired token"));
        }
    });
    // ============================================
    // Connection Handler
    // ============================================
    io.on("connection", (socket) => {
        const authSocket = socket;
        const user = authSocket.data.user;
        // Safety check
        if (!user || !user.id) {
            console.warn(`❌ Unauthenticated socket connected: ${socket.id}`);
            socket.disconnect(true);
            return;
        }
        console.log(`✅ Socket connected: ${socket.id} | User: ${user.id} | Role: ${user.role}`);
        // ============================================
        // Role-Based Room Assignment
        // ============================================
        // 1. Category Admin Room
        if (user.role === "category-admin" && user.category) {
            const adminRoom = `admin:${user.category}`;
            socket.join(adminRoom);
            console.log(`👨‍💼 Admin ${user.id} joined room: ${adminRoom}`);
            // Send confirmation to client
            socket.emit("roomJoined", {
                success: true,
                room: adminRoom,
                message: `Joined ${user.category} admin room`,
            });
        }
        // 2. User Personal Room
        if (user.role === "user") {
            const userRoom = `user:${user.id}`;
            socket.join(userRoom);
            console.log(`👤 User ${user.id} joined personal room: ${userRoom}`);
            socket.emit("roomJoined", {
                success: true,
                room: userRoom,
                message: "Joined personal room",
            });
        }
        // 3. Super Admin Room (optional)
        if (user.role === "super-admin") {
            socket.join("admin:super");
            console.log(`🔑 Super Admin ${user.id} joined super admin room`);
            socket.emit("roomJoined", {
                success: true,
                room: "admin:super",
                message: "Joined super admin room",
            });
        }
        // ============================================
        // Event Handlers
        // ============================================
        // Test event (for debugging)
        socket.on("ping", () => {
            socket.emit("pong", { timestamp: Date.now() });
        });
        // Custom event example
        socket.on("joinRoom", (roomName) => {
            if (roomName && typeof roomName === "string") {
                socket.join(roomName);
                console.log(`📥 ${user.id} manually joined room: ${roomName}`);
                socket.emit("roomJoined", { success: true, room: roomName });
            }
        });
        socket.on("leaveRoom", (roomName) => {
            if (roomName && typeof roomName === "string") {
                socket.leave(roomName);
                console.log(`📤 ${user.id} left room: ${roomName}`);
            }
        });
        // ============================================
        // Disconnect Handler
        // ============================================
        socket.on("disconnect", (reason) => {
            console.log(`❌ Socket disconnected: ${socket.id} | User: ${user.id} | Reason: ${reason}`);
        });
        // ============================================
        // Error Handler
        // ============================================
        socket.on("error", (error) => {
            console.error(`⚠️ Socket error for ${socket.id}:`, error);
        });
    });
    console.log("🔌 Socket.IO initialized successfully");
    return io;
};
exports.initSocket = initSocket;
// ============================================
// Get Socket.IO Instance
// ============================================
const getIO = () => {
    if (!io) {
        throw new Error("❌ Socket.IO not initialized. Call initSocket(server) first.");
    }
    return io;
};
exports.getIO = getIO;
// ============================================
// Utility Functions
// ============================================
/*
 * Emit event to specific category admin room
 */
const emitToCategoryAdmin = (category, event, data) => {
    const io = (0, exports.getIO)();
    const room = `admin:${category}`;
    io.to(room).emit(event, data);
    console.log(`📢 Emitted '${event}' to room: ${room}`);
};
exports.emitToCategoryAdmin = emitToCategoryAdmin;
/**
 * Emit event to specific user
 */
const emitToUser = (userId, event, data) => {
    const io = (0, exports.getIO)();
    const room = `user:${userId}`;
    io.to(room).emit(event, data);
    console.log(`📢 Emitted '${event}' to user: ${userId}`);
};
exports.emitToUser = emitToUser;
/**
 * Emit event to all super admins
 */
const emitToSuperAdmin = (event, data) => {
    const io = (0, exports.getIO)();
    io.to("admin:super").emit(event, data);
    console.log(`📢 Emitted '${event}' to super admins`);
};
exports.emitToSuperAdmin = emitToSuperAdmin;
/**
 * Broadcast to all connected clients
 */
const broadcastToAll = (event, data) => {
    const io = (0, exports.getIO)();
    io.emit(event, data);
    console.log(`📢 Broadcasted '${event}' to all clients`);
};
exports.broadcastToAll = broadcastToAll;
//# sourceMappingURL=socket.js.map