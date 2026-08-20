import { type HydratedDocument, type InferSchemaType, model, Schema, type Decimal128 } from "mongoose";
import { AccountStatus, AccountType } from "../variables/Enums";
import { ObjectId } from "mongodb";
import mongooseLeanGetters from "mongoose-lean-getters";
import { toMoney } from "../utility/Money";

const accountSchema = new Schema({
    type: { type: String, enum: Object.values(AccountType), required: true },
    userId: { type: ObjectId, ref: "Users", required: true },
    label: { type: String, required: true },
    balance: { type: Schema.Types.Decimal128, default: 0, get: (v: Decimal128) => Number(v), set: toMoney },
    status: { type: String, enum: Object.values(AccountStatus), default: AccountStatus.Active },
    // String, not Number: 17-digit account numbers exceed 2^53 and collapse onto
    // each other, and a numeric type also eats significant leading zeros.
    // Not required — cash accounts have none; CreateAccountSchema expresses the
    // per-type requirement, which Mongoose cannot.
    accountNumber: { type: String },
    limit: { type: Schema.Types.Decimal128, default: 0, get: (v: Decimal128) => Number(v), set: toMoney }, // this one use for credit account to limit incoming transaction
    amountUsed: { type: Schema.Types.Decimal128, default: 0, get: (v: Decimal128) => Number(v), set: toMoney }, // this one use for credit account to track how much amount used
    availableCredit: { type: Schema.Types.Decimal128, default: 0, get: (v: Decimal128) => Number(v), set: toMoney }, // this one use for credit account to track how much credit is available
}, {
    timestamps: true,
})

accountSchema.plugin(mongooseLeanGetters);

accountSchema.index({ userId: 1, createdAt: -1 }); // getAccountList
// Not unique: accounts are soft-deleted (status: 'delete') and the document stays,
// so a unique index would permanently block recreating that account number.
accountSchema.index({ userId: 1, type: 1, accountNumber: 1 }); // verifyUniqueAccount

export type AccountSchema = InferSchemaType<typeof accountSchema>;
export type AccountDocument = HydratedDocument<AccountSchema>;

export const AccountModel = model("Accounts", accountSchema);