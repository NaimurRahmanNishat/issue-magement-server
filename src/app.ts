// src/app.ts

import express , { Request, Response } from 'express'
import config from './config';
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { globalErrorHandler } from './utils/errorHandler';
import router from './routes';

const app = express();

// middleware
app.use(
  cors({
    origin: [config.client_url, "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);

// Increase body parser limits for image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// API 
app.use("/api/v1", router);

app.get("/", (_req: Request, res: Response) => {
  res.send(
    "Citizen Driven Issue Reporting & Tracking System Server is Running..."
  );
});

// global error handler
app.use(globalErrorHandler);

export default app;
