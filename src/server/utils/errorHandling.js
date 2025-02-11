// Base error class for the application
class BaseError extends Error {
    constructor(message, statusCode, errorCode, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            error: {
                name: this.name,
                message: this.message,
                code: this.errorCode,
                statusCode: this.statusCode,
                details: this.details,
                timestamp: this.timestamp
            }
        };
    }
}

// Specific error classes
class ValidationError extends BaseError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

class AuthenticationError extends BaseError {
    constructor(message, details = null) {
        super(message, 401, 'AUTHENTICATION_ERROR', details);
    }
}

class AuthorizationError extends BaseError {
    constructor(message, details = null) {
        super(message, 403, 'AUTHORIZATION_ERROR', details);
    }
}

class NotFoundError extends BaseError {
    constructor(message, details = null) {
        super(message, 404, 'NOT_FOUND_ERROR', details);
    }
}

class RateLimitError extends BaseError {
    constructor(message, details = null) {
        super(message, 429, 'RATE_LIMIT_ERROR', details);
    }
}

class DatabaseError extends BaseError {
    constructor(message, details = null) {
        super(message, 500, 'DATABASE_ERROR', details);
    }
}

// Error creation utility
export const createError = (statusCode, message, errorCode = null, details = null) => {
    switch (statusCode) {
        case 400:
            return new ValidationError(message, details);
        case 401:
            return new AuthenticationError(message, details);
        case 403:
            return new AuthorizationError(message, details);
        case 404:
            return new NotFoundError(message, details);
        case 429:
            return new RateLimitError(message, details);
        default:
            return new BaseError(message, statusCode, errorCode, details);
    }
};

// Error handling middleware
export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    if (err instanceof BaseError) {
        return res.status(err.statusCode).json(err.toJSON());
    }

    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
        const validationError = new ValidationError(
            'Validation Error',
            Object.values(err.errors).map(e => ({
                field: e.path,
                message: e.message
            }))
        );
        return res.status(validationError.statusCode).json(validationError.toJSON());
    }

    // Handle mongoose duplicate key errors
    if (err.code === 11000) {
        const duplicateError = new ValidationError(
            'Duplicate Key Error',
            {
                field: Object.keys(err.keyPattern)[0],
                value: err.keyValue[Object.keys(err.keyPattern)[0]]
            }
        );
        return res.status(duplicateError.statusCode).json(duplicateError.toJSON());
    }

    // Default error
    const serverError = new BaseError(
        'Internal Server Error',
        500,
        'INTERNAL_SERVER_ERROR'
    );
    return res.status(500).json(serverError.toJSON());
};

// Async handler wrapper
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Export error classes
export {
    BaseError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    RateLimitError,
    DatabaseError
};