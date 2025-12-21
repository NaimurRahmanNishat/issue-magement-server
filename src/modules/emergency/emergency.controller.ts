import { Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { AuthRequest } from "../../middleware/auth.middleware";
import { emitToCategoryAdmin, getIO } from "../../config/socket";
import { AppError } from "../../utils/errorHandler";
import { EmergencyMessage } from "./emergency.model";

// Send emergency message
export const sendEmergencyMessage = catchAsync(async (req: AuthRequest, res: Response) => {
  const { category, message } = req.body;
  const user = (req as any).user!;

  if (!category || !message) {
    throw new AppError(400, "Category and message are required!");
  }

  // Validation: message length check
  if (message.trim().length < 2) {
    throw new AppError(400, "Message must be at least 2 characters long");
  }

    // Create emergency message
    const emergencyMessage = await EmergencyMessage.create({
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
      emitToCategoryAdmin(category, "newEmergency", {
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
    } catch (socketError) {
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
export const getEmergencyMessagesForAdmin = catchAsync(async (req: AuthRequest, res: Response) => {
    const user = (req as any).user!;
    const { page = 1, limit = 20, unreadOnly } = req.query;

    // Filter based on role
    const filter: any = {};

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
      EmergencyMessage.find(filter)
        .populate("sender", "name email phone avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),

      EmergencyMessage.countDocuments(filter),
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
export const markMessageAsRead = catchAsync(async (req: AuthRequest, res: Response) => {
  const { messageId } = req.params;
  const admin = req.user!;

  if (admin.role !== "category-admin") {
    throw new AppError(403, "Only category-admin can mark messages as read");
  }

  const message = await EmergencyMessage.findOneAndUpdate({ _id: messageId, category:admin.category, read: false },{ read: true },{ new: true }); 

  if (!message) {
    throw new AppError(404, "Message not found");
  }

  res.status(200).json({
    success: true,
    message: "Message marked as read",
    data: message,
  });
});


// Mark ALL messages as read (category-admin only)
export const markAllMessagesAsRead = catchAsync(async (req: AuthRequest, res: Response) => {
  const admin = req.user!;

  if (admin.role !== "category-admin") {
    throw new AppError(403, "Only category-admin can mark messages as read");
  }

  const result = await EmergencyMessage.updateMany(
    { category: admin.category, read: false },
    { read: true }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} message(s) marked as read`,
    data: result,
  });
});


// Get unread count for category-admin
export const getUnreadCount = catchAsync(async (req: AuthRequest, res: Response) => {
  const admin = req.user!;

  if (admin.role !== "category-admin") {
    throw new AppError(403, "Only category-admin can access this");
  }

  const count = await EmergencyMessage.countDocuments({
    category: admin.category,
    read: false,
  });

  res.status(200).json({
    success: true,
    count,
  });
});


// Delete an emergency message (category-admin only)
export const deleteEmergencyMessage = catchAsync(async (req: AuthRequest, res: Response) => {
  const { messageId } = req.params;
  const admin = req.user!;

  if (admin.role !== "category-admin") {
    throw new AppError(403, "Only category-admin can delete messages");
  }

  const message = await EmergencyMessage.findOneAndDelete({
    _id: messageId,
    category: admin.category,
  });

  if (!message) {
    throw new AppError(404, "Message not found");
  }

  res.status(200).json({
    success: true,
    message: "Message deleted successfully",
  });
});