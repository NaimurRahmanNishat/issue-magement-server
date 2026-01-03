// src/modules/message/message.model.ts

import mongoose, { Schema, Document, Types } from "mongoose";

export enum CategoryType {
  BROKEN_ROAD = "broken_road",
  WATER = "water",
  GAS = "gas",
  ELECTRICITY = "electricity",
  OTHER = "other",
}


export interface IMessage extends Document {
  _id: string;
  sender: Types.ObjectId;
  senderName?: string;
  senderEmail?: string;
  category: CategoryType;
  message: string;
  isRead?: boolean;      
  readAt?: Date;         
  createdAt?: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User" },
    senderName: { type: String },
    senderEmail: { type: String },
    category: { 
      type: String, 
      required: true, 
      enum: Object.values(CategoryType),
      immutable: true, 
    },
    message: { type: String, required: true, trim: true, minlength: 2 },
    isRead: { type: Boolean, default: false },     
    readAt: { type: Date },                        
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, createdAt: -1 }); 
messageSchema.index({ category: 1, createdAt: -1 }); 
messageSchema.index({ createdAt: -1 }); 
messageSchema.index({ sender: 1, category: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>("Message",messageSchema);