import { type HydratedDocument, type InferSchemaType, model, Schema, type Decimal128 } from "mongoose";
import { ObjectId } from "mongodb";
import mongooseLeanGetters from "mongoose-lean-getters";
import { TransactionType } from "../variables/Enums";
import { toMoney } from "../utility/Money";

const transactionSchema = new Schema({
    transactionType: { type: String, enum: Object.values(TransactionType), required: true },
    userId: { type: ObjectId, ref: "Users", required: true },
    accountId: { type: ObjectId, ref: "Accounts", required: true },
    transactionLabelId: { type: ObjectId, ref: "TransactionLabels", required: true },
    amount: { type: Schema.Types.Decimal128, default: 0, get: (v: Decimal128) => Number(v), set: toMoney },
    remarks : { type: String, maxLength: 255 }
}, {
    timestamps: true,
})

transactionSchema.plugin(mongooseLeanGetters);

// Serves getTransaction's filter, its default sort ({ createdAt: -1 }), and the
// $match stage of getTransactionsByTransactionLabel.
transactionSchema.index({ userId: 1, createdAt: -1 });

export type TransactionSchema = InferSchemaType<typeof transactionSchema>;
export type TransactionDocument = HydratedDocument<TransactionSchema>;

export const TransactionModel = model("Transactions", transactionSchema);