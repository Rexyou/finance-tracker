export const httpErrorCode = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
}

export const errorMessages = {
    NotFound: { code: httpErrorCode.NOT_FOUND, message: "not_found" },
    UnknownError: { code: httpErrorCode.INTERNAL_SERVER_ERROR, message: "unknown_error" },
}