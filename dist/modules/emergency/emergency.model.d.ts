import mongoose, { Document, Types } from "mongoose";
export declare enum CategoryType {
    BROKEN_ROAD = "broken_road",
    WATER = "water",
    GAS = "gas",
    ELECTRICITY = "electricity",
    OTHER = "other"
}
export declare enum IssueStatus {
    PENDING = "pending",
    IN_PROGRESS = "in-progress",
    SOLVED = "solved"
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
export declare const EmergencyMessage: mongoose.Model<IEmergencyMessage, {}, {}, {}, mongoose.Document<unknown, {}, IEmergencyMessage, {}, {}> & IEmergencyMessage & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=emergency.model.d.ts.map