import { NextFunction, Request, Response } from "express";
export declare const register: (req: Request, res: Response, next: NextFunction) => void;
export declare const activateUser: (req: Request, res: Response, next: NextFunction) => void;
export declare const login: (req: Request, res: Response, next: NextFunction) => void;
export declare const refreshToken: (req: Request, res: Response, next: NextFunction) => void;
export declare const logout: (req: Request, res: Response, next: NextFunction) => void;
export declare const forgetPassword: (req: Request, res: Response, next: NextFunction) => void;
export declare const resetPassword: (req: Request, res: Response, next: NextFunction) => void;
export declare const editProfileById: (req: Request, res: Response, next: NextFunction) => void;
export declare const getProfileById: (req: Request, res: Response, next: NextFunction) => void;
export declare const getAllUsers: (req: Request, res: Response, next: NextFunction) => void;
export declare const getAllCategoryAdmins: (req: Request, res: Response, next: NextFunction) => void;
export declare const updateCategoryAdminRole: (req: Request, res: Response, next: NextFunction) => void;
export declare const deleteCategoryAdminRole: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=user.controller.d.ts.map