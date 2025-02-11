/*
import { config } from './config/environment.js';
const port = config.port;
*/

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Environment validation schema
const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'MONGO_URI',
    'JWT_SECRET'
];

// Validate required environment variables
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Configuration object
export const config = {
    // Environment
    env: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',

    // Server
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || 'localhost',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    apiPrefix: '/api',

    // Database
    mongoUri: process.env.MONGO_URI,
    useReplicaSet: process.env.USE_REPLICA_SET === 'true',
    replicaSetName: process.env.REPLICA_SET_NAME,
    replicaNodes: process.env.REPLICA_NODES?.split(','),
    dbMaxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE, 10) || 100,
    dbMinPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE, 10) || 5,

    // Authentication
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    saltRounds: parseInt(process.env.SALT_ROUNDS, 10) || 10,

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100 // limit each IP to 100 requests per windowMs
    },

    // CORS
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    corsCredentials: process.env.CORS_CREDENTIALS === 'true',

    // Tracking Settings
    tracking: {
        enableIPTracking: process.env.ENABLE_IP_TRACKING === 'true',
        anonymizeIP: process.env.ANONYMIZE_IP === 'true',
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 30 * 60 * 1000, // 30 minutes
        batchSize: parseInt(process.env.TRACKING_BATCH_SIZE, 10) || 10,
        flushInterval: parseInt(process.env.TRACKING_FLUSH_INTERVAL, 10) || 5000 // 5 seconds
    },

    // Analytics Settings
    analytics: {
        retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS, 10) || 365,
        aggregationInterval: parseInt(process.env.ANALYTICS_AGGREGATION_INTERVAL, 10) || 3600000, // 1 hour
        enableRealtime: process.env.ENABLE_REALTIME_ANALYTICS === 'true'
    },

    // Cache Settings
    cache: {
        driver: process.env.CACHE_DRIVER || 'memory', // 'memory', 'redis'
        ttl: parseInt(process.env.CACHE_TTL, 10) || 3600, // 1 hour
        redisUrl: process.env.REDIS_URL,
        prefix: process.env.CACHE_PREFIX || 'analytics:'
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined',
        directory: process.env.LOG_DIRECTORY || 'logs',
        maxSize: process.env.LOG_MAX_SIZE || '10m',
        maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 5,
        enableConsole: process.env.ENABLE_CONSOLE_LOGGING !== 'false'
    },

    // Security
    security: {
        enableHSTS: process.env.ENABLE_HSTS === 'true',
        enableCSP: process.env.ENABLE_CSP === 'true',
        csrfProtection: process.env.CSRF_PROTECTION === 'true',
        xssFilter: process.env.XSS_FILTER !== 'false',
        maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb'
    },

    // Monitoring
    monitoring: {
        enableMetrics: process.env.ENABLE_METRICS === 'true',
        metricsPath: process.env.METRICS_PATH || '/metrics',
        enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
        healthCheckPath: process.env.HEALTH_CHECK_PATH || '/health'
    },

    // File Storage
    storage: {
        provider: process.env.STORAGE_PROVIDER || 'local', // 'local', 's3', 'gcs'
        basePath: process.env.STORAGE_BASE_PATH || 'uploads',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: process.env.ALLOWED_MIME_TYPES?.split(',') || [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf'
        ]
    },

    // Error Reporting
    errorReporting: {
        enabled: process.env.ENABLE_ERROR_REPORTING === 'true',
        service: process.env.ERROR_REPORTING_SERVICE, // 'sentry', 'rollbar'
        dsn: process.env.ERROR_REPORTING_DSN,
        environment: process.env.ERROR_REPORTING_ENV || process.env.NODE_ENV
    },

    // Email
    email: {
        enabled: process.env.ENABLE_EMAIL === 'true',
        provider: process.env.EMAIL_PROVIDER || 'smtp',
        from: process.env.EMAIL_FROM,
        smtp: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        }
    }
};

// Environment-specific overrides
const envSpecificConfig = {
    development: {
        logging: {
            level: 'debug',
            enableConsole: true
        }
    },
    production: {
        logging: {
            level: 'warn',
            enableConsole: false
        },
        security: {
            enableHSTS: true,
            enableCSP: true,
            csrfProtection: true
        }
    },
    test: {
        logging: {
            level: 'error',
            enableConsole: false
        },
        email: {
            enabled: false
        }
    }
};

// Merge environment-specific configuration
Object.assign(config, envSpecificConfig[config.env] || {});

export default config;

/*
environment.js provides:


Environment variable validation
Server configuration
Database settings
Authentication parameters
Rate limiting
CORS settings
Tracking configurations
Analytics settings
Cache management
Logging configuration
Security settings
Monitoring options
Storage configurations
Error reporting
Email settings
*/