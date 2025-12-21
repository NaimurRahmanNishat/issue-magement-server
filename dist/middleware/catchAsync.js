"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catchAsync = void 0;
const errorHandler_1 = require("../utils/errorHandler");
const catchAsync = (fn) => (0, errorHandler_1.asyncHandler)(fn);
exports.catchAsync = catchAsync;
//# sourceMappingURL=catchAsync.js.map