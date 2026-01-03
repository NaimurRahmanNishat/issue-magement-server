// src/modules/issues/issue.routes.ts

import { Router } from "express";
import { upload } from "../../middleware/multer";
import { createIssue, deleteIssueById, getAllIssues, getIssueById, getIssueByUser, getUnreadIssuesCount, markAllIssuesAsRead, markIssueAsRead, updateIssueById } from "./issue.controller";
import { authorizeRole, isAuthenticated, optionalAuth } from "../../middleware/auth.middleware";


const router = Router();

router.post( "/create-issue", isAuthenticated, upload.fields([{ name: "images", maxCount: 3 }]), createIssue );
router.get("/", optionalAuth,  getAllIssues);
router.get("/:issueId",  getIssueById);
router.put("/update-status/:issueId", isAuthenticated, authorizeRole("category-admin", "super-admin"), updateIssueById);
router.delete("/:id", isAuthenticated, authorizeRole("category-admin", "super-admin"), deleteIssueById);
router.get("/user-issues/:userId", isAuthenticated, getIssueByUser);
router.get("/admin/unread-count", isAuthenticated, authorizeRole("category-admin", "super-admin"), getUnreadIssuesCount);
router.patch("/admin/mark-read/:issueId", isAuthenticated, authorizeRole("category-admin", "super-admin"), markIssueAsRead);
router.patch("/admin/mark-all-read", isAuthenticated, authorizeRole("category-admin", "super-admin"), markAllIssuesAsRead);


export const issueRoutes = router;