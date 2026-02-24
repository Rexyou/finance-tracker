import type { ObjectId } from "mongodb";
import { AccountModel, AccountSchema } from "../schemas/account";
import type { UserDocument } from "../schemas/users";
import type { AccountPayload, AccountUpdatePayload, PaginationData, VerifyAccount } from "../variables/types";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { isEmpty } from "../utility/GeneralFunctions";
import { AccountType } from "../variables/Enums";
import { paginate } from "./GeneralService";
import { findOrFail } from "./ModelService";

export class AccountService {
    private static verifyUniqueAccount(userPayload: VerifyAccount){
        return AccountModel.find(userPayload, { _id: 1 }).read("secondaryPreferred")
    }

    async createAccount(user: UserDocument, payload: AccountPayload){
        // Check account unique for each user
        let newPayload: { userId: ObjectId } & AccountPayload = { ...payload, userId: user._id as ObjectId }
        const checkUniqueAccount = await AccountService.verifyUniqueAccount(newPayload);
        if(!isEmpty(checkUniqueAccount)){
            throw new CustomError(ErrorMessages.AccountExistsError)
        }

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
        const account = await findOrFail<AccountSchema, Omit<AccountSchema, 'balance' | 'limit' | 'availableCredit' | 'amountUsed'> & { balance: number; limit: number; availableCredit: number; amountUsed: number }>(
            AccountModel,
            { _id: accountId, userId: user._id },
            { _id: 1, type: 1, balance: 1, limit: 1, availableCredit: 1, amountUsed: 1  },
        )

        if(account.type === AccountType.DebitAccount){
            if(!isEmpty(payload.limit)){
                throw new CustomError(ErrorMessages.InvalidAccountFieldError)
            }
        }

        if(account.type === AccountType.CreditAccount){
            if(!isEmpty(payload.balance)){
                throw new CustomError(ErrorMessages.InvalidAccountFieldError)
            }

            if(!isEmpty(payload.limit)){
                if(payload.limit < account.amountUsed){
                    throw new CustomError(ErrorMessages.CreditAccountLimitError)
                }

                const newAvailableCredit = payload.limit - account.amountUsed
                payload = { ...payload, availableCredit: newAvailableCredit }
            }
        }

        return await AccountModel.findByIdAndUpdate(accountId, payload, { new: true, projection: { __v: 0 } }).lean({ getters: true })
    }

    async getAccountList(user: UserDocument, paginationData: PaginationData){
        return paginate(AccountModel, { userId: user._id }, paginationData, { projection: { __v: 0 }, lean: true })    
    }

    async checkAccountDetails(user: UserDocument, accountId: ObjectId){
        return await findOrFail<AccountSchema, Omit<AccountSchema, "balance" | "limit" | "availableCredit" | "amountUsed"> & { balance: number; limit: number; availableCredit: number; amountUsed: number }>(
            AccountModel,
            { _id: accountId, userId: user._id },
            { _id: 1, type: 1, status: 1, balance: 1, limit: 1, availableCredit: 1, amountUsed: 1 },
            { lean: true }
        )
    }
}