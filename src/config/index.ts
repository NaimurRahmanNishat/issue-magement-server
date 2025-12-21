// src/config/index.ts
import dotenv from 'dotenv';
dotenv.config();

interface Config {
    port: number;
    nodeEnv: string;
    client_url: string;
    database_url: string;
    redis_url : string;
    smtp_host : string;
    smtp_port : number;
    smtp_user : string;
    smtp_pass : string;
    smtp_from : string;
    smtp_secure: string;
    jwt_access_secret : string;
    access_token_expires : string;
    refresh_token_secret : string;
    refresh_token_expires : string;
    cloudinary_cloud_name: string;
    cloudinary_api_key: string;
    cloudinary_api_secret: string;
}

const config = {
    port: Number(process.env.PORT) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    client_url: process.env.CLIENT_URL || "",
    database_url: process.env.MONGODB_URL || "",
    redis_url : process.env.REDIS_URL || "",
    smtp_host : process.env.SMTP_HOST || "",
    smtp_port : Number(process.env.SMTP_PORT) || 587,
    smtp_user : process.env.SMTP_USER || "",
    smtp_pass : process.env.SMTP_PASS || "",
    smtp_from : process.env.SMTP_FROM || "",
    smtp_secure: process.env.SMTP_SECURE || "",
    jwt_access_secret : process.env.JWT_ACCESS_SECRET || "",
    access_token_expires : process.env.ACCESS_TOKEN_EXPIRES_IN || "",
    refresh_token_secret : process.env.REFRESH_TOKEN_SECRET || "",
    refresh_token_expires : process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
    cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
    cloudinary_api_key: process.env.CLOUDINARY_API_KEY || "",
    cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET || "",
};

export default config;