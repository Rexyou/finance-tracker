import { AccountService } from "./AccountService";
import { TransactionLabelService } from "./TransactionLabelService";
import { TransactionService } from "./TransactionService";

// services/ServiceContainer.ts
class ServiceContainer {
    static readonly account = new AccountService();
    static readonly label = new TransactionLabelService();
    static readonly transaction = new TransactionService(ServiceContainer.account);
}

export default ServiceContainer;