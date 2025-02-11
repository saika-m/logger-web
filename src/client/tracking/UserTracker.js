/*
const tracker = new UserTracker({
    endpoint: 'https://your-api.com/tracking',
    sessionTimeout: 1800000, // 30 minutes
    batchSize: 10,
    flushInterval: 5000 // 5 seconds
}); 
*/

class UserTracker {
    constructor(config = {}) {
        this.sessionId = this.generateSessionId();
        this.userId = this.getUserId();
        this.startTime = Date.now();
        this.lastActivityTime = this.startTime;
        this.config = {
            endpoint: config.endpoint || '/api/tracking',
            sessionTimeout: config.sessionTimeout || 30 * 60 * 1000, // 30 minutes
            batchSize: config.batchSize || 10,
            flushInterval: config.flushInterval || 5000, // 5 seconds
            ...config
        };
        
        this.eventQueue = [];
        this.isTracking = false;
        this.pageLoadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
        
        // Initialize core tracking
        this.initializeTracking();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getUserId() {
        let userId = localStorage.getItem('userId');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('userId', userId);
        }
        return userId;
    }

    initializeTracking() {
        // Track basic information
        this.trackBasicInfo();

        // Set up event listeners
        this.setupEventListeners();

        // Start periodic flush of events
        this.startEventFlush();

        this.isTracking = true;
    }

    trackBasicInfo() {
        const basicInfo = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            referrer: document.referrer,
            pageLoadTime: this.pageLoadTime,
            url: window.location.href,
            timestamp: Date.now()
        };

        this.queueEvent('page_view', basicInfo);
    }

    setupEventListeners() {
        // Page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.queueEvent('visibility_change', {
                isVisible: !document.hidden,
                timestamp: Date.now()
            });
        });

        // Mouse movements (throttled)
        let lastMouseMove = 0;
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - lastMouseMove > 1000) { // Track every second
                this.queueEvent('mouse_movement', {
                    x: e.clientX,
                    y: e.clientY,
                    timestamp: now
                });
                lastMouseMove = now;
            }
        });

        // Clicks
        document.addEventListener('click', (e) => {
            const target = e.target;
            this.queueEvent('click', {
                x: e.clientX,
                y: e.clientY,
                element: target.tagName.toLowerCase(),
                elementId: target.id,
                elementClass: target.className,
                timestamp: Date.now()
            });
        });

        // Scroll events (throttled)
        let lastScroll = 0;
        window.addEventListener('scroll', () => {
            const now = Date.now();
            if (now - lastScroll > 1000) { // Track every second
                this.queueEvent('scroll', {
                    scrollX: window.scrollX,
                    scrollY: window.scrollY,
                    maxScroll: Math.max(
                        document.body.scrollHeight,
                        document.body.offsetHeight,
                        document.documentElement.clientHeight,
                        document.documentElement.scrollHeight,
                        document.documentElement.offsetHeight
                    ),
                    timestamp: now
                });
                lastScroll = now;
            }
        });

        // Form interactions
        document.addEventListener('focus', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                this.queueEvent('form_focus', {
                    element: e.target.tagName.toLowerCase(),
                    elementId: e.target.id,
                    elementType: e.target.type,
                    timestamp: Date.now()
                });
            }
        }, true);

        // Page unload
        window.addEventListener('beforeunload', () => {
            this.queueEvent('page_exit', {
                timeSpent: Date.now() - this.startTime,
                timestamp: Date.now()
            });
            this.flushEvents(true); // Synchronous flush on exit
        });
    }

    queueEvent(eventType, eventData) {
        const event = {
            eventType,
            eventData,
            userId: this.userId,
            sessionId: this.sessionId,
            url: window.location.href,
            timestamp: Date.now()
        };

        this.eventQueue.push(event);

        // Check if we should flush based on batch size
        if (this.eventQueue.length >= this.config.batchSize) {
            this.flushEvents();
        }
    }

    async flushEvents(sync = false) {
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        try {
            const sendEvents = async () => {
                const response = await fetch(this.config.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(events),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            };

            if (sync) {
                // Use navigator.sendBeacon for synchronous sending when page is unloading
                const blob = new Blob([JSON.stringify(events)], { type: 'application/json' });
                navigator.sendBeacon(this.config.endpoint, blob);
            } else {
                await sendEvents();
            }
        } catch (error) {
            console.error('Error flushing events:', error);
            // Re-queue failed events
            this.eventQueue = [...events, ...this.eventQueue];
        }
    }

    startEventFlush() {
        setInterval(() => {
            this.flushEvents();
        }, this.config.flushInterval);
    }

    // Public methods for manual tracking
    trackCustomEvent(eventName, eventData) {
        this.queueEvent('custom_' + eventName, eventData);
    }

    trackError(error) {
        this.queueEvent('error', {
            message: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
    }

    // Method to stop tracking
    stopTracking() {
        this.isTracking = false;
        this.flushEvents(true);
    }
}

export default UserTracker;

/*
This UserTracker.js file creates a comprehensive tracking system that captures:

Basic Information:


User agent and browser information
Screen resolution and viewport size
Language and timezone
Referrer URL
Page load time


User Interactions:


Mouse movements (throttled)
Clicks with element information
Scroll depth and patterns
Form interactions
Page visibility changes


Session Management:


Generates unique session IDs
Maintains persistent user IDs
Tracks session duration
Handles page exits


Performance & Reliability:


Batches events for efficient sending
Handles failed requests with re-queuing
Uses sendBeacon for reliable exit tracking
Configurable flush intervals and batch sizes
*/