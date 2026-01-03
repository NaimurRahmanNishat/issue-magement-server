// routes/emergency.route.ts       

import { Router } from "express";
import { deleteMessage, getAllMessagesReceived, getUnreadMessagesCount, markAllMessagesAsReadByAdmin, markMessageAsReadByAdmin, snedMessage, updateMessageById } from "./message.controller";
import { isAuthenticated } from "../../middleware/auth.middleware";


const router = Router();

router.post("/send", isAuthenticated, snedMessage);
router.get("/receive", isAuthenticated, getAllMessagesReceived);
router.patch("/:id", isAuthenticated, updateMessageById);
router.delete("/:id", isAuthenticated, deleteMessage);
router.get("/admin/unread-count", getUnreadMessagesCount);
router.patch("/admin/mark-read/:messageId", isAuthenticated, markMessageAsReadByAdmin);
router.patch("/admin/mark-all-read", isAuthenticated, markAllMessagesAsReadByAdmin);

export const messageRoutes = router;