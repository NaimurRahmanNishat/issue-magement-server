// src/modules/issues/issue.routes.ts
import { Router } from "express";
import { createIssue, deleteIssueById, getAllIssues, getIssueById, getIssueByUser, updateIssueById } from "./issue.controller";
import { authorizeRole, isAuthenticated, optionalAuth } from "../../middleware/auth.middleware";
import { uploadImages } from "../../middleware/upload.middleware";


const router = Router();

router.post("/create-issue", isAuthenticated, uploadImages.array("images", 3), createIssue);
router.get("/all-issues", optionalAuth,  getAllIssues);
router.get("/:issueId",  getIssueById);
router.put("/update-status/:issueId", isAuthenticated, authorizeRole("category-admin", "super-admin"), updateIssueById);
router.delete("/:id", isAuthenticated, authorizeRole("category-admin", "super-admin"), deleteIssueById);
router.get("/user-issues/:userId", isAuthenticated, getIssueByUser);


export default router;