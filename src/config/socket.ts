// src/config/socket.ts
import { Server as HttpServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import config from ".";

let io: IOServer | null = null;

// ============================================
// TypeScript Interfaces
// ============================================

interface SocketUser {
  id: string;
  role: "user" | "category-admin" | "super-admin";
  category?: string;
  email?: string;
}

interface AuthenticatedSocket extends Socket {
  data: {
    user: SocketUser;
  };
}

// ============================================
// Socket.IO Initialization
// ============================================

export const initSocket = (server: HttpServer): IOServer => {
  if (io) {
    console.log("⚠️ Socket.IO already initialized, returning existing instance");
    return io;
  }

  // Create Socket.IO Server
  io = new IOServer(server, {
    cors: {
      origin: config.client_url || ["http://localhost:5173"],
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

  io.use((socket: Socket, next) => {
    const token = socket.handshake?.auth?.token;

    if (!token) {
      console.warn(`❌ Socket connection rejected (no token): ${socket.id}`);
      return next(new Error("Authentication required"));
    }

    try {
      // Verify JWT Token
      const decoded = jwt.verify(
        token,
        process.env.SOCKET_TOKEN_SECRET || process.env.REFRESH_TOKEN_SECRET!
      ) as SocketUser;

      // Validate user data
      if (!decoded.id || !decoded.role) {
        console.warn(`❌ Invalid token payload: ${socket.id}`);
        return next(new Error("Invalid token payload"));
      }

      // Attach user data to socket
      socket.data.user = decoded;
      return next();
    } catch (err: any) {
      console.error(`❌ Socket auth failed: ${socket.id}`, err.message);
      return next(new Error("Invalid or expired token"));
    }
  });

  // ============================================
  // Connection Handler
  // ============================================

  io.on("connection", (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const user = authSocket.data.user;

    // Safety check
    if (!user || !user.id) {
      console.warn(`❌ Unauthenticated socket connected: ${socket.id}`);
      socket.disconnect(true);
      return;
    }

    console.log(
      `✅ Socket connected: ${socket.id} | User: ${user.id} | Role: ${user.role}`
    );

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
    socket.on("joinRoom", (roomName: string) => {
      if (roomName && typeof roomName === "string") {
        socket.join(roomName);
        console.log(`📥 ${user.id} manually joined room: ${roomName}`);
        socket.emit("roomJoined", { success: true, room: roomName });
      }
    });

    socket.on("leaveRoom", (roomName: string) => {
      if (roomName && typeof roomName === "string") {
        socket.leave(roomName);
        console.log(`📤 ${user.id} left room: ${roomName}`);
      }
    });

    // ============================================
    // Disconnect Handler
    // ============================================

    socket.on("disconnect", (reason) => {
      console.log(
        `❌ Socket disconnected: ${socket.id} | User: ${user.id} | Reason: ${reason}`
      );
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

// ============================================
// Get Socket.IO Instance
// ============================================

export const getIO = (): IOServer => {
  if (!io) {
    throw new Error(
      "❌ Socket.IO not initialized. Call initSocket(server) first."
    );
  }
  return io;
};

// ============================================
// Utility Functions
// ============================================

/*
 * Emit event to specific category admin room
 */
export const emitToCategoryAdmin = (
  category: string,
  event: string,
  data: any
) => {
  const io = getIO();
  const room = `admin:${category}`;
  io.to(room).emit(event, data);
  console.log(`📢 Emitted '${event}' to room: ${room}`);
};

/**
 * Emit event to specific user
 */
export const emitToUser = (userId: string, event: string, data: any) => {
  const io = getIO();
  const room = `user:${userId}`;
  io.to(room).emit(event, data);
  console.log(`📢 Emitted '${event}' to user: ${userId}`);
};

/**
 * Emit event to all super admins
 */
export const emitToSuperAdmin = (event: string, data: any) => {
  const io = getIO();
  io.to("admin:super").emit(event, data);
  console.log(`📢 Emitted '${event}' to super admins`);
};

/**
 * Broadcast to all connected clients
 */
export const broadcastToAll = (event: string, data: any) => {
  const io = getIO();
  io.emit(event, data);
  console.log(`📢 Broadcasted '${event}' to all clients`);
};