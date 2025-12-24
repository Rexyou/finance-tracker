import { PaginationData } from "../variables/types";
import ServiceContainer from "./ServiceContainer";
import { UserDocument } from "../schemas/users";

export class DashboardService {
    static async getData(user: UserDocument, paginationData: PaginationData){
        const [transactionsList, transactionLabelsList] = await Promise.all([
            ServiceContainer.transaction.getTransaction(user, paginationData),
            ServiceContainer.label.getTransactionLabel(user, paginationData)
        ]);

        return {
            transactionsList, transactionLabelsList
        }
    }
}