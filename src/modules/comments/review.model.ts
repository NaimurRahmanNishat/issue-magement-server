// src/modules/comments/review.model.ts

import mongoose, { Schema, Document, Types } from "mongoose";

export enum CommentType {
  COMMENT = "comment",
  REPLY = "reply",
}

export interface IReply {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  comment: string;
  replies?: IReply[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IReview extends Document {
  issue: Types.ObjectId;
  author: Types.ObjectId;
  comment: string;
  replies: IReply[];
  parentReview?: Types.ObjectId | null;
  commentType: CommentType;
  createdAt: Date;
  updatedAt: Date;
}


const replySchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId, ref: "User" },
    comment: {
      type: String,
      required: true,
      trim: true,
    },

  },
  {
    timestamps: true,
    _id: true,
  }
);


replySchema.add({
  replies: [replySchema],
});

const reviewSchema = new Schema<IReview>(
  {
    issue: {
      type: Schema.Types.ObjectId,
      ref: "Issue",
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    replies: {
      type: [replySchema],
      default: [],
    },
    parentReview: {
      type: Schema.Types.ObjectId,
      ref: "Review",
      default: null,
    },
    commentType: {
      type: String,
      enum: Object.values(CommentType),
      default: CommentType.COMMENT,
    },
  },
  {
    timestamps: true,
  }
);

// index
reviewSchema.index({ issue: 1, createdAt: -1 });
reviewSchema.index({ parentReview: 1 });

export const Review = mongoose.model<IReview>("Review", reviewSchema);
export default Review;