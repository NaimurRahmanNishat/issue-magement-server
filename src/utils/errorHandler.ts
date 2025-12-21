// src/utils/errorHandler.ts
import { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "./constants";
import { sendError } from "./response";


export class AppError extends Error{
    public statusCode: number;
    public isOperational: boolean;
    constructor(statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,message: string) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}


export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};


// global error handler
export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    let error = {...err};
    error.message = err.message;
    error.statusCode = err.statusCode || 500;
    error.status = err.status || "error";
    
    // specific error handle
    if(err.name === 'validationError'){
        const errors = Object.values(err.errors).map((val: any) => val.message);
        error.message = `Validation Error: ${errors.join(', ')}`;
        error.statusCode = HTTP_STATUS.BAD_REQUEST;
        return sendError(res, error.message, error.statusCode, errors);
    }

    if(err.code === 11000){
        const field = Object.keys(err.keyValue || {})[0];
        const value = field ? err.keyValue[field] : 'unknown';
        error.message = `${field} '${value}' already exists.`;
        error.statusCode = HTTP_STATUS.CONFLICT;
    }

    if(err.name === 'CastError'){
        error.message = `Invalid ${err.path}: ${err.value}`;
        error.statusCode = HTTP_STATUS.BAD_REQUEST;
    }

    if(err.name === 'JsonWebTokenError'){
        error.message = 'Invalid token. Please log in again.';
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
    }

    if(err.name === 'TokenExpiredError'){
        error.message = 'Token expired';
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
    }

    if(process.env.NODE_ENV==='development'){
        return sendError(res, error.message, error.statusCode);
    }
    
    if(error.isOperational){
        return sendError(res, error.message, error.statusCode);
    }
    console.error('Error:', err);
    return sendError(res, "Something went wrong", HTTP_STATUS.INTERNAL_SERVER_ERROR);
}


// unhandle promise rejection
export const handleProcessErrors = (err: any) => {
    process.on('unhandledRejection', (err: any) => {
        console.error('Unhandled rejection:', err);
        console.error(err.name, err.message);
        process.exit(1);
    })

    process.on('uncaughtException', (err: any) => {
        console.error('Uncaught exception:', err);
        console.error(err.name, err.message);
        process.exit(1);
    })
}

// create custom error
export const createError = ( statusCode: number, message: string ) => {
    return new AppError( statusCode, message);
}
