import type { ObjectId } from "mongodb";
import type { UserDocument } from "../schemas/users";
import type { BalanceDeltas, DatePaginationPayload, TransactionPayload, TransactionUpdatePayload } from "../variables/types";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages, type ErrorMessage } from "../variables/errorCodes";
import { isEmpty } from "../utility/GeneralFunctions";
import { TransactionModel, TransactionSchema } from "../schemas/transaction";
import { TransactionLabelModel } from "../schemas/transactionLabel";
import { AccountStatus, AccountType, TransactionType } from "../variables/Enums";
import { AccountService } from "./AccountService";
import { paginate } from "./GeneralService";
import { findOrFail } from "./ModelService";
import mongoose, { PipelineStage } from "mongoose";

/**
 * Runs `fn` inside a Mongo transaction. `withTransaction` retries callbacks that
 * fail with a TransientTransactionError — concurrent writes to the same account
 * produce a WriteConflict carrying that label, so without the retry the guarded
 * updates below would surface contention as an opaque 500.
 *
 * The callback may therefore run more than once: keep it free of side effects
 * outside the session, and never swallow errors inside it (a swallowed error
 * retries forever).
 *
 * Requires MongoDB to be running as a replica set.
 */
export async function withSession<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession()

    try {
        return await session.withTransaction(fn)
    } finally {
        await session.endSession()
    }
}

export class TransactionService {

    constructor(
        private accountService: AccountService
    ){}

    /**
     * A credit account moves amountUsed and availableCredit in opposite directions,
     * so exactly one of the two guards can fail — which one tells us the reason.
     */
    private static creditDeltas(amountUsedDelta: number): { deltas: BalanceDeltas; error: ErrorMessage } {
        return {
            deltas: { amountUsed: amountUsedDelta, availableCredit: -amountUsedDelta },
            error: amountUsedDelta > 0
                ? ErrorMessages.LimitNotEnoughError      // would push amountUsed past limit
                : ErrorMessages.CreditAmountOverLimitError // would push amountUsed below zero
        }
    }

    /**
     * A labelId is only validated as a well-formed ObjectId by Zod. Without this
     * an owner can point a transaction at any label id — dereferenced by the
     * populate in getTransaction — or at one that does not exist, which the
     * $lookup in getTransactionsByTransactionLabel would then silently drop.
     */
    private static assertLabelOwned(userId: ObjectId, labelId: ObjectId, session: mongoose.ClientSession){
        return findOrFail(
            TransactionLabelModel,
            { _id: labelId, userId },
            { _id: 1 },
            { session },
            ErrorMessages.LabelNotFoundError
        )
    }

    async createTransaction(user: UserDocument, payload: TransactionPayload){
        return withSession(async (session) => {
            const newPayload = { ...payload, userId: user._id as ObjectId }

            // Read in-session for snapshot consistency and read-your-own-writes.
            // Note this read does NOT gate the write below — the guards inside
            // applyBalanceDelta do. It exists to pick the right branch and to
            // produce precise errors on the uncontended path.
            const getAccountData = await this.accountService.checkAccountDetails(user, payload.accountId, session)

            if(getAccountData.status !== AccountStatus.Active){
                throw new CustomError(ErrorMessages.AccountNotActiveError)
            }

            const isSpending = newPayload.transactionType === TransactionType.Debit
            const isCreditAccount = getAccountData.type === AccountType.CreditAccount

            if(isCreditAccount){
                if(isSpending && (getAccountData.amountUsed + payload.amount) > getAccountData.limit){
                    throw new CustomError(ErrorMessages.LimitNotEnoughError)
                }

                if(!isSpending && payload.amount > getAccountData.amountUsed){
                    throw new CustomError(ErrorMessages.CreditAmountOverLimitError)
                }
            } else if(isSpending && payload.amount > getAccountData.balance){
                throw new CustomError(ErrorMessages.BalanceNotEnoughError)
            }

            await TransactionService.assertLabelOwned(user._id as ObjectId, payload.transactionLabelId, session)

            const [result] = await TransactionModel.create([newPayload], { session })
            if(!result){
                throw new CustomError(ErrorMessages.TransactionCreationError)
            }

            const { deltas, error } = isCreditAccount
                ? TransactionService.creditDeltas(isSpending ? payload.amount : -payload.amount)
                : {
                    deltas: { balance: isSpending ? -payload.amount : payload.amount } as BalanceDeltas,
                    error: ErrorMessages.BalanceNotEnoughError
                }

            await this.accountService.applyBalanceDelta(
                payload.accountId, user._id as ObjectId, deltas, session, error
            )

            return { id: result._id, ...payload }
        })
    }

    async editTransaction(user: UserDocument, transactionId: ObjectId, payload: TransactionUpdatePayload){
        return withSession(async (session) => {
            const checkTransaction = await findOrFail<
                TransactionSchema,
                Omit<TransactionSchema, 'amount'> & { amount: number }
            >(
                TransactionModel,
                { _id: transactionId, userId: user._id },
                { _id: 1, amount: 1, transactionType: 1, accountId: 1 },
                { getters: true, session }
            )
            const accountId = checkTransaction.accountId as ObjectId

            const getAccountData = await this.accountService.checkAccountDetails(user, accountId, session)

            if(getAccountData.status !== AccountStatus.Active){
                throw new CustomError(ErrorMessages.AccountNotActiveError)
            }

            const newAmount = !isEmpty(payload.amount) ? payload.amount : checkTransaction.amount
            const transactionType = checkTransaction.transactionType
            const amountChanged = newAmount !== checkTransaction.amount
            const isCreditAccount = getAccountData.type === AccountType.CreditAccount

            if(amountChanged){
                if(isCreditAccount){
                    this.validateCreditAccountEdit(getAccountData, checkTransaction, newAmount, transactionType)
                } else {
                    this.validateDebitAccountEdit(getAccountData, checkTransaction, newAmount, transactionType)
                }
            }

            if(payload.transactionLabelId){
                await TransactionService.assertLabelOwned(user._id as ObjectId, payload.transactionLabelId, session)
            }

            const result = await TransactionModel.findOneAndUpdate(
                { _id: transactionId, userId: user._id },
                payload,
                { new: true, projection: { __v: 0 }, lean: { getters: true }, session }
            )
            if(!result){
                throw new CustomError(ErrorMessages.TransactionUpdateError)
            }

            if(amountChanged){
                // Net effect of reverting the old amount and applying the new one.
                const signedChange = transactionType === TransactionType.Credit
                    ? newAmount - checkTransaction.amount
                    : checkTransaction.amount - newAmount

                const { deltas, error } = isCreditAccount
                    ? TransactionService.creditDeltas(-signedChange)
                    : { deltas: { balance: signedChange } as BalanceDeltas, error: ErrorMessages.BalanceNotEnoughError }

                await this.accountService.applyBalanceDelta(
                    accountId, user._id as ObjectId, deltas, session, error
                )
            }

            return result
        })
    }

    private validateDebitAccountEdit(
        accountData: { balance: number; limit: number; type: string; status: string },
        oldTransaction: { amount: number; transactionType: string },
        newAmount: number,
        transactionType: string
    ){
        const revertedBalance = transactionType === TransactionType.Credit
            ? accountData.balance - oldTransaction.amount
            : accountData.balance + oldTransaction.amount

        const projectedBalance = transactionType === TransactionType.Credit
            ? revertedBalance + newAmount
            : revertedBalance - newAmount

        if(projectedBalance < 0){
            throw new CustomError(ErrorMessages.BalanceNotEnoughError)
        }
    }

    private validateCreditAccountEdit(
        accountData: { balance: number; limit: number; type: string; status: string; amountUsed: number; availableCredit: number },
        oldTransaction: { amount: number; transactionType: string },
        newAmount: number,
        transactionType: string
    ){
        const revertedAmountUsed = transactionType === TransactionType.Debit
            ? accountData.amountUsed - oldTransaction.amount
            : accountData.amountUsed + oldTransaction.amount

        const projectedAmountUsed = transactionType === TransactionType.Debit
            ? revertedAmountUsed + newAmount
            : revertedAmountUsed - newAmount

        if(projectedAmountUsed > accountData.limit){
            throw new CustomError(ErrorMessages.LimitNotEnoughError)
        }

        if(projectedAmountUsed < 0){
            throw new CustomError(ErrorMessages.CreditAmountOverLimitError)
        }
    }

    async getTransaction(user: UserDocument, paginationData: DatePaginationPayload){
        const { dateFrom, dateTo, pagination } = paginationData
        let filter: {
            userId: ObjectId;
            createdAt: { $gte: Date; $lte: Date }
        } = {
            userId: user._id,
            createdAt: { $gte: dateFrom, $lte: dateTo }
        }

        return paginate(TransactionModel, filter, pagination, { projection: { __v: 0 }, lean: true, populate: {
            path: 'transactionLabelId',
            select: 'labelName labelColor -_id'
        }})
    }

    async deleteTransaction(user: UserDocument, transactionId: ObjectId){
        return withSession(async (session) => {
            const checkTransaction = await findOrFail<
                TransactionSchema,
                Omit<TransactionSchema, 'amount'> & { amount: number }
            >(
                TransactionModel,
                { _id: transactionId, userId: user._id },
                { _id: 1, amount: 1, transactionType: 1, accountId: 1 },
                { getters: true, session }
            )
            const accountId = checkTransaction.accountId as ObjectId

            const getAccountData = await this.accountService.checkAccountDetails(user, accountId, session)

            if(getAccountData.status !== AccountStatus.Active){
                throw new CustomError(ErrorMessages.AccountNotActiveError)
            }

            const result = await TransactionModel.findOneAndDelete(
                { _id: transactionId, userId: user._id },
                { session }
            )
            if(!result){
                throw new CustomError(ErrorMessages.DeleteTransactionError)
            }

            // Deleting reverses whatever the transaction originally did.
            const isSpending = checkTransaction.transactionType === TransactionType.Debit
            const { deltas, error } = getAccountData.type === AccountType.CreditAccount
                ? TransactionService.creditDeltas(isSpending ? -checkTransaction.amount : checkTransaction.amount)
                : {
                    deltas: { balance: isSpending ? checkTransaction.amount : -checkTransaction.amount } as BalanceDeltas,
                    error: ErrorMessages.BalanceNotEnoughError
                }

            await this.accountService.applyBalanceDelta(
                accountId, user._id as ObjectId, deltas, session, error
            )

            return { id: transactionId }
        })
    }

    async getTransactionsByTransactionLabel(user: UserDocument, transactionsByLabelPayload: DatePaginationPayload) {
        const {
            dateFrom,
            dateTo,
            pagination: { page = 1, size = 10 } = {}
        } = transactionsByLabelPayload;

        const skip = (page - 1) * size;

        const pipeline: PipelineStage[] = [
            {
                $match: {
                    userId: user._id,
                    createdAt: { $gte: dateFrom, $lte: dateTo }
                }
            },
            {
                $lookup: {
                    from: 'transactionlabels',
                    localField: 'transactionLabelId',
                    foreignField: '_id',
                    as: 'transactionLabel'
                }
            },
            // Keep transactions whose label lookup came back empty rather than
            // dropping them, so these totals cannot silently disagree with
            // /transaction/list.
            { $unwind: { path: '$transactionLabel', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$transactionLabelId',
                    labelName: { $first: '$transactionLabel.labelName' },
                    labelColor: { $first: '$transactionLabel.labelColor' },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ['$transactionType', TransactionType.Debit] },
                                { $multiply: ['$amount', -1] },
                                '$amount'
                            ]
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $addFields: { totalAmount: { $toDouble: "$totalAmount" } } },
            { $sort: { totalAmount: -1 } },
            {
                $facet: {
                    // Counts label groups, not transactions: data is paged by group,
                    // so a transaction total here makes the client compute totalPage
                    // against the wrong unit. Per-label counts stay in each row.
                    metadata: [{ $count: 'totalCount' }],
                    data: [{ $skip: skip }, { $limit: size }]
                }
            },
            {
                $project: {
                    totalCount: { $ifNull: [{ $arrayElemAt: ["$metadata.totalCount", 0] }, 0] },
                    data: 1
                }
            }
        ];

        const [result] = await TransactionModel.aggregate(pipeline);
        return result || { totalCount: 0, data: [] };
    }
}
