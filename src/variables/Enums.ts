export enum RedisKeyName {
    UserData = "UserData",
}

export enum UserStatus {
    Active = "active",
    Inactive = "inactive",
    Freeze = "freeze",
    Delete = "delete",
}

export enum AccountType {
    DebitAccount = "debitAccount", // Debit Card
    CreditAccount = "creditAccount", // Credit Card
    // FixedDeposit removed: the balance arithmetic worked, but none of the
    // actual FD semantics exist (no tenure, no maturity date, nothing stops an
    // early withdrawal, no maturity notification). Add it back together with
    // those fields, not as a bare enum member.
    Cash = "cash",
}

export enum AccountStatus {
    Active = "active",
    Inactive = "inactive",
    Delete = "delete",
}

export enum TransactionType {
    Credit = "credit",
    Debit = "debit",
}

export enum TransactionLabel {
    Saving = "saving",
    Meal = "meal",
    Utility = "utility",
    Entertainment = "entertainment",
    Investment = "investment",
    Installment = "installment",
}

export enum TransactionLabelStatus {
    Active = "active",
    Inactive = "inactive",
    Delete = "delete",
}