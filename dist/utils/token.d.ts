import jwt from "jsonwebtoken";
import { IUser } from "../modules/users/user.model";
export declare const generateAccessToken: (payload: object) => string;
export declare const generateRefreshToken: (payload: object) => string;
export declare const verifyAccessToken: (token: string) => string | jwt.JwtPayload;
export declare const verifyRefreshToken: (token: string) => string | jwt.JwtPayload;
export declare const updateRefreshToken: (user: IUser, refreshToken: string, expiry: Date) => Promise<IUser>;
//# sourceMappingURL=token.d.ts.map