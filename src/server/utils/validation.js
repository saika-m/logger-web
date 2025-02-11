// Date range validation
export const validateDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
        throw new Error('Start date and end date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format');
    }

    if (start > end) {
        throw new Error('Start date must be before end date');
    }

    // Limit date range to reasonable period (e.g., 1 year)
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (end - start > maxRange) {
        throw new Error('Date range cannot exceed 1 year');
    }

    return { start, end };
};

// Input sanitization
export const sanitizeInput = (input) => {
    if (typeof input !== 'string') {
        return input;
    }

    // Remove potentially dangerous characters
    return input
        .replace(/[<>]/g, '')  // Remove < and >
        .trim();
};

// Query parameter validation
export const validateQueryParams = (params, schema) => {
    const errors = [];

    for (const [key, rules] of Object.entries(schema)) {
        const value = params[key];

        // Required check
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`${key} is required`);
            continue;
        }

        // Skip further validation if value is not present and not required
        if (value === undefined || value === null || value === '') {
            continue;
        }

        // Type validation
        if (rules.type) {
            switch (rules.type) {
                case 'number':
                    if (isNaN(Number(value))) {
                        errors.push(`${key} must be a number`);
                    }
                    break;
                case 'boolean':
                    if (value !== 'true' && value !== 'false') {
                        errors.push(`${key} must be a boolean`);
                    }
                    break;
                case 'date':
                    if (isNaN(new Date(value).getTime())) {
                        errors.push(`${key} must be a valid date`);
                    }
                    break;
            }
        }

        // Range validation for numbers
        if (rules.type === 'number' && !isNaN(Number(value))) {
            const num = Number(value);
            if (rules.min !== undefined && num < rules.min) {
                errors.push(`${key} must be at least ${rules.min}`);
            }
            if (rules.max !== undefined && num > rules.max) {
                errors.push(`${key} must be at most ${rules.max}`);
            }
        }

        // Length validation for strings
        if (typeof value === 'string') {
            if (rules.minLength && value.length < rules.minLength) {
                errors.push(`${key} must be at least ${rules.minLength} characters`);
            }
            if (rules.maxLength && value.length > rules.maxLength) {
                errors.push(`${key} must be at most ${rules.maxLength} characters`);
            }
        }

        // Pattern validation
        if (rules.pattern && !rules.pattern.test(value)) {
            errors.push(`${key} has invalid format`);
        }

        // Enum validation
        if (rules.enum && !rules.enum.includes(value)) {
            errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
        }
    }

    if (errors.length > 0) {
        throw new Error(errors.join('; '));
    }

    return true;
};

// Common validation schemas
export const schemas = {
    pagination: {
        page: {
            type: 'number',
            min: 1,
            default: 1
        },
        limit: {
            type: 'number',
            min: 1,
            max: 100,
            default: 10
        }
    },
    timeRange: {
        startDate: {
            type: 'date',
            required: true
        },
        endDate: {
            type: 'date',
            required: true
        }
    },
    tracking: {
        eventType: {
            type: 'string',
            required: true,
            enum: ['page_view', 'click', 'scroll', 'form_submit', 'error']
        },
        sessionId: {
            type: 'string',
            required: true,
            pattern: /^[a-zA-Z0-9_-]+$/
        }
    }
};

// Validation helper functions
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const isValidIP = (ip) => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

export const isValidUUID = (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

// Input transformation helpers
export const transformToNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
};

export const transformToBoolean = (value, defaultValue = false) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return defaultValue;
};

export const transformToDate = (value, defaultValue = null) => {
    const date = new Date(value);
    return isNaN(date.getTime()) ? defaultValue : date;
};

/*
This validation utility provides:

Date Validation:


Date range validation
Date format checking
Range limitations


Input Validation:


Query parameter validation
Schema-based validation
Type checking
Range checking


Sanitization:


Input sanitization
Character filtering
Data cleaning


Common Schemas:


Pagination schema
Time range schema
Tracking event schema


Helper Functions:


Email validation
IP validation
UUID validation
Data type transformation
*/