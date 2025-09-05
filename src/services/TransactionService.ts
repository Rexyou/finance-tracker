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

export class TransactionService {
    
    public user: UserDocument

    constructor(user: UserDocument) {
        this.user = user
    }

    async createTransaction(payload: TransactionPayload){
        const newPayload = { ...payload, userId: this.user._id as ObjectId }

        const accountService = new AccountService(this.user)
        const getAccountData = await accountService.checkAccountDetails(payload.accountId)
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

    async editTransaction(transactionId: ObjectId, payload: TransactionUpdatePayload){
        const checkTransaction = await TransactionModel.findOne({ _id: transactionId, userId: this.user._id }, { _id: 1, amount: 1, transactionType: 1, accountId: 1 }).lean<Omit<TransactionSchema, 'amount'> & { amount: number }>({ getters: true })
        if(isEmpty(checkTransaction)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        const accountId = checkTransaction.accountId as ObjectId

        const accountService = new AccountService(this.user)
        const getAccountData = await accountService.checkAccountDetails(accountId)
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

    async getTransaction(paginationData: PaginationData){
        return paginate(TransactionModel, { userId: this.user._id }, paginationData, { projection: { __v: 0 }, lean: true })
    }
}