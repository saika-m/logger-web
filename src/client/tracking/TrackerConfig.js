// Consent Management Helper Class
class ConsentManager {
    constructor(requireConsent) {
        this.requireConsent = requireConsent;
        this.consentStatus = this.loadConsentStatus();
    }

    loadConsentStatus() {
        const stored = localStorage.getItem('tracking_consent');
        return stored ? JSON.parse(stored) : null;
    }

    saveConsentStatus(status) {
        localStorage.setItem('tracking_consent', JSON.stringify(status));
        this.consentStatus = status;
    }

    hasConsent(dataType) {
        if (!this.requireConsent) return true;
        return this.consentStatus && this.consentStatus[dataType];
    }

    updateConsent(dataTypes) {
        this.saveConsentStatus(dataTypes);
    }

    revokeConsent() {
        localStorage.removeItem('tracking_consent');
        this.consentStatus = null;
    }
}

class TrackerConfig {
    constructor(options = {}) {
        // Default configuration
        this.config = {
            // Endpoint Configuration
            endpoint: options.endpoint || '/api/tracking',
            apiVersion: options.apiVersion || 'v1',
            
            // Session Configuration
            sessionTimeout: options.sessionTimeout || 30 * 60 * 1000, // 30 minutes
            sessionExtendOnActivity: options.sessionExtendOnActivity ?? true,
            
            // Batch Processing Configuration
            batchSize: options.batchSize || 10,
            flushInterval: options.flushInterval || 5000, // 5 seconds
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000, // 1 second
            
            // Privacy and Consent Settings
            requireConsent: options.requireConsent ?? true,
            allowedDataTypes: options.allowedDataTypes || [
                'basic', 'behavior', 'performance'
            ],
            dataDeletionEndpoint: options.dataDeletionEndpoint || '/api/user/data',
            
            // Feature Flags
            features: {
                trackClicks: options.trackClicks ?? true,
                trackScroll: options.trackScroll ?? true,
                trackMouseMovement: options.trackMouseMovement ?? true,
                trackForms: options.trackForms ?? true,
                trackErrors: options.trackErrors ?? true,
                trackPerformance: options.trackPerformance ?? true,
                useBeacon: options.useBeacon ?? true,
            },
            
            // Performance Settings
            mouseMoveThrottle: options.mouseMoveThrottle || 1000,
            scrollThrottle: options.scrollThrottle || 1000,
            maxEventsPerPage: options.maxEventsPerPage || 1000,
            
            // Data Sanitization Rules
            sanitization: {
                excludeElements: options.excludeElements || ['password', 'credit-card'],
                excludeSelectors: options.excludeSelectors || ['.private', '[data-private]'],
                maskCharacter: options.maskCharacter || '●',
            },
            
            // Debug Settings
            debug: options.debug ?? false,
            verboseLogging: options.verboseLogging ?? false,
            
            // Custom Event Settings
            customEvents: options.customEvents || {},
            
            // Storage Configuration
            storageType: options.storageType || 'localStorage',
            storageDuration: options.storageDuration || 365, // days
            
            // Rate Limiting
            rateLimit: {
                enabled: options.rateLimitEnabled ?? true,
                maxRequests: options.maxRequests || 100,
                timeWindow: options.timeWindow || 60000, // 1 minute
            }
        };
        
        // Initialize storage
        this.initializeStorage();
        
        // Set up consent management
        this.consentManager = new ConsentManager(this.config.requireConsent);
    }

    initializeStorage() {
        this.storage = {
            get: (key) => {
                try {
                    if (this.config.storageType === 'localStorage') {
                        return JSON.parse(localStorage.getItem(key));
                    }
                    return JSON.parse(sessionStorage.getItem(key));
                } catch (e) {
                    this.logError('Storage get error', e);
                    return null;
                }
            },
            set: (key, value) => {
                try {
                    const serialized = JSON.stringify(value);
                    if (this.config.storageType === 'localStorage') {
                        localStorage.setItem(key, serialized);
                    } else {
                        sessionStorage.setItem(key, serialized);
                    }
                } catch (e) {
                    this.logError('Storage set error', e);
                }
            },
            remove: (key) => {
                try {
                    if (this.config.storageType === 'localStorage') {
                        localStorage.removeItem(key);
                    } else {
                        sessionStorage.removeItem(key);
                    }
                } catch (e) {
                    this.logError('Storage remove error', e);
                }
            }
        };
    }

    // Public Methods
    getConfig() {
        return this.config;
    }

    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig,
            features: {
                ...this.config.features,
                ...newConfig.features
            },
            sanitization: {
                ...this.config.sanitization,
                ...newConfig.sanitization
            },
            rateLimit: {
                ...this.config.rateLimit,
                ...newConfig.rateLimit
            }
        };
    }

    isFeatureEnabled(featureName) {
        return this.config.features[featureName] ?? false;
    }

    shouldTrackElement(element) {
        if (!element) return false;

        // Check against excluded elements
        if (this.config.sanitization.excludeElements.includes(element.type)) {
            return false;
        }

        // Check against excluded selectors
        return !this.config.sanitization.excludeSelectors.some(selector => 
            element.matches(selector)
        );
    }

    getConsentStatus(dataType) {
        return this.consentManager.hasConsent(dataType);
    }

    updateConsent(dataTypes) {
        this.consentManager.updateConsent(dataTypes);
    }

    revokeConsent() {
        this.consentManager.revokeConsent();
    }

    logError(message, error) {
        if (this.config.debug) {
            console.error(`[Tracker Config] ${message}:`, error);
        }
    }

    logDebug(message, data) {
        if (this.config.debug && this.config.verboseLogging) {
            console.log(`[Tracker Config] ${message}:`, data);
        }
    }
}

export default TrackerConfig;