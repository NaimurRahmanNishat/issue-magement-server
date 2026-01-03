"use strict";
// src/middleware/validate.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const catchAsync_1 = require("./catchAsync");
const errorHandler_1 = require("../utils/errorHandler");
const validate = (schema) => (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const dataToValidate = {};
    if (schema.shape.body)
        dataToValidate.body = req.body;
    if (schema.shape.params)
        dataToValidate.params = req.params;
    if (schema.shape.query) {
        if (req.query && Object.keys(req.query).length) {
            dataToValidate.query = req.query;
        }
    }
    ;
    if (schema.shape.cookies)
        dataToValidate.cookies = req.cookies;
    try {
        const validatedData = await schema.parseAsync(dataToValidate);
        if (validatedData.body)
            req.body = validatedData.body;
        if (validatedData.params)
            req.params = validatedData.params;
        if (validatedData.query)
            req.query = validatedData.query;
        next();
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            const errorMessage = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
            throw (0, errorHandler_1.createError)(400, `Validation Faild: ${errorMessage.join(', ')}`);
        }
        throw (0, errorHandler_1.createError)(500, "Validation failed due to an unexpected server error");
    }
});
exports.validate = validate;
//# sourceMappingURL=validate.middleware.js.map