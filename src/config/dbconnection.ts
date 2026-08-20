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

    /**
     * connectDB only covers the initial connect. Without these, a failover or
     * network drop turns every subsequent request into a 500 with nothing in the
     * log distinguishing "DB is down" from a real bug.
     */
    private static registerConnectionEvents(){
        mongoose.connection.on("error", (err) => console.error("[Mongo]: connection error:", err.message))
        mongoose.connection.on("disconnected", () => console.warn("[Mongo]: disconnected"))
        mongoose.connection.on("reconnected", () => console.log("[Mongo]: reconnected"))
    }

    public async connectDB() {
        DbConnection.registerConnectionEvents()

        try {
            await mongoose.connect(DbConnection.connectionString);
            console.log("[Mongo]: Connection ok.")
            await this.syncIndex()
        } catch (error) {
            // Keep the original cause: it is the difference between a bad DB_URL,
            // an auth failure, and an index build conflict.
            console.error("[Mongo]: startup failed:", error)
            throw new CustomError(ErrorMessages.UnknownError, String(error))
        }
    }

    private async syncIndex(){
        await Promise.all([
            UserModel.syncIndexes(),
            AccountModel.syncIndexes(),
            TransactionLabelModel.syncIndexes(),
            TransactionModel.syncIndexes()
        ]).catch((error) => {
            console.log("[Mongo]: syncIndex error:", error)
            throw new CustomError(ErrorMessages.UnknownError)
        })
    }
}