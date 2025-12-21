"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCreated = exports.sendSuccess = exports.sendError = void 0;
const sendError = (res, message, statusCode = 500, errors) => {
    const response = {
        success: false,
        message,
        errors: errors || [],
    };
    res.status(statusCode).json(response);
};
exports.sendError = sendError;
const sendSuccess = (res, message, data, statusCode = 200, meta) => {
    const response = {
        success: true,
        message,
        data,
        meta
    };
    return res.status(statusCode).json(response);
};
exports.sendSuccess = sendSuccess;
const sendCreated = (res, message = "Resource Created successfully", data, meta) => {
    return (0, exports.sendSuccess)(res, message, data, 201, meta);
};
exports.sendCreated = sendCreated;
//# sourceMappingURL=response.js.map