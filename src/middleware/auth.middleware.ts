import { Request, Response, NextFunction } from "express";
import User, { IUser } from "../modules/users/user.model";
import jwt from "jsonwebtoken";
import config from "../config";
import { AppError } from "../utils/errorHandler";
import { getCache, setCache } from "../utils/cache";


export interface AuthRequest extends Request {
  user?: IUser | undefined;
}


// Authentication middleware
export const isAuthenticated = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.accessToken;
  if (!token) return next(new AppError(401, "Access token missing"));

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt_access_secret!) as { id: string };
    
    // 1. try to get user from cache
    let user = await getCache(`user:${decoded.id}`);
    if (!user) {
      // 2. fallback to DB
      const userDoc = await User.findById(decoded.id).select("-password +category");
      if (!userDoc) return next(new AppError(404, "User not found"));
      user = userDoc.toObject();
      // 3. store in cache for next time
      await setCache(`user:${decoded.id}`, user);
    }
    req.user = user;
    next();
  } catch {
    return next(new AppError(401, "Token expired or invalid"));
  }
};

// Authorization middleware
export const authorizeRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "Not authorized"));
    }
    next();
  };
};


// Optional authentication middleware
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.accessToken;
  if (!token) return next(); // no token, skip silently (public access)

  try {
    const decoded = jwt.verify(token, config.jwt_access_secret!) as { id: string };
    let user = await getCache(decoded.id);
    if (!user) {
      const userDoc = await User.findById(decoded.id).select("-password");
      if (userDoc) {
        user = userDoc.toObject();
        await setCache(decoded.id, user);
      }
    }
    if (user) req.user = user;
  } catch {
    // ignore invalid token for public users
  }
  next();
};


// role and category admin guard
export const categoryAdminGuard = (req: AuthRequest,res: Response,next: NextFunction) => {
  const user = req.user;
  if (!user) {
    throw new AppError(401, "Unauthorized");
  }
  if (user.role === "category-admin" && !user.category) {
    throw new AppError(403, "Category admin has no assigned category");
  }
  next();
};
