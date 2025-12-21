// src/modules/issues/issue.controller.ts
import { Request, Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { AuthRequest } from "../../middleware/auth.middleware";
import { CATEGORY_STATS_KEY, generateIssueCacheKey, generateIssuesCacheKey, getCache, invalidateCacheAsync, invalidateIssueCache, setCache } from "../../utils/cache";
import { AppError } from "../../utils/errorHandler";
import { sendIssueStatusEmail } from "../../utils/email";
import Issue, { IssueStatus } from "./issue.model";
import { uploadBufferImage, uploadImageBase64 } from "../../utils/UploadImage";
import { compressImage } from "../../utils/image";


// 1. create issue with zod validation
export const createIssue = catchAsync(async (req: AuthRequest, res: Response) => {
  const { title, category, description, location, division, date, images } = req.body;

  if (!title || !category || !description || !location || !division) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  let uploadedImages: { public_id: string; url: string }[] = [];

  if (req.files && Array.isArray(req.files)) {
    const files = req.files as Express.Multer.File[];
    uploadedImages = await Promise.all(
      files.map(async (file) => {
        const compressed = await compressImage(file.buffer);
        const uploaded = await uploadBufferImage(compressed, "issue-reports");
        return uploaded;
      })
    );
  }
  else if (Array.isArray(images) && images.length > 0) {
    uploadedImages = await Promise.all(
      images.map(async (img: string) => {
        const uploaded = await uploadImageBase64(img, "issue-reports");
        return uploaded;
      })
    );
  }

  const newIssue = await Issue.create({
    title,
    category,
    description,
    images: uploadedImages,
    location,
    division,
    author: req.user!._id,
    date: date || Date.now(),
  });

  // Invalidate issue list cache
  await invalidateIssueCache(newIssue._id!.toString());

  res.status(201).json({ success: true, message: "Issue created successfully!", issue: newIssue });
});


// 2. get all issues with pagination
export const getAllIssues = catchAsync(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 10, sort = "-createdAt", status, division, category, search } = req.query;
  const user = req.user;

  // Dynamic query
  const query: any = {};
  if (status) query.status = status;
  if (division) query.division = division;
  if (category) query.category = category;
  if (search) query.$text = { $search: search as string };

  // Category-admin can only see own category
  if (user?.role === "category-admin") {
    if (!user.category) throw new AppError(403, "Your admin account has no assigned category");
    query.category = user.category;
  }

  // Generate cache key
  const cacheKey = generateIssuesCacheKey({ ...query, page, limit, sort });
  const cachedData = await getCache(cacheKey);
  if (cachedData) return res.status(200).json({ success: true, message: "Issues fetched (from cache)", ...cachedData });


  const pageNumber = Math.max(1, parseInt(page as string, 10));
  const limitNumber = Math.min(50, Math.max(1, parseInt(limit as string, 10)));

  // MongoDB query with pagination and index-friendly sort
  const [issues, totalIssues] = await Promise.all([
    Issue.find(query)
      .populate({ path: "reviews", populate: { path: "author replies.author", select: "name email" } })
      .populate("author", "name email")
      .populate("approvedBy", "name email role avatar")
      .sort(sort as string)
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean(),
    Issue.countDocuments(query)
  ]);

  const responseData = {
    issues,
    totalIssues,
    totalPages: Math.ceil(totalIssues / limitNumber),
  };

  await setCache(cacheKey, responseData);

  res.status(200).json({
    success: true,
    message: "All issues fetched successfully",
    ...responseData,
  });
});


// 3. get issue by id  (issue details)
export const getIssueById = catchAsync(async (req: AuthRequest, res: Response) => {
  const { issueId } = req.params;
  if (!issueId) throw new AppError(400, "Issue ID is required");

  const cacheKey = generateIssueCacheKey(issueId);
  const cached = await getCache(cacheKey);
  if (cached) return res.status(200).json({ success: true, message: "Issue fetched (from cache)", ...cached });

  const issue = await Issue.findById(issueId)
    .populate({ path: "reviews", populate: { path: "author replies.author", select: "name email" } })
    .populate("author", "name email")
    .lean();


  if (!issue) throw new AppError(404, "Issue not found");

  await setCache(cacheKey, { success: true, issue }, 600);

  res.status(200).json({ message: "Issue fetched successfully", issue });
});


// 4. Update Issue by ID (category-admin or super-admin)
export const updateIssueById = catchAsync(async (req: AuthRequest, res: Response) => {
  const { issueId } = req.params;
  const { status } = req.body;
  const user = req.user!;

  // Validate status
  if (!Object.values(IssueStatus).includes(status)) {
    throw new AppError(400, "Invalid status value! Must be pending, in-progress or solved.");
  }

  // Atomic update with permission check
  const filter: any = { _id: issueId };
  if (user.role === "category-admin") filter.category = user.category;

  const update = { status, approvedBy: user._id, approvedAt: new Date() };
  const issue = await Issue.findOneAndUpdate(filter, update, { new: true })
    .populate("author", "name email")
    .populate("approvedBy", "name email role avatar");


  if (!issue) throw new AppError(403, "Access denied or issue not found");

  // Invalidate cache
  invalidateCacheAsync(CATEGORY_STATS_KEY(issue.category));
  invalidateCacheAsync("issues:list"); // optional: issue list refresh

  // Send Email Notification to issue author
  const author: any = issue.author;
  const userEmail = author?.email;
  const issueTitle = issue.title;

  if (userEmail) {
    try {
      await sendIssueStatusEmail(userEmail, issueTitle, status);
      console.log(`Email sent to ${userEmail} about status: ${status}`);
    } catch (err) {
      console.error("Failed to send issue status email:", err);
    }
  } 

  res.status(200).json({
    success: true,
    message: `Issue status updated to '${status}' and email sent to user.`,
    issue,
  });
});


// 5. delete issue by id (category-admin access only)
export const deleteIssueById = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  if (!user) throw new AppError(401, "Unauthorized");

  // Delete with filter for category-admin
  const filter: any = { _id: id };
  if (user.role === "category-admin") filter.category = user.category;

  const issue = await Issue.findOneAndDelete(filter);
  if (!issue) throw new AppError(404, "Issue not found or access denied");

  await invalidateIssueCache(issue._id!.toString());

  res.status(200).json({
    success: true,
    message: "Issue deleted successfully and cache invalidated",
  });
});


// 6. get issue for (single user)
export const getIssueByUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = 10;

  const cacheKey = `user:${userId}:issues:page:${page}`;
  const cached = await getCache(cacheKey);
  if (cached) return res.status(200).json({ success: true, message: "Issues fetched (from cache)", ...cached });

  const issues = await Issue.find({ author: userId })
    .sort("-createdAt")
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  await setCache(cacheKey, { success: true, issues }, 600);

  res.status(200).json({ success: true, message: "Issues fetched successfully", issues });
});

