// src/config/socket.ts
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import config from ".";

let io: Server;

interface SocketUser {
  id: string;
  role: "user" | "category-admin" | "super-admin";
  category?: string;
  email?: string;
}


// Init Socket
export const initSocket = (server: HttpServer): Server => {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: config.client_url || "http://localhost:5173",
      credentials: true,
    },
    transports: ["websocket"],
    pingTimeout: 60000,
  });


  // Auth Middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error("No token");

      const user = jwt.verify(
        token,
        process.env.SOCKET_TOKEN_SECRET!
      ) as SocketUser;

      socket.data.user = user;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  // Connection
  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as SocketUser;

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
    socket.on("ping", () =>
      socket.emit("pong", { timestamp: Date.now() })
    );

    socket.on("joinRoom", (room: string) => join(socket, room));
    socket.on("leaveRoom", (room: string) => socket.leave(room));

    socket.on("disconnect", (r) =>
      console.log(`${socket.id} disconnected: ${r}`)
    );
  });

  console.log("🔌 Socket initialized");
  return io;
};


// Helpers
const join = (socket: Socket, room: string) => {
  socket.join(room);
  socket.emit("roomJoined", { success: true, room });
};


// Get IO Instance
export const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};


// Emit Helpers
export const emitToCategoryAdmin = (category: string, event: string, data: any) =>
  getIO().to(`admin:${category}`).emit(event, data);

export const emitToUser = (userId: string, event: string, data: any) =>
  getIO().to(`user:${userId}`).emit(event, data);

export const emitToSuperAdmin = (event: string, data: any) =>
  getIO().to("admin:super").emit(event, data);

export const broadcastToAll = (event: string, data: any) =>
  getIO().emit(event, data);
