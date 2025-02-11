/*
// As middleware
app.get('/api/data', cacheMiddleware('5m'), (req, res) => {
    // Response will be cached for 5 minutes
});

// Direct usage
await cache.set('key', data, 300); // Cache for 5 minutes
const data = await cache.get('key');
*/

import { config } from '../config/environment.js';
import { captureCacheMetrics } from '../utils/metrics.js';

class CacheStore {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = config.cache.ttl || 3600; // 1 hour default
    }

    // Get item from cache
    async get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            captureCacheMetrics('get', false);
            return null;
        }

        if (item.expiry && item.expiry < Date.now()) {
            this.cache.delete(key);
            captureCacheMetrics('get', false);
            return null;
        }

        captureCacheMetrics('get', true);
        return item.value;
    }

    // Set item in cache
    async set(key, value, ttl = this.defaultTTL) {
        const expiry = ttl ? Date.now() + (ttl * 1000) : null;
        
        this.cache.set(key, {
            value,
            expiry,
            createdAt: Date.now()
        });

        captureCacheMetrics('set');
        return true;
    }

    // Delete item from cache
    async del(key) {
        captureCacheMetrics('delete');
        return this.cache.delete(key);
    }

    // Clear entire cache
    async clear() {
        captureCacheMetrics('clear');
        this.cache.clear();
        return true;
    }

    // Get cache stats
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Initialize cache store
const cacheStore = new CacheStore();

// Cache middleware function
export const cacheMiddleware = (duration = '5m') => {
    return async (req, res, next) => {
        // Skip caching for non-GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Convert duration string to seconds
        const ttl = parseDuration(duration);

        // Generate cache key from request
        const cacheKey = generateCacheKey(req);

        try {
            // Try to get from cache
            const cachedResponse = await cacheStore.get(cacheKey);
            
            if (cachedResponse) {
                res.set('X-Cache', 'HIT');
                return res.json(cachedResponse);
            }

            // Store original json method
            const originalJson = res.json;

            // Override json method to cache response
            res.json = function(data) {
                // Restore original json method
                res.json = originalJson;

                // Cache the response
                cacheStore.set(cacheKey, data, ttl);

                // Set cache header
                res.set('X-Cache', 'MISS');

                // Send response
                return res.json(data);
            };

            next();
        } catch (error) {
            console.error('Cache error:', error);
            next();
        }
    };
};

// Helper function to generate cache key
function generateCacheKey(req) {
    const parts = [
        req.originalUrl || req.url,
        req.headers['accept-language'],
        req.headers['user-agent']
    ];

    // Add auth-specific parts if needed
    if (req.user) {
        parts.push(req.user.id);
    }

    return parts.join('|');
}

// Helper function to parse duration string
function parseDuration(duration) {
    const units = {
        s: 1,
        m: 60,
        h: 3600,
        d: 86400
    };

    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
        return 300; // Default 5 minutes
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
}

// Middleware to clear cache for specific patterns
export const clearCache = (patterns = []) => {
    return async (req, res, next) => {
        try {
            const stats = cacheStore.getStats();
            
            if (patterns.length === 0) {
                await cacheStore.clear();
            } else {
                const keys = stats.keys.filter(key => 
                    patterns.some(pattern => key.includes(pattern))
                );
                
                await Promise.all(keys.map(key => cacheStore.del(key)));
            }
            
            next();
        } catch (error) {
            console.error('Cache clear error:', error);
            next();
        }
    };
};

// Export cache instance for direct usage
export const cache = {
    get: (key) => cacheStore.get(key),
    set: (key, value, ttl) => cacheStore.set(key, value, ttl),
    del: (key) => cacheStore.del(key),
    clear: () => cacheStore.clear(),
    stats: () => cacheStore.getStats()
};

/*
This cache middleware provides:

Core Caching:


In-memory cache store
TTL (Time To Live) support
Cache key generation
Cache statistics


Middleware Features:


Response caching
Cache headers
Duration parsing
Cache clearing


API Methods:


get/set operations
Cache deletion
Cache clearing
Stats retrieval
*/