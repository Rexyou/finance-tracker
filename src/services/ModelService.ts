import { Model, FilterQuery, ProjectionType, QueryOptions } from "mongoose";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages, type ErrorMessage } from "../variables/errorCodes";
import { ReadPreferenceMode } from "mongodb";

export async function findOrFail<
    DocType,
    ReturnType = DocType
>(
    model: Model<DocType>,  // Now this will work correctly
    filter: FilterQuery<DocType>,
    projection?: ProjectionType<DocType>,
    options?: QueryOptions & { lean?: boolean; readPref?: ReadPreferenceMode },
    error: ErrorMessage = ErrorMessages.NotFound,
): Promise<ReturnType> {

    let query = model.findOne(filter, projection, options);

    if (options?.readPref) {
        query = query.read(options.readPref);
    }

    const result = await query.lean<ReturnType>(options?.lean ?? true);

    if (!result) {
        throw new CustomError(error);
    }

    return result as ReturnType;
}