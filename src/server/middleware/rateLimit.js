import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { config } from '../config/environment.js';

// Base rate limit configuration
export const rateLimitConfig = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests, please try again later',
        retryAfter: (retryAfter) => `Please try again in ${retryAfter} seconds`
    },
    skip: (req) => {
        // Skip rate limiting for whitelisted IPs or internal requests
        return isWhitelisted(req.ip);
    },
    keyGenerator: (req) => {
        // Use API key or IP address as rate limit key
        return req.header('X-API-Key') || req.ip;
    }
};

// API endpoint rate limiter
export const apiLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP/API key to 100 requests per windowMs
});

// Authentication endpoint rate limiter
export const authLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 failed authentication attempts per hour
    skipSuccessfulRequests: true // don't count successful authentications
});

// Analytics endpoint rate limiter
export const analyticsLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 60 * 1000, // 1 minute
    max: 30 // limit each IP/API key to 30 analytics requests per minute
});

// Tracking endpoint rate limiter (more permissive)
export const trackingLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 60 * 1000, // 1 minute
    max: 60 // limit each IP/API key to 60 tracking requests per minute
});

// Redis store configuration (for distributed rate limiting)
if (config.cache.driver === 'redis') {
    const redisClient = createRedisClient();
    
    const redisStore = new RedisStore({
        prefix: 'rl:',
        client: redisClient,
        windowMs: config.rateLimit.windowMs
    });

    // Update rate limiters to use Redis store
    [apiLimiter, authLimiter, analyticsLimiter, trackingLimiter].forEach(limiter => {
        limiter.store = redisStore;
    });
}

// Dynamic rate limiter factory
export const createRateLimiter = (options = {}) => {
    return rateLimit({
        ...rateLimitConfig,
        ...options,
        handler: (req, res) => {
            const retryAfter = Math.ceil(options.windowMs / 1000);
            res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter,
                limit: options.max,
                windowMs: options.windowMs
            });
        }
    });
};

// Tier-based rate limiter
export const tierBasedLimiter = (req, res, next) => {
    const tier = req.user?.tier || 'free';
    const limits = {
        free: { windowMs: 60 * 1000, max: 30 },
        pro: { windowMs: 60 * 1000, max: 100 },
        enterprise: { windowMs: 60 * 1000, max: 500 }
    };

    const limiter = createRateLimiter(limits[tier]);
    return limiter(req, res, next);
};

// Helper functions
function isWhitelisted(ip) {
    const whitelistedIPs = config.rateLimit.whitelist || [];
    return whitelistedIPs.includes(ip);
}

function createRedisClient() {
    // Implement Redis client creation
    // This is a placeholder - implement actual Redis connection
    return {
        get: async () => {},
        set: async () => {},
        del: async () => {}
    };
}

// Export middleware composition
export const rateLimitMiddleware = {
    api: apiLimiter,
    auth: authLimiter,
    analytics: analyticsLimiter,
    tracking: trackingLimiter,
    tierBased: tierBasedLimiter,
    create: createRateLimiter
};

/*
rateLimit.js provides:


Basic rate limiting
Tiered rate limiting
Endpoint-specific limits
Redis-based distributed limiting
IP whitelisting
Custom limit handlers
*/