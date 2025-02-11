/*
import TrackingData from './models/TrackingData.js';

// Create a new tracking event
const event = new TrackingData({
    eventType: 'page_view',
    userId: 'user123',
    sessionId: 'session456',
    pageView: {
        url: '/home',
        loadTime: 1200
    }
});

await event.save();
*/

import mongoose from 'mongoose';

// Sub-schemas for specific event types
const PageViewSchema = new mongoose.Schema({
    url: String,
    referrer: String,
    title: String,
    loadTime: Number,
    viewport: {
        width: Number,
        height: Number
    }
}, { _id: false });

const UserInteractionSchema = new mongoose.Schema({
    elementId: String,
    elementType: String,
    elementClass: String,
    action: String,
    value: mongoose.Schema.Types.Mixed,
    position: {
        x: Number,
        y: Number
    }
}, { _id: false });

const PerformanceSchema = new mongoose.Schema({
    metric: String,
    value: Number,
    name: String,
    entryType: String,
    startTime: Number,
    duration: Number,
    resources: [{
        name: String,
        initiatorType: String,
        duration: Number,
        transferSize: Number,
        decodedBodySize: Number
    }]
}, { _id: false });

const ErrorEventSchema = new mongoose.Schema({
    message: String,
    stack: String,
    type: String,
    filename: String,
    lineno: Number,
    colno: Number
}, { _id: false });

const SessionSchema = new mongoose.Schema({
    startTime: Date,
    endTime: Date,
    duration: Number,
    active: Boolean,
    interactions: Number,
    pages: [String]
}, { _id: false });

const DeviceInfoSchema = new mongoose.Schema({
    type: String,
    browser: {
        name: String,
        version: String,
        engine: String
    },
    os: {
        name: String,
        version: String,
        architecture: String
    },
    screen: {
        width: Number,
        height: Number,
        colorDepth: Number,
        pixelRatio: Number
    },
    viewport: {
        width: Number,
        height: Number
    }
}, { _id: false });

const NetworkInfoSchema = new mongoose.Schema({
    connectionType: String,
    effectiveType: String,
    downlink: Number,
    rtt: Number,
    bandwidth: Number
}, { _id: false });

const ConsentSchema = new mongoose.Schema({
    essential: Boolean,
    functional: Boolean,
    analytics: Boolean,
    marketing: Boolean,
    version: String,
    timestamp: Date
}, { _id: false });

// Main tracking data schema
const TrackingDataSchema = new mongoose.Schema({
    // Basic event information
    eventType: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Client information
    ip: String,
    userAgent: String,

    // Consent information
    consent: ConsentSchema,

    // Device and browser information
    deviceInfo: DeviceInfoSchema,
    networkInfo: NetworkInfoSchema,

    // Session information
    session: SessionSchema,

    // Event-specific data
    eventData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Event-type specific schemas
    pageView: PageViewSchema,
    userInteraction: UserInteractionSchema,
    performance: PerformanceSchema,
    error: ErrorEventSchema,

    // Custom data field for flexible storage
    customData: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },

    // Metadata
    processed: {
        type: Boolean,
        default: false,
        index: true
    },
    version: {
        type: String,
        default: '1.0'
    }
}, {
    timestamps: true,
    strict: false // Allow for flexible data storage
});

// Indexes
TrackingDataSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
TrackingDataSchema.index({ sessionId: 1, timestamp: -1 });
TrackingDataSchema.index({ 'eventData.url': 1 }, { sparse: true });
TrackingDataSchema.index({ 'deviceInfo.type': 1 }, { sparse: true });

// Methods
TrackingDataSchema.methods.isExpired = function(retentionDays = 365) {
    const retentionPeriod = retentionDays * 24 * 60 * 60 * 1000;
    return Date.now() - this.timestamp.getTime() > retentionPeriod;
};

TrackingDataSchema.methods.sanitize = function() {
    // Remove sensitive information
    if (this.eventData) {
        delete this.eventData.password;
        delete this.eventData.token;
        delete this.eventData.creditCard;
    }
    return this;
};

// Static methods
TrackingDataSchema.statics.findByDateRange = async function(startDate, endDate, options = {}) {
    return this.find({
        timestamp: {
            $gte: startDate,
            $lte: endDate
        },
        ...options
    }).sort({ timestamp: -1 });
};

TrackingDataSchema.statics.getSessionData = async function(sessionId) {
    return this.find({ sessionId })
        .sort({ timestamp: 1 })
        .lean();
};

TrackingDataSchema.statics.getUserSessions = async function(userId, limit = 10) {
    return this.aggregate([
        { $match: { userId } },
        { $sort: { timestamp: -1 } },
        { $group: {
            _id: '$sessionId',
            startTime: { $first: '$timestamp' },
            endTime: { $last: '$timestamp' },
            events: { $sum: 1 },
            pages: { $addToSet: '$eventData.url' }
        }},
        { $limit: limit }
    ]);
};

TrackingDataSchema.statics.getEventMetrics = async function(options = {}) {
    const { startDate, endDate, eventType } = options;
    
    const pipeline = [
        {
            $match: {
                timestamp: {
                    $gte: startDate,
                    $lte: endDate
                },
                ...(eventType && { eventType })
            }
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    eventType: '$eventType'
                },
                count: { $sum: 1 },
                users: { $addToSet: '$userId' }
            }
        },
        {
            $project: {
                date: '$_id.date',
                eventType: '$_id.eventType',
                count: 1,
                uniqueUsers: { $size: '$users' }
            }
        },
        { $sort: { date: 1 } }
    ];

    return this.aggregate(pipeline);
};

// Middleware
TrackingDataSchema.pre('save', function(next) {
    // Set version
    if (!this.version) {
        this.version = '1.0';
    }

    // Sanitize data
    this.sanitize();

    next();
});

TrackingDataSchema.pre('find', function() {
    // Add default sorting if not specified
    if (!this.options.sort) {
        this.sort({ timestamp: -1 });
    }
});

// Plugins (if needed)
// TrackingDataSchema.plugin(somePlugin);

// Create model
const TrackingData = mongoose.model('TrackingData', TrackingDataSchema);

// Export model and schemas for flexibility
export {
    TrackingData as default,
    TrackingDataSchema,
    PageViewSchema,
    UserInteractionSchema,
    PerformanceSchema,
    ErrorEventSchema,
    SessionSchema,
    DeviceInfoSchema,
    NetworkInfoSchema,
    ConsentSchema
};



/*
This TrackingData.js schema provides:

Comprehensive Data Structure:


Event metadata
User interactions
Performance metrics
Device information
Network status
Session tracking
Error logging
Consent management


Schema Features:


Type validation
Required fields
Default values
Nested schemas
Flexible custom data


Performance Optimizations:


Strategic indexing
Compound indexes
Sparse indexes
Query optimization


Built-in Methods:


Data sanitization
Expiration checking
Date range queries
Session analysis
Metrics aggregation
*/