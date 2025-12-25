import { Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";
export declare const initSocket: (server: HttpServer) => IOServer;
export declare const getIO: () => IOServer;
export declare const emitToCategoryAdmin: (category: string, event: string, data: any) => void;
/**
 * Emit event to specific user
 */
export declare const emitToUser: (userId: string, event: string, data: any) => void;
/**
 * Emit event to all super admins
 */
export declare const emitToSuperAdmin: (event: string, data: any) => void;
/**
 * Broadcast to all connected clients
 */
export declare const broadcastToAll: (event: string, data: any) => void;
//# sourceMappingURL=socket.d.ts.map