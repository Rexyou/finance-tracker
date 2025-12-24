import type { ObjectId } from "mongodb";
import type { UserDocument } from "../schemas/users";
import type { PaginationData, TransactionLabelPayload, TransactionLabelUpdatePayload, VerifyLabel } from "../variables/types";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { isEmpty } from "../utility/GeneralFunctions";
import { TransactionLabelModel } from "../schemas/transactionLabel";
import { paginate } from "./GeneralService";
import { findOrFail } from "./ModelService";

export class TransactionLabelService {
    private static verifyUniqueAccount(userPayload: VerifyLabel){
        return TransactionLabelModel.find(userPayload, { _id: 1 }).read("secondaryPreferred")
    }

    async createTransactionLabel(user: UserDocument, payload: TransactionLabelPayload){
        // Check account unique for each user
        const newPayload = { ...payload, userId: user._id as ObjectId }
        const checkUniqueLabel = await TransactionLabelService.verifyUniqueAccount(newPayload);
        if(!isEmpty(checkUniqueLabel)){ 
            throw new CustomError(ErrorMessages.LabelExistsError)
        }

        const result = await TransactionLabelModel.create(newPayload)

        return { id: result._id, ...payload }
    }

    async editTransactionLabel(user: UserDocument, labelId: ObjectId, payload: TransactionLabelUpdatePayload){
        await findOrFail(TransactionLabelModel, { _id: labelId, userId: user._id }, { _id: 1 })

        return await TransactionLabelModel.findByIdAndUpdate(labelId, payload, { new: true, projection: { __v: 0 } })
    }

    async getTransactionLabel(user: UserDocument, paginationData: PaginationData){
        return paginate(TransactionLabelModel, { userId: user._id }, paginationData, { projection: { __v: 0 }, lean: true })
    }
}