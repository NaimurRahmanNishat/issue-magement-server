// src/utils/response.ts
import { Response } from "express";
import { ApiResponse } from "../@types/api";

export const sendError = (res: Response, message: string, statusCode: number=500, errors?: string[]): void => {
  const response: ApiResponse = {
    success: false,
    message,
    errors: errors || [],
  }

  res.status(statusCode).json(response);
};

export const sendSuccess = <T>(res: Response, message?: string, data?: T, statusCode: number=200, meta?: ApiResponse['meta']) => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    meta
  }

  return res.status(statusCode).json(response);
};


export const sendCreated = <T>(res: Response, message: string ="Resource Created successfully", data?: T, meta?: ApiResponse['meta']) => {
  return sendSuccess(res, message, data, 201, meta);
}