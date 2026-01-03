// src/modules/comments/review.controller.ts

import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { catchAsync } from "../../middleware/catchAsync";
import { AppError } from "../../utils/errorHandler";
import Issue from "../issues/issue.model";
import Review from "./review.model";
import { Types } from "mongoose";
import { deleteCache, getCache, invalidateCache, setCache } from "../../helper/redisCache";
import { calculateCursorPagination, createCursorPaginationMeta } from "../../helper/cursorPagination";


// 1. Create First Comment on Issue
export const createComment = catchAsync(async (req: AuthRequest, res: Response) => {
  const { issueId } = req.params;
  const { comment } = req.body;

  // Validate inputs
  if (!issueId) {
    throw new AppError(400, "Issue ID is required!");
  }

  if (!comment || comment.trim().length < 3) {
    throw new AppError(400, "Comment must be at least 3 characters long!");
  }

  // Check if issue exists
  const issue = await Issue.findById(issueId);
  if (!issue) {
    throw new AppError(404, "Issue not found!");
  }

  // Create review/comment
  const review = await Review.create({
    issue: new Types.ObjectId(issueId),
    author: req.user!._id as Types.ObjectId,
    comment: comment.trim(),
  });

  // Populate author details for response
  await review.populate("author", "name email avatar");

  // Add review to issue
  (issue.reviews as Types.ObjectId[]).push(review._id as Types.ObjectId);
  await issue.save();

  // Invalidate caches
  await invalidateCache({
    entity: "issue",
    entityId: issueId,
    userId: req.user!._id!.toString(),
    role: req.user!.role,
  });

  // Invalidate review caches for this issue
  await deleteCache(`reviews:issue:${issueId}:*`);

  res.status(201).json({
    success: true,
    message: "Comment added successfully!",
    data: review,
  });
});


// 2. Reply to Comment (Nested Replies Support)
export const replyToComment = catchAsync(async (req: AuthRequest, res: Response) => {
  const { reviewId } = req.params;
  const { comment, parentReplyId } = req.body;

  // Validate input
  if (!comment || comment.trim().length < 3) {
    throw new AppError(400, "Reply must be at least 3 characters long!");
  }

  // Find the review
  const review = await Review.findById(reviewId)
    .populate("author", "name email avatar");

  if (!review) {
    throw new AppError(404, "Review not found!");
  }

  // Create new reply object
  const newReply: any = {
    _id: new Types.ObjectId(),
    author: req.user!._id as Types.ObjectId,
    comment: comment.trim(),
    replies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // If parentReplyId exists, add as nested reply
  if (parentReplyId) {
    const addNestedReply = (replies: any[]): boolean => {
      for (let reply of replies) {
        if (reply._id.toString() === parentReplyId) {
          if (!reply.replies) reply.replies = [];
          reply.replies.push(newReply);
          return true;
        }
        if (reply.replies && reply.replies.length > 0) {
          if (addNestedReply(reply.replies)) return true;
        }
      }
      return false;
    };

    const found = addNestedReply(review.replies);
    if (!found) {
      throw new AppError(404, "Parent reply not found!");
    }
  } else {
    // Add as direct reply to review
    review.replies.push(newReply);
  }

  // Save review with new reply
  await review.save();

  // Populate the newly added reply's author
  await review.populate("replies.author", "name email avatar");

  // Invalidate caches
  await invalidateCache({
    entity: "issue",
    entityId: review.issue.toString(),
    userId: req.user!._id!.toString(),
    role: req.user!.role,
  });

  // Invalidate review caches
  await deleteCache(`reviews:issue:${review.issue}:*`);

  res.status(201).json({
    success: true,
    message: "Reply added successfully!",
    data: review,
  });
});


// 3. Edit a Review or Reply
export const editComment = catchAsync(async (req: AuthRequest, res: Response) => {
  const { reviewId } = req.params;
  const { comment, replyId } = req.body;

  // Validate input
  if (!comment || comment.trim().length < 3) {
    throw new AppError(400, "Comment must be at least 3 characters long!");
  }

  // Find review
  const review = await Review.findById(reviewId)
    .populate("author", "name email avatar");

  if (!review) {
    throw new AppError(404, "Review not found!");
  }

  // Edit main review (no replyId)
  if (!replyId) {
    // Check authorization
    if (review.author._id.toString() !== req.user!._id!.toString()) {
      throw new AppError(403, "You are not authorized to edit this review!");
    }

    review.comment = comment.trim();
    review.updatedAt = new Date();
  } 
  // Edit nested reply
  else {
    const editNestedReply = (replies: any[]): boolean => {
      for (let reply of replies) {
        if (reply._id.toString() === replyId) {
          // Check authorization
          if (reply.author.toString() !== req.user!._id!.toString()) {
            throw new AppError(403, "You are not authorized to edit this reply!");
          }
          reply.comment = comment.trim();
          reply.updatedAt = new Date();
          return true;
        }
        if (reply.replies && reply.replies.length > 0) {
          if (editNestedReply(reply.replies)) return true;
        }
      }
      return false;
    };

    const found = editNestedReply(review.replies);
    if (!found) {
      throw new AppError(404, "Reply not found!");
    }
  }

  // Save updated review
  await review.save();

  // Populate all authors in replies
  await review.populate("replies.author", "name email avatar");

  // Invalidate caches
  await invalidateCache({
    entity: "issue",
    entityId: review.issue.toString(),
    userId: review.author._id.toString(),
    role: req.user!.role,
  });

  // Invalidate review caches
  await deleteCache(`reviews:issue:${review.issue}:*`);

  res.status(200).json({
    success: true,
    message: replyId ? "Reply updated successfully!" : "Review updated successfully!",
    data: review,
  });
});


// 4. Delete Review or Reply
export const deleteComment = catchAsync(async (req: AuthRequest, res: Response) => {
  const { reviewId } = req.params;
  const { replyId } = req.body;

  // Find review
  const review = await Review.findById(reviewId)
    .populate("author", "name email avatar");

  if (!review) {
    throw new AppError(404, "Review not found!");
  }

  // Delete entire review (no replyId)
  if (!replyId) {
    // Check authorization
    if (review.author._id.toString() !== req.user!._id!.toString()) {
      throw new AppError(403, "You are not authorized to delete this review!");
    }

    // Store issueId before deletion
    const issueId = review.issue.toString();
    const authorId = review.author._id.toString();

    // Delete review
    await Review.findByIdAndDelete(reviewId);

    // Remove review reference from issue
    await Issue.findByIdAndUpdate(issueId, { 
      $pull: { reviews: review._id } 
    });

    // Invalidate caches
    await invalidateCache({
      entity: "issue",
      entityId: issueId,
      userId: authorId,
      role: req.user!.role,
    });

    // Invalidate review caches
    await deleteCache(`reviews:issue:${issueId}:*`);

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully!",
    });
  }

  // Delete nested reply
  const deleteNestedReply = (replies: any[]): boolean => {
    for (let i = 0; i < replies.length; i++) {
      if (replies[i]._id.toString() === replyId) {
        // Check authorization
        if (replies[i].author.toString() !== req.user!._id!.toString()) {
          throw new AppError(403, "You are not authorized to delete this reply!");
        }
        replies.splice(i, 1);
        return true;
      }
      if (replies[i].replies && replies[i].replies.length > 0) {
        if (deleteNestedReply(replies[i].replies)) return true;
      }
    }
    return false;
  };

  const found = deleteNestedReply(review.replies);
  if (!found) {
    throw new AppError(404, "Reply not found!");
  }

  // Save review after removing reply
  await review.save();

  // Invalidate caches
  await invalidateCache({
    entity: "issue",
    entityId: review.issue.toString(),
    userId: review.author._id.toString(),
    role: req.user!.role,
  });

  // Invalidate review caches
  await deleteCache(`reviews:issue:${review.issue}:*`);

  res.status(200).json({
    success: true,
    message: "Reply deleted successfully!",
  });
});


// 5. Get All Comments for Admin (Cursor Pagination)
export const getAllCommentsForAdmin = catchAsync(async (req: AuthRequest, res: Response) => {
  const user = req.user!;

  // Permission check
  if (user.role !== "category-admin" && user.role !== "super-admin") {
    throw new AppError(403, "Access denied! Only admins can view all comments.");
  }

  const { cursor, limit = 10, sortOrder = "desc" } = req.query;

  const adminCategory = user.category || null;
  const cacheKey = `reviews:admin:${user.role}:${adminCategory || "all"}:${cursor || 'first'}:${limit}:${sortOrder}`;

  // Try cache first
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`⚡ Cache hit: ${cacheKey}`);
      return res.status(200).json({
        success: true,
        message: "Comments fetched (from cache)",
        ...cached,
      });
    }
  } catch (cacheError) {
    console.error("Cache retrieval error:", cacheError);
  }

  // Build base query
  let baseQuery: any = {};

  // Category admin sees only their category's reviews
  if (user.role === "category-admin") {
    if (!adminCategory) {
      throw new AppError(400, "Category-admin must have a category assigned!");
    }

    // Get all issues for this category
    const issues = await Issue.find({ category: adminCategory }).select("_id").lean();
    const issueIds = issues.map((i) => i._id);
    baseQuery = { issue: { $in: issueIds } };
  }

  // Calculate cursor pagination
  const paginationOptions = calculateCursorPagination({
    limit: parseInt(limit as string),
    cursor: cursor as string,
    sortBy: 'createdAt',
    sortOrder: sortOrder as "asc" | "desc",
  });

  // Combine base query with cursor filter
  const finalQuery = {
    ...baseQuery,
    ...paginationOptions.filter,
  };

  // Fetch reviews from database
  const reviews = await Review.find(finalQuery)
    .populate("author", "name avatar email")
    .populate({
      path: "replies.author",
      select: "name avatar email",
    })
    .populate("issue", "title category status")
    .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
    .limit(paginationOptions.limit + 1)
    .lean();

  // Create cursor pagination metadata
  const { data, meta } = createCursorPaginationMeta(
    reviews,
    paginationOptions.limit,
    paginationOptions.sortBy,
    paginationOptions.sortOrder
  );

  const responseData = { data, meta };

  // Cache for 5 minutes
  await setCache(cacheKey, responseData, 600);

  res.status(200).json({
    success: true,
    message: "Comments fetched successfully",
    ...responseData,
  });
});


// 6. Get Comments by Issue ID (Cursor Pagination)
export const getCommentsByIssue = catchAsync(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const { cursor, limit = 10, sortOrder = "desc" } = req.query;

  // Validate issueId
  if (!issueId) {
    throw new AppError(400, "Issue ID is required!");
  }

  // Check if issue exists
  const issue = await Issue.findById(issueId).lean();
  if (!issue) {
    throw new AppError(404, "Issue not found!");
  }

  // Calculate cursor pagination
  const paginationOptions = calculateCursorPagination({
    limit: parseInt(limit as string),
    cursor: cursor as string,
    sortBy: 'createdAt',
    sortOrder: sortOrder as "asc" | "desc",
  });

  // Build query with cursor filter
  const query = {
    issue: issueId,
    ...paginationOptions.filter,
  };

  // Fetch reviews with cursor pagination
  const reviews = await Review.find(query)
    .populate("author", "name avatar email")
    .populate({
      path: "replies.author",
      select: "name avatar email",
    })
    .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
    .limit(paginationOptions.limit + 1)
    .lean();

  // Create cursor pagination metadata
  const { data, meta } = createCursorPaginationMeta(
    reviews,
    paginationOptions.limit,
    paginationOptions.sortBy,
    paginationOptions.sortOrder
  );

  // Get total count for this issue
  const total = await Review.countDocuments({ issue: issueId });

  const responseData = {
    data,
    meta: {
      ...meta,
      total,
    },
  };

  console.log(`✅ Found ${data.length} reviews for issue ${issueId}`);

  res.status(200).json({
    success: true,
    message: "Comments fetched successfully",
    ...responseData,
  });
});


// 7. Get Single Review by ID
export const getReviewById = catchAsync(async (req: Request, res: Response) => {
  const { reviewId } = req.params;

  if (!reviewId) {
    throw new AppError(400, "Review ID is required!");
  }

  const cacheKey = `review:${reviewId}`;

  // Try cache first
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`⚡ Cache hit: ${cacheKey}`);
      return res.status(200).json({
        success: true,
        message: "Review fetched (from cache)",
        data: cached,
      });
    }
  } catch (cacheError) {
    console.error("Cache retrieval error:", cacheError);
  }

  // Fetch from database
  const review = await Review.findById(reviewId)
    .populate("author", "name avatar email")
    .populate({
      path: "replies.author",
      select: "name avatar email",
    })
    .populate("issue", "title category status")
    .lean();

  if (!review) {
    throw new AppError(404, "Review not found!");
  }

  // Cache for 10 minutes
  await setCache(cacheKey, review, 600);

  res.status(200).json({
    success: true,
    message: "Review fetched successfully",
    data: review,
  });
});


// 8. Get Reviews by User ID (Cursor Pagination)
export const getReviewsByUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { cursor, limit = 10, sortOrder = "desc" } = req.query;
  const currentUser = req.user!;

  // Permission check: user can only view own reviews (unless admin)
  if (currentUser._id!.toString() !== userId && 
      currentUser.role !== "super-admin" && 
      currentUser.role !== "category-admin") {
    throw new AppError(403, "You can only view your own reviews");
  }

  const cacheKey = `reviews:user:${userId}:${cursor || 'first'}:${limit}:${sortOrder}`;

  // Try cache first
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`⚡ Cache hit: ${cacheKey}`);
      return res.status(200).json({
        success: true,
        message: "Reviews fetched (from cache)",
        ...cached,
      });
    }
  } catch (cacheError) {
    console.error("Cache retrieval error:", cacheError);
  }

  // Calculate cursor pagination
  const paginationOptions = calculateCursorPagination({
    limit: parseInt(limit as string),
    cursor: cursor as string,
    sortBy: 'createdAt',
    sortOrder: sortOrder as "asc" | "desc",
  });

  // Build query
  const query = {
    author: userId,
    ...paginationOptions.filter,
  };

  // Fetch reviews
  const reviews = await Review.find(query)
    .populate("author", "name avatar email")
    .populate({
      path: "replies.author",
      select: "name avatar email",
    })
    .populate("issue", "title category status")
    .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
    .limit(paginationOptions.limit + 1)
    .lean();

  // Create pagination metadata
  const { data, meta } = createCursorPaginationMeta(
    reviews,
    paginationOptions.limit,
    paginationOptions.sortBy,
    paginationOptions.sortOrder
  );

  // Get total count
  const total = await Review.countDocuments({ author: userId });

  const responseData = {
    data,
    meta: {
      ...meta,
      total,
    },
  };

  // Cache for 10 minutes
  await setCache(cacheKey, responseData, 600);

  res.status(200).json({
    success: true,
    message: "Reviews fetched successfully",
    ...responseData,
  });
});
