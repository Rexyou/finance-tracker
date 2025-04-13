export const httpErrorCode = {
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_ERROR: 422,
    INTERNAL_SERVER_ERROR: 500
}

export const ErrorMessages = {
    NotFound: { code: httpErrorCode.NOT_FOUND, message: "not_found" },
    UnknownError: { code: httpErrorCode.INTERNAL_SERVER_ERROR, message: "unknown_error" },
    UsernameExistsError: { code: httpErrorCode.VALIDATION_ERROR, message: "username_exists" },
    EmailExistsError: { code: httpErrorCode.VALIDATION_ERROR, message: "email_exists" },
    PhoneNumberExistsError: { code: httpErrorCode.VALIDATION_ERROR, message: "phone_number_exists" },
    PasswordMismatchError: { code: httpErrorCode.VALIDATION_ERROR, message: "password_mismatch" },
    ValidationError: { code: httpErrorCode.VALIDATION_ERROR, message: "validation_error" },
    UsernameOrPasswordError: { code: httpErrorCode.NOT_FOUND, message: "username_or_password_error" },
    TokenInvalidError: { code: httpErrorCode.UNAUTHORIZED, message: "token_invalid" },
}