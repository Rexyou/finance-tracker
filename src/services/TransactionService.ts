import type { ObjectId } from "mongodb";
import type { UserDocument } from "../schemas/users";
import type { DatePaginationPayload, TransactionPayload, TransactionUpdatePayload } from "../variables/types";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { isEmpty } from "../utility/GeneralFunctions";
import { TransactionModel, TransactionSchema } from "../schemas/transaction";
import { AccountModel } from "../schemas/account";
import { AccountStatus, AccountType, TransactionType } from "../variables/Enums";
import { AccountService } from "./AccountService";
import { paginate } from "./GeneralService";
import { findOrFail } from "./ModelService";
import mongoose, { PipelineStage } from "mongoose";

export async function withSession<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const result = await fn(session)
        await session.commitTransaction()
        return result
    } catch(error) {
        await session.abortTransaction().catch((abortError) => {
            console.error("Failed to abort transaction:", abortError)
        })
        throw error
    } finally {
        session.endSession()
    }
}

export class TransactionService {

    constructor(
        private accountService: AccountService
    ){}

    async createTransaction(user: UserDocument, payload: TransactionPayload){
        return withSession(async (session) => {
            const newPayload = { ...payload, userId: user._id as ObjectId }

            const getAccountData = await this.accountService.checkAccountDetails(user, payload.accountId)
            if(!getAccountData){
                throw new CustomError(ErrorMessages.AccountNotFoundError)
            }

            if(getAccountData.status !== AccountStatus.Active){
                throw new CustomError(ErrorMessages.AccountNotActiveError)
            }

            const isSpending = newPayload.transactionType === TransactionType.Debit
            const amountUsed = getAccountData.amountUsed
            const accountLimit = getAccountData.limit
            const accountBalance = getAccountData.balance
            const availableCredit = getAccountData.availableCredit

            if(payload.transactionType === TransactionType.Debit && payload.amount > accountBalance && getAccountData.type !== AccountType.CreditAccount){
                throw new CustomError(ErrorMessages.BalanceNotEnoughError)
            }

            if(getAccountData.type === AccountType.CreditAccount){
                if(isSpending && (amountUsed + newPayload.amount) > availableCredit){
                    throw new CustomError(ErrorMessages.LimitNotEnoughError)
                }

                if(!isSpending && (availableCredit + newPayload.amount > accountLimit)){
                    throw new CustomError(ErrorMessages.CreditAmountOverLimitError)
                }
            }

            const [result] = await TransactionModel.create([newPayload], { session })
            if(!result){
                throw new CustomError(ErrorMessages.TransactionCreationError)
            }

            if(getAccountData.type === AccountType.CreditAccount){
                await AccountModel.updateOne(
                    { _id: newPayload.accountId },
                    {
                        $inc: {
                            amountUsed: isSpending ? newPayload.amount : -newPayload.amount,
                            availableCredit: isSpending ? -newPayload.amount : newPayload.amount
                        }
                    }
                ).session(session)
            } else {
                await AccountModel.updateOne(
                    { _id: newPayload.accountId },
                    {
                        $inc: {
                            balance: newPayload.transactionType === TransactionType.Credit ? newPayload.amount : -newPayload.amount
                        }
                    }
                ).session(session)
            }

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

            const getAccountData = await this.accountService.checkAccountDetails(user, accountId)
            if(!getAccountData){
                throw new CustomError(ErrorMessages.AccountNotFoundError)
            }

            const newAmount = !isEmpty(payload.amount) ? payload.amount : checkTransaction.amount
            const transactionType = checkTransaction.transactionType
            const amountChanged = newAmount !== checkTransaction.amount

            if(amountChanged){
                if(getAccountData.type === AccountType.DebitAccount){
                    await this.validateDebitAccountEdit(getAccountData, checkTransaction, newAmount, transactionType)
                } else if(getAccountData.type === AccountType.CreditAccount){
                    await this.validateCreditAccountEdit(getAccountData, checkTransaction, newAmount, transactionType)
                }
            }

            const result = await TransactionModel.findByIdAndUpdate(
                transactionId,
                payload,
                { new: true, projection: { __v: 0 }, lean: { getters: true }, session }
            )
            if(!result){
                throw new CustomError(ErrorMessages.TransactionUpdateError)
            }

            if(amountChanged){
                if(getAccountData.type === AccountType.DebitAccount){
                    await this.updateDebitAccountBalance(accountId, checkTransaction, newAmount, transactionType, session)
                } else if(getAccountData.type === AccountType.CreditAccount){
                    await this.updateCreditAccountBalance(accountId, checkTransaction, newAmount, transactionType, session)
                }
            }

            return result
        })
    }

    private async validateDebitAccountEdit(
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

    private async validateCreditAccountEdit(
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

    private async updateDebitAccountBalance(
        accountId: ObjectId,
        oldTransaction: { amount: number; transactionType: string },
        newAmount: number,
        transactionType: string,
        session: mongoose.ClientSession
    ){
        const revertAmount = transactionType === TransactionType.Credit
            ? -oldTransaction.amount
            : oldTransaction.amount

        const applyAmount = transactionType === TransactionType.Credit
            ? newAmount
            : -newAmount

        const totalChange = revertAmount + applyAmount

        await AccountModel.updateOne(
            { _id: accountId },
            { $inc: { balance: totalChange } }
        ).session(session)
    }

    private async updateCreditAccountBalance(
        accountId: ObjectId,
        oldTransaction: { amount: number; transactionType: string },
        newAmount: number,
        transactionType: string,
        session: mongoose.ClientSession
    ){
        const revertAmountUsed = transactionType === TransactionType.Debit
            ? -oldTransaction.amount
            : oldTransaction.amount

        const revertAvailableCredit = transactionType === TransactionType.Debit
            ? oldTransaction.amount
            : -oldTransaction.amount

        const applyAmountUsed = transactionType === TransactionType.Debit
            ? newAmount
            : -newAmount

        const applyAvailableCredit = transactionType === TransactionType.Debit
            ? -newAmount
            : newAmount

        const totalAmountUsedChange = revertAmountUsed + applyAmountUsed
        const totalAvailableCreditChange = revertAvailableCredit + applyAvailableCredit

        await AccountModel.updateOne(
            { _id: accountId },
            {
                $inc: {
                    amountUsed: totalAmountUsedChange,
                    availableCredit: totalAvailableCreditChange
                }
            }
        ).session(session)
    }

    async getTransaction(user: UserDocument, paginationData: DatePaginationPayload){
        const { dateFrom, dateTo, pagination } = paginationData
        let filter: {
            userId: ObjectId;
            createdAt?: { $gte?: Date; $lte?: Date }
        } = {
            userId: user._id,
        }

        if(dateFrom){
            filter = { ...filter, createdAt: { $gte: dateFrom } }
        }

        if(dateTo){
            filter = { ...filter, createdAt: { ...filter.createdAt, $lte: dateTo } }
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

            const getAccountData = await this.accountService.checkAccountDetails(user, accountId)
            if(!getAccountData){
                throw new CustomError(ErrorMessages.AccountNotFoundError)
            }

            const result = await TransactionModel.findByIdAndDelete(transactionId).session(session)
            if(!result){
                throw new CustomError(ErrorMessages.DeleteTransactionError)
            }

            if(getAccountData.type === AccountType.CreditAccount){
                const isSpending = checkTransaction.transactionType === TransactionType.Debit

                await AccountModel.updateOne(
                    { _id: accountId },
                    {
                        $inc: {
                            amountUsed: isSpending ? -checkTransaction.amount : checkTransaction.amount,
                            availableCredit: isSpending ? checkTransaction.amount : -checkTransaction.amount
                        }
                    }
                ).session(session)
            } else {
                await AccountModel.updateOne(
                    { _id: accountId },
                    {
                        $inc: {
                            balance: checkTransaction.transactionType === TransactionType.Credit
                                ? -checkTransaction.amount
                                : checkTransaction.amount
                        }
                    }
                ).session(session)
            }

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
            { $unwind: '$transactionLabel' },
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
                    metadata: [{ $group: { _id: null, totalCount: { $sum: '$count' } } }],  // ← sum all counts
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