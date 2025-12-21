"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createError = exports.handleProcessErrors = exports.globalErrorHandler = exports.asyncHandler = exports.AppError = void 0;
const constants_1 = require("./constants");
const response_1 = require("./response");
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(statusCode = constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.AppError = AppError;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// global error handler
const globalErrorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || 500;
    error.status = err.status || "error";
    // specific error handle
    if (err.name === 'validationError') {
        const errors = Object.values(err.errors).map((val) => val.message);
        error.message = `Validation Error: ${errors.join(', ')}`;
        error.statusCode = constants_1.HTTP_STATUS.BAD_REQUEST;
        return (0, response_1.sendError)(res, error.message, error.statusCode, errors);
    }
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0];
        const value = field ? err.keyValue[field] : 'unknown';
        error.message = `${field} '${value}' already exists.`;
        error.statusCode = constants_1.HTTP_STATUS.CONFLICT;
    }
    if (err.name === 'CastError') {
        error.message = `Invalid ${err.path}: ${err.value}`;
        error.statusCode = constants_1.HTTP_STATUS.BAD_REQUEST;
    }
    if (err.name === 'JsonWebTokenError') {
        error.message = 'Invalid token. Please log in again.';
        error.statusCode = constants_1.HTTP_STATUS.UNAUTHORIZED;
    }
    if (err.name === 'TokenExpiredError') {
        error.message = 'Token expired';
        error.statusCode = constants_1.HTTP_STATUS.UNAUTHORIZED;
    }
    if (process.env.NODE_ENV === 'development') {
        return (0, response_1.sendError)(res, error.message, error.statusCode);
    }
    if (error.isOperational) {
        return (0, response_1.sendError)(res, error.message, error.statusCode);
    }
    console.error('Error:', err);
    return (0, response_1.sendError)(res, "Something went wrong", constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR);
};
exports.globalErrorHandler = globalErrorHandler;
// unhandle promise rejection
const handleProcessErrors = (err) => {
    process.on('unhandledRejection', (err) => {
        console.error('Unhandled rejection:', err);
        console.error(err.name, err.message);
        process.exit(1);
    });
    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        console.error(err.name, err.message);
        process.exit(1);
    });
};
exports.handleProcessErrors = handleProcessErrors;
// create custom error
const createError = (statusCode, message) => {
    return new AppError(statusCode, message);
};
exports.createError = createError;
//# sourceMappingURL=errorHandler.js.map