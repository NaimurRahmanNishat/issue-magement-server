// src/modules/comments/review.routes.ts

import { Router } from "express";
import { createComment, deleteComment, editComment, getAllCommentsForAdmin, getCommentsByIssue, getReviewById, getReviewsByUser, replyToComment } from "./review.controller";
import { authorizeRole, isAuthenticated } from "../../middleware/auth.middleware";


const router = Router();

// Get all comments for a specific issue (with cursor pagination)
router.get("/issue/:issueId", getCommentsByIssue);

// Get single review by ID
router.get("/single/:reviewId", getReviewById);

// Create new comment on an issue
router.post("/:issueId", isAuthenticated, createComment);

// Reply to a comment (supports nested replies)
router.post("/reply/:reviewId", isAuthenticated, replyToComment);

// Edit comment or reply
router.put("/:reviewId", isAuthenticated, editComment);

// Delete comment or reply
router.delete("/:reviewId", isAuthenticated, deleteComment);

// Get user's own reviews (with cursor pagination)
router.get("/user/:userId", isAuthenticated, getReviewsByUser);

// Get all comments for admin dashboard (with cursor pagination)
router.get( "/admin/all", isAuthenticated, authorizeRole("category-admin", "super-admin"), getAllCommentsForAdmin );

export const reviewRoutes = router; 