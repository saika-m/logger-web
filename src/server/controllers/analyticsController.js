import TrackingData from '../models/TrackingData.js';
import { calculateDateRange } from '../utils/dateUtils.js';
import { config } from '../config/environment.js';

class AnalyticsController {
    // Get dashboard overview
    async getDashboardData(req, res) {
        try {
            const { range = '7d' } = req.query;
            const { startDate, endDate } = calculateDateRange(range);

            const [
                pageViews,
                userSessions,
                interactions,
                performance,
                devices,
                errors
            ] = await Promise.all([
                this.getPageViews(startDate, endDate),
                this.getUserSessions(startDate, endDate),
                this.getInteractions(startDate, endDate),
                this.getPerformanceMetrics(startDate, endDate),
                this.getDeviceDistribution(startDate, endDate),
                this.getErrorMetrics(startDate, endDate)
            ]);

            return res.json({
                pageViews,
                userSessions,
                interactions,
                performance,
                devices,
                errors
            });

        } catch (error) {
            console.error('Error getting dashboard data:', error);
            return res.status(500).json({ error: 'Failed to fetch dashboard data' });
        }
    }

    // Get visitor analytics
    async getVisitorAnalytics(req, res) {
        try {
            const { startDate, endDate, interval = 'day' } = req.query;

            const visitors = await TrackingData.aggregate([
                {
                    $match: {
                        timestamp: {
                            $gte: new Date(startDate),
                            $lte: new Date(endDate)
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            date: {
                                $dateToString: {
                                    format: this.getDateFormat(interval),
                                    date: '$timestamp'
                                }
                            }
                        },
                        uniqueVisitors: { $addToSet: '$userId' },
                        newVisitors: {
                            $addToSet: {
                                $cond: [
                                    { $eq: ['$metrics.isNewUser', true] },
                                    '$userId',
                                    null
                                ]
                            }
                        },
                        sessions: { $addToSet: '$sessionId' }
                    }
                },
                {
                    $project: {
                        date: '$_id.date',
                        uniqueVisitors: { $size: '$uniqueVisitors' },
                        newVisitors: {
                            $size: {
                                $filter: {
                                    input: '$newVisitors',
                                    as: 'visitor',
                                    cond: { $ne: ['$$visitor', null] }
                                }
                            }
                        },
                        sessions: { $size: '$sessions' },
                        _id: 0
                    }
                },
                { $sort: { date: 1 } }
            ]);

            return res.json(visitors);

        } catch (error) {
            console.error('Error getting visitor analytics:', error);
            return res.status(500).json({ error: 'Failed to fetch visitor analytics' });
        }
    }

    // Get behavior analytics
    async getBehaviorAnalytics(req, res) {
        try {
            const { startDate, endDate } = req.query;

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
                            page: '$eventData.page',
                            eventType: '$eventType'
                        },
                        count: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$userId' }
                    }
                },
                {
                    $group: {
                        _id: '$_id.page',
                        interactions: {
                            $push: {
                                type: '$_id.eventType',
                                count: '$count',
                                uniqueUsers: { $size: '$uniqueUsers' }
                            }
                        },
                        totalInteractions: { $sum: '$count' }
                    }
                },
                {
                    $project: {
                        page: '$_id',
                        interactions: 1,
                        totalInteractions: 1,
                        _id: 0
                    }
                },
                { $sort: { totalInteractions: -1 } }
            ]);

            return res.json(behavior);

        } catch (error) {
            console.error('Error getting behavior analytics:', error);
            return res.status(500).json({ error: 'Failed to fetch behavior analytics' });
        }
    }

    // Get conversion analytics
    async getConversionAnalytics(req, res) {
        try {
            const { startDate, endDate, goalType } = req.query;

            const match = {
                eventType: 'conversion',
                timestamp: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };

            if (goalType) {
                match['eventData.goalType'] = goalType;
            }

            const conversions = await TrackingData.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: {
                            date: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: '$timestamp'
                                }
                            },
                            goalType: '$eventData.goalType'
                        },
                        count: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$userId' },
                        value: { $sum: '$eventData.value' }
                    }
                },
                {
                    $project: {
                        date: '$_id.date',
                        goalType: '$_id.goalType',
                        conversions: '$count',
                        uniqueUsers: { $size: '$uniqueUsers' },
                        value: 1,
                        _id: 0
                    }
                },
                { $sort: { date: 1, goalType: 1 } }
            ]);

            return res.json(conversions);

        } catch (error) {
            console.error('Error getting conversion analytics:', error);
            return res.status(500).json({ error: 'Failed to fetch conversion analytics' });
        }
    }

    // Get real-time analytics
    async getRealTimeAnalytics(req, res) {
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
                        uniqueUsers: { $addToSet: '$userId' }
                    }
                },
                {
                    $project: {
                        minute: '$_id.minute',
                        eventType: '$_id.eventType',
                        count: 1,
                        activeUsers: { $size: '$uniqueUsers' },
                        _id: 0
                    }
                },
                { $sort: { minute: 1 } }
            ]);

            return res.json(realtime);

        } catch (error) {
            console.error('Error getting real-time analytics:', error);
            return res.status(500).json({ error: 'Failed to fetch real-time analytics' });
        }
    }

    // Private helper methods
    async getPageViews(startDate, endDate) {
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
                    views: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            {
                $project: {
                    date: '$_id',
                    views: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);
    }

    async getUserSessions(startDate, endDate) {
        return TrackingData.aggregate([
            {
                $match: {
                    eventType: 'session_start',
                    timestamp: { $gte: startDate, $lte: endDate }
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
                                        { $eq: ['$sessionId', '$sessionId'] },
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
                    duration: {
                        $subtract: [
                            { $arrayElemAt: ['$sessionEnd.timestamp', 0] },
                            '$timestamp'
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%H', date: '$timestamp' }
                    },
                    sessions: { $sum: 1 },
                    avgDuration: { $avg: '$duration' }
                }
            },
            {
                $project: {
                    hour: '$_id',
                    sessions: 1,
                    avgDuration: 1,
                    _id: 0
                }
            },
            { $sort: { hour: 1 } }
        ]);
    }

    async getInteractions(startDate, endDate) {
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
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            {
                $project: {
                    type: '$_id',
                    count: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    _id: 0
                }
            }
        ]);
    }

    async getPerformanceMetrics(startDate, endDate) {
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
                    avgLoadTime: { $avg: '$metrics.loadTime' },
                    avgFirstPaint: { $avg: '$metrics.firstPaint' },
                    avgFirstContentfulPaint: { $avg: '$metrics.firstContentfulPaint' },
                    avgDomInteractive: { $avg: '$metrics.domInteractive' }
                }
            },
            {
                $project: {
                    date: '$_id',
                    metrics: {
                        loadTime: '$avgLoadTime',
                        firstPaint: '$avgFirstPaint',
                        firstContentfulPaint: '$avgFirstContentfulPaint',
                        domInteractive: '$avgDomInteractive'
                    },
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);
    }

    async getDeviceDistribution(startDate, endDate) {
        return TrackingData.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$deviceInfo.type',
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            {
                $project: {
                    type: '$_id',
                    count: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    percentage: {
                        $multiply: [
                            { $divide: ['$count', { $sum: '$count' }] },
                            100
                        ]
                    },
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ]);
    }

    async getErrorMetrics(startDate, endDate) {
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
                    count: { $sum: 1 },
                    users: { $addToSet: '$userId' },
                    occurrences: {
                        $push: {
                            message: '$error.message',
                            timestamp: '$timestamp',
                            url: '$error.url'
                        }
                    }
                }
            },
            {
                $project: {
                    type: '$_id',
                    count: 1,
                    uniqueUsers: { $size: '$users' },
                    recentOccurrences: { $slice: ['$occurrences', -5] },
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ]);
    }

    getDateFormat(interval) {
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
}

export default new AnalyticsController();

/*
analyticsController.js provides:


Dashboard analytics
Visitor metrics
Behavior analysis
Conversion tracking
Real-time analytics
Performance metrics
*/