// src/config/socket.ts

import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import config from "../config";

let io: Server;

export const initializeSocket = (server: HTTPServer) => {
  io = new Server(server, {
    cors: {
      origin: [config.client_url, "http://localhost:5173"],
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

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};


// message emission function to category admin
export const emitToCategoryAdmin = (category: string, event: string, data: any) => {
  const io = getIO();
  const room = `category-admin:${category}`;
  console.log(`👥 User joined room: ${room}`);
  io.to(room).emit(event, data);
  console.log(`📢 Emitted '${event}' to room: ${room}`);
};


// Emit unread count update to specific category admin
export const emitUnreadCountUpdate = (category: string, type: 'issue' | 'message', count: number) => {
  const io = getIO();
  
  // Emit to all admins in that category room
  io.to(`category-admin-${category}`).emit('unreadCountUpdate', {
    type,
    count,
    category,
    timestamp: new Date(),
  });
  
  console.log(`🔔 Unread ${type} count (${count}) emitted to category: ${category}`);
};
