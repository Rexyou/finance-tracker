import type { ObjectId } from "mongodb";
import type { UserDocument } from "../schemas/users";
import type { TransactionPayload, TransactionUpdatePayload } from "../variables/types";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { isEmpty } from "../utility/GeneralFunctions";
import { TransactionModel } from "../schemas/transaction";

export class TransactionService {
    
    public user: UserDocument

    constructor(user: UserDocument) {
        this.user = user
    }

    async createTransaction(payload: TransactionPayload){
        const newPayload = { ...payload, userId: this.user._id as ObjectId }

        const result = await TransactionModel.create(newPayload)

        return { id: result._id, ...payload }
    }

    async editTransaction(transactionId: ObjectId, payload: TransactionUpdatePayload){
        const checkTransaction = await TransactionModel.findOne({ _id: transactionId, userId: this.user._id }, { _id: 1 })
        if(isEmpty(checkTransaction)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        return await TransactionModel.findByIdAndUpdate(transactionId, payload, { new: true, projection: { __v: 0 }, lean: { getters: true } })
    }

    async getTransaction(){
        return TransactionModel.find({ userId: this.user._id }, { __v: 0 }).lean({ getters: true })
    }
}