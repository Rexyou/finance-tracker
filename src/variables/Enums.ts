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
    DebitAccount = "DebitAccount", // Debit Card
    CreditAccount = "CreditAccount", // Credit Card
    FixedDeposit = "FixedDeposit",
    Cash = "Cash",
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