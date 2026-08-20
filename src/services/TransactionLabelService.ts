import type { ObjectId } from "mongodb";
import type { UserDocument } from "../schemas/users";
import type { PaginationPayload, TransactionLabelPayload, TransactionLabelUpdatePayload } from "../variables/types";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { isDuplicateKey } from "../utility/GeneralFunctions";
import { TransactionLabelModel } from "../schemas/transactionLabel";
import { TransactionLabelStatus } from "../variables/Enums";
import { paginate } from "./GeneralService";
import { findOrFail } from "./ModelService";

/**
 * Labels are soft-deleted, and the unique index is on { userId, labelName } with
 * no status component — so a deleted label keeps holding its name. Listing hides
 * deleted labels, which would otherwise leave the user unable to see why the name
 * is taken. Re-creating one therefore revives the original document rather than
 * erroring: the id is unchanged, so historical transactions keep resolving.
 */
export class TransactionLabelService {
    async createTransactionLabel(user: UserDocument, payload: TransactionLabelPayload){
        const userId = user._id as ObjectId

        // Matches the unique index exactly. Including labelColor here (as this once
        // did) lets a same-name/different-colour insert past the check and straight
        // into a raw duplicate-key error.
        const existing = await TransactionLabelModel.findOne({ userId, labelName: payload.labelName })

        if(existing && existing.status !== TransactionLabelStatus.Delete){
            throw new CustomError(ErrorMessages.LabelExistsError)
        }

        // The findOne above is not transactional, so a concurrent create of the
        // same name still reaches the unique index.
        try {
            const result = existing
                ? await TransactionLabelModel.findByIdAndUpdate(
                    existing._id,
                    { ...payload, status: TransactionLabelStatus.Active },
                    { new: true }
                )
                : await TransactionLabelModel.create({ ...payload, userId })

            return { id: result?._id, ...payload }
        } catch (err) {
            if(isDuplicateKey(err)) throw new CustomError(ErrorMessages.LabelExistsError)
            throw err
        }
    }

    async editTransactionLabel(user: UserDocument, labelId: ObjectId, payload: TransactionLabelUpdatePayload){
        const userId = user._id as ObjectId
        await findOrFail(TransactionLabelModel, { _id: labelId, userId }, { _id: 1 }, undefined, ErrorMessages.LabelNotFoundError)

        // Renaming onto an existing name would otherwise hit the unique index and
        // surface as a 500 instead of label_exists.
        if(payload.labelName){
            const clash = await TransactionLabelModel.findOne(
                { userId, labelName: payload.labelName, _id: { $ne: labelId } },
                { _id: 1, status: 1 }
            )
            if(clash){
                // A soft-deleted label still holds its name (the unique index has no
                // status component) but is invisible in the list, so the user cannot
                // see why the rename failed. Say so with a distinct code.
                // ponytail: could absorb an unreferenced deleted placeholder by hard
                // deleting it; not done because that is data loss for a case a
                // clearer error covers.
                throw new CustomError(
                    clash.status === TransactionLabelStatus.Delete
                        ? ErrorMessages.LabelNameTakenByDeletedError
                        : ErrorMessages.LabelExistsError
                )
            }
        }

        try {
            return await TransactionLabelModel.findOneAndUpdate(
                { _id: labelId, userId },
                payload,
                { new: true, projection: { __v: 0 } }
            )
        } catch (err) {
            if(isDuplicateKey(err)) throw new CustomError(ErrorMessages.LabelExistsError)
            throw err
        }
    }

    async getTransactionLabel(user: UserDocument, paginationData: PaginationPayload){
        return paginate(
            TransactionLabelModel,
            { userId: user._id, status: { $ne: TransactionLabelStatus.Delete } },
            paginationData.pagination,
            { projection: { __v: 0 }, lean: true }
        )
    }
}
