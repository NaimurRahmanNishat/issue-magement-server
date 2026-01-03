"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllMessagesAsReadByAdmin = exports.markMessageAsReadByAdmin = exports.getUnreadMessagesCount = exports.deleteMessage = exports.updateMessageById = exports.getAllMessagesReceived = exports.snedMessage = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const errorHandler_1 = require("../../utils/errorHandler");
const message_model_1 = require("./message.model");
const socket_1 = require("../../config/socket");
const cursorPagination_1 = require("../../helper/cursorPagination");
// 1. Send Message (User → Category Admin)
exports.snedMessage = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const { message, category } = req.body;
    if (!category || !message) {
        throw new errorHandler_1.AppError(400, "Category and message are required!");
    }
    if (message.trim().length < 2) {
        throw new errorHandler_1.AppError(400, "Message must be at least 2 characters long");
    }
    // Create emergency message
    const emergencyMessage = await message_model_1.Message.create({
        sender: user._id,
        senderName: user.name,
        senderEmail: user.email,
        message,
        category,
        createdAt: new Date(),
    });
    // Convert to plain object for socket emit
    const messageData = {
        _id: emergencyMessage._id.toString(),
        sender: emergencyMessage.sender.toString(),
        senderName: emergencyMessage.senderName,
        senderEmail: emergencyMessage.senderEmail,
        message: emergencyMessage.message,
        category: emergencyMessage.category,
        createdAt: emergencyMessage.createdAt,
    };
    // Emit to Category Admin via Socket.IO
    try {
        (0, socket_1.emitToCategoryAdmin)(category, "newEmergency", messageData);
        const unreadCount = await message_model_1.Message.countDocuments({
            category: category,
            isRead: false
        });
        (0, socket_1.emitUnreadCountUpdate)(category, 'message', unreadCount);
        console.log(`🚨 Emergency emitted to admin: ${category}`);
    }
    catch (socketError) {
        console.error("Socket emit error:", socketError);
    }
    res.status(201).json({
        success: true,
        message: "Emergency message sent successfully",
        data: emergencyMessage,
    });
});
// 2. Get All Messages (with Cursor Pagination)
exports.getAllMessagesReceived = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    const limit = parseInt(req.query.limit) || 10;
    const cursor = req.query.cursor;
    const sortOrder = req.query.sortOrder || 'desc';
    const unread = req.query.unread;
    // Build query based on user role
    let baseQuery = {};
    if (user.role === "category-admin" && user.category) {
        baseQuery.category = user.category;
    }
    else if (user.role === "user") {
        baseQuery.sender = user._id;
    }
    // Filter for unread messages if requested
    if (unread === "true") {
        baseQuery.isRead = false;
    }
    // Cursor pagination helper use 
    const paginationOptions = (0, cursorPagination_1.calculateCursorPagination)({
        limit,
        cursor,
        sortBy: 'createdAt',
        sortOrder,
    });
    // Combine base query with pagination filter
    const finalQuery = {
        ...baseQuery,
        ...paginationOptions.filter
    };
    // Single efficient query
    const messages = await message_model_1.Message.find(finalQuery)
        .select('-__v')
        .lean()
        .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
        .limit(paginationOptions.limit + 1);
    const { data, meta } = (0, cursorPagination_1.createCursorPaginationMeta)(messages, paginationOptions.limit, paginationOptions.sortBy, paginationOptions.sortOrder);
    // Count unread messages
    const unreadCount = await message_model_1.Message.countDocuments({
        ...baseQuery,
        isRead: false,
    });
    const response = {
        success: true,
        message: "Messages retrieved successfully",
        data,
        meta: {
            ...meta,
            unreadCount,
        },
    };
    res.status(200).json(response);
});
// 3. Update Message by ID
exports.updateMessageById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const { message } = req.body;
    // Fetch existing message from database
    const existingMessage = await message_model_1.Message.findById(id);
    if (!existingMessage) {
        throw new errorHandler_1.AppError(404, "Message not found");
    }
    // Check authorization
    if (user.role === "user" && existingMessage.sender.toString() !== user._id.toString()) {
        throw new errorHandler_1.AppError(403, "You are not authorized to update this message");
    }
    if (user.role === "category-admin" && existingMessage.category !== user.category) {
        throw new errorHandler_1.AppError(403, "You are not authorized to update this message");
    }
    // Validate update data
    if (message && message.trim().length < 2) {
        throw new errorHandler_1.AppError(400, "Message must be at least 2 characters long");
    }
    // Update message in database
    const updatedMessage = await message_model_1.Message.findByIdAndUpdate(id, {
        ...(message && { message }),
        updatedAt: new Date()
    }, { new: true, runValidators: true }).lean();
    if (!updatedMessage) {
        throw new errorHandler_1.AppError(404, "Message not found after update");
    }
    // Emit socket event for real-time update
    try {
        (0, socket_1.emitToCategoryAdmin)(updatedMessage.category, "messageUpdated", {
            _id: updatedMessage._id,
            message: updatedMessage.message,
            category: updatedMessage.category,
            updatedAt: new Date(),
        });
        console.log(`📢 Message update emitted to category: ${updatedMessage.category}`);
    }
    catch (socketError) {
        console.error("Socket emit error:", socketError);
    }
    res.status(200).json({
        success: true,
        message: "Message updated successfully",
        data: updatedMessage,
    });
});
// 4. Delete Message by ID
exports.deleteMessage = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const message = await message_model_1.Message.findById(id);
    if (!message) {
        throw new errorHandler_1.AppError(404, "Message not found");
    }
    // Check authorization
    if (user.role === "user" && message.sender.toString() !== user._id.toString()) {
        throw new errorHandler_1.AppError(403, "You are not authorized to delete this message");
    }
    if (user.role === "category-admin" && message.category !== user.category) {
        throw new errorHandler_1.AppError(403, "You are not authorized to delete this message");
    }
    // Store category before deletion for cache invalidation
    const category = message.category;
    await message_model_1.Message.findByIdAndDelete(id);
    res.status(200).json({
        success: true,
        message: "Message deleted successfully",
    });
});
// 5. Get Unread Messages Count (Admin Only)
exports.getUnreadMessagesCount = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    if (!user || (user.role !== "category-admin" && user.role !== "super-admin")) {
        throw new errorHandler_1.AppError(403, "Only admins can access this endpoint");
    }
    // Build query
    const query = { isRead: false };
    if (user.role === "category-admin") {
        if (!user.category) {
            throw new errorHandler_1.AppError(403, "Your admin account has no assigned category");
        }
        query.category = user.category;
    }
    // Count unread messages
    const count = await message_model_1.Message.countDocuments(query);
    res.status(200).json({
        success: true,
        message: "Unread messages count fetched successfully",
        count,
    });
});
// 6. Mark Single Message as Read (Admin Only)
exports.markMessageAsReadByAdmin = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { messageId } = req.params;
    const user = req.user;
    if (!user || (user.role !== "category-admin" && user.role !== "super-admin")) {
        throw new errorHandler_1.AppError(403, "Only admins can mark messages as read");
    }
    // Build filter
    const filter = { _id: messageId };
    if (user.role === "category-admin") {
        if (!user.category) {
            throw new errorHandler_1.AppError(403, "Your admin account has no assigned category");
        }
        filter.category = user.category;
    }
    // Update message
    const message = await message_model_1.Message.findOneAndUpdate(filter, {
        isRead: true,
        readAt: new Date()
    }, { new: true });
    if (!message) {
        throw new errorHandler_1.AppError(404, "Message not found or access denied");
    }
    res.status(200).json({
        success: true,
        message: "Message marked as read",
        data: message,
    });
});
// 7. Mark All Messages as Read (Admin Only)
exports.markAllMessagesAsReadByAdmin = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const user = req.user;
    if (!user || (user.role !== "category-admin" && user.role !== "super-admin")) {
        throw new errorHandler_1.AppError(403, "Only admins can mark messages as read");
    }
    // Build query
    let query = { isRead: false };
    if (user.role === "category-admin") {
        if (!user.category) {
            throw new errorHandler_1.AppError(403, "Your admin account has no assigned category");
        }
        query.category = user.category;
    }
    // Update all unread messages
    const result = await message_model_1.Message.updateMany(query, {
        isRead: true,
        readAt: new Date()
    });
    res.status(200).json({
        success: true,
        message: `${result.modifiedCount} messages marked as read`,
        modifiedCount: result.modifiedCount,
    });
});
//# sourceMappingURL=message.controller.js.map