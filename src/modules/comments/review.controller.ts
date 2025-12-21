// src/modules/comments/review.controller.ts
import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { catchAsync } from "../../middleware/catchAsync";
import { AppError } from "../../utils/errorHandler";
import Issue from "../issues/issue.model";
import Review from "./review.model";
import { Types } from "mongoose";
import { getCache, invalidateIssueCache, setCache } from "../../utils/cache";


// 1. create first comment issue
export const createComment = catchAsync(async (req: AuthRequest, res: Response) => {
    const { issueId } = req.params;
    const { comment } = req.body;

    if (!issueId) throw new AppError(400, "Issue ID is required!");
    if (!comment || comment.trim().length < 3) {
      throw new AppError(400, "Comment must be at least 3 characters long!");
    }

    const issue = await Issue.findById(issueId);
    if (!issue) throw new AppError(404, "Issue not found!");

    const review = await Review.create({
      issue: new Types.ObjectId(issueId),
      author: req.user!._id as Types.ObjectId,
      comment,
    });

    (issue.reviews as Types.ObjectId[]).push(review._id as Types.ObjectId);
    await issue.save();

    await invalidateIssueCache(issueId);

    res.status(201).json({
      success: true,
      message: "Review added successfully!",
      review,
    });
  }
);


// 2. reply to comment
export const replyToComment = catchAsync(async (req: AuthRequest, res: Response) => {
  const { reviewId } = req.params;
  const { comment, parentReplyId } = req.body;

  if (!comment || comment.trim().length < 3) {
    throw new AppError(400, "Reply must be at least 3 characters long!");
  }

  const review = await Review.findById(reviewId);
  if (!review) throw new AppError(404, "Review not found!");

  const newReply: any = {
    _id: new Types.ObjectId(),
    author: req.user!._id as Types.ObjectId,
    comment,
    replies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
    if (!found) throw new AppError(404, "Parent reply not found!");
  } else {
    review.replies.push(newReply);
  }

    await review.save();
  await invalidateIssueCache(review.issue.toString());

  res.status(201).json({
    success: true,
    message: "Reply added successfully!",
    review,
  });
});


// 3. Edit a Review or Reply
export const editComment = catchAsync(async (req: AuthRequest, res: Response) => {
  const { reviewId } = req.params;
  const { comment, replyId } = req.body;

  if (!comment || comment.trim().length < 3) {
    throw new AppError(400, "Comment must be at least 3 characters long!");
  }

  const review = await Review.findById(reviewId);
  if (!review) throw new AppError(404, "Review not found!");

  if (!replyId) {
    if (review.author.toString() !== req.user?._id!.toString()) {
      throw new AppError(403, "You are not authorized to edit this review!");
    }
    review.comment = comment;
  } else {
    const editNestedReply = (replies: any[]): boolean => {
      for (let reply of replies) {
        if (reply._id.toString() === replyId) {
          if (reply.author.toString() !== req.user?._id!.toString()) {
            throw new AppError(403, "You are not authorized to edit this reply!");
          }
          reply.comment = comment;
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
    if (!found) throw new AppError(404, "Reply not found!");
  }

  await review.save();
  await invalidateIssueCache(review.issue.toString());

  res.status(200).json({
    success: true,
    message: replyId ? "Reply updated successfully!" : "Review updated successfully!",
    review,
  });
});


// 4. Delete Review or Reply
export const deleteComment = catchAsync(async (req: AuthRequest, res: Response) => {
  const { reviewId } = req.params;
  const { replyId } = req.body;

  const review = await Review.findById(reviewId);
  if (!review) throw new AppError(404, "Review not found!");

  if (!replyId) {
    if (review.author.toString() !== req.user?._id!.toString()) {
      throw new AppError(403, "You are not authorized to delete this review!");
    }

    await Review.findByIdAndDelete(reviewId);
    await Issue.findByIdAndUpdate(review.issue, { $pull: { reviews: review._id } });

    await invalidateIssueCache(review.issue.toString());

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully!",
    });
  }

  const deleteNestedReply = (replies: any[], parentReplies: any[]): boolean => {
    for (let i = 0; i < replies.length; i++) {
      if (replies[i]._id.toString() === replyId) {
        if (replies[i].author.toString() !== req.user?._id!.toString()) {
          throw new AppError(403, "You are not authorized to delete this reply!");
        }
        replies.splice(i, 1);
        return true;
      }
      if (replies[i].replies && replies[i].replies.length > 0) {
        if (deleteNestedReply(replies[i].replies, replies)) return true;
      }
    }
    return false;
  };

  const found = deleteNestedReply(review.replies, review.replies);
  if (!found) throw new AppError(404, "Reply not found!");

  await review.save();
  await invalidateIssueCache(review.issue.toString());

  res.status(200).json({
    success: true,
    message: "Reply deleted successfully!",
  });
});


// 5. Get all reviews for admin
export const getAllCommentsForAdmin = catchAsync(async (req: AuthRequest, res: Response) => {
  const user = req.user!;

  if (user.role !== "category-admin" && user.role !== "super-admin") {
    throw new AppError(403, "Access denied!");
  }

  const adminCategory = user.category || null;
  const cacheKey = `reviews:admin:${user.role}:${adminCategory || "all"}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      source: "cache",
      count: JSON.parse(cached).length,
      reviews: JSON.parse(cached),
    });
  }

  let query: any = {};

  if (user.role === "category-admin") {
    if (!adminCategory) {
      throw new AppError(400, "Category-admin must have a category assigned!");
    }
    const issues = await Issue.find({ category: adminCategory }).select("_id");
    const issueIds = issues.map((i) => i._id);
    query = { issue: { $in: issueIds } };
  }

  const reviews = await Review.find(query)
    .populate("author", "name avatar email")
    .populate({
      path: "replies.author",
      select: "name avatar email",
    })
    .populate("issue", "title category status")
    .sort({ createdAt: -1 });

  await setCache(cacheKey, reviews, 300);

  res.status(200).json({
    success: true,
    source: "db",
    count: reviews.length,
    reviews,
  });
});


// 6. Get reviews for a specific issue (PUBLIC ROUTE)
export const getCommentsByIssue = catchAsync(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const { page = "1", limit = "10" } = req.query;

  console.log("getCommentsByIssue called for issueId:", issueId); // Debug log

  if (!issueId) {
    throw new AppError(400, "Issue ID is required!");
  }

  // Check if issue exists
  const issue = await Issue.findById(issueId);
  if (!issue) {
    throw new AppError(404, "Issue not found!");
  }

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const cacheKey = `reviews:issue:${issueId}:page:${pageNum}:limit:${limitNum}`;

  // Check cache
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("✅ Returning cached reviews");
      return res.status(200).json({
        success: true,
        source: "cache",
        ...JSON.parse(cached),
      });
    }
  } catch (err) {
    console.warn("Cache read error:", err);
  }

  const skip = (pageNum - 1) * limitNum;

  // Fetch reviews
  const [reviews, total] = await Promise.all([
    Review.find({ issue: issueId })
      .populate("author", "name avatar email")
      .populate({
        path: "replies.author",
        select: "name avatar email",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Review.countDocuments({ issue: issueId }),
  ]);

  console.log(`✅ Found ${reviews.length} reviews for issue ${issueId}`);

  const result = {
    count: reviews.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    reviews,
  };

  // Cache result
  try {
    await setCache(cacheKey, result, 300);
  } catch (err) {
    console.warn("Cache write error:", err);
  }

  res.status(200).json({
    success: true,
    source: "db",
    ...result,
  });
});
