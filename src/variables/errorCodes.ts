export const HttpCode = {
    SUCCESS: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_ERROR: 422,
    INTERNAL_SERVER_ERROR: 500
}

export const ErrorMessages = {
    NotFound: { code: HttpCode.NOT_FOUND, message: "not_found" },
    UnknownError: { code: HttpCode.INTERNAL_SERVER_ERROR, message: "unknown_error" },
    UsernameExistsError: { code: HttpCode.VALIDATION_ERROR, message: "username_exists" },
    EmailExistsError: { code: HttpCode.VALIDATION_ERROR, message: "email_exists" },
    PhoneNumberExistsError: { code: HttpCode.VALIDATION_ERROR, message: "phone_number_exists" },
    PasswordMismatchError: { code: HttpCode.VALIDATION_ERROR, message: "password_mismatch" },
    ValidationError: { code: HttpCode.VALIDATION_ERROR, message: "validation_error" },
    UsernameOrPasswordError: { code: HttpCode.NOT_FOUND, message: "username_or_password_error" },
    TokenInvalidError: { code: HttpCode.UNAUTHORIZED, message: "token_invalid" },
    AccountExistsError: { code: HttpCode.VALIDATION_ERROR, message: "account_exists" },
    AccountNotFoundError: { code: HttpCode.NOT_FOUND, message: "account_not_found" },
    AccountNotActiveError: { code: HttpCode.NOT_FOUND, message: "account_not_active" },
    LabelExistsError: { code: HttpCode.VALIDATION_ERROR, message: "label_exists" },
    TransactionCreationError: { code: HttpCode.INTERNAL_SERVER_ERROR, message: "transaction_create_error" },
    TransactionUpdateError: { code: HttpCode.INTERNAL_SERVER_ERROR, message: "transaction_update_error" },
    BalanceNotEnoughError: { code: HttpCode.INTERNAL_SERVER_ERROR, message: "balance_not_enough_error" },
    LimitNotEnoughError: { code: HttpCode.INTERNAL_SERVER_ERROR, message: "limit_not_enough_error" },
    CreditAccountLimitError: { code: HttpCode.INTERNAL_SERVER_ERROR, message: "credit_account_limit_error" }
}