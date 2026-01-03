import { Request, Response } from "express";
export declare const createComment: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const replyToComment: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const editComment: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const deleteComment: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getAllCommentsForAdmin: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getCommentsByIssue: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getReviewById: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getReviewsByUser: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=review.controller.d.ts.map