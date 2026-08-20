import type { ObjectId } from "mongodb";
import type mongoose from "mongoose";
import { AccountModel, AccountSchema } from "../schemas/account";
import type { UserDocument } from "../schemas/users";
import type { AccountPayload, AccountUpdatePayload, BalanceDeltas, PaginationPayload } from "../variables/types";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages, type ErrorMessage } from "../variables/errorCodes";
import { isEmpty } from "../utility/GeneralFunctions";
import { toMoney, type MoneyValue } from "../utility/Money";
import { AccountStatus, AccountType } from "../variables/Enums";
import { paginate } from "./GeneralService";
import { findOrFail } from "./ModelService";

/** Account with its Decimal128 money fields surfaced as plain numbers by the getters. */
type AccountMoneyView = Omit<AccountSchema, 'balance' | 'limit' | 'availableCredit' | 'amountUsed'>
    & { balance: number; limit: number; availableCredit: number; amountUsed: number };

const MONEY_PROJECTION = { _id: 1, type: 1, status: 1, label: 1, accountNumber: 1, balance: 1, limit: 1, availableCredit: 1, amountUsed: 1 } as const;

export class AccountService {
    /**
     * Enforces per-user account uniqueness. Cash has no account number, so it is
     * identified by its own label instead ("Wallet" vs "Safe").
     *
     * Reads the primary — this is the only thing enforcing uniqueness (accounts
     * deliberately carry no unique index, because they are soft-deleted), so a
     * stale secondary read would be a read-your-own-writes violation.
     *
     * Never build this filter by spreading a possibly-undefined accountNumber:
     * Mongoose strips undefined keys, so the filter would collapse to
     * { userId, type } and match every existing account of that type.
     */
    private static async assertUnique(
        userId: ObjectId,
        type: AccountType,
        payload: { accountNumber?: string; label?: string },
        exceptId?: ObjectId
    ){
        const key = type === AccountType.Cash
            ? (isEmpty(payload.label) ? null : { label: payload.label })
            : (isEmpty(payload.accountNumber) ? null : { accountNumber: payload.accountNumber })

        if(!key) return // the identifying field is not being set — nothing to check

        const clash = await AccountModel.findOne(
            { userId, type, ...key, ...(exceptId ? { _id: { $ne: exceptId } } : {}) },
            { _id: 1 }
        )

        if(clash){
            throw new CustomError(ErrorMessages.AccountExistsError)
        }
    }

    async createAccount(user: UserDocument, payload: AccountPayload){
        // Check account unique for each user
        let newPayload: { userId: ObjectId } & AccountPayload = { ...payload, userId: user._id as ObjectId }
        await AccountService.assertUnique(user._id as ObjectId, payload.type, payload)

        if(payload.type === AccountType.CreditAccount){
            if(isEmpty(payload.limit)){
                throw new CustomError(ErrorMessages.CreditAccountLimitError)
            }

            newPayload = { ...newPayload, availableCredit: payload.limit, amountUsed: 0, balance: 0 }
        }

        const result = await AccountModel.create(newPayload)

        return { id: result._id, ...payload }
    }

    async editAccount(user: UserDocument, accountId: ObjectId, payload: AccountUpdatePayload){
        const account = await findOrFail<AccountSchema, AccountMoneyView>(
            AccountModel,
            { _id: accountId, userId: user._id, status: { $ne: AccountStatus.Delete } },
            MONEY_PROJECTION,
            undefined,
            ErrorMessages.AccountNotFoundError
        )

        // Whichever field identifies this account type must stay unique on edit,
        // exactly as it does on create.
        await AccountService.assertUnique(user._id as ObjectId, account.type, payload, accountId)

        const isLimitChange = !isEmpty(payload.limit)

        if(account.type !== AccountType.CreditAccount){
            if(isLimitChange){
                throw new CustomError(ErrorMessages.InvalidAccountFieldError)
            }

            return this.updateAccountFields(accountId, user._id as ObjectId, payload)
        }

        if(!isLimitChange){
            return this.updateAccountFields(accountId, user._id as ObjectId, payload)
        }

        const newLimit = payload.limit as number
        if(newLimit < account.amountUsed){
            throw new CustomError(ErrorMessages.CreditAccountLimitError)
        }

        // Optimistic concurrency on `limit`, with availableCredit moved by the same
        // delta rather than recomputed from a stale amountUsed. This preserves the
        // availableCredit === limit - amountUsed invariant even if a transaction
        // commits between the read above and this write — which matters because
        // availableCredit is the guard column for every credit-limit check.
        const limitDelta = newLimit - account.limit
        const filter: Record<string, unknown> = {
            _id: accountId,
            userId: user._id,
            limit: toMoney(account.limit),
        }
        if(limitDelta < 0){
            filter.availableCredit = { $gte: toMoney(-limitDelta) }
        }

        const { limit, ...otherFields } = payload
        const updated = await AccountModel.findOneAndUpdate(
            filter,
            {
                $set: { ...otherFields, limit: toMoney(newLimit) },
                $inc: { availableCredit: toMoney(limitDelta) }
            },
            { new: true, projection: { __v: 0 }, lean: { getters: true } }
        )

        if(!updated){
            throw new CustomError(ErrorMessages.CreditAccountLimitError)
        }

        return updated
    }

    private async updateAccountFields(accountId: ObjectId, userId: ObjectId, payload: AccountUpdatePayload){
        const updated = await AccountModel.findOneAndUpdate(
            { _id: accountId, userId },
            payload,
            { new: true, projection: { __v: 0 }, lean: { getters: true } }
        )

        // Null means the row vanished between the read above and this write; the
        // credit branch already guards this, so mirror it rather than 200 null.
        if(!updated){
            throw new CustomError(ErrorMessages.AccountNotFoundError)
        }

        return updated
    }

    async getAccountList(user: UserDocument, paginationData: PaginationPayload){
        return paginate(AccountModel, { userId: user._id, status: { $ne: AccountStatus.Delete } }, paginationData.pagination, { projection: { __v: 0 }, lean: true })
    }

    async checkAccountDetails(user: UserDocument, accountId: ObjectId, session?: mongoose.ClientSession){
        return await findOrFail<AccountSchema, AccountMoneyView>(
            AccountModel,
            { _id: accountId, userId: user._id },
            MONEY_PROJECTION,
            { lean: true, session },
            ErrorMessages.AccountNotFoundError
        )
    }

    /**
     * Moves money on an account atomically.
     *
     * The caller's earlier read does NOT gate this write — MongoDB transactions
     * take no read locks, so a check-then-$inc can be interleaved by a concurrent
     * transaction. The guard built here is the only thing that constrains the
     * update: for any negative delta we require the field to hold at least that
     * much, which enforces balance >= 0, amountUsed >= 0, and (via availableCredit)
     * amountUsed <= limit in a single rule.
     */
    async applyBalanceDelta(
        accountId: ObjectId,
        userId: ObjectId,
        deltas: BalanceDeltas,
        session: mongoose.ClientSession,
        error: ErrorMessage
    ): Promise<void> {
        const increments: Record<string, MoneyValue> = {}
        const guard: Record<string, { $gte: MoneyValue }> = {}

        for(const [field, delta] of Object.entries(deltas)){
            if(!delta) continue // nothing to move; also keeps $inc from going empty
            increments[field] = toMoney(delta)
            if(delta < 0){
                guard[field] = { $gte: toMoney(-delta) }
            }
        }

        if(isEmpty(increments)) return // updateOne would throw "'$inc' is empty"

        const result = await AccountModel.updateOne(
            { _id: accountId, userId, ...guard },
            { $inc: increments },
            { session }
        )

        if(result.matchedCount > 0) return

        // Zero matches means either a guard failed or the account is gone. Only the
        // failure path pays for this extra read.
        const stillExists = await AccountModel.findOne({ _id: accountId, userId }, { _id: 1 }, { session }).lean()
        throw new CustomError(stillExists ? error : ErrorMessages.AccountNotFoundError)
    }
}
