import type { ObjectId } from "mongodb";
import type { UserDocument } from "../schemas/users";
import type { PaginationData, TransactionPayload, TransactionUpdatePayload } from "../variables/types";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { isEmpty } from "../utility/GeneralFunctions";
import { TransactionModel, TransactionSchema } from "../schemas/transaction";
import { AccountModel } from "../schemas/account";
import { AccountStatus, AccountType, TransactionType } from "../variables/Enums";
import { AccountService } from "./AccountService";
import { paginate } from "./GeneralService";
import { findOrFail } from "./ModelService";

export class TransactionService {

    constructor(
        private accountService: AccountService
    ){}

    async createTransaction(user: UserDocument, payload: TransactionPayload){
        const newPayload = { ...payload, userId: user._id as ObjectId }

        const getAccountData = await this.accountService.checkAccountDetails(user, payload.accountId)
        if(!getAccountData){
            throw new CustomError(ErrorMessages.AccountNotFoundError)
        }

        if(getAccountData.status !== AccountStatus.Active){
            throw new CustomError(ErrorMessages.AccountNotActiveError)
        }

        // Convert Decimal128 balance to number for comparison
        const accountBalance = getAccountData.balance;
        const accountLimit = getAccountData.limit

        if(payload.transactionType === TransactionType.Debit && payload.amount > accountBalance && getAccountData.type !== AccountType.CreditAccount){
            throw new CustomError(ErrorMessages.BalanceNotEnoughError)
        }

        if(getAccountData.type === AccountType.CreditAccount){
            const newTotalBalance = accountBalance + payload.amount
            if(accountLimit === accountBalance ||newTotalBalance > accountLimit){
                throw new CustomError(ErrorMessages.LimitNotEnoughError)
            }
        }

        const result = await TransactionModel.create(newPayload)
        if(!result){
            throw new CustomError(ErrorMessages.TransactionCreationError)
        }

        // Deduct/Increase related account
        await AccountModel.updateOne({ _id: newPayload.accountId }, { $inc: { balance: (newPayload.transactionType === TransactionType.Credit ? newPayload.amount : -newPayload.amount) } }).then(( )=> {
            console.log("update account success.")
        }).catch((error)=> { console.log("update account failure: ", error) })

        return { id: result._id, ...payload }
    }

    async editTransaction(user: UserDocument, transactionId: ObjectId, payload: TransactionUpdatePayload){
        const checkTransaction = await findOrFail<
            TransactionSchema, // model document type
            Omit<TransactionSchema, 'amount'> & { amount: number } // return lean type
        >(
            TransactionModel,
            { _id: transactionId, userId: user._id },
            { _id: 1, amount: 1, transactionType: 1, accountId: 1 },
            { getters: true }
        );
        const accountId = checkTransaction.accountId as ObjectId

        const getAccountData = await this.accountService.checkAccountDetails(user, accountId)
        if(!getAccountData){
            throw new CustomError(ErrorMessages.AccountNotFoundError)
        }

        const accountBalance = getAccountData.balance
        const accountLimit = getAccountData.limit
        let currentAmount = !isEmpty(payload.amount) ? payload.amount : checkTransaction.amount
        const currentTransactionType = !isEmpty(payload.transactionType) ? payload.transactionType : checkTransaction.transactionType
        let negativeTrigger = false

        if(currentTransactionType === TransactionType.Debit){
            negativeTrigger = true
            if(getAccountData.type === AccountType.DebitAccount){
                const checker = accountBalance - currentAmount
                if(checker < 0){
                    throw new CustomError(ErrorMessages.BalanceNotEnoughError)
                }

                if(currentAmount !== checkTransaction.amount){
                    const checker = currentAmount > checkTransaction.amount
                    currentAmount = checker ? currentAmount - checkTransaction.amount : checkTransaction.amount - currentAmount
                    if(!checker){
                        negativeTrigger = false
                    }
                }
            }
        }

        if(currentTransactionType === TransactionType.Credit){
            if(currentAmount !== checkTransaction.amount){
                const checker = currentAmount > checkTransaction.amount
                currentAmount = checker ? currentAmount - checkTransaction.amount : checkTransaction.amount - currentAmount
                if(!checker){
                    negativeTrigger = true
                }
            }

            if(getAccountData.type === AccountType.CreditAccount){
                const checker = accountBalance + currentAmount
                if(checker > accountLimit){
                    throw new CustomError(ErrorMessages.LimitNotEnoughError)
                }
            }
        }

        const result = await TransactionModel.findByIdAndUpdate(transactionId, payload, { new: true, projection: { __v: 0 }, lean: { getters: true } })
        if(!result){
            throw new CustomError(ErrorMessages.TransactionCreationError)
        }

        if(currentTransactionType !== checkTransaction.transactionType || currentAmount !== checkTransaction.amount){
            await AccountModel.updateOne({ _id: accountId }, { $inc: { balance: (negativeTrigger ? -currentAmount : currentAmount) } }).then(( )=> {
                console.log("update account success.")
            }).catch((error)=> { console.log("update account failure: ", error) })
        }

        return result
    }

    async getTransaction(user: UserDocument, paginationData: PaginationData){
        return paginate(TransactionModel, { userId: user._id }, paginationData, { projection: { __v: 0 }, lean: true })
    }
}