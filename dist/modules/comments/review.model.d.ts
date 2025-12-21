import mongoose, { Document, Types } from "mongoose";
export declare enum CommentType {
    COMMENT = "comment",
    REPLY = "reply"
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
export declare const Review: mongoose.Model<IReview, {}, {}, {}, mongoose.Document<unknown, {}, IReview, {}, {}> & IReview & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export default Review;
//# sourceMappingURL=review.model.d.ts.map