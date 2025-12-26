import { type HydratedDocument, type InferSchemaType, model, Schema } from "mongoose";
import { ObjectId } from "mongodb";
import { TransactionLabelStatus } from "../variables/Enums";

const transactionLabelSchema = new Schema({
    userId: { type: ObjectId, ref: "Users", required: true },
    labelName: { type: String, maxLength: 255, required: true },
    labelColor: { type: String, default: "" },
    status: { type: String, enum: Object.values(TransactionLabelStatus), default: TransactionLabelStatus.Active },
}, {
    timestamps: true,
})

transactionLabelSchema.index({ userId: 1, labelName: 1 }, { unique: true });

export type TransactionLabelSchema = InferSchemaType<typeof transactionLabelSchema>;
export type TransactionLabelDocument = HydratedDocument<TransactionLabelSchema>;

export const TransactionLabelModel = model("TransactionLabels", transactionLabelSchema);