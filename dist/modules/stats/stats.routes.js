"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stats_controller_1 = require("./stats.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// 1. user stats
router.get("/user-stats", auth_middleware_1.isAuthenticated, stats_controller_1.userStats);
// 2. super-admin stats
router.get("/admin-stats", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("super-admin"), stats_controller_1.adminStats);
// 3. category-admin stats
router.get("/category-admin-stats", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin"), stats_controller_1.categoryAdminStats);
exports.default = router;
//# sourceMappingURL=stats.routes.js.map