import type { ObjectId } from "mongodb";
import type { UserDocument } from "../schemas/users";
import type { TransactionLabelPayload, TransactionLabelUpdatePayload, VerifyLabel } from "../variables/types";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { isEmpty } from "../utility/GeneralFunctions";
import { TransactionLabelModel } from "../schemas/transactionLabel";

export class TransactionLabelService {
    
    public user: UserDocument

    constructor(user: UserDocument) {
        this.user = user
    }

    private static verifyUniqueAccount(userPayload: VerifyLabel){
        return TransactionLabelModel.find(userPayload, { _id: 1 }).read("secondaryPreferred")
    }

    async createTransactionLabel(payload: TransactionLabelPayload){
        // Check account unique for each user
        const newPayload = { ...payload, userId: this.user._id as ObjectId }
        const checkUniqueLabel = await TransactionLabelService.verifyUniqueAccount(newPayload);
        if(!isEmpty(checkUniqueLabel)){
            throw new CustomError(ErrorMessages.LabelExistsError)
        }

        const result = await TransactionLabelModel.create(newPayload)

        return { id: result._id, ...payload }
    }

    async editTransactionLabel(labelId: ObjectId, payload: TransactionLabelUpdatePayload){
        const checkLabel = await TransactionLabelModel.findOne({ _id: labelId, userId: this.user._id }, { _id: 1 })
        if(isEmpty(checkLabel)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        return await TransactionLabelModel.findByIdAndUpdate(labelId, payload, { new: true, projection: { __v: 0 } })
    }

    async getTransactionLabel(){
        return TransactionLabelModel.find({ userId: this.user._id }, { __v: 0 })
    }
}