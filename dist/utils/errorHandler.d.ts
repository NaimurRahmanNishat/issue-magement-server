import { NextFunction, Request, Response } from "express";
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(statusCode: number | undefined, message: string);
}
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const globalErrorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
export declare const handleProcessErrors: (err: any) => void;
export declare const createError: (statusCode: number, message: string) => AppError;
//# sourceMappingURL=errorHandler.d.ts.map