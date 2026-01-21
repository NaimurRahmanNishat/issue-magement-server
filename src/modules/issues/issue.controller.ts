// src/modules/issues/issue.controller.ts

import { Request, Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { AuthRequest } from "../../middleware/auth.middleware";
import { AppError } from "../../utils/errorHandler";
import { sendIssueStatusEmail } from "../../utils/email";
import Issue, { IssueStatus } from "./issue.model";
import { deleteCache, getCache, invalidateCache, setCache } from "../../helper/redisCache";
import { calculateCursorPagination, createCursorPaginationMeta } from "../../helper/cursorPagination";
import { emitToCategoryAdmin, emitUnreadCountUpdate } from "../../config/socket";
import { sendError } from "../../utils/response";
import sharp from "sharp";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";


// 1. Create Issue with Real-time Notification
export const createIssue = catchAsync(async (req: AuthRequest, res: Response) => {
  const { title, category, description, location, division, date } = req.body;

  // Validate required fields
  if (!title || !category || !description || !location || !division) {
    throw new AppError(400, "All fields are required");
  }

  // Upload images
  const files = (req.files as { images?: Express.Multer.File[] })?.images;
  if (!files || files.length === 0) {
    return sendError(res, "Please upload at least one image", 400);
  }

  if (files.length > 3) {
    return sendError(res, "Maximum 3 images allowed", 400);
  }

  // compress images
  const compressedBuffers = await Promise.all(
    files.map((file) =>
      sharp(file.buffer)
        .resize({ width: 1200 })
        .webp({ quality: 65 })
        .toBuffer()
    )
  );

  // upload to cloudinary
  const uploadedImages = await Promise.all(
    compressedBuffers.map((buffer) =>
      uploadToCloudinary(buffer, "services/images")
    )
  );

  const images = uploadedImages.map((img) => ({
    public_id: img.public_id,
    url: img.secure_url,
  }));

  // Create new issue in database
  const newIssue = await Issue.create({
    title,
    category,
    description,
    images,
    location,
    division,
    author: req.user!._id,
    date: date || Date.now(),
    isReadByAdmin: false, // Default unread
  });

  // Populate author details for response
  await newIssue.populate("author", "name email");

  // Invalidate related caches
  await invalidateCache({
    entity: "issue",
    entityId: newIssue._id!.toString(),
    userId: req.user!._id!.toString(),
    category: category,
    division: division,
    role: req.user!.role,
  });

  // Invalidate stats caches
  await deleteCache(`user_stats_${req.user!._id}`);
  if (category) {
    await deleteCache(`category_stats:${category}`);
  }

  // Cache the new issue
  await setCache(`issue:${newIssue._id}`, newIssue, 600);

  // Real-time notification to category admin
  try {
    // Get updated unread count
    const unreadCount = await Issue.countDocuments({
      category: category,
      isReadByAdmin: false,
    });

    // Emit new issue notification
    emitToCategoryAdmin(category, "newIssue", {
      _id: newIssue._id,
      title: newIssue.title,
      category: newIssue.category,
      status: newIssue.status,
      author: {
        _id: req.user!._id,
        name: req.user!.name,
        email: req.user!.email,
      },
      createdAt: newIssue.createdAt,
    });

    // Emit unread count update
    emitUnreadCountUpdate(category, 'issue', unreadCount);
    console.log(`🔔 New issue notification sent to ${category} admins`);
  } catch (socketError) {
    console.error("Socket emit error:", socketError);
  }

  res.status(201).json({ 
    success: true, 
    message: "Issue created successfully!", 
    data: newIssue 
  });
});


// 2. Get All Issues with Filters & Pagination
export const getAllIssues = catchAsync(async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { cursor, limit = 10, sortOrder = "desc", status, division, category, search } = req.query;

  // Build dynamic query
  const query: any = {};
  
  if (status) query.status = status;
  if (division) query.division = division;
  if (category) query.category = category;
  if (search) query.$text = { $search: search as string };

  // Category-admin can only see their own category
  if (user?.role === "category-admin") {
    if (!user.category) {
      throw new AppError(403, "Your admin account has no assigned category");
    }
    query.category = user.category;
  }

  // Generate cache key with all filters
  const cacheKey = `issues:${user?._id || 'public'}:${user?.role || 'guest'}:${user?.category || 'all'}:${cursor || 'first'}:${limit}:${sortOrder}:${status || 'all'}:${division || 'all'}:${category || 'all'}:${search || 'none'}`;
  
  await getCache(cacheKey);

  // Calculate cursor pagination
  const paginationOptions = calculateCursorPagination({
    limit: parseInt(limit as string),
    cursor: cursor as string,
    sortBy: 'createdAt',
    sortOrder: sortOrder as "asc" | "desc",
  });

  // Combine filters with cursor pagination
  const finalQuery = {
    ...query,
    ...paginationOptions.filter, 
  };
  
  // Query database with pagination
  const issues = await Issue.find(finalQuery)
    .populate({ path: "author", select: "name email avatar" })
    .populate("approvedBy", "name email role avatar")
    .populate({ 
      path: "reviews", 
      populate: { 
        path: "author replies.author", 
        select: "name email avatar" 
      }  
    })
    .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
    .limit(paginationOptions.limit + 1) 
    .lean();

  // Create pagination metadata
  const { data, meta } = createCursorPaginationMeta(
    issues,
    paginationOptions.limit,
    paginationOptions.sortBy,
    paginationOptions.sortOrder
  );

  const responseData = { data, meta };

  // Cache the response for 10 minutes
  await setCache(cacheKey, responseData, 600);

  res.status(200).json({
    success: true,
    message: "Issues fetched successfully",
    ...responseData,
  });
});


// 3. Get Issue by ID (with Details)
export const getIssueById = catchAsync(async (req: AuthRequest, res: Response) => {
  const { issueId } = req.params;

  // Try cache first
  const cacheKey = `issue:${issueId}`;
  try {
    const cachedIssue = await getCache(cacheKey);
    if (cachedIssue) {
      console.log(`⚡ Cache hit for issue: ${issueId}`);
      return res.status(200).json({
        success: true,
        message: "Issue fetched from cache",
        data: cachedIssue,
      });
    }
  } catch (cacheError) {
    console.error("Cache retrieval error:", cacheError);
  }

  // Fetch from database
  const issue = await Issue.findById(issueId)
    .populate({ 
      path: "reviews", 
      populate: { 
        path: "author replies.author", 
        select: "name email avatar" 
      } 
    })
    .populate("author", "name email avatar")
    .populate("approvedBy", "name email role avatar")
    .lean();

  if (!issue) {
    throw new AppError(404, "Issue not found");
  }

  // Cache the result for 10 minutes
  await setCache(cacheKey, issue, 600);

  res.status(200).json({
    success: true,
    message: "Issue fetched successfully",
    data: issue,
  });
});


// 4. Update Issue Status (Admin Only)
export const updateIssueById = catchAsync(async (req: AuthRequest, res: Response) => {
  const { issueId } = req.params;
  const { status } = req.body;
  const user = req.user!;

  // Validate status
  if (!Object.values(IssueStatus).includes(status)) {
    throw new AppError(
      400, 
      `Invalid status! Must be one of: ${Object.values(IssueStatus).join(", ")}`
    );
  }

  // Build filter with permission check
  const filter: any = { _id: issueId };
  if (user.role === "category-admin") {
    if (!user.category) {
      throw new AppError(403, "Your admin account has no assigned category");
    }
    filter.category = user.category;
  }

  // Atomic update
  const update = { 
    status, 
    approvedBy: user._id, 
    approvedAt: new Date() 
  };

  const issue = await Issue.findOneAndUpdate(filter, update, { new: true })
    .populate("author", "name email")
    .populate("approvedBy", "name email role avatar")
    .lean();

  if (!issue) {
    throw new AppError(404, "Issue not found or access denied");
  }

  // Invalidate caches
  await invalidateCache({
    entity: "issue",
    entityId: issueId,
    userId: issue.author._id.toString(),
    category: issue.category,
    division: issue.division,
    role: user.role,
  });

  // Invalidate stats caches
  await deleteCache(`user_stats_${issue.author._id}`);
  if (issue.category) {
    await deleteCache(`category_stats:${issue.category}`);
  }
  
  // Cache the updated issue
  await setCache(`issue:${issueId}`, issue, 600);

  // Send email notification to issue author
  const author: any = issue.author;
  if (author?.email) {
    try {
      await sendIssueStatusEmail(author.email, issue.title, status);
      console.log(`📧 Email sent to ${author.email} about status: ${status}`);
    } catch (emailError) {
      console.error("❌ Failed to send issue status email:", emailError);
    }
  }

  res.status(200).json({
    success: true,
    message: `Issue status updated to '${status}'`,
    data: issue,
  });
});


// 5. Delete Issue by ID (Admin Only)
export const deleteIssueById = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  // Build filter with permission check
  const filter: any = { _id: id };
  if (user.role === "category-admin") {
    if (!user.category) {
      throw new AppError(403, "Your admin account has no assigned category");
    }
    filter.category = user.category;
  }

  // Get issue metadata before deletion
  const issue = await Issue.findOne(filter).lean();
  if (!issue) {
    throw new AppError(404, "Issue not found or access denied");
  }

  // Extract metadata for cache invalidation
  const authorId = issue.author.toString();
  const category = issue.category;
  const division = issue.division;

  // Delete the issue from database
  await Issue.findByIdAndDelete(id);

  // Invalidate caches
  await invalidateCache({
    entity: "issue",
    entityId: id,
    userId: authorId,
    category,
    division,
    role: user.role,
  });

  // Invalidate stats caches
  await deleteCache(`user_stats_${authorId}`);
  if (category) {
    await deleteCache(`category_stats:${category}`);
    
    // Update unread count for category admin
    try {
      const unreadCount = await Issue.countDocuments({
        category: category,
        isReadByAdmin: false,
      });
      emitUnreadCountUpdate(category, 'issue', unreadCount);
    } catch (socketError) {
      console.error("Socket emit error:", socketError);
    }
  }

  res.status(200).json({
    success: true,
    message: "Issue deleted successfully",
  });
});


// 6. Get Issues by User ID (User Dashboard)
export const getIssueByUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const currentUser = req.user!;
  
  const limit = Number(req.query.limit) || 10;
  const cursor = req.query.cursor as string;
  const status = req.query.status as string;
  const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

  // Permission check: user can only view own issues (unless super-admin)
  if (currentUser._id!.toString() !== userId && currentUser.role !== "super-admin") {
    throw new AppError(403, "You can only view your own issues");
  }

  // Generate cache key
  const cacheKey = `user:${userId}:issues:${cursor || 'first'}:${limit}:${sortOrder}:${status || 'all'}`;
  
  // Try cache first
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`⚡ Cache hit: ${cacheKey}`);
      return res.status(200).json({
        success: true,
        message: "Issues fetched (from cache)",
        ...cached,
      });
    }
  } catch (cacheError) {
    console.error("Cache retrieval error:", cacheError);
  }

  // Calculate cursor pagination
  const paginationOptions = calculateCursorPagination({
    limit,
    cursor,
    sortBy: 'createdAt',
    sortOrder,
  });

  // Build query filter
  const query: any = { 
    author: userId, 
    ...paginationOptions.filter 
  };

  // Add status filter if provided
  if (status) {
    query.status = status;
  }

  // Fetch issues from database
  const issues = await Issue.find(query)
    .populate({ 
      path: "reviews", 
      populate: { 
        path: "author replies.author", 
        select: "name email avatar" 
      } 
    })
    .populate("author", "name email avatar")
    .populate("approvedBy", "name email role avatar")
    .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
    .limit(paginationOptions.limit + 1)
    .lean();

  // Create pagination metadata
  const { data, meta } = createCursorPaginationMeta(
    issues,
    paginationOptions.limit,
    paginationOptions.sortBy,
    paginationOptions.sortOrder
  );

  const responseData = { 
    data, 
    meta: {
      ...meta,
      status: status || null,
    },
  };

  // Cache for 10 minutes
  await setCache(cacheKey, responseData, 600);

  res.status(200).json({
    success: true,
    message: "Issues fetched successfully",
    ...responseData,
  });
});


// 7. Get Unread Issues Count (Admin Only)
export const getUnreadIssuesCount = catchAsync(async (req: AuthRequest, res: Response) => {
  const user = req.user!;

  // Permission check
  if (user.role !== "category-admin" && user.role !== "super-admin") {
    throw new AppError(403, "Only admins can access this endpoint");
  }

  // Build query based on role
  const query: any = { isReadByAdmin: false };

  if (user.role === "category-admin") {
    if (!user.category) {
      throw new AppError(403, "Your admin account has no assigned category");
    }
    query.category = user.category;
  }

  // Generate cache key
  const cacheKey = `unread_issues_count:${user._id}:${user.role}:${user.category || 'all'}`;

  // Try cache first
  try {
    const cached = await getCache(cacheKey);
    if (cached !== null && cached !== undefined) {
      console.log(`⚡ Cache hit: ${cacheKey}`);
      return res.status(200).json({
        success: true,
        message: "Unread issues count fetched (from cache)",
        count: cached,
      });
    }
  } catch (cacheError) {
    console.error("Cache retrieval error:", cacheError);
  }

  // Count unread issues
  const count = await Issue.countDocuments(query);

  // Cache for 10 minutes
  await setCache(cacheKey, count, 600);

  res.status(200).json({
    success: true,
    message: "Unread issues count fetched successfully",
    count,
  });
});


// 8. Mark Single Issue as Read (Admin Only)
export const markIssueAsRead = catchAsync(async (req: AuthRequest, res: Response) => {
  const { issueId } = req.params;
  const user = req.user!;

  // Permission check
  if (user.role !== "category-admin" && user.role !== "super-admin") {
    throw new AppError(403, "Only admins can mark issues as read");
  }

  // Build filter with permission check
  const filter: any = { _id: issueId };
  
  if (user.role === "category-admin") {
    if (!user.category) {
      throw new AppError(403, "Your admin account has no assigned category");
    }
    filter.category = user.category;
  }

  // Update issue
  const issue = await Issue.findOneAndUpdate(
    filter,
    { 
      isReadByAdmin: true, 
      readByAdminAt: new Date() 
    },
    { new: true }
  ).lean();

  if (!issue) {
    throw new AppError(404, "Issue not found or access denied");
  }

  // Invalidate unread count cache
  await deleteCache(`unread_issues_count:${user._id}:${user.role}:${user.category || 'all'}`);

  // Invalidate issue cache
  await deleteCache(`issue:${issueId}`);

  // Invalidate issue list caches
  await invalidateCache({
    entity: "issue",
    entityId: issueId,
    userId: issue.author.toString(),
    category: issue.category,
    division: issue.division,
    role: user.role,
  });

  // Update unread count via socket
  try {
    const unreadCount = await Issue.countDocuments({
      category: issue.category,
      isReadByAdmin: false,
    });
    emitUnreadCountUpdate(issue.category, 'issue', unreadCount);
  } catch (socketError) {
    console.error("Socket emit error:", socketError);
  }

  res.status(200).json({
    success: true,
    message: "Issue marked as read",
    data: issue,
  });
});


// 9. Mark All Issues as Read (Admin Only)
export const markAllIssuesAsRead = catchAsync(async (req: AuthRequest, res: Response) => {
  const user = req.user!;

  // Permission check
  if (user.role !== "category-admin" && user.role !== "super-admin") {
    throw new AppError(403, "Only admins can mark issues as read");
  }

  // Build query
  const query: any = { isReadByAdmin: false };

  if (user.role === "category-admin") {
    if (!user.category) {
      throw new AppError(403, "Your admin account has no assigned category");
    }
    query.category = user.category;
  }

  // Update all unread issues
  const result = await Issue.updateMany(
    query,
    { 
      isReadByAdmin: true, 
      readByAdminAt: new Date() 
    }
  );

  // Invalidate unread count cache
  await deleteCache(`unread_issues_count:${user._id}:${user.role}:${user.category || 'all'}`);

  // Invalidate all issues list caches
  await invalidateCache({
    entity: "issue",
    userId: user._id!.toString(),
    category: user.category,
    role: user.role,
  });

  // Update unread count via socket
  if (user.category) {
    try {
      emitUnreadCountUpdate(user.category, 'issue', 0);
    } catch (socketError) {
      console.error("Socket emit error:", socketError);
    }
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} issue(s) marked as read`,
    modifiedCount: result.modifiedCount,
  });
});
