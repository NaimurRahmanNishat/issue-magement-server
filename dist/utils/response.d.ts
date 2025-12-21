import { Response } from "express";
import { ApiResponse } from "../@types/api";
export declare const sendError: (res: Response, message: string, statusCode?: number, errors?: string[]) => void;
export declare const sendSuccess: <T>(res: Response, message?: string, data?: T, statusCode?: number, meta?: ApiResponse["meta"]) => Response<any, Record<string, any>>;
export declare const sendCreated: <T>(res: Response, message?: string, data?: T, meta?: ApiResponse["meta"]) => Response<any, Record<string, any>>;
//# sourceMappingURL=response.d.ts.map