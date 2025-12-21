// src/utils/token.ts
import jwt from "jsonwebtoken";
import config from "../config";
import { IUser } from "../modules/users/user.model";


// generate access token for (15 minutes)
export const generateAccessToken = (payload: object): string => {
  const secret = config.jwt_access_secret;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not defined");
  }
  
  const expiresIn = config.access_token_expires || "10m";
  
  return jwt.sign(payload, secret, { expiresIn } as any);
};

// generate refresh token for (7 days)
export const generateRefreshToken = (payload: object): string => {
  const secret = config.refresh_token_secret;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not defined");
  }
  
  const expiresIn = config.refresh_token_expires || "7d";
  
  return jwt.sign(payload, secret, { expiresIn } as any);
};


// verify access token
export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, config.jwt_access_secret!);
};


// verify refresh token
export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, config.refresh_token_secret!);
};


// update refresh token
export const updateRefreshToken = (user: IUser, refreshToken: string, expiry: Date):Promise<IUser> => {
  user.refreshToken = refreshToken;
  user.refreshTokenExpiry = expiry;
  return user.save();
}