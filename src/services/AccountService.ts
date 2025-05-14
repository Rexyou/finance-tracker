import type { ObjectId } from "mongodb";
import { AccountModel } from "../schemas/account";
import type { UserDocument } from "../schemas/users";
import type { AccountPayload, AccountUpdatePayload, VerifyAccount } from "../variables/types";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { isEmpty } from "../utility/GeneralFunctions";

export class AccountService {
    
    public user: UserDocument

    constructor(user: UserDocument) {
        this.user = user
    }

    private static verifyUniqueAccount(userPayload: VerifyAccount){
        return AccountModel.find(userPayload, { _id: 1 }).read("secondaryPreferred")
    }

    async createAccount(payload: AccountPayload){
        // Check account unique for each user
        const newPayload = { ...payload, userId: this.user._id as ObjectId }
        const checkUniqueAccount = await AccountService.verifyUniqueAccount(newPayload);
        if(!isEmpty(checkUniqueAccount)){
            throw new CustomError(ErrorMessages.AccountExistsError)
        }

        const result = await AccountModel.create(newPayload)

        return { id: result._id, ...payload }
    }

    async editAccount(accountId: ObjectId, payload: AccountUpdatePayload){
        const checkAccount = await AccountModel.findOne({ _id: accountId, userId: this.user._id }, { _id: 1 })
        if(isEmpty(checkAccount)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        return await AccountModel.findByIdAndUpdate(accountId, payload, { new: true, projection: { __v: 0 } }).lean({ getters: true })
    }

    async getAccountList(){
        return AccountModel.find({ userId: this.user._id }, { __v: 0 }).lean({ getters: true })
    }
}