import { Router } from "express";
import { createComment, deleteComment, editComment, getAllCommentsForAdmin, getCommentsByIssue, replyToComment } from "./review.controller";
import { authorizeRole, isAuthenticated } from "../../middleware/auth.middleware";


const router = Router();

// Public routes
router.get("/issue/:issueId", getCommentsByIssue);

// Authenticated routes
router.post("/create-comment/:issueId", isAuthenticated, createComment);
router.post("/reply/:reviewId", isAuthenticated, replyToComment);
router.put("/edit-review/:reviewId", isAuthenticated, editComment);
router.delete("/:reviewId", isAuthenticated, deleteComment);

// Admin route
router.get("/", isAuthenticated, authorizeRole("category-admin", "super-admin"), getAllCommentsForAdmin);

export default router; 