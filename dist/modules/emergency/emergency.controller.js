"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEmergencyMessage = exports.getUnreadCount = exports.markAllMessagesAsRead = exports.markMessageAsRead = exports.getEmergencyMessagesForAdmin = exports.sendEmergencyMessage = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const socket_1 = require("../../config/socket");
const errorHandler_1 = require("../../utils/errorHandler");
const emergency_model_1 = require("./emergency.model");
// Send emergency message
exports.sendEmergencyMessage = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { category, message } = req.body;
    const user = req.user;
    if (!category || !message) {
        throw new errorHandler_1.AppError(400, "Category and message are required!");
    }
    // Validation: message length check
    if (message.trim().length < 2) {
        throw new errorHandler_1.AppError(400, "Message must be at least 2 characters long");
    }
    // Create emergency message
    const emergencyMessage = await emergency_model_1.EmergencyMessage.create({
        sender: user._id,
        senderName: user.name,
        senderEmail: user.email,
        message,
        category,
        status: "pending",
        createdAt: new Date(),
    });
    // Emit to Category Admin via Socket.IO
    try {
        (0, socket_1.emitToCategoryAdmin)(category, "newEmergency", {
            _id: emergencyMessage._id,
            senderId: emergencyMessage.sender,
            senderName: emergencyMessage.senderName,
            senderEmail: emergencyMessage.senderEmail,
            message: emergencyMessage.message,
            category: emergencyMessage.category,
            status: emergencyMessage.status,
            createdAt: emergencyMessage.createdAt,
        });
        console.log(`🚨 Emergency emitted to admin:${category}`);
    }
    catch (socketError) {
        console.error("Socket emit error:", socketError);
        // Continue even if socket fails
    }
    res.status(201).json({
        success: true,
        data: emergencyMessage,
        message: "Emergency message sent successfully",
    });
});
// Get emergency messages for category-admin
exports.getEmergencyMessagesForAdmin = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const { page = 1, limit = 20, unreadOnly } = req.query;
    // Filter based on role
    const filter = {};
    if (user.role === "category-admin") {
        filter.category = user.category;
    }
    if (user.role === "user") {
        filter.sender = user._id;
    }
    if (unreadOnly === "true") {
        filter.read = false;
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [messages, total] = await Promise.all([
        emergency_model_1.EmergencyMessage.find(filter)
            .populate("sender", "name email phone avatar")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        emergency_model_1.EmergencyMessage.countDocuments(filter),
    ]);
    res.status(200).json({
        success: true,
        data: messages,
        total,
        totalPages: Math.ceil(total / Number(limit)),
        page: Number(page),
    });
});
// Mark message as read (category-admin only)
exports.markMessageAsRead = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { messageId } = req.params;
    const admin = req.user;
    if (admin.role !== "category-admin") {
        throw new errorHandler_1.AppError(403, "Only category-admin can mark messages as read");
    }
    const message = await emergency_model_1.EmergencyMessage.findOneAndUpdate({ _id: messageId, category: admin.category, read: false }, { read: true }, { new: true });
    if (!message) {
        throw new errorHandler_1.AppError(404, "Message not found");
    }
    res.status(200).json({
        success: true,
        message: "Message marked as read",
        data: message,
    });
});
// Mark ALL messages as read (category-admin only)
exports.markAllMessagesAsRead = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const admin = req.user;
    if (admin.role !== "category-admin") {
        throw new errorHandler_1.AppError(403, "Only category-admin can mark messages as read");
    }
    const result = await emergency_model_1.EmergencyMessage.updateMany({ category: admin.category, read: false }, { read: true });
    res.status(200).json({
        success: true,
        message: `${result.modifiedCount} message(s) marked as read`,
        data: result,
    });
});
// Get unread count for category-admin
exports.getUnreadCount = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const admin = req.user;
    if (admin.role !== "category-admin") {
        throw new errorHandler_1.AppError(403, "Only category-admin can access this");
    }
    const count = await emergency_model_1.EmergencyMessage.countDocuments({
        category: admin.category,
        read: false,
    });
    res.status(200).json({
        success: true,
        count,
    });
});
// Delete an emergency message (category-admin only)
exports.deleteEmergencyMessage = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { messageId } = req.params;
    const admin = req.user;
    if (admin.role !== "category-admin") {
        throw new errorHandler_1.AppError(403, "Only category-admin can delete messages");
    }
    const message = await emergency_model_1.EmergencyMessage.findOneAndDelete({
        _id: messageId,
        category: admin.category,
    });
    if (!message) {
        throw new errorHandler_1.AppError(404, "Message not found");
    }
    res.status(200).json({
        success: true,
        message: "Message deleted successfully",
    });
});
//# sourceMappingURL=emergency.controller.js.map