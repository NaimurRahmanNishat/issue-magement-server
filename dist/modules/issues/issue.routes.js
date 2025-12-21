"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/issues/issue.routes.ts
const express_1 = require("express");
const issue_controller_1 = require("./issue.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const router = (0, express_1.Router)();
router.post("/create-issue", auth_middleware_1.isAuthenticated, upload_middleware_1.uploadImages.array("images", 3), issue_controller_1.createIssue);
router.get("/all-issues", auth_middleware_1.optionalAuth, issue_controller_1.getAllIssues);
router.get("/:issueId", issue_controller_1.getIssueById);
router.put("/update-status/:issueId", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin", "super-admin"), issue_controller_1.updateIssueById);
router.delete("/:id", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin", "super-admin"), issue_controller_1.deleteIssueById);
router.get("/user-issues/:userId", auth_middleware_1.isAuthenticated, issue_controller_1.getIssueByUser);
exports.default = router;
//# sourceMappingURL=issue.routes.js.map