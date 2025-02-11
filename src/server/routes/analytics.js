/*
import analyticsRoutes from './routes/analytics.js';
app.use('/api/analytics', analyticsRoutes);
*/

import express from 'express';
import { authorizeApiKey } from '../middleware/auth.js';
import { cacheMiddleware } from '../middleware/cache.js';
import TrackingData from '../models/TrackingData.js';
import { validateDateRange } from '../utils/validation.js';

const router = express.Router();

// Get dashboard overview data
router.get('/dashboard', authorizeApiKey, cacheMiddleware('1h'), async (req, res) => {
    try {
        const { range = '7d' } = req.query;
        const endDate = new Date();
        const startDate = calculateStartDate(range);

        const [
            pageViews,
            userSessions,
            interactions,
            performance,
            devices,
            errors
        ] = await Promise.all([
            getPageViews(startDate, endDate),
            getUserSessions(startDate, endDate),
            getInteractions(startDate, endDate),
            getPerformanceMetrics(startDate, endDate),
            getDeviceDistribution(startDate, endDate),
            getErrorMetrics(startDate, endDate)
        ]);

        res.json({
            pageViews,
            userSessions,
            interactions,
            performance,
            devices,
            errors
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get detailed page views analytics
router.get('/pageviews', authorizeApiKey, cacheMiddleware('30m'), async (req, res) => {
    try {
        const { startDate, endDate, interval = 'day' } = req.query;
        validateDateRange(startDate, endDate);

        const pageViews = await TrackingData.aggregate([
            {
                $match: {
                    eventType: 'page_view',
                    timestamp: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: getDateFormat(interval),
                            date: '$timestamp'
                        }
                    },
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            {
                $project: {
                    date: '$_id',
                    views: '$count',
                    uniqueUsers: { $size: '$uniqueUsers' },
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);

        res.json(pageViews);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch page view analytics' });
    }
});

// Get user session analytics
router.get('/sessions', authorizeApiKey, cacheMiddleware('30m'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        validateDateRange(startDate, endDate);

        const sessions = await TrackingData.aggregate([
            {
                $match: {
                    eventType: 'session_start',
                    timestamp: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $lookup: {
                    from: 'tracking_events',
                    let: { sessionId: '$sessionId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$sessionId', '$$sessionId'] },
                                        { $eq: ['$eventType', 'session_end'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'sessionEnd'
                }
            },
            {
                $project: {
                    sessionId: 1,
                    userId: 1,
                    duration: {
                        $subtract: [
                            { $arrayElemAt: ['$sessionEnd.timestamp', 0] },
                            '$timestamp'
                        ]
                    },
                    pageViews: '$metrics.pageViews',
                    interactions: '$metrics.interactions'
                }
            }
        ]);

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch session analytics' });
    }
});

// Get user behavior analysis
router.get('/behavior', authorizeApiKey, cacheMiddleware('1h'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        validateDateRange(startDate, endDate);

        const behavior = await TrackingData.aggregate([
            {
                $match: {
                    eventType: { $in: ['click', 'scroll', 'form_submit'] },
                    timestamp: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        eventType: '$eventType',
                        path: '$eventData.path'
                    },
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            {
                $project: {
                    eventType: '$_id.eventType',
                    path: '$_id.path',
                    count: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    _id: 0
                }
            }
        ]);

        res.json(behavior);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch behavior analytics' });
    }
});

// Get performance metrics
router.get('/performance', authorizeApiKey, cacheMiddleware('30m'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        validateDateRange(startDate, endDate);

        const performance = await TrackingData.aggregate([
            {
                $match: {
                    eventType: 'performance',
                    timestamp: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d %H:00:00',
                            date: '$timestamp'
                        }
                    },
                    avgLoadTime: { $avg: '$metrics.loadTime' },
                    avgFirstPaint: { $avg: '$metrics.firstPaint' },
                    avgFirstContentfulPaint: { $avg: '$metrics.firstContentfulPaint' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json(performance);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch performance metrics' });
    }
});

// Get real-time analytics
router.get('/realtime', authorizeApiKey, async (req, res) => {
    try {
        const timeWindow = 5 * 60 * 1000; // 5 minutes
        const startTime = new Date(Date.now() - timeWindow);

        const realtime = await TrackingData.aggregate([
            {
                $match: {
                    timestamp: { $gte: startTime }
                }
            },
            {
                $group: {
                    _id: {
                        minute: {
                            $dateToString: {
                                format: '%Y-%m-%d %H:%M:00',
                                date: '$timestamp'
                            }
                        },
                        eventType: '$eventType'
                    },
                    count: { $sum: 1 },
                    activeUsers: { $addToSet: '$userId' }
                }
            },
            {
                $project: {
                    minute: '$_id.minute',
                    eventType: '$_id.eventType',
                    count: 1,
                    activeUsers: { $size: '$activeUsers' },
                    _id: 0
                }
            },
            { $sort: { minute: 1 } }
        ]);

        res.json(realtime);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch real-time analytics' });
    }
});

// Helper functions
function calculateStartDate(range) {
    const now = new Date();
    switch (range) {
        case '24h':
            return new Date(now - 24 * 60 * 60 * 1000);
        case '7d':
            return new Date(now - 7 * 24 * 60 * 60 * 1000);
        case '30d':
            return new Date(now - 30 * 24 * 60 * 60 * 1000);
        case '90d':
            return new Date(now - 90 * 24 * 60 * 60 * 1000);
        default:
            return new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
}

function getDateFormat(interval) {
    switch (interval) {
        case 'hour':
            return '%Y-%m-%d %H:00:00';
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

async function getPageViews(startDate, endDate) {
    return TrackingData.aggregate([
        {
            $match: {
                eventType: 'page_view',
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                },
                views: { $sum: 1 }
            }
        },
        {
            $project: {
                date: '$_id',
                views: 1,
                _id: 0
            }
        },
        { $sort: { date: 1 } }
    ]);
}

async function getUserSessions(startDate, endDate) {
    return TrackingData.aggregate([
        {
            $match: {
                eventType: 'session_start',
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%H', date: '$timestamp' }
                },
                sessions: { $sum: 1 }
            }
        },
        {
            $project: {
                hour: '$_id',
                sessions: 1,
                _id: 0
            }
        },
        { $sort: { hour: 1 } }
    ]);
}

async function getInteractions(startDate, endDate) {
    return TrackingData.aggregate([
        {
            $match: {
                eventType: { $in: ['click', 'scroll', 'form_submit'] },
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$eventType',
                value: { $sum: 1 }
            }
        },
        {
            $project: {
                name: '$_id',
                value: 1,
                _id: 0
            }
        }
    ]);
}

async function getPerformanceMetrics(startDate, endDate) {
    return TrackingData.aggregate([
        {
            $match: {
                eventType: 'performance',
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                },
                loadTime: { $avg: '$metrics.loadTime' },
                fcp: { $avg: '$metrics.firstContentfulPaint' }
            }
        },
        {
            $project: {
                timestamp: '$_id',
                loadTime: 1,
                fcp: 1,
                _id: 0
            }
        },
        { $sort: { timestamp: 1 } }
    ]);
}

async function getDeviceDistribution(startDate, endDate) {
    return TrackingData.aggregate([
        {
            $match: {
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$deviceInfo.type',
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                type: '$_id',
                count: 1,
                _id: 0
            }
        }
    ]);
}

async function getErrorMetrics(startDate, endDate) {
    return TrackingData.aggregate([
        {
            $match: {
                eventType: 'error',
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$error.type',
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                type: '$_id',
                count: 1,
                _id: 0
            }
        }
    ]);
}

export default router;

/*
This analytics.js routes file provides comprehensive analytics endpoints with:

Dashboard Overview:


Page view metrics
User session data
Interaction tracking
Performance metrics
Device distribution
Error tracking


Detailed Analytics:


Page view analysis
Session analytics
User behavior tracking
Performance monitoring
Real-time analytics


Features:


API key authorization
Cache middleware
Date range validation
Aggregation pipelines
Error handling
Helper functions
*/