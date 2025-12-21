// routes/emergency.route.ts
import { Router } from "express";
import { authorizeRole, categoryAdminGuard, isAuthenticated } from "../../middleware/auth.middleware";
import { deleteEmergencyMessage, getEmergencyMessagesForAdmin, getUnreadCount, markAllMessagesAsRead, markMessageAsRead, sendEmergencyMessage } from "./emergency.controller";
const router = Router();

// Send emergency message (any authenticated user)
router.post("/send", isAuthenticated, sendEmergencyMessage);

// Get messages (category-admin only)
router.get( "/admin/messages", isAuthenticated, categoryAdminGuard, authorizeRole("category-admin", "super-admin"), getEmergencyMessagesForAdmin);

// Mark as read (category-admin only)
router.patch( "/read/:messageId", isAuthenticated, authorizeRole("category-admin"), markMessageAsRead );

// Mark all messages as read 
router.patch( "/read-all", isAuthenticated, authorizeRole("category-admin"), markAllMessagesAsRead );

router.get("/unread-count", isAuthenticated, authorizeRole("category-admin"), getUnreadCount);

// Delete an emergency message (category-admin only)
router.delete("/delete/:messageId", isAuthenticated, authorizeRole("category-admin"), deleteEmergencyMessage);

export default router;
