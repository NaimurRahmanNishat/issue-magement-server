"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// routes/emergency.route.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const emergency_controller_1 = require("./emergency.controller");
const router = (0, express_1.Router)();
// Send emergency message (any authenticated user)
router.post("/send", auth_middleware_1.isAuthenticated, emergency_controller_1.sendEmergencyMessage);
// Get messages (category-admin only)
router.get("/admin/messages", auth_middleware_1.isAuthenticated, auth_middleware_1.categoryAdminGuard, (0, auth_middleware_1.authorizeRole)("category-admin", "super-admin"), emergency_controller_1.getEmergencyMessagesForAdmin);
// Mark as read (category-admin only)
router.patch("/read/:messageId", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin"), emergency_controller_1.markMessageAsRead);
// Mark all messages as read 
router.patch("/read-all", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin"), emergency_controller_1.markAllMessagesAsRead);
router.get("/unread-count", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin"), emergency_controller_1.getUnreadCount);
// Delete an emergency message (category-admin only)
router.delete("/delete/:messageId", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin"), emergency_controller_1.deleteEmergencyMessage);
exports.default = router;
//# sourceMappingURL=emergency.routes.js.map