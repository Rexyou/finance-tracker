import mongoose, { type HydratedDocument, type InferSchemaType, model, Schema, type Decimal128 } from "mongoose";
import { AccountStatus, AccountType } from "../variables/Enums";
import { ObjectId } from "mongodb";
import mongooseLeanGetters from "mongoose-lean-getters";

const accountSchema = new Schema({
    type: { type: String, enum: Object.values(AccountType), required: true },
    userId: { type: ObjectId, ref: "Users", required: true },
    balance: { type: Schema.Types.Decimal128, default: 0, get: (v: Decimal128) => Number(v), set: (v: number) => mongoose.Types.Decimal128.fromString(v.toFixed(2))},
    status: { type: String, enum: Object.values(AccountStatus), default: AccountStatus.Active },
    accountNumber: { type: Number, required: true },
    limit: { type: Schema.Types.Decimal128, default: 0, get: (v: Decimal128) => Number(v), set: (v: number) => mongoose.Types.Decimal128.fromString(v.toFixed(2))}, // this one use for credit account to limit incoming transaction
}, {
    timestamps: true,
})

accountSchema.plugin(mongooseLeanGetters);

export type AccountSchema = InferSchemaType<typeof accountSchema>;
export type AccountDocument = HydratedDocument<AccountSchema>;

export const AccountModel = model("Accounts", accountSchema);