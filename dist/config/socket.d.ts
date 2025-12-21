import { Server as HttpServer } from "http";
import { Server } from "socket.io";
export declare const initSocket: (server: HttpServer) => Server;
export declare const getIO: () => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const emitToCategoryAdmin: (category: string, event: string, data: any) => boolean;
export declare const emitToUser: (userId: string, event: string, data: any) => boolean;
export declare const emitToSuperAdmin: (event: string, data: any) => boolean;
export declare const broadcastToAll: (event: string, data: any) => boolean;
//# sourceMappingURL=socket.d.ts.map