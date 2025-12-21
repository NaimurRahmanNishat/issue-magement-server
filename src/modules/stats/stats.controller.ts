import { Request, Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { AuthRequest } from "../../middleware/auth.middleware";
import { CATEGORY_STATS_KEY, getCache, setCache } from "../../utils/cache";
import { AppError } from "../../utils/errorHandler";
import User from "../users/user.model";
import Issue from "../issues/issue.model";
import Review from "../comments/review.model";


// 1. User Stats (cached)
export const userStats = catchAsync(async (req: AuthRequest, res: Response) => {
  const email = req.user?.email;  
  
  if (!email) throw new AppError(400, "Authentication required!");

  const cacheKey = `user_stats_${email}`;
  const cached = await getCache(cacheKey);
  
  if (cached) {
    return res.status(200).json({
      success: true,
      message: "User stats fetched from cache!",
      data: cached,
    });
  }

  const user = await User.findOne({ email });
  if (!user) throw new AppError(404, "User not found!");

  // Basic Stats
  const totalIssues = await Issue.countDocuments({ author: user._id });
  const userReviews = await Review.find({ author: user._id });
  const totalReviews = userReviews.length;
  const totalReplies = userReviews.reduce((acc, r) => acc + (r.replies?.length || 0), 0);
  const totalReviewAndComment = totalReviews + totalReplies;

  const totalPending = await Issue.countDocuments({ author: user._id, status: "pending" });
  const totalInProgress = await Issue.countDocuments({ author: user._id, status: "in-progress" });
  const totalSolved = await Issue.countDocuments({ author: user._id, status: "solved" });

  // Monthly Issues Aggregation
  const monthlyIssues = await Issue.aggregate([
    { $match: { author: user._id } },
    {
      $group: {
        _id: { month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        month: "$_id.month",
        count: 1,
        _id: 0,
      },
    },
    { $sort: { month: 1 } }
  ]);

  const stats = {
    totalIssues,
    totalReviewAndComment,
    totalSolved,
    totalPending,
    totalInProgress,
    monthlyIssues,  
  };

  await setCache(cacheKey, stats, 600);

  res.status(200).json({
    success: true,
    message: "User stats fetched successfully!",
    data: stats,
  });
});


// 2. Super Admin Stats (cached)
export const adminStats = catchAsync(async (req: Request, res: Response) => {
  const cacheKey = `super_admin_stats`;

  // Check cache first
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      message: "Admin stats fetched from cache!",
      data: cached,
    });
  }

  // Total issues count
  const totalIssues = await Issue.countDocuments();

  // Count issues by status
  const pendingIssues = await Issue.countDocuments({ status: "pending" });
  const inProgressIssues = await Issue.countDocuments({ status: "in-progress" });
  const solvedIssues = await Issue.countDocuments({ status: "solved" });

  // Monthly issues aggregation
  const currentYear = new Date().getFullYear();
  const monthlyAggregation = await Issue.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
          $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`),
        },
      },
    },
    {
      $group: {
        _id: { month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.month": 1 } },
  ]);

  const monthlyPostIssue = Array.from({ length: 12 }, (_, idx) => {
    const monthData = monthlyAggregation.find((m) => m._id.month === idx + 1);
    return { month: idx + 1, count: monthData ? monthData.count : 0 };
  });

  const stats = {
    totalIssues,
    pendingIssues,
    inProgressIssues,
    solvedIssues,
    monthlyIssues: monthlyPostIssue, // frontend expects this
  };

  await setCache(cacheKey, stats, 600);

  res.status(200).json({
    success: true,
    message: "Admin stats fetched successfully!",
    data: stats,
  });
});


// 3. Category Admin Stats (cached) 
export const categoryAdminStats = catchAsync(async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "category-admin") {
    throw new AppError(403, "Unauthorized");
  }

  // No database hit for category
  const category = req.user.category;
  if (!category) {
    throw new AppError(400, "Category not assigned");
  }

  const cacheKey = CATEGORY_STATS_KEY(category);

  // cache first (o(1) time complexity)
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      message: "Category stats from cache",
      data: cached,
    });
  }

  // data base parallel queries
  const year = new Date().getFullYear();
  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year}-12-31`);

  const [
    totalIssues,
    pendingIssues,
    inProgressIssues,
    solvedIssues,
    monthlyAgg,
  ] = await Promise.all([
    Issue.countDocuments({ category }),
    Issue.countDocuments({ category, status: "pending" }),
    Issue.countDocuments({ category, status: "in-progress" }),
    Issue.countDocuments({ category, status: "solved" }),
    Issue.aggregate([
      {
        $match: { category, createdAt: { $gte: start, $lte: end } },
      },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  // month normalization
  const monthMap = new Map<number, number>();
  monthlyAgg.forEach(m => monthMap.set(m._id.month, m.count));

  const monthlyPostIssue = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: monthMap.get(i + 1) || 0,
  }));

  const stats = {
    category,
    totalIssues,
    pendingIssues,
    inProgressIssues,
    solvedIssues,
    monthlyPostIssue,
  };

  // set cache
  await setCache(cacheKey, stats, 600);

  res.status(200).json({
    success: true,
    message: "Category stats fetched successfully",
    data: stats,
  });
});

