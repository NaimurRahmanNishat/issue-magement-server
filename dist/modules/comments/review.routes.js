"use strict";
// src/modules/comments/review.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRoutes = void 0;
const express_1 = require("express");
const review_controller_1 = require("./review.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Get all comments for a specific issue (with cursor pagination)
router.get("/issue/:issueId", review_controller_1.getCommentsByIssue);
// Get single review by ID
router.get("/single/:reviewId", review_controller_1.getReviewById);
// Create new comment on an issue
router.post("/:issueId", auth_middleware_1.isAuthenticated, review_controller_1.createComment);
// Reply to a comment (supports nested replies)
router.post("/reply/:reviewId", auth_middleware_1.isAuthenticated, review_controller_1.replyToComment);
// Edit comment or reply
router.put("/:reviewId", auth_middleware_1.isAuthenticated, review_controller_1.editComment);
// Delete comment or reply
router.delete("/:reviewId", auth_middleware_1.isAuthenticated, review_controller_1.deleteComment);
// Get user's own reviews (with cursor pagination)
router.get("/user/:userId", auth_middleware_1.isAuthenticated, review_controller_1.getReviewsByUser);
// Get all comments for admin dashboard (with cursor pagination)
router.get("/admin/all", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("category-admin", "super-admin"), review_controller_1.getAllCommentsForAdmin);
exports.reviewRoutes = router;
//# sourceMappingURL=review.routes.js.map