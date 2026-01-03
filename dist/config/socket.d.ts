import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
export declare const initializeSocket: (server: HTTPServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const getIO: () => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const emitToCategoryAdmin: (category: string, event: string, data: any) => void;
export declare const emitUnreadCountUpdate: (category: string, type: "issue" | "message", count: number) => void;
//# sourceMappingURL=socket.d.ts.map