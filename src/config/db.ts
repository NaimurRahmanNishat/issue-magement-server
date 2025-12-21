// src/config/db.ts
import mongoose from "mongoose";
import config from "../config";

const dbConnect = async () => {
  try {
    await mongoose.connect(config.database_url as string);
    console.log("✅ Mongodb is connected successfully!");
  } catch (error) {
    console.log("❌ Mongodb connection failed!", error);
  }
};

export default dbConnect;