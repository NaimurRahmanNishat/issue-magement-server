"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = __importDefault(require("./config"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const body_parser_1 = __importDefault(require("body-parser"));
const errorHandler_1 = require("./utils/errorHandler");
// ===========================================================================
// routes
// ===========================================================================
const user_routes_1 = __importDefault(require("./modules/users/user.routes"));
const issue_routes_1 = __importDefault(require("./modules/issues/issue.routes"));
const review_routes_1 = __importDefault(require("./modules/comments/review.routes"));
const stats_routes_1 = __importDefault(require("./modules/stats/stats.routes"));
const emergency_routes_1 = __importDefault(require("./modules/emergency/emergency.routes"));
const app = (0, express_1.default)();
// ===========================================================================
// middleware
// ===========================================================================
app.use((0, cors_1.default)({
    origin: [config_1.default.client_url, "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
}));
// Increase body parser limits for image uploads
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "50mb" }));
app.use((0, cookie_parser_1.default)());
app.use(body_parser_1.default.json({ limit: "50mb" }));
app.use(body_parser_1.default.urlencoded({ limit: "50mb", extended: true }));
// API 
app.use("/api/v1/auth", user_routes_1.default);
app.use("/api/v1/issues", issue_routes_1.default);
app.use("/api/v1/reviews", review_routes_1.default);
app.use("/api/v1/emergency", emergency_routes_1.default);
app.use("/api/v1/stats", stats_routes_1.default);
app.get("/", (_req, res) => {
    res.send("Citizen Driven Issue Reporting & Tracking System Server is Running...");
});
// global error handler
app.use(errorHandler_1.globalErrorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map