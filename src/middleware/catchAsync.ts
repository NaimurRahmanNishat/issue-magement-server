// src/middleware/catchAsync.ts
import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/errorHandler";

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const catchAsync = (fn: AsyncFunction) => asyncHandler(fn);