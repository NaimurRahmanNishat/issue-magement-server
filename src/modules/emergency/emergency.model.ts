import mongoose, { Schema, Document, Types } from "mongoose";

export enum CategoryType {
  BROKEN_ROAD = "broken_road",
  WATER = "water",
  GAS = "gas",
  ELECTRICITY = "electricity",
  OTHER = "other",
}

export enum IssueStatus {
  PENDING = "pending",
  IN_PROGRESS = "in-progress",
  SOLVED = "solved",
}

export interface IEmergencyMessage extends Document {
  _id: string;
  sender: Types.ObjectId;
  senderName?: string;
  senderEmail?: string;
  category: CategoryType;
  message: string;
  status?: IssueStatus; 
  read: boolean;
  createdAt?: Date;
}

const emergencyMessageSchema = new Schema<IEmergencyMessage>(
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
    status: { 
      type: String, 
      enum: Object.values(IssueStatus), 
      default: IssueStatus.PENDING 
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

emergencyMessageSchema.index({ category: 1, createdAt: -1 });

export const EmergencyMessage = mongoose.model<IEmergencyMessage>(
  "EmergencyMessage",
  emergencyMessageSchema
);
