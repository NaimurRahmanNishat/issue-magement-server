"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/config/db.ts
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const dbConnect = async () => {
    try {
        await mongoose_1.default.connect(config_1.default.database_url);
        console.log("✅ Mongodb is connected successfully!");
    }
    catch (error) {
        console.log("❌ Mongodb connection failed!", error);
    }
};
exports.default = dbConnect;
//# sourceMappingURL=db.js.map