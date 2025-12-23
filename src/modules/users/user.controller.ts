// src/modules/users/user.controller.ts
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { catchAsync } from "../../middleware/catchAsync";
import User, { emailRegex, IUser } from "./user.model";
import { AppError } from "../../utils/errorHandler";
import bcrypt from "bcryptjs";
import { AuthRequest } from "../../middleware/auth.middleware";
import crypto from "crypto";
import { sendActivationEmail } from "../../utils/email";
import config from "../../config";
import { redis } from "../../config/redis";
import { generateAccessToken, generateRefreshToken, updateRefreshToken, verifyRefreshToken } from "../../utils/token";
import { getCache, invalidateCache, invalidateCacheAsync, setCache } from "../../utils/cache";
import { USER_CACHE_TTL } from "../../config/cacheConfig";
import { setAccessTokenCookie, setAuthCookies } from "../../utils/cookie";
import { sanitizeBody } from "../../helper/senitize";
import { deleteImageFromCloudinary, deleteMultipleImagesFromCloudinary, uploadBufferImage, uploadImageBase64 } from "../../utils/UploadImage";
import { compressImage } from "../../utils/image";

// 1. register user complexity o(1)
export const register = catchAsync(async (req: AuthRequest, res: Response) => {
  const body = sanitizeBody(req.body);
  const {name,email,password,confirmPassword,phone,nid,role,category,division} = body as any;

  // 1. Password match check
  if (password !== confirmPassword) {
    throw new AppError(400, "Passwords do not match!");
  }

  // 2. Check duplicate email/phone/nid in ONE QUERY
  const existing = await User.findOne({$or: [{ email }, { phone }, { nid }],}).select("email phone nid");

  if (existing) {
    if (existing.email === email) throw new AppError(400, "Email already exists!");
    if (existing.phone === phone) throw new AppError(400, "Phone already exists!");
    if (existing.nid === nid) throw new AppError(400, "NID already exists!");
  }

  // 3. First registered user → super-admin
  const userCount = await User.estimatedDocumentCount();

  if (userCount === 0) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({name,email,password: hashedPassword,phone,nid,isVerified: true,role: "super-admin"});

    return res.status(201).json({
      success: true,
      message: "Super admin created successfully!",
      data: {
        message: "Super admin created successfully!",
      },
    });
  }

  // 4. Category-admin registration (Only super-admin can create)
  if (role === "category-admin") {
    if (!req.user || req.user.role !== "super-admin") {
      throw new AppError(403, "Only super-admin can register category-admins!");
    }
    if (!category) {
      throw new AppError(400, "Category is required for category-admin!");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({name,email,password: hashedPassword,phone,nid,division,role: "category-admin",isVerified: true,category});

    return res.status(201).json({
      success: true,
      message: "Category admin created successfully!",
      data: {
        message: "Category admin created successfully!",
      },
    });
  }

  // 5. Regular user registration → via activation code
  const hashedPassword = await bcrypt.hash(password, 10);
  const activationCode = crypto.randomBytes(3).toString("hex").toUpperCase();
  const activationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store user data temporarily in Redis
  const userData = {name,email,password: hashedPassword,phone,nid,role: "user",activationCode,activationCodeExpiry: activationCodeExpiry.toISOString()};

  await redis.set(`activation:${email}`,JSON.stringify(userData),"EX",600); // 10 minutes

  // Create activation token
  const token = jwt.sign({ email, activationCode }, config.jwt_access_secret!, {expiresIn: "15m"} );

  try {
    await sendActivationEmail(email, activationCode);
  } catch (error) {
    await redis.del(`activation:${email}`);
    throw new AppError(500, "Failed to send activation email!");
  }

  res.status(200).json({
    success: true,
    message: "Check your email to activate your account.",
    data: {
      message: "Check your email to activate your account.",
      expiresIn: "10 minutes",
    },
  });
});


// 2. Activate user account complexity o(1)
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

  // Generate JWT token for login
  const token = jwt.sign(
    { userId: newUser._id, email: newUser.email, role: newUser.role },
    config.jwt_access_secret!,
    { expiresIn: "7d" }
  );

  res.status(201).json({
    success: true,
    message: "Account activated successfully!",
    data: {
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    },
  });
});


// 3. login user complexity o(1)
export const login = catchAsync(async (req: Request, res: Response) => {
  const body = sanitizeBody(req.body);
  const { email, password } = body as any;
  
  // validation
  if (!email || !emailRegex.test(email)) {
    throw new AppError(400, "Please provide a valid email!");
  }
  if (!password || password.length < 6) {
    throw new AppError(400, "Password is required!");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new AppError(404, "User not found!");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new AppError(401, "Invalid password!");

  const accessToken = generateAccessToken({ id: user._id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user._id, role: user.role });

  // Refresh token to database save (cookie not set)
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await updateRefreshToken(user as IUser, refreshToken, expiry);

  //  access token cookie set
  setAuthCookies(res, accessToken, refreshToken);

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
    avatar: user.avatar
  };

  await setCache(`user:${user._id}`, safeUser, USER_CACHE_TTL);

  res.status(200).json({
    success: true,
    message: "Login successful!",
    data: safeUser,
  });
});


// 4. refresh token complexity o(1)
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

  const user = await User.findById(decoded.id).select(
    "+refreshToken +refreshTokenExpiry"
  );

  if (
    !user ||
    user.refreshToken !== oldRefreshToken ||
    !user.refreshTokenExpiry
  ) {
    throw new AppError(401, "Invalid refresh token");
  }

  if (new Date() > user.refreshTokenExpiry) {
    user.refreshToken = null;
    user.refreshTokenExpiry = null;
    await user.save();
    throw new AppError(401, "Refresh token expired");
  }

  // 🔁 ROTATE refresh token
  const newRefreshToken = generateRefreshToken({
    id: user._id,
    role: user.role,
  });

  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  user.refreshToken = newRefreshToken;
  user.refreshTokenExpiry = newExpiry;
  await user.save();

  const newAccessToken = generateAccessToken({
    id: user._id,
    role: user.role,
  });

  // overwrite cookies
  setAuthCookies(res, newAccessToken, newRefreshToken);

  res.status(200).json({
    success: true,
    message: "Token refreshed",
  });
});


// 5. logout complexity o(1)
export const logout = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  if (userId) {
    // Redis from refresh token & user state delete 
    await redis.del(`refresh_token:${userId}`);

    // user cache invalidate (delete from cache)
    await invalidateCache(userId.toString());
  }

  // Cookies clear (explicit options)
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});


// 6. Forget Password (OTP Based) complexity o(1)
export const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  const body = sanitizeBody(req.body);
  const { email } = body as any;

  if (!email) throw new AppError(400, "Email is required!");

  const user = await User.findOne({ email });
  if (!user) throw new AppError(404, "User not found!");

  // 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  user.resetPasswordOtp = otp;
  user.resetPasswordOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min expire
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
  });
});


// 7. Reset Password complexity o(1)
export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const body = sanitizeBody(req.body);
  const { otp, newPassword } = body as any;

  if (!otp || !newPassword)
    throw new AppError(400, "OTP and new password are required!");

  // find user by OTP
  const user = await User.findOne({
    resetPasswordOtp: otp,
    resetPasswordOtpExpiry: { $gt: new Date() },
  }).select("+password");

  if (!user) throw new AppError(400, "Invalid or expired OTP!");

  // update password
  user.password = newPassword;
  user.resetPasswordOtp = null;
  user.resetPasswordOtpExpiry = null;
  await user.save();

  // Redis Cache update
  const userWithoutPassword = { ...user.toObject(), password: undefined };
  await setCache(user._id!.toString(), userWithoutPassword, USER_CACHE_TTL);

  res.status(200).json({
    success: true,
    message: "Password reset successfully!",
  });
});


// 8. edit profile by id complexity o(1)
export const editProfileById = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new AppError(401, "Unauthorized");

  const {name,email,phone,zipCode,profession,division,avatar,nidPic} = req.body;

  const existingUser = await User.findById(userId);
  if (!existingUser) throw new AppError(404, "User not found");

  const updateData: Partial<IUser> = {};

  /* ==========================
    BASIC FIELDS
  ========================== */
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (zipCode) updateData.zipCode = zipCode;
    if (profession) updateData.profession = profession;
    if (division) updateData.division = division;

  /* ==========================
    AVATAR (SINGLE IMAGE)
  ========================== */
  let newAvatar: IUser["avatar"] | undefined;

  // Case 1: multipart/form-data (single file upload)
  if (req.files && (req.files as any).avatar?.[0]) {
    const file = (req.files as any).avatar[0] as Express.Multer.File;

    console.log("📸 Uploading new avatar...");
    console.log(`Original size: ${(file.size / 1024).toFixed(2)} KB`);

    // Compress image
    const compressed = await compressImage(file.buffer);
    console.log(`Compressed size: ${(compressed.length / 1024).toFixed(2)} KB`);

    // Upload to Cloudinary
    newAvatar = await uploadBufferImage(compressed, "user-avatars");
    console.log(`✅ Avatar uploaded: ${newAvatar.url}`);
  }

  // Case 2: base64 fallback
  else if (typeof avatar === "string" && avatar.startsWith("data:image/")) {
    console.log("📸 Uploading base64 avatar...");
    newAvatar = await uploadImageBase64(avatar, "user-avatars");
    console.log(`✅ Avatar uploaded: ${newAvatar.url}`);
  }

  // If new avatar uploaded, update and delete old
  if (newAvatar) {
    updateData.avatar = newAvatar;

    // Delete old avatar from Cloudinary
    if (
      existingUser.avatar?.public_id &&
      existingUser.avatar.public_id.startsWith("user-avatars/")
    ) {
      console.log(`🗑️ Deleting old avatar: ${existingUser.avatar.public_id}`);
      await deleteImageFromCloudinary(existingUser.avatar.public_id).catch(() => {
        console.warn("Failed to delete old avatar");
      });
      }
    }
  
  /* ==========================
    NID PICTURES (MULTIPLE)
  ========================== */
  let newNidPics: { public_id: string; url: string }[] = [];

  // Case 1: multipart/form-data (multiple files)
  if (req.files && (req.files as any).nidPic) {
    const files = (req.files as any).nidPic as Express.Multer.File[];

    console.log(`📸 Uploading ${files.length} NID pictures...`);

    newNidPics = await Promise.all(
      files.map(async (file, index) => {
        console.log(`Processing NID ${index + 1}/${files.length}...`);
        console.log(`Original: ${(file.size / 1024).toFixed(2)} KB`);

        const compressed = await compressImage(file.buffer);
        console.log(`Compressed: ${(compressed.length / 1024).toFixed(2)} KB`);

        const uploaded = await uploadBufferImage(compressed, "user-nid");
        console.log(`✅ Uploaded: ${uploaded.url}`);

        return uploaded;
      })
    );
  }

  // Case 2: base64 fallback (multiple images)
  else if (Array.isArray(nidPic) && nidPic.length > 0) {
    const base64Images = nidPic.filter(
      (img) => typeof img === "string" && img.startsWith("data:image/")
    );

    if (base64Images.length > 0) {
      console.log(`📸 Uploading ${base64Images.length} base64 NID pictures...`);

      newNidPics = await Promise.all(
        base64Images.map(async (img, index) => {
          console.log(`Processing NID ${index + 1}/${base64Images.length}...`);
          const uploaded = await uploadImageBase64(img, "user-nid");
          console.log(`✅ Uploaded: ${uploaded.url}`);
          return uploaded;
        })
      );
    }
  }

  // If new NID pics uploaded, update and delete old
  if (newNidPics.length > 0) {
    updateData.nidPic = newNidPics;

    // Delete old NID images from Cloudinary
    if (existingUser.nidPic?.length) {
      const oldIds = existingUser.nidPic
        .filter((p) => p.public_id.startsWith("user-nid/"))
        .map((p) => p.public_id);

      if (oldIds.length) {
        console.log(`🗑️ Deleting ${oldIds.length} old NID pictures...`);
        await deleteMultipleImagesFromCloudinary(oldIds).catch(() => {
          console.warn("Failed to delete old NID pictures");
        });
      }
    }
  }

  // Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    throw new AppError(400, "No valid fields to update");
  }

  // Update user in database
  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
    select: "-password -refreshToken -activationCode -resetPasswordOtp -refreshTokenExpiry",
  });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  }
);


// 9. get user profile by id complexity o(1)
export const getProfileById = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  if (!userId) throw new AppError(401, "Unauthorized");

  const user = await User.findById(userId).select(
    "-password -refreshToken -refreshTokenExpiry -activationCode -activationCodeExpiry -resetPasswordOtp -resetPasswordOtpExpiry"
  );

  if (!user) throw new AppError(404, "User not found");

  res.status(200).json({
    success: true,
    message: "Profile fetched successfully!",
    data: user,
  });
});


// 10. get all normal users (only super-admin and category-admin can access) complexity o(n)
export const getAllUsers = catchAsync(async (req: AuthRequest, res: Response) => {
  const role = req.user?.role;
  if (role !== "category-admin" && role !== "super-admin") {
    throw new AppError(403, "You are not authorized to access user list!");
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const skip = (page - 1) * limit;

  const cacheKey = `users:list:role=user:page=${page}:limit=${limit}`;

  // ✅ CACHE READ
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      message: "User list fetched from cache",
      ...cached,
    });
  }

  // ✅ Parallel DB queries
  const [totalUsers, users] = await Promise.all([
    User.countDocuments({ role: "user" }),
    User.find({ role: "user" })
      .select("-password -refreshToken -refreshTokenExpiry -activationCode -activationCodeExpiry -resetPasswordOtp -resetPasswordOtpExpiry")
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const payload = { totalUsers, data: users };

  // ✅ CACHE WRITE
  await setCache(cacheKey, payload, 600); // 10 min TTL

  res.status(200).json({
    success: true,
    message: "User list fetched successfully",
    ...payload,
  });
});


// 11. get all category admin complexity o(n)
export const getAllCategoryAdmins = catchAsync(async (req: AuthRequest, res: Response) => {
  const role = req.user?.role;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  if (role !== "super-admin") {
    throw new AppError(403, "You are not authorized to access category admin list!");
  }

  const totalCategoryAdmins = await User.countDocuments({ role: "category-admin" });

  const categoryAdmins = await User.find({ role: "category-admin" }).skip((page - 1) * limit).limit(limit).select("-password -refreshToken -refreshTokenExpiry -activationCode -activationCodeExpiry -resetPasswordOtp -resetPasswordOtpExpiry");

  res.status(200).json({
    success: true,
    message: "Category admin list fetched successfully",
    totalCategoryAdmins,
    data: categoryAdmins,
  });
});


// 12. update category admin role complexity o(1)
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
  user.category = category ?? user.category;
  user.division = division ?? user.division;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Category admin role updated successfully!",
    data: {
      id: user._id,
      category: user.category,
      division: user.division,
    }
  });
});


// 13. delete category admin role complexity o(1)
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

  res.status(200).json({
    success: true,
    message: "Category admin deleted successfully!",
  });
});


// 14. Get socket token
export const getSocketToken = catchAsync(async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const socketToken = jwt.sign(
    {
      id: user._id,
      role: user.role,
      category: user.category,
      email: user.email,
    },
    config.socket_token_secret!,
    { expiresIn: "10m" }
  );

  res.status(200).json({
    success: true,
    data: { socketToken },
  });
});

