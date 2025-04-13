import mongoose from "mongoose";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";


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
            console.log("DB connection ok.")
        } catch (error) {
            console.log("DB connection error.")
            throw new CustomError(ErrorMessages.UnknownError)
        }
    }
}