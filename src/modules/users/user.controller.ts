// src/modules/users/user.controller.ts

import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import User, { emailRegex, IUser } from "./user.model";
import { AppError } from "../../utils/errorHandler";
import bcrypt from "bcryptjs";
import { AuthRequest } from "../../middleware/auth.middleware";
import crypto from "crypto";
import { sendActivationEmail } from "../../utils/email";
import { redis } from "../../config/redis";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../utils/token";
import { setAccessTokenCookie, setAuthCookies } from "../../utils/cookie";
import { sanitizeBody } from "../../helper/senitize";
import { deleteCache, getCache, setCache } from "../../helper/redisCache";
import { calculateCursorPagination, createCursorPaginationMeta } from "../../helper/cursorPagination";
import sharp from "sharp";
import { deleteMultipleImagesFromCloudinary, uploadToCloudinary } from "../../utils/uploadToCloudinary";



// 1. Register User time complexity: O(1)
export const register = catchAsync(async (req: AuthRequest, res: Response) => {
  const body = sanitizeBody(req.body);
  const { name, email, password, confirmPassword, phone, nid, role, category, division } = body as any;

  // Validate password match
  if (password !== confirmPassword) {
    throw new AppError(400, "Passwords do not match!");
  }

  // Check for duplicate email/phone/nid in ONE query
  const existing = await User.findOne({$or: [{ email }, { phone }, { nid }]}).select("email phone nid").lean();

  if (existing) {
    if (existing.email === email) throw new AppError(400, "Email already exists!");
    if (existing.phone === phone) throw new AppError(400, "Phone already exists!");
    if (existing.nid === nid) throw new AppError(400, "NID already exists!");
  }

  // First registered user becomes super-admin
  const userCount = await User.estimatedDocumentCount();

  if (userCount === 0) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const superAdmin = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      nid,
      isVerified: true,
      role: "super-admin",
    });

    return res.status(201).json({
      success: true,
      message: "Super admin created successfully!",
      data: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role,
      },
    });
  }

  // Category-admin registration (Only super-admin can create)
  if (role === "category-admin") {
    if (!req.user || req.user.role !== "super-admin") {
      throw new AppError(403, "Only super-admin can register category-admins!");
    }
    if (!category) {
      throw new AppError(400, "Category is required for category-admin!");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const categoryAdmin = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      nid,
      division,
      role: "category-admin",
      isVerified: true,
      category,
    });

    return res.status(201).json({
      success: true,
      message: "Category admin created successfully!",
      data: {
        id: categoryAdmin._id,
        name: categoryAdmin.name,
        email: categoryAdmin.email,
        role: categoryAdmin.role,
        category: categoryAdmin.category,
      },
    });
  }

  // Regular user registration with activation code
  const hashedPassword = await bcrypt.hash(password, 12);
  const activationCode = crypto.randomBytes(3).toString("hex").toUpperCase();
  const activationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store user data temporarily in Redis
  const userData = {
    name,
    email,
    password: hashedPassword,
    phone,
    nid,
    role: "user",
    activationCode,
    activationCodeExpiry: activationCodeExpiry.toISOString(),
  };

  await redis.set(`activation:${email}`, JSON.stringify(userData), "EX", 600);

  // Send activation email
  try {
    await sendActivationEmail(email, activationCode);
  } catch (error) {
    await redis.del(`activation:${email}`);
    throw new AppError(500, "Failed to send activation email!");
  }

  res.status(200).json({
    success: true,
    message: "Registration successful! Check your email to activate your account.",
    data: {
      email,
      expiresIn: "10 minutes",
    },
  });
});


// 2. Activate User Account time complexity: O(1)
export const activateUser = catchAsync(async (req: Request, res: Response) => {
  const body = sanitizeBody(req.body);
  const { email, activationCode } = body as any;

  if (!email || !activationCode) {
    throw new AppError(400, "Email and activation code are required!");
  }

  // Get user data from Redis
  const userDataString = await redis.get(`activation:${email}`);

  if (!userDataString) {
    throw new AppError(400, "Activation code expired or invalid!");
  }

  const userData = JSON.parse(userDataString);

  // Verify activation code
  if (userData.activationCode !== activationCode.toUpperCase()) {
    throw new AppError(400, "Invalid activation code!");
  }

  // Check if activation code expired
  const expiryTime = new Date(userData.activationCodeExpiry);
  if (new Date() > expiryTime) {
    await redis.del(`activation:${email}`);
    throw new AppError(400, "Activation code has expired!");
  }

  // Create user in database
  const newUser = await User.create({
    name: userData.name,
    email: userData.email,
    password: userData.password,
    phone: userData.phone,
    nid: userData.nid,
    role: userData.role,
    isVerified: true,
  });

  // Delete from Redis after successful activation
  await redis.del(`activation:${email}`);

  // Generate tokens
  const accessToken = generateAccessToken({ id: newUser._id!.toString(), role: newUser.role });
  const refreshToken = generateRefreshToken({ id: newUser._id!.toString(), role: newUser.role });

  // Set cookies
  setAuthCookies(res, accessToken, refreshToken);

  // Cache user data
  const safeUser = {
    _id: newUser._id!.toString(),
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    isVerified: newUser.isVerified,
  };

  res.status(201).json({
    success: true,
    message: "Account activated successfully!",
    data: safeUser,
  });
});


// 3. Login User time complexity: O(1)
export const login = catchAsync(async (req: Request, res: Response) => {
  const body = sanitizeBody(req.body);
  const { email, password } = body as any;

  // Validation
  if (!email || !emailRegex.test(email)) {
    throw new AppError(400, "Please provide a valid email!");
  }
  if (!password || password.length < 6) {
    throw new AppError(400, "Password must be at least 6 characters!");
  }

  const user = await User.findOne({ email }).select("+password").lean();
  if (!user) throw new AppError(404, "User not found!");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new AppError(401, "Invalid password!");

  // Check if user is verified
  if (!user.isVerified) {
    throw new AppError(403, "Please verify your email before logging in!");
  }

  // Generate tokens
  const accessToken = generateAccessToken({ id: user._id!.toString(), role: user.role });
  const refreshToken = generateRefreshToken({ id: user._id!.toString(), role: user.role });

  // Set cookies
  setAuthCookies(res, accessToken, refreshToken);

  // Prepare safe user data
  const safeUser = {
    _id: user._id!.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    category: user.category,
    isVerified: user.isVerified,
    phone: user.phone,
    zipCode: user.zipCode,
    profession: user.profession,
    division: user.division,
    nidPic: user.nidPic,
    avatar: user.avatar,
  };

  res.status(200).json({
    success: true,
    message: "Login successful!",
    data: safeUser,
  });
});


// 4. Refresh Access Token time complexity: O(1)
export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const oldRefreshToken = req.cookies?.refreshToken;

  if (!oldRefreshToken) {
    throw new AppError(401, "Refresh token missing");
  }

  let decoded: any;
  try {
    decoded = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AppError(401, "Invalid refresh token");
  }

  const user = await User.findById(decoded.id).select("role").lean();
  if (!user) {
    throw new AppError(401, "User no longer exists");
  }

  // Generate new access token
  const newAccessToken = generateAccessToken({ id: decoded.id, role: user.role });

  // Update access token cookie
  setAccessTokenCookie(res, newAccessToken);

  res.status(200).json({
    success: true,
    message: "Access token refreshed successfully",
  });
});


// 5. Logout User time complexity: O(1)
export const logout = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;

  // Clear cookies
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});


// 6. Forget Password (OTP Based) time complexity: O(1)
export const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  const body = sanitizeBody(req.body);
  const { email } = body as any;

  if (!email) throw new AppError(400, "Email is required!");

  const user = await User.findOne({ email });
  if (!user) throw new AppError(404, "User not found!");

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  user.resetPasswordOtp = otp;
  user.resetPasswordOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save({ validateBeforeSave: false });

  try {
    await sendActivationEmail(email, `Your password reset OTP is: ${otp}`);
  } catch (err) {
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpiry = null;
    await user.save({ validateBeforeSave: false });
    throw new AppError(500, "Failed to send reset OTP. Please try again later.");
  }

  res.status(200).json({
    success: true,
    message: "Password reset OTP sent successfully to your email.",
    data: {
      email,
      expiresIn: "10 minutes",
    },
  });
});


// 7. Reset Password time complexity: O(1)
export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const body = sanitizeBody(req.body);
  const { otp, newPassword } = body as any;

  if (!otp || !newPassword) {
    throw new AppError(400, "OTP and new password are required!");
  }

  if (newPassword.length < 6) {
    throw new AppError(400, "Password must be at least 6 characters!");
  }

  // Find user by OTP
  const user = await User.findOne({
    resetPasswordOtp: otp,
    resetPasswordOtpExpiry: { $gt: new Date() },
  });

  if (!user) throw new AppError(400, "Invalid or expired OTP!");

  // Hash new password
  user.password = await bcrypt.hash(newPassword, 12);
  user.resetPasswordOtp = null;
  user.resetPasswordOtpExpiry = null;
  await user.save();

  // Invalidate user cache
  await deleteCache(`user:${user._id}`);

  res.status(200).json({
    success: true,
    message: "Password reset successfully!",
  });
});


// 8. Edit Profile by ID time complexity: O(n)
export const editProfileById = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new AppError(401, "Unauthorized");

  const { name, email, phone, zipCode, profession, division } = req.body;

  const existingUser = await User.findById(userId);
  if (!existingUser) throw new AppError(404, "User not found");

  const updateData: any = {};

  // ================= BASIC FIELDS =================
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (phone) updateData.phone = phone;
  if (zipCode) updateData.zipCode = zipCode;
  if (profession) updateData.profession = profession;
  if (division) updateData.division = division;

  // ================= AVATAR (SINGLE IMAGE) =================
  const avatarFile = (req.files as any)?.avatar?.[0];

  if (avatarFile) {
    const avatarBuffer = await sharp(avatarFile.buffer)
      .resize(500, 500)
      .webp({ quality: 70 })
      .toBuffer();

    const avatarUpload = await uploadToCloudinary(
      avatarBuffer,
      "users/avatar"
    );

    updateData.avatar = {
      public_id: avatarUpload.public_id,
      url: avatarUpload.secure_url,
    };

    // delete old avatar
    if (
      existingUser.avatar?.public_id &&
      existingUser.avatar.public_id.startsWith("users/avatar")
    ) {
      await deleteMultipleImagesFromCloudinary([
        existingUser.avatar.public_id,
      ]).catch(() => {});
    }
  }

  // ================= NID PICTURES (MULTIPLE) =================
  const nidFiles = (req.files as any)?.nidPic as Express.Multer.File[];

  if (nidFiles && nidFiles.length > 0) {
    if (nidFiles.length > 3) {
      throw new AppError(400, "Maximum 3 NID images allowed");
    }

    const compressedBuffers = await Promise.all(
      nidFiles.map((file) =>
        sharp(file.buffer)
          .resize({ width: 1200 })
          .webp({ quality: 65 })
          .toBuffer()
      )
    );

    const uploads = await Promise.all(
      compressedBuffers.map((buffer) =>
        uploadToCloudinary(buffer, "users/nid")
      )
    );

    updateData.nidPic = uploads.map((img) => ({
      public_id: img.public_id,
      url: img.secure_url,
    }));

    // delete old nid images
    if (existingUser.nidPic?.length) {
      const oldIds = existingUser.nidPic
        .filter((i) => i.public_id.startsWith("users/nid"))
        .map((i) => i.public_id);

      if (oldIds.length) {
        await deleteMultipleImagesFromCloudinary(oldIds).catch(() => {});
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError(400, "No valid fields to update");
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
    select: "-password -activationCode -resetPasswordOtp",
  });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: updatedUser,
  });
});

// 9. Get User Profile by ID time complexity: O(1)
export const getProfileById = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new AppError(401, "Unauthorized");

  // Try cache first
  const cacheKey = `user:${userId}`;
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`⚡ Cache hit: ${cacheKey}`);
      return res.status(200).json({
        success: true,
        message: "Profile fetched (from cache)",
        data: cached,
      });
    }
  } catch (cacheError) {
    console.error("Cache retrieval error:", cacheError);
  }

  const user = await User.findById(userId)
    .select("-password -refreshToken -refreshTokenExpiry -activationCode -activationCodeExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
    .lean();

  if (!user) throw new AppError(404, "User not found");

  res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data: user,
  });
});


// 10. Get All Users (Cursor Pagination) time complexity: O(n)
export const getAllUsers = catchAsync(async (req: AuthRequest, res: Response) => {
  const role = req.user?.role;

  if (role !== "category-admin" && role !== "super-admin") {
    throw new AppError(403, "You are not authorized to access user list!");
  }

  const { cursor, limit = 10, sortOrder = "desc" } = req.query;

  const cacheKey = `users:list:role=user:${cursor || 'first'}:${limit}:${sortOrder}`;

  // Try cache first
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`⚡ Cache hit: ${cacheKey}`);
      return res.status(200).json({
        success: true,
        message: "User list fetched (from cache)",
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
    role: "user",
    ...paginationOptions.filter,
  };

  // Fetch users
  const users = await User.find(query)
    .select("-password -refreshToken -refreshTokenExpiry -activationCode -activationCodeExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
    .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
    .limit(paginationOptions.limit + 1)
    .lean();

  // Create pagination metadata
  const { data, meta } = createCursorPaginationMeta(
    users,
    paginationOptions.limit,
    paginationOptions.sortBy,
    paginationOptions.sortOrder
  );

  // Get total count
  const total = await User.countDocuments({ role: "user" });

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
    message: "User list fetched successfully",
    ...responseData,
  });
});


// 11. Get All Category Admins (Cursor Pagination) time complexity: O(n)
export const getAllCategoryAdmins = catchAsync(async (req: AuthRequest, res: Response) => {
  const role = req.user?.role;

  if (role !== "super-admin") {
    throw new AppError(403, "You are not authorized to access category admin list!");
  }

  const { cursor, limit = 10, sortOrder = "desc" } = req.query;

  const cacheKey = `users:list:role=category-admin:${cursor || 'first'}:${limit}:${sortOrder}`;

  // Try cache first
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`⚡ Cache hit: ${cacheKey}`);
      return res.status(200).json({
        success: true,
        message: "Category admin list fetched (from cache)",
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
    role: "category-admin",
    ...paginationOptions.filter,
  };

  // Fetch category admins
  const categoryAdmins = await User.find(query)
    .select("-password -refreshToken -refreshTokenExpiry -activationCode -activationCodeExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
    .sort({ [paginationOptions.sortBy]: paginationOptions.sortOrder === 'asc' ? 1 : -1 })
    .limit(paginationOptions.limit + 1)
    .lean();

  // Create pagination metadata
  const { data, meta } = createCursorPaginationMeta(
    categoryAdmins,
    paginationOptions.limit,
    paginationOptions.sortBy,
    paginationOptions.sortOrder
  );

  // Get total count
  const total = await User.countDocuments({ role: "category-admin" });

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
    message: "Category admin list fetched successfully",
    ...responseData,
  });
});


// 12. Update Category Admin Role time complexity: O(1)
export const updateCategoryAdminRole = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { category, division } = req.body;

  if (req.user?.role !== "super-admin") {
    throw new AppError(403, "Only super-admin can update category admin!");
  }

  // Find the user to update
  const user = await User.findById(id);
  if (!user) throw new AppError(404, "User not found");

  // Ensure the target user is category-admin
  if (user.role !== "category-admin") {
    throw new AppError(400, "Only category-admin can be updated!");
  }

  // Update fields
  if (category) user.category = category;
  if (division) user.division = division;

  await user.save();

  // Invalidate cache
  await deleteCache(`user:${id}`);
  await deleteCache(`users:list:role=category-admin:*`);

  res.status(200).json({
    success: true,
    message: "Category admin updated successfully!",
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      category: user.category,
      division: user.division,
    },
  });
});


// 13. Delete Category Admin time complexity: O(1)
export const deleteCategoryAdminRole = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  if (req.user?.role !== "super-admin") {
    throw new AppError(403, "Only super-admin can delete a category admin!");
  }

  const user = await User.findById(id);
  if (!user) throw new AppError(404, "User not found");

  if (user.role !== "category-admin") {
    throw new AppError(400, "Only category-admin accounts can be deleted!");
  }

  if (req.user._id!.toString() === id) {
    throw new AppError(400, "Super-admin cannot delete themselves!");
  }

  await User.findByIdAndDelete(id);

  // Invalidate cache
  await deleteCache(`user:${id}`);
  await deleteCache(`users:list:role=category-admin:*`);

  res.status(200).json({
    success: true,
    message: "Category admin deleted successfully!",
  });
});
