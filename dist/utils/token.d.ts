import jwt from "jsonwebtoken";
export declare const generateAccessToken: (payload: object) => string;
export declare const generateRefreshToken: (payload: object) => string;
export declare const verifyAccessToken: (token: string) => string | jwt.JwtPayload;
export declare const verifyRefreshToken: (token: string) => string | jwt.JwtPayload;
//# sourceMappingURL=token.d.ts.map