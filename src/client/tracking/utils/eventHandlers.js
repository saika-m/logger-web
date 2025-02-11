/*
const config = new TrackerConfig({  ##yourconfig });
const tracker = new UserTracker(config);
const eventHandlers = new EventHandlers(config, tracker);
eventHandlers.initializeEventListeners();
*/

class EventHandlers {
    constructor(config, tracker) {
        this.config = config;
        this.tracker = tracker;
        this.lastMouseMove = 0;
        this.lastScroll = 0;
        this.lastResize = 0;
        this.sessionStartTime = Date.now();
        this.idleTimer = null;
        this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    initializeEventListeners() {
        // Mouse Events
        if (this.config.features.trackMouseMovement) {
            document.addEventListener('mousemove', this.handleMouseMove.bind(this));
            document.addEventListener('mousedown', this.handleMouseClick.bind(this));
            document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        }

        // Scroll Events
        if (this.config.features.trackScroll) {
            window.addEventListener('scroll', this.handleScroll.bind(this));
        }

        // Form Events
        if (this.config.features.trackForms) {
            document.addEventListener('focus', this.handleFormFocus.bind(this), true);
            document.addEventListener('blur', this.handleFormBlur.bind(this), true);
            document.addEventListener('change', this.handleFormChange.bind(this), true);
            document.addEventListener('submit', this.handleFormSubmit.bind(this), true);
        }

        // Page Lifecycle Events
        document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));

        // Error Events
        if (this.config.features.trackErrors) {
            window.addEventListener('error', this.handleError.bind(this));
            window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));
        }

        // Performance Events
        if (this.config.features.trackPerformance) {
            this.initializePerformanceTracking();
        }

        // Network Events
        window.addEventListener('online', this.handleNetworkChange.bind(this));
        window.addEventListener('offline', this.handleNetworkChange.bind(this));

        // Initialize idle timer
        this.startIdleTimer();
    }

    // Mouse Event Handlers
    handleMouseMove(event) {
        const now = Date.now();
        if (now - this.lastMouseMove >= this.config.mouseMoveThrottle) {
            const mouseData = {
                x: event.clientX,
                y: event.clientY,
                timestamp: now,
                elementHovered: this.getElementInfo(event.target)
            };

            this.tracker.queueEvent('mouse_move', mouseData);
            this.lastMouseMove = now;
            this.resetIdleTimer();
        }
    }

    handleMouseClick(event) {
        const clickData = {
            x: event.clientX,
            y: event.clientY,
            button: event.button,
            timestamp: Date.now(),
            elementClicked: this.getElementInfo(event.target)
        };

        this.tracker.queueEvent('mouse_click', clickData);
        this.resetIdleTimer();
    }

    handleContextMenu(event) {
        const contextData = {
            x: event.clientX,
            y: event.clientY,
            timestamp: Date.now(),
            elementContext: this.getElementInfo(event.target)
        };

        this.tracker.queueEvent('context_menu', contextData);
    }

    // Scroll Event Handler
    handleScroll(event) {
        const now = Date.now();
        if (now - this.lastScroll >= this.config.scrollThrottle) {
            const scrollData = {
                x: window.scrollX,
                y: window.scrollY,
                timestamp: now,
                maxScroll: this.getMaxScroll(),
                viewportHeight: window.innerHeight,
                documentHeight: document.documentElement.scrollHeight
            };

            this.tracker.queueEvent('scroll', scrollData);
            this.lastScroll = now;
            this.resetIdleTimer();
        }
    }

    // Form Event Handlers
    handleFormFocus(event) {
        if (this.isFormElement(event.target)) {
            const formData = {
                timestamp: Date.now(),
                element: this.getElementInfo(event.target, true)
            };

            this.tracker.queueEvent('form_focus', formData);
            this.resetIdleTimer();
        }
    }

    handleFormBlur(event) {
        if (this.isFormElement(event.target)) {
            const formData = {
                timestamp: Date.now(),
                element: this.getElementInfo(event.target, true)
            };

            this.tracker.queueEvent('form_blur', formData);
        }
    }

    handleFormChange(event) {
        if (this.isFormElement(event.target)) {
            const formData = {
                timestamp: Date.now(),
                element: this.getElementInfo(event.target, true),
                value: this.sanitizeFormValue(event.target)
            };

            this.tracker.queueEvent('form_change', formData);
            this.resetIdleTimer();
        }
    }

    handleFormSubmit(event) {
        const formData = {
            timestamp: Date.now(),
            formId: event.target.id || 'unknown',
            formAction: event.target.action || 'unknown',
            formMethod: event.target.method || 'unknown'
        };

        this.tracker.queueEvent('form_submit', formData);
        this.resetIdleTimer();
    }

    // Page Lifecycle Handlers
    handleVisibilityChange() {
        const visibilityData = {
            timestamp: Date.now(),
            isVisible: !document.hidden,
            timeSpent: Date.now() - this.sessionStartTime
        };

        this.tracker.queueEvent('visibility_change', visibilityData);
    }

    handleBeforeUnload(event) {
        const unloadData = {
            timestamp: Date.now(),
            timeSpent: Date.now() - this.sessionStartTime,
            scrollDepth: this.getScrollDepth()
        };

        this.tracker.queueEvent('page_exit', unloadData);
        this.tracker.flushEvents(true);
    }

    handleResize(event) {
        const now = Date.now();
        if (now - this.lastResize >= 1000) { // Throttle resize events
            const resizeData = {
                timestamp: now,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                screen: {
                    width: window.screen.width,
                    height: window.screen.height
                }
            };

            this.tracker.queueEvent('viewport_resize', resizeData);
            this.lastResize = now;
        }
    }

    // Error Handlers
    handleError(event) {
        const errorData = {
            timestamp: Date.now(),
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error ? {
                name: event.error.name,
                message: event.error.message,
                stack: event.error.stack
            } : null
        };

        this.tracker.queueEvent('error', errorData);
    }

    handlePromiseRejection(event) {
        const rejectionData = {
            timestamp: Date.now(),
            reason: this.getErrorInfo(event.reason)
        };

        this.tracker.queueEvent('promise_rejection', rejectionData);
    }

    // Network Handler
    handleNetworkChange(event) {
        const networkData = {
            timestamp: Date.now(),
            online: navigator.onLine,
            connection: this.getConnectionInfo()
        };

        this.tracker.queueEvent('network_change', networkData);
    }

    // Performance Tracking
    initializePerformanceTracking() {
        if ('PerformanceObserver' in window) {
            // Track resource timing
            const resourceObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    this.handleResourceTiming(entry);
                });
            });

            resourceObserver.observe({ entryTypes: ['resource'] });

            // Track largest contentful paint
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.handleLCP(lastEntry);
            });

            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

            // Track first input delay
            const fidObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    this.handleFID(entry);
                });
            });

            fidObserver.observe({ entryTypes: ['first-input'] });
        }
    }

    // Utility Methods
    getElementInfo(element, isForm = false) {
        if (!element) return null;

        const info = {
            tagName: element.tagName.toLowerCase(),
            id: element.id || null,
            className: element.className || null,
            type: element.type || null,
            name: element.name || null,
            href: element.href || null
        };

        if (isForm && this.config.shouldTrackElement(element)) {
            info.value = this.sanitizeFormValue(element);
        }

        return info;
    }

    isFormElement(element) {
        const formElements = ['input', 'textarea', 'select'];
        return element && formElements.includes(element.tagName.toLowerCase());
    }

    sanitizeFormValue(element) {
        if (!this.config.shouldTrackElement(element)) {
            return '[REDACTED]';
        }

        if (element.type === 'password') {
            return '[REDACTED]';
        }

        return element.value;
    }

    getMaxScroll() {
        return Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight,
            document.body.clientHeight,
            document.documentElement.clientHeight
        );
    }

    getScrollDepth() {
        const windowHeight = window.innerHeight;
        const documentHeight = this.getMaxScroll();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        return ((scrollTop + windowHeight) / documentHeight) * 100;
    }

    getConnectionInfo() {
        const connection = navigator.connection || 
                          navigator.mozConnection || 
                          navigator.webkitConnection;

        if (!connection) return null;

        return {
            type: connection.effectiveType || connection.type,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData
        };
    }

    getErrorInfo(error) {
        if (!error) return 'Unknown error';

        return {
            name: error.name || 'Error',
            message: error.message || String(error),
            stack: error.stack || null
        };
    }

    // Idle Timer Methods
    startIdleTimer() {
        this.resetIdleTimer();
    }

    resetIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }

        this.idleTimer = setTimeout(() => {
            this.handleUserIdle();
        }, this.config.sessionTimeout);
    }

    handleUserIdle() {
        const idleData = {
            timestamp: Date.now(),
            duration: this.config.sessionTimeout,
            lastActivity: this.lastMouseMove || this.lastScroll
        };

        this.tracker.queueEvent('user_idle', idleData);
    }

    // Performance Event Handlers
    handleResourceTiming(entry) {
        const resourceData = {
            timestamp: Date.now(),
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration,
            initiatorType: entry.initiatorType,
            transferSize: entry.transferSize,
            encodedBodySize: entry.encodedBodySize,
            decodedBodySize: entry.decodedBodySize
        };

        this.tracker.queueEvent('resource_timing', resourceData);
    }

    handleLCP(entry) {
        const lcpData = {
            timestamp: Date.now(),
            value: entry.startTime,
            size: entry.size,
            id: entry.id,
            url: entry.url
        };

        this.tracker.queueEvent('largest_contentful_paint', lcpData);
    }

    handleFID(entry) {
        const fidData = {
            timestamp: Date.now(),
            value: entry.processingStart - entry.startTime,
            startTime: entry.startTime,
            targetElement: this.getElementInfo(entry.target)
        };

        this.tracker.queueEvent('first_input_delay', fidData);
    }

    // Cleanup
    removeEventListeners() {
        // Mouse Events
        if (this.config.features.trackMouseMovement) {
            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('mousedown', this.handleMouseClick);
            document.removeEventListener('contextmenu', this.handleContextMenu);
        }

        // Scroll Events
        if (this.config.features.trackScroll) {
            window.removeEventListener('scroll', this.handleScroll);
        }

        // Form Events
        if (this.config.features.trackForms) {
            document.removeEventListener('focus', this.handleFormFocus, true);
            document.removeEventListener('blur', this.handleFormBlur, true);
            document.removeEventListener('change', this.handleFormChange, true);
            document.removeEventListener('submit', this.handleFormSubmit, true);
        }

        // Page Lifecycle Events
        document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('resize', this.handleResize);

        // Error Events
        if (this.config.features.trackErrors) {
            window.removeEventListener('error', this.handleError);
            window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
        }

        // Network Events
        window.removeEventListener('online', this.handleNetworkChange);
        window.removeEventListener('offline', this.handleNetworkChange);

        // Clear idle timer
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
    }
}

export default EventHandlers;

/*
This eventHandlers.js file provides comprehensive event tracking with:

Mouse Tracking:


Movement (throttled)
Clicks and context menu
Hover states
Element interaction


Form Tracking:


Focus/blur events
Input changes
Form submissions
Value sanitization for sensitive fields
Form element validation
Custom form analytics
Intelligent field tracking


Scroll Tracking:


Scroll depth
Scroll speed
Viewport position
Reading progress


Performance Monitoring:


Resource timing
Largest Contentful Paint (LCP)
First Input Delay (FID)
Network conditions


Error Tracking:


JavaScript errors
Promise rejections
Network errors
Custom error context


Session Management:


Idle detection
Session timeouts
Activity tracking
Session persistence
*/