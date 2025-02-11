import TrackingData from '../models/TrackingData.js';
import { sanitizeData, validateEvent } from '../utils/dataProcessing.js';
import { config } from '../config/environment.js';

class TrackingController {
    // Handle batch event tracking
    async trackEvents(req, res) {
        try {
            const { events } = req.body;
            const userId = req.user.id;
            const timestamp = Date.now();

            if (!Array.isArray(events)) {
                return res.status(400).json({ error: 'Events must be an array' });
            }

            // Process events in parallel
            const processedEvents = await Promise.all(events.map(async (event) => {
                if (!validateEvent(event)) {
                    return null;
                }

                return this.enrichEventData(event, userId, req);
            }));

            // Filter out invalid events
            const validEvents = processedEvents.filter(event => event !== null);

            // Store events in database
            const savedEvents = await TrackingData.insertMany(validEvents, { ordered: false });

            return res.status(200).json({
                success: true,
                processed: validEvents.length,
                failed: events.length - validEvents.length
            });

        } catch (error) {
            console.error('Error tracking events:', error);
            return res.status(500).json({ error: 'Failed to track events' });
        }
    }

    // Handle single event tracking
    async trackEvent(req, res) {
        try {
            const eventData = req.body;
            const userId = req.user.id;

            if (!validateEvent(eventData)) {
                return res.status(400).json({ error: 'Invalid event structure' });
            }

            const enrichedEvent = await this.enrichEventData(eventData, userId, req);
            const savedEvent = await TrackingData.create(enrichedEvent);

            return res.status(200).json({
                success: true,
                eventId: savedEvent._id
            });

        } catch (error) {
            console.error('Error tracking event:', error);
            return res.status(500).json({ error: 'Failed to track event' });
        }
    }

    // Handle session management
    async handleSession(req, res) {
        try {
            const { sessionId, action } = req.body;
            const userId = req.user.id;

            switch (action) {
                case 'start':
                    return await this.startSession(sessionId, userId, req);
                case 'update':
                    return await this.updateSession(sessionId, userId);
                case 'end':
                    return await this.endSession(sessionId, userId);
                default:
                    return res.status(400).json({ error: 'Invalid session action' });
            }
        } catch (error) {
            console.error('Error handling session:', error);
            return res.status(500).json({ error: 'Failed to handle session' });
        }
    }

    // Handle data deletion requests
    async deleteData(req, res) {
        try {
            const { userId, startDate, endDate } = req.body;

            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            const query = {
                userId,
                ...(startDate && endDate && {
                    timestamp: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                })
            };

            const result = await TrackingData.deleteMany(query);

            return res.status(200).json({
                success: true,
                deletedCount: result.deletedCount
            });

        } catch (error) {
            console.error('Error deleting data:', error);
            return res.status(500).json({ error: 'Failed to delete data' });
        }
    }

    // Private helper methods
    async enrichEventData(event, userId, req) {
        const enrichedEvent = {
            ...sanitizeData(event),
            userId,
            timestamp: new Date(),
            ip: config.tracking.anonymizeIP ? this.anonymizeIP(req.ip) : req.ip,
            userAgent: req.headers['user-agent']
        };

        // Add device information
        enrichedEvent.deviceInfo = this.getDeviceInfo(req);

        // Add session information if available
        if (event.sessionId) {
            enrichedEvent.sessionId = event.sessionId;
        }

        return enrichedEvent;
    }

    async startSession(sessionId, userId, req) {
        const session = await TrackingData.create({
            eventType: 'session_start',
            sessionId,
            userId,
            timestamp: new Date(),
            deviceInfo: this.getDeviceInfo(req),
            ip: config.tracking.anonymizeIP ? this.anonymizeIP(req.ip) : req.ip
        });

        return session;
    }

    async updateSession(sessionId, userId) {
        const update = await TrackingData.findOneAndUpdate(
            { sessionId, userId, eventType: 'session_start' },
            { $set: { lastActivity: new Date() } },
            { new: true }
        );

        return update;
    }

    async endSession(sessionId, userId) {
        const session = await TrackingData.create({
            eventType: 'session_end',
            sessionId,
            userId,
            timestamp: new Date()
        });

        return session;
    }

    getDeviceInfo(req) {
        const userAgent = req.headers['user-agent'];
        // Implement device detection logic here
        return {
            type: 'unknown',
            userAgent
        };
    }

    anonymizeIP(ip) {
        // Implement IP anonymization logic here
        // Example: 192.168.1.1 -> 192.168.1.0
        return ip.replace(/\d+$/, '0');
    }
}

export default new TrackingController();

/*
trackingController.js provides:


Event tracking (batch and single)
Session management
Data enrichment
Privacy controls
Data deletion
*/