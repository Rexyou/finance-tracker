import mongoose from "mongoose";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { AccountModel } from "../schemas/account";
import { TransactionLabelModel } from "../schemas/transactionLabel";
import { TransactionModel } from "../schemas/transaction";
import { UserModel } from "../schemas/users";


export class DbConnection {
    private static connectionString: string = process.env.DB_URL as string;

    constructor() {
        if (!DbConnection.connectionString) {
            throw new CustomError(ErrorMessages.UnknownError);
        }
    }

    public async connectDB() {
        try {
            await mongoose.connect(DbConnection.connectionString);
            console.log("[Mongo]: Connection ok.")
            await this.syncIndex()
        } catch (error) {
            console.log("[Mongo]: connection error.")
            throw new CustomError(ErrorMessages.UnknownError)
        }
    }

    private async syncIndex(){
        await Promise.all([
            UserModel.syncIndexes(),
            AccountModel.syncIndexes(),
            TransactionLabelModel.syncIndexes(),
            TransactionModel.syncIndexes()
        ])
    }
}