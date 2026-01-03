"use strict";
// src/modules/issues/issue.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueRoutes = void 0;
const express_1 = require("express");
const multer_1 = require("../../middleware/multer");
const issue_controller_1 = require("./issue.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post("/create-issue", auth_middleware_1.isAuthenticated, multer_1.upload.fields([{ name: "images", maxCount: 3 }]), issue_controller_1.createIssue);
router.get("/", auth_middleware_1.optionalAuth, issue_controller_1.getAllIssues);
router.get("/:issueId", issue_controller_1.getIssueById);
router.put("/update-status/:issueId", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin", "super-admin"), issue_controller_1.updateIssueById);
router.delete("/:id", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin", "super-admin"), issue_controller_1.deleteIssueById);
router.get("/user-issues/:userId", auth_middleware_1.isAuthenticated, issue_controller_1.getIssueByUser);
router.get("/admin/unread-count", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin", "super-admin"), issue_controller_1.getUnreadIssuesCount);
router.patch("/admin/mark-read/:issueId", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin", "super-admin"), issue_controller_1.markIssueAsRead);
router.patch("/admin/mark-all-read", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin", "super-admin"), issue_controller_1.markAllIssuesAsRead);
exports.issueRoutes = router;
//# sourceMappingURL=issue.routes.js.map