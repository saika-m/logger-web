import { config } from '../config/environment.js';

// Validate event structure
export const validateEvent = (event) => {
    if (!event || typeof event !== 'object') {
        return false;
    }

    // Required fields
    const requiredFields = ['eventType', 'timestamp'];
    for (const field of requiredFields) {
        if (!(field in event)) {
            return false;
        }
    }

    // Validate timestamp
    if (isNaN(new Date(event.timestamp).getTime())) {
        return false;
    }

    return true;
};

// Sanitize sensitive data
export const sanitizeData = (data) => {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const sanitized = { ...data };
    const sensitiveFields = [
        'password',
        'token',
        'secret',
        'apiKey',
        'creditCard',
        'ssn',
        'auth',
        'authorization'
    ];

    function sanitizeObject(obj) {
        for (const [key, value] of Object.entries(obj)) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                obj[key] = '[REDACTED]';
            } else if (value && typeof value === 'object') {
                sanitizeObject(value);
            }
        }
        return obj;
    }

    return sanitizeObject(sanitized);
};

// Compress event data by removing null/undefined values
export const compressData = (data) => {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const compressed = {};
    
    for (const [key, value] of Object.entries(data)) {
        if (value != null) {
            if (typeof value === 'object') {
                const compressedValue = compressData(value);
                if (Object.keys(compressedValue).length > 0) {
                    compressed[key] = compressedValue;
                }
            } else {
                compressed[key] = value;
            }
        }
    }

    return compressed;
};

// Process IP address - anonymize if configured
export const processIP = (ip) => {
    if (!ip || !config.tracking.anonymizeIP) {
        return ip;
    }

    // Anonymize IPv4
    if (ip.includes('.')) {
        return ip.split('.').slice(0, 3).concat(['0']).join('.');
    }

    // Anonymize IPv6
    if (ip.includes(':')) {
        return ip.split(':').slice(0, 4).concat(['0000']).join(':');
    }

    return ip;
};

// Format tracking data for storage
export const formatTrackingData = (data) => {
    return {
        ...data,
        timestamp: new Date(data.timestamp),
        processedAt: new Date(),
        version: '1.0'
    };
};

// Validate batch data
export const validateBatch = (events) => {
    if (!Array.isArray(events)) {
        return {
            valid: false,
            error: 'Events must be an array'
        };
    }

    const validEvents = [];
    const invalidEvents = [];

    events.forEach(event => {
        if (validateEvent(event)) {
            validEvents.push(event);
        } else {
            invalidEvents.push(event);
        }
    });

    return {
        valid: invalidEvents.length === 0,
        validEvents,
        invalidEvents,
        totalValid: validEvents.length,
        totalInvalid: invalidEvents.length
    };
};

// Process and enrich event data
export const enrichEventData = (event, req) => {
    const enriched = {
        ...event,
        ip: processIP(req.ip),
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'],
        language: req.headers['accept-language'],
        hostname: req.hostname,
        protocol: req.protocol,
        method: req.method,
        path: req.path,
        timestamp: new Date(event.timestamp || Date.now())
    };

    // Add geolocation if available
    if (req.geolocation) {
        enriched.geolocation = req.geolocation;
    }

    return enriched;
};

// Calculate event metrics
export const calculateEventMetrics = (events) => {
    return {
        total: events.length,
        byType: events.reduce((acc, event) => {
            acc[event.eventType] = (acc[event.eventType] || 0) + 1;
            return acc;
        }, {}),
        averageSize: events.reduce((acc, event) => 
            acc + JSON.stringify(event).length, 0) / events.length
    };
};

// Validate session data
export const validateSession = (sessionData) => {
    const required = ['sessionId', 'userId', 'startTime'];
    const missing = required.filter(field => !(field in sessionData));
    
    if (missing.length > 0) {
        return {
            valid: false,
            error: `Missing required fields: ${missing.join(', ')}`
        };
    }

    return { valid: true };
};

/*
Data Validation:


Event structure validation
Batch data validation
Session validation


Data Sanitization:


Sensitive data redaction
IP anonymization
Data compression


Data Enrichment:


Request data enrichment
Geolocation (if available)
Metrics calculation


Data Formatting:


Timestamp normalization
Version tracking
Event metrics
*/