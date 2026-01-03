import { Request, Response, NextFunction } from "express";
import { IUser } from "../modules/users/user.model";
export interface AuthRequest extends Request {
    user?: IUser;
}
export declare const isAuthenticated: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const authorizeRole: (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const categoryAdminGuard: (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map