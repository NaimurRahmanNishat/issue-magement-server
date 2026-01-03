import mongoose, { Document, Types } from "mongoose";
export declare enum CategoryType {
    BROKEN_ROAD = "broken_road",
    WATER = "water",
    GAS = "gas",
    ELECTRICITY = "electricity",
    OTHER = "other"
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
export declare const Message: mongoose.Model<IMessage, {}, {}, {}, mongoose.Document<unknown, {}, IMessage, {}, {}> & IMessage & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=message.model.d.ts.map