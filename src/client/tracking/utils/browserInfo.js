/*
const browserInfo = new BrowserInfo();
const systemInfo = browserInfo.getBrowserData();
*/

class BrowserInfo {
    constructor() {
        this.userAgent = navigator.userAgent;
        this.platform = navigator.platform;
        this.vendor = navigator.vendor;
        this.language = navigator.language;
    }

    getBrowserData() {
        return {
            browser: this.detectBrowser(),
            operatingSystem: this.detectOS(),
            device: this.detectDevice(),
            screenInfo: this.getScreenInfo(),
            networkInfo: this.getNetworkInfo(),
            features: this.detectFeatures(),
            performance: this.getPerformanceMetrics()
        };
    }

    detectBrowser() {
        const ua = this.userAgent.toLowerCase();
        let browser = {
            name: 'unknown',
            version: 'unknown',
            engine: 'unknown'
        };

        // Detect browser name
        if (ua.includes('firefox')) {
            browser.name = 'Firefox';
            browser.engine = 'Gecko';
        } else if (ua.includes('edg')) {
            browser.name = 'Edge';
            browser.engine = 'EdgeHTML/Blink';
        } else if (ua.includes('chrome')) {
            browser.name = 'Chrome';
            browser.engine = 'Blink';
        } else if (ua.includes('safari') && !ua.includes('chrome')) {
            browser.name = 'Safari';
            browser.engine = 'WebKit';
        } else if (ua.includes('opr') || ua.includes('opera')) {
            browser.name = 'Opera';
            browser.engine = 'Blink';
        }

        // Extract version
        const matches = this.userAgent.match(/(firefox|edge|chrome|safari|opera|opr)\/?\s*(\d+(\.\d+)*)/i);
        if (matches && matches[2]) {
            browser.version = matches[2];
        }

        return browser;
    }

    detectOS() {
        const ua = this.userAgent.toLowerCase();
        const platform = this.platform.toLowerCase();
        
        let os = {
            name: 'unknown',
            version: 'unknown',
            architecture: 'unknown'
        };

        // Detect OS name and version
        if (ua.includes('win')) {
            os.name = 'Windows';
            if (ua.includes('windows nt 10.0')) os.version = '10';
            else if (ua.includes('windows nt 6.3')) os.version = '8.1';
            else if (ua.includes('windows nt 6.2')) os.version = '8';
            else if (ua.includes('windows nt 6.1')) os.version = '7';
        } else if (ua.includes('mac')) {
            os.name = 'macOS';
            const matches = ua.match(/mac os x (\d+[._]\d+[._]\d+)/);
            if (matches) os.version = matches[1].replace(/_/g, '.');
        } else if (ua.includes('linux')) {
            os.name = 'Linux';
            if (ua.includes('android')) {
                os.name = 'Android';
                const matches = ua.match(/android (\d+(\.\d+)*)/);
                if (matches) os.version = matches[1];
            }
        } else if (ua.includes('ios')) {
            os.name = 'iOS';
            const matches = ua.match(/os (\d+[._]\d+[._]\d+)/);
            if (matches) os.version = matches[1].replace(/_/g, '.');
        }

        // Detect architecture
        if (platform.includes('win64') || platform.includes('wow64')) os.architecture = 'x64';
        else if (platform.includes('win32')) os.architecture = 'x86';
        else if (platform.includes('arm')) os.architecture = 'ARM';

        return os;
    }

    detectDevice() {
        const ua = this.userAgent.toLowerCase();
        
        let device = {
            type: 'desktop',
            model: 'unknown',
            orientation: window.screen.orientation?.type || 'unknown'
        };

        // Detect device type
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
            device.type = 'tablet';
        } else if (/mobile|ip(hone|od)|android|blackberry|opera mini|opera mobi/i.test(ua)) {
            device.type = 'mobile';
        }

        // Detect specific models
        if (ua.includes('iphone')) device.model = 'iPhone';
        else if (ua.includes('ipad')) device.model = 'iPad';
        else if (ua.includes('pixel')) device.model = 'Google Pixel';
        else if (ua.includes('samsung')) device.model = 'Samsung Galaxy';

        return device;
    }

    getScreenInfo() {
        return {
            width: window.screen.width,
            height: window.screen.height,
            availWidth: window.screen.availWidth,
            availHeight: window.screen.availHeight,
            colorDepth: window.screen.colorDepth,
            pixelRatio: window.devicePixelRatio,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            touchPoints: navigator.maxTouchPoints || 0
        };
    }

    getNetworkInfo() {
        const connection = navigator.connection || 
                          navigator.mozConnection || 
                          navigator.webkitConnection;

        let networkInfo = {
            onLine: navigator.onLine,
            connectionType: 'unknown',
            effectiveType: 'unknown',
            downlink: null,
            rtt: null
        };

        if (connection) {
            networkInfo.connectionType = connection.type || 'unknown';
            networkInfo.effectiveType = connection.effectiveType || 'unknown';
            networkInfo.downlink = connection.downlink;
            networkInfo.rtt = connection.rtt;
        }

        return networkInfo;
    }

    detectFeatures() {
        return {
            cookies: navigator.cookieEnabled,
            localStorage: this.isLocalStorageAvailable(),
            sessionStorage: this.isSessionStorageAvailable(),
            serviceWorker: 'serviceWorker' in navigator,
            webGL: this.isWebGLAvailable(),
            webRTC: this.isWebRTCAvailable(),
            canvas: this.isCanvasAvailable(),
            audio: this.isAudioAvailable(),
            video: this.isVideoAvailable(),
            geolocation: 'geolocation' in navigator,
            bluetooth: 'bluetooth' in navigator,
            touchscreen: 'ontouchstart' in window
        };
    }

    getPerformanceMetrics() {
        const performance = window.performance;
        
        if (!performance) {
            return null;
        }

        const timing = performance.timing;
        const navigation = performance.navigation;

        return {
            timing: {
                loadTime: timing.loadEventEnd - timing.navigationStart,
                domReadyTime: timing.domComplete - timing.domLoading,
                readyStart: timing.fetchStart - timing.navigationStart,
                redirectTime: timing.redirectEnd - timing.redirectStart,
                appcacheTime: timing.domainLookupStart - timing.fetchStart,
                unloadEventTime: timing.unloadEventEnd - timing.unloadEventStart,
                lookupDomainTime: timing.domainLookupEnd - timing.domainLookupStart,
                connectTime: timing.connectEnd - timing.connectStart,
                requestTime: timing.responseEnd - timing.requestStart,
                initDomTreeTime: timing.domInteractive - timing.responseEnd,
                loadEventTime: timing.loadEventEnd - timing.loadEventStart
            },
            navigation: {
                type: this.getNavigationType(navigation.type),
                redirectCount: navigation.redirectCount
            },
            memory: this.getMemoryInfo()
        };
    }

    // Helper methods
    isLocalStorageAvailable() {
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return true;
        } catch (e) {
            return false;
        }
    }

    isSessionStorageAvailable() {
        try {
            sessionStorage.setItem('test', 'test');
            sessionStorage.removeItem('test');
            return true;
        } catch (e) {
            return false;
        }
    }

    isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                    (canvas.getContext('webgl') || 
                     canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    isWebRTCAvailable() {
        return !!(window.RTCPeerConnection || 
                 window.mozRTCPeerConnection || 
                 window.webkitRTCPeerConnection);
    }

    isCanvasAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext && canvas.getContext('2d'));
        } catch (e) {
            return false;
        }
    }

    isAudioAvailable() {
        return !!(window.AudioContext || window.webkitAudioContext);
    }

    isVideoAvailable() {
        return !!document.createElement('video').canPlayType;
    }

    getNavigationType(type) {
        const types = {
            0: 'navigate',
            1: 'reload',
            2: 'back_forward',
            255: 'prerender'
        };
        return types[type] || 'unknown';
    }

    getMemoryInfo() {
        if (performance.memory) {
            return {
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                usedJSHeapSize: performance.memory.usedJSHeapSize
            };
        }
        return null;
    }
}

export default BrowserInfo;

/*
This browserInfo.js utility file provides comprehensive browser and system detection with:

Browser Detection:


Browser name and version
Rendering engine
Vendor information


Operating System Detection:


OS name and version
Architecture (32/64 bit, ARM)
Platform details


Device Information:


Device type (desktop/mobile/tablet)
Model detection
Screen orientation
Touch capabilities


Screen Information:


Resolution and available space
Color depth
Pixel ratio
Viewport dimensions


Network Information:


Connection type
Network speed
RTT (Round Trip Time)
Online status


Feature Detection:


Storage availability
API support (WebGL, WebRTC, etc.)
Hardware capabilities
Media support


Performance Metrics:


Page load timings
Navigation information
Memory usage
DOM processing times
*/