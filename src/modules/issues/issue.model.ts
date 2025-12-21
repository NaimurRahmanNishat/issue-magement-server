// src/modules/issues/issue.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import "../comments/review.model"; 

export enum BangladeshDivision {
  DHAKA = "Dhaka",
  CHATTOGRAM = "Chattogram",
  RAJSHAHI = "Rajshahi",
  KHULNA = "Khulna",
  BARISHAL = "Barishal",
  SYLHET = "Sylhet",
  RANGPUR = "Rangpur",
  MYMENSINGH = "Mymensingh",
}

export enum IssueStatus {
  PENDING = "pending",
  IN_PROGRESS = "in-progress",
  SOLVED = "solved",
}

export enum IssueCategory {
  ELECTRICITY = "electricity",
  WATER = "water",
  GAS = "gas",
  BROKEN_ROAD = "broken_road",
  OTHER = "other",
}

export interface IIssue extends Document {
  title: string;
  category: IssueCategory;
  description: string;
  images: {
    public_id: string;
    url: string;
  }[];
  location: string;
  division: BangladeshDivision;
  status: IssueStatus;
  author: Types.ObjectId;
  reviews: Types.ObjectId[];
  date: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const issueSchema = new Schema<IIssue>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters long"],
    },
    category: {
      type: String,
      enum: Object.values(IssueCategory),
      required: [true, "Category is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters long"],
    },
    images: {
      type: [
        {
          public_id: { type: String },
          url: { type: String, required: true },
        },
      ],
      default: [],
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    division: {
      type: String,
      enum: Object.values(BangladeshDivision),
      required: [true, "Division is required"],
    },
    status: {
      type: String,
      enum: Object.values(IssueStatus),
      default: IssueStatus.PENDING,
    },
    author: { type: Schema.Types.ObjectId, ref: "User" },
    reviews: [{ type: Schema.Types.ObjectId, ref: "Review", default: [] }],
    date: { type: Date, default: Date.now },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

// Full-text search index
issueSchema.index({
  title: "text",
  category: "text",
  description: "text",
  location: "text",
});

issueSchema.index({ category: 1 });
issueSchema.index({ status: 1 });
issueSchema.index({ division: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ category: 1, status: 1 });
issueSchema.index({ "$**": "text" });
issueSchema.index({ author: 1, createdAt: -1 });


const Issue = mongoose.model<IIssue>("Issue", issueSchema);

export default Issue;
