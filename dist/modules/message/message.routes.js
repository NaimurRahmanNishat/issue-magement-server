"use strict";
// routes/emergency.route.ts       
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRoutes = void 0;
const express_1 = require("express");
const message_controller_1 = require("./message.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post("/send", auth_middleware_1.isAuthenticated, message_controller_1.snedMessage);
router.get("/receive", auth_middleware_1.isAuthenticated, message_controller_1.getAllMessagesReceived);
router.patch("/:id", auth_middleware_1.isAuthenticated, message_controller_1.updateMessageById);
router.delete("/:id", auth_middleware_1.isAuthenticated, message_controller_1.deleteMessage);
router.get("/admin/unread-count", message_controller_1.getUnreadMessagesCount);
router.patch("/admin/mark-read/:messageId", auth_middleware_1.isAuthenticated, message_controller_1.markMessageAsReadByAdmin);
router.patch("/admin/mark-all-read", auth_middleware_1.isAuthenticated, message_controller_1.markAllMessagesAsReadByAdmin);
exports.messageRoutes = router;
//# sourceMappingURL=message.routes.js.map