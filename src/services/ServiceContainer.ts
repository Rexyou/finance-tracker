import { AccountService } from "./AccountService";
import { TransactionLabelService } from "./TransactionLabelService";
import { TransactionService } from "./TransactionService";

// services/ServiceContainer.ts
class ServiceContainer {
    private static accountService?: AccountService;
    private static transactionService?: TransactionService;
    private static labelService?: TransactionLabelService;

    static get account(): AccountService {
        if (!this.accountService) {
            this.accountService = new AccountService();
        }
        return this.accountService;
    }

    static get transaction(): TransactionService {
        if (!this.transactionService) {
            this.transactionService = new TransactionService(this.account); // Reuses
        }
        return this.transactionService;
    }

    static get label(): TransactionLabelService {
        if (!this.labelService) {
            this.labelService = new TransactionLabelService();
        }
        return this.labelService;
    }
}

export default ServiceContainer;