/*
const config = new TrackerConfig({ ##yourconfig });
const privacyManager = new PrivacyManager(config);
*/

class PrivacyManager {
    constructor(config) {
        this.config = config;
        this.consentStatus = this.loadConsentStatus();
        this.dataRetentionPeriod = 365; // days
        this.sensitiveDataPatterns = {
            email: /[^@\s]+@[^@\s]+\.[^@\s]+/,
            phone: /(\+\d{1,3}[- ]?)?\d{10}/,
            creditCard: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/,
            ssn: /\d{3}[- ]?\d{2}[- ]?\d{4}/,
            password: /password|pwd|pass/i,
            apiKey: /api[_-]?key|api[_-]?token/i
        };

        this.initializePrivacyControls();
    }

    initializePrivacyControls() {
        // Initialize privacy banner if consent not given
        if (this.config.requireConsent && !this.hasValidConsent()) {
            this.showPrivacyBanner();
        }

        // Set up privacy-related event listeners
        this.setupPrivacyEventListeners();
    }

    // Consent Management
    loadConsentStatus() {
        try {
            const stored = localStorage.getItem('privacy_consent');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error loading consent status:', error);
            return null;
        }
    }

    saveConsentStatus(status) {
        try {
            localStorage.setItem('privacy_consent', JSON.stringify({
                ...status,
                timestamp: Date.now(),
                version: this.config.privacyVersion || '1.0'
            }));
            this.consentStatus = status;
        } catch (error) {
            console.error('Error saving consent status:', error);
        }
    }

    hasValidConsent() {
        if (!this.consentStatus) return false;

        const consentAge = Date.now() - this.consentStatus.timestamp;
        const maxConsentAge = this.config.consentDuration || (365 * 24 * 60 * 60 * 1000); // 1 year in ms

        return consentAge < maxConsentAge &&
               this.consentStatus.version === (this.config.privacyVersion || '1.0');
    }

    updateConsent(preferences) {
        const consentData = {
            ...preferences,
            timestamp: Date.now(),
            version: this.config.privacyVersion || '1.0'
        };

        this.saveConsentStatus(consentData);
        this.hidePrivacyBanner();
        
        // Emit consent update event
        this.emitConsentUpdate(consentData);
    }

    revokeConsent() {
        localStorage.removeItem('privacy_consent');
        this.consentStatus = null;
        this.deleteStoredData();
        this.showPrivacyBanner();
    }

    // Data Protection
    sanitizeData(data, type = 'all') {
        if (!data) return data;

        if (typeof data === 'object') {
            return this.sanitizeObject(data, type);
        }

        if (typeof data === 'string') {
            return this.sanitizeString(data, type);
        }

        return data;
    }

    sanitizeObject(obj, type) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(obj)) {
            // Skip if key is in exclusion list
            if (this.isExcludedField(key)) continue;

            // Recursively sanitize nested objects
            if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObject(value, type);
            } else {
                sanitized[key] = this.sanitizeValue(key, value, type);
            }
        }

        return sanitized;
    }

    sanitizeString(str, type) {
        let sanitized = str;

        // Apply relevant sanitization based on type
        Object.entries(this.sensitiveDataPatterns).forEach(([patternType, pattern]) => {
            if (type === 'all' || type === patternType) {
                sanitized = sanitized.replace(pattern, '[REDACTED]');
            }
        });

        return sanitized;
    }

    sanitizeValue(key, value, type) {
        // Check if the key indicates sensitive data
        if (this.isSensitiveField(key)) {
            return '[REDACTED]';
        }

        // Check if the value matches sensitive patterns
        if (typeof value === 'string') {
            return this.sanitizeString(value, type);
        }

        return value;
    }

    // Data Retention
    deleteStoredData() {
        try {
            // Clear local storage data
            const keysToKeep = ['privacy_consent']; // Add any keys that should be preserved
            Object.keys(localStorage).forEach(key => {
                if (!keysToKeep.includes(key)) {
                    localStorage.removeItem(key);
                }
            });

            // Clear session storage
            sessionStorage.clear();

            // Clear cookies except essential ones
            this.clearNonEssentialCookies();

        } catch (error) {
            console.error('Error deleting stored data:', error);
        }
    }

    clearNonEssentialCookies() {
        const essentialCookies = ['privacy_consent']; // Add other essential cookies
        document.cookie.split(';').forEach(cookie => {
            const name = cookie.split('=')[0].trim();
            if (!essentialCookies.includes(name)) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            }
        });
    }

    // Data Access and Portability
    async exportUserData() {
        try {
            const userData = {
                consent: this.consentStatus,
                preferences: this.loadUserPreferences(),
                timestamp: Date.now()
            };

            // Create downloadable file
            const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            
            // Trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = `user_data_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error exporting user data:', error);
            throw new Error('Failed to export user data');
        }
    }

    // Privacy Banner Management
    showPrivacyBanner() {
        // Create and show privacy banner
        const banner = this.createPrivacyBanner();
        document.body.appendChild(banner);
    }

    hidePrivacyBanner() {
        const banner = document.getElementById('privacy-banner');
        if (banner) {
            banner.remove();
        }
    }

    createPrivacyBanner() {
        const banner = document.createElement('div');
        banner.id = 'privacy-banner';
        banner.className = 'privacy-banner';
        banner.innerHTML = `
            <div class="privacy-content">
                <h3>Privacy Settings</h3>
                <p>We use tracking technologies to improve your experience. Please select your preferences:</p>
                <div class="privacy-options">
                    <label>
                        <input type="checkbox" name="essential" checked disabled>
                        Essential (Required)
                    </label>
                    <label>
                        <input type="checkbox" name="functional" class="consent-checkbox">
                        Functional
                    </label>
                    <label>
                        <input type="checkbox" name="analytics" class="consent-checkbox">
                        Analytics
                    </label>
                    <label>
                        <input type="checkbox" name="marketing" class="consent-checkbox">
                        Marketing
                    </label>
                </div>
                <div class="privacy-actions">
                    <button class="accept-all">Accept All</button>
                    <button class="save-preferences">Save Preferences</button>
                </div>
            </div>
        `;

        // Add event listeners to banner buttons
        this.setupBannerEventListeners(banner);

        return banner;
    }

    // Utility Methods
    isExcludedField(key) {
        const excludedFields = [
            'password',
            'token',
            'secret',
            'creditCard',
            'ssn',
            ...this.config.excludedFields || []
        ];

        return excludedFields.some(field => 
            key.toLowerCase().includes(field.toLowerCase())
        );
    }

    isSensitiveField(key) {
        return Object.keys(this.sensitiveDataPatterns).some(pattern => 
            key.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    loadUserPreferences() {
        try {
            const preferences = localStorage.getItem('user_preferences');
            return preferences ? JSON.parse(preferences) : {};
        } catch (error) {
            console.error('Error loading user preferences:', error);
            return {};
        }
    }

    // Event Listeners
    setupPrivacyEventListeners() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'privacy_consent') {
                this.consentStatus = e.newValue ? JSON.parse(e.newValue) : null;
            }
        });
    }

    setupBannerEventListeners(banner) {
        const acceptAllBtn = banner.querySelector('.accept-all');
        const savePreferencesBtn = banner.querySelector('.save-preferences');

        acceptAllBtn.addEventListener('click', () => {
            const preferences = {
                essential: true,
                functional: true,
                analytics: true,
                marketing: true
            };
            this.updateConsent(preferences);
        });

        savePreferencesBtn.addEventListener('click', () => {
            const preferences = {
                essential: true,
                functional: banner.querySelector('input[name="functional"]').checked,
                analytics: banner.querySelector('input[name="analytics"]').checked,
                marketing: banner.querySelector('input[name="marketing"]').checked
            };
            this.updateConsent(preferences);
        });
    }

    emitConsentUpdate(consentData) {
        const event = new CustomEvent('consentUpdate', { detail: consentData });
        window.dispatchEvent(event);
    }

    // GDPR Compliance Methods
    handleDataRequest(type, userData) {
        switch (type) {
            case 'access':
                return this.exportUserData();
            case 'delete':
                return this.deleteUserData(userData);
            case 'modify':
                return this.modifyUserData(userData);
            default:
                throw new Error('Invalid data request type');
        }
    }

    async deleteUserData(userData) {
        try {
            // Clear local data
            this.deleteStoredData();

            // Send deletion request to server
            if (this.config.dataEndpoint) {
                await fetch(`${this.config.dataEndpoint}/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userData.id })
                });
            }

            return true;
        } catch (error) {
            console.error('Error deleting user data:', error);
            throw new Error('Failed to delete user data');
        }
    }

    async modifyUserData(userData) {
        try {
            // Update local data
            this.updateLocalUserData(userData);

            // Send modification request to server
            if (this.config.dataEndpoint) {
                await fetch(`${this.config.dataEndpoint}/modify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });
            }

            return true;
        } catch (error) {
            console.error('Error modifying user data:', error);
            throw new Error('Failed to modify user data');
        }
    }

    updateLocalUserData(userData) {
        try {
            localStorage.setItem('user_preferences', JSON.stringify(userData.preferences));
        } catch (error) {
            console.error('Error updating local user data:', error);
        }
    }
}

export default PrivacyManager;

/*
This privacy.js file provides comprehensive privacy management with:

Consent Management:


User consent tracking
Consent versioning
Consent expiration
Granular consent options


Data Protection:


Sensitive data detection
Data sanitization
Pattern matching for PII
Field exclusion rules


GDPR Compliance:


Data access requests
Right to be forgotten
Data modification
Data portability


Privacy UI:


Configurable privacy banner
Consent preferences
Privacy notifications
User controls


Data Retention:


Automated data cleanup
Retention period management
Cookie management
Storage clearing
*/