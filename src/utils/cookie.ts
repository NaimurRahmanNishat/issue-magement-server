// src/utils/cookie.ts
import { Response } from "express";
import config from "../config";

const isProduction = config.nodeEnv === "production";

const setCookie = (res: Response, name: string, token: string, maxAge: number) => {
    const cookieOptions: any = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge,
        path: "/",
    };

    res.cookie(name, token, cookieOptions);
}  

export const setAuthCookies = (res:Response, accessToken: string, refreshToken: string) => {
    setCookie(res, "accessToken", accessToken, 10 * 60 * 1000);  // 10 minute
    setCookie(res, "refreshToken", refreshToken, 7 * 24 * 60 * 60 * 1000);  // 7 days
}


export const setAccessTokenCookie = ( res: Response, accessToken: string ) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 10 * 60 * 1000, // 10 minute
  });
};