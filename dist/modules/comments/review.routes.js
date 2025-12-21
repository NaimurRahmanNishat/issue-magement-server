"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const review_controller_1 = require("./review.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public routes
router.get("/issue/:issueId", review_controller_1.getCommentsByIssue);
// Authenticated routes
router.post("/create-comment/:issueId", auth_middleware_1.isAuthenticated, review_controller_1.createComment);
router.post("/reply/:reviewId", auth_middleware_1.isAuthenticated, review_controller_1.replyToComment);
router.put("/edit-review/:reviewId", auth_middleware_1.isAuthenticated, review_controller_1.editComment);
router.delete("/:reviewId", auth_middleware_1.isAuthenticated, review_controller_1.deleteComment);
// Admin route
router.get("/", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin", "super-admin"), review_controller_1.getAllCommentsForAdmin);
exports.default = router;
//# sourceMappingURL=review.routes.js.map