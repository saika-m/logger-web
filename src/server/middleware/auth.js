import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';

// Authentication middleware
export const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid authentication token' });
    }
};

// API key authorization middleware
export const authorizeApiKey = async (req, res, next) => {
    try {
        const apiKey = req.header('X-API-Key');

        if (!apiKey) {
            return res.status(401).json({ error: 'No API key provided' });
        }

        // Validate API key (implement your validation logic)
        const isValidApiKey = await validateApiKey(apiKey);
        
        if (!isValidApiKey) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        next();
    } catch (error) {
        res.status(401).json({ error: 'API key authorization failed' });
    }
};

// Role-based authorization middleware
export const authorize = (roles = []) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const userRoles = req.user.roles || [];
            
            if (roles.length && !roles.some(role => userRoles.includes(role))) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            next();
        } catch (error) {
            res.status(403).json({ error: 'Authorization failed' });
        }
    };
};

// Permission-based authorization middleware
export const hasPermission = (requiredPermissions = []) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const userPermissions = req.user.permissions || [];
            
            if (requiredPermissions.length && 
                !requiredPermissions.every(permission => userPermissions.includes(permission))) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            next();
        } catch (error) {
            res.status(403).json({ error: 'Permission check failed' });
        }
    };
};

// Token refresh middleware
export const refreshToken = async (req, res, next) => {
    try {
        const refreshToken = req.header('X-Refresh-Token');

        if (!refreshToken) {
            return res.status(401).json({ error: 'No refresh token provided' });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, config.jwtSecret);
        
        // Generate new access token
        const accessToken = generateAccessToken(decoded.userId);
        
        // Attach new token to response headers
        res.setHeader('X-Access-Token', accessToken);
        
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};

// Helper functions
const validateApiKey = async (apiKey) => {
    // Implement your API key validation logic here
    // This could involve checking against a database of valid API keys
    return true; // Replace with actual validation
};

const generateAccessToken = (userId) => {
    return jwt.sign(
        { userId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
    );
};

// Session validation middleware
export const validateSession = async (req, res, next) => {
    try {
        const sessionId = req.header('X-Session-ID');

        if (!sessionId) {
            return res.status(401).json({ error: 'No session ID provided' });
        }

        // Validate session (implement your validation logic)
        const isValidSession = await checkSession(sessionId);
        
        if (!isValidSession) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        next();
    } catch (error) {
        res.status(401).json({ error: 'Session validation failed' });
    }
};

// Rate limit per token middleware
export const tokenRateLimit = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return next();
        }

        // Implement token-based rate limiting
        const isRateLimited = await checkTokenRateLimit(token);
        
        if (isRateLimited) {
            return res.status(429).json({ error: 'Rate limit exceeded for this token' });
        }

        next();
    } catch (error) {
        next(error);
    }
};

// Helper functions
const checkSession = async (sessionId) => {
    // Implement your session validation logic here
    return true; // Replace with actual validation
};

const checkTokenRateLimit = async (token) => {
    // Implement your token-based rate limiting logic here
    return false; // Replace with actual rate limiting check
};

/*
auth.js provides:


JWT authentication
API key authorization
Role-based access control
Permission-based access control
Token refresh mechanism
Session validation
*/