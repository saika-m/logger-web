/*
import trackingRouter from './routes/tracking.js';
app.use('/api/tracking', trackingRouter);
*/

import express from 'express';
import rateLimit from 'express-rate-limit';
import TrackingData from '../models/TrackingData.js';
import { validateEvent, sanitizeData, compressData } from '../utils/dataProcessing.js';
import { auth, authorizeApiKey } from '../middleware/auth.js';
import { createError } from '../utils/errorHandling.js';
import { captureMetrics } from '../utils/metrics.js';
import { cacheMiddleware, cache } from '../middleware/cache.js';

const router = express.Router();

// Rate limiting configuration
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
});

// Apply rate limiting to all tracking routes
router.use(limiter);

// Batch event tracking endpoint
router.post('/events', auth, async (req, res, next) => {
    try {
        const { events } = req.body;
        const userId = req.user.id;
        const timestamp = Date.now();

        if (!Array.isArray(events)) {
            throw createError(400, 'Events must be an array');
        }

        // Process events in parallel with Promise.all
        const processedEvents = await Promise.all(events.map(async (event) => {
            // Validate event structure
            if (!validateEvent(event)) {
                console.warn(`Invalid event structure: ${JSON.stringify(event)}`);
                return null;
            }

            // Sanitize event data
            const sanitizedEvent = sanitizeData(event);

            // Add metadata
            const enrichedEvent = {
                ...sanitizedEvent,
                userId,
                timestamp,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            };

            // Compress data if needed
            if (enrichedEvent.eventData && typeof enrichedEvent.eventData === 'object') {
                enrichedEvent.eventData = compressData(enrichedEvent.eventData);
            }

            return enrichedEvent;
        }));

        // Filter out null events (failed validation)
        const validEvents = processedEvents.filter(event => event !== null);

        // Store events in database
        const savedEvents = await TrackingData.insertMany(validEvents, { ordered: false });

        // Update cache for analytics
        await updateAnalyticsCache(validEvents);

        // Capture metrics
        captureMetrics('tracking_events', {
            count: validEvents.length,
            userId,
            timestamp
        });

        res.status(200).json({
            success: true,
            processed: validEvents.length,
            failed: events.length - validEvents.length
        });

    } catch (error) {
        next(error);
    }
});

// Single event tracking endpoint
router.post('/event', auth, async (req, res, next) => {
    try {
        const eventData = req.body;
        const userId = req.user.id;
        const timestamp = Date.now();

        // Validate event
        if (!validateEvent(eventData)) {
            throw createError(400, 'Invalid event structure');
        }

        // Sanitize and enrich event data
        const enrichedEvent = {
            ...sanitizeData(eventData),
            userId,
            timestamp,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        };

        // Compress data if needed
        if (enrichedEvent.eventData && typeof enrichedEvent.eventData === 'object') {
            enrichedEvent.eventData = compressData(enrichedEvent.eventData);
        }

        // Store in database
        const savedEvent = await TrackingData.create(enrichedEvent);

        // Update cache for analytics
        await updateAnalyticsCache([enrichedEvent]);

        // Capture metrics
        captureMetrics('tracking_event', {
            eventType: eventData.eventType,
            userId,
            timestamp
        });

        res.status(200).json({
            success: true,
            eventId: savedEvent._id
        });

    } catch (error) {
        next(error);
    }
});

// Query events endpoint
router.get('/events', auth, authorizeApiKey, cacheMiddleware, async (req, res, next) => {
    try {
        const {
            userId,
            eventType,
            startDate,
            endDate,
            limit = 100,
            skip = 0
        } = req.query;

        // Build query
        const query = {};
        if (userId) query.userId = userId;
        if (eventType) query.eventType = eventType;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        // Execute query with pagination
        const events = await TrackingData.find(query)
            .sort({ timestamp: -1 })
            .skip(Number(skip))
            .limit(Number(limit));

        // Get total count for pagination
        const total = await TrackingData.countDocuments(query);

        res.status(200).json({
            success: true,
            data: events,
            pagination: {
                total,
                limit: Number(limit),
                skip: Number(skip),
                hasMore: total > (Number(skip) + Number(limit))
            }
        });

    } catch (error) {
        next(error);
    }
});

// Aggregate events endpoint
router.get('/aggregate', auth, authorizeApiKey, cacheMiddleware, async (req, res, next) => {
    try {
        const {
            groupBy,
            eventType,
            startDate,
            endDate,
            interval
        } = req.query;

        // Build aggregation pipeline
        const pipeline = [];

        // Match stage
        const match = {};
        if (eventType) match.eventType = eventType;
        if (startDate || endDate) {
            match.timestamp = {};
            if (startDate) match.timestamp.$gte = new Date(startDate);
            if (endDate) match.timestamp.$lte = new Date(endDate);
        }
        if (Object.keys(match).length > 0) {
            pipeline.push({ $match: match });
        }

        // Group stage
        const groupStage = {
            _id: null,
            count: { $sum: 1 }
        };

        if (groupBy) {
            if (groupBy === 'time' && interval) {
                groupStage._id = {
                    $dateToString: {
                        format: getTimeFormat(interval),
                        date: '$timestamp'
                    }
                };
            } else {
                groupStage._id = `$${groupBy}`;
            }
        }

        pipeline.push({ $group: groupStage });

        // Sort stage
        pipeline.push({ $sort: { _id: 1 } });

        // Execute aggregation
        const result = await TrackingData.aggregate(pipeline);

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        next(error);
    }
});

// Delete events endpoint
router.delete('/events', auth, authorizeApiKey, async (req, res, next) => {
    try {
        const { userId, eventType, endDate } = req.body;

        if (!userId && !eventType && !endDate) {
            throw createError(400, 'At least one deletion criteria must be specified');
        }

        // Build deletion query
        const query = {};
        if (userId) query.userId = userId;
        if (eventType) query.eventType = eventType;
        if (endDate) query.timestamp = { $lte: new Date(endDate) };

        // Execute deletion
        const result = await TrackingData.deleteMany(query);

        // Clear relevant cache
        await clearAffectedCache(query);

        // Capture metrics
        captureMetrics('tracking_events_deletion', {
            criteria: { userId, eventType, endDate },
            deletedCount: result.deletedCount
        });

        res.status(200).json({
            success: true,
            deletedCount: result.deletedCount
        });

    } catch (error) {
        next(error);
    }
});

// Utility functions
function getTimeFormat(interval) {
    switch (interval) {
        case 'hour':
            return '%Y-%m-%d %H:00';
        case 'day':
            return '%Y-%m-%d';
        case 'week':
            return '%Y-W%V';
        case 'month':
            return '%Y-%m';
        default:
            return '%Y-%m-%d';
    }
}

async function updateAnalyticsCache(events) {
    try {
        // Group events by type for cache updates
        const eventsByType = {};
        events.forEach(event => {
            if (!eventsByType[event.eventType]) {
                eventsByType[event.eventType] = [];
            }
            eventsByType[event.eventType].push(event);
        });

        // Update cache for each event type
        await Promise.all(Object.entries(eventsByType).map(async ([eventType, typeEvents]) => {
            const cacheKey = `analytics:${eventType}:latest`;
            const currentCache = await cache.get(cacheKey) || [];
            const updatedCache = [...typeEvents, ...currentCache].slice(0, 1000); // Keep last 1000 events
            await cache.set(cacheKey, updatedCache, 3600); // Cache for 1 hour
        }));
    } catch (error) {
        console.error('Cache update error:', error);
    }
}

async function clearAffectedCache(query) {
    try {
        if (query.eventType) {
            await cache.del(`analytics:${query.eventType}:latest`);
        } else {
            // Clear all analytics caches if no specific event type
            const keys = await cache.keys('analytics:*');
            await Promise.all(keys.map(key => cache.del(key)));
        }
    } catch (error) {
        console.error('Cache clearing error:', error);
    }
}

export default router;

/*
This tracking.js server-side endpoint provides:

Event Handling:


Batch event processing
Single event tracking
Data validation and sanitization
Event enrichment


Data Management:


Event querying with filters
Aggregation capabilities
Data deletion
Cache management


Security Features:


Authentication
Rate limiting
API key authorization
Data sanitization


Performance Optimizations:


Batch processing
Caching layer
Compression
Efficient queries
*/