import { Request, Response } from "express";
export declare const snedMessage: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getAllMessagesReceived: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateMessageById: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const deleteMessage: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getUnreadMessagesCount: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const markMessageAsReadByAdmin: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const markAllMessagesAsReadByAdmin: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=message.controller.d.ts.map