import { config } from '../config/environment.js';

class MetricsCollector {
    constructor() {
        this.metrics = new Map();
        this.startTime = Date.now();
        this.lastResetTime = this.startTime;
    }

    // Capture a metric with optional tags
    captureMetric(name, value = 1, tags = {}) {
        const metricKey = this.getMetricKey(name, tags);
        
        if (!this.metrics.has(metricKey)) {
            this.metrics.set(metricKey, {
                count: 0,
                sum: 0,
                min: Number.MAX_VALUE,
                max: Number.MIN_VALUE,
                lastUpdate: Date.now(),
                tags
            });
        }

        const metric = this.metrics.get(metricKey);
        metric.count++;
        metric.sum += value;
        metric.min = Math.min(metric.min, value);
        metric.max = Math.max(metric.max, value);
        metric.lastUpdate = Date.now();
    }

    // Get a specific metric
    getMetric(name, tags = {}) {
        const metricKey = this.getMetricKey(name, tags);
        const metric = this.metrics.get(metricKey);
        
        if (!metric) {
            return null;
        }

        return {
            ...metric,
            average: metric.count > 0 ? metric.sum / metric.count : 0
        };
    }

    // Get all metrics
    getAllMetrics() {
        const result = {};
        for (const [key, metric] of this.metrics.entries()) {
            result[key] = {
                ...metric,
                average: metric.count > 0 ? metric.sum / metric.count : 0
            };
        }
        return result;
    }

    // Reset metrics
    resetMetrics() {
        this.metrics.clear();
        this.lastResetTime = Date.now();
    }

    // Get uptime
    getUptime() {
        return Date.now() - this.startTime;
    }

    // Private helper method to generate metric key
    getMetricKey(name, tags) {
        const tagString = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}:${value}`)
            .join(',');
        return tagString ? `${name}[${tagString}]` : name;
    }
}

// Create singleton instance
const metricsCollector = new MetricsCollector();

// Export metric capture function
export const captureMetrics = (name, value = 1, tags = {}) => {
    metricsCollector.captureMetric(name, value, tags);
};

// Capture HTTP request metrics
export const captureRequestMetrics = (req, res, next) => {
    const startTime = Date.now();
    
    // Capture response metrics when the response is finished
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        const tags = {
            method: req.method,
            path: req.route?.path || req.path,
            status: res.statusCode,
            statusClass: Math.floor(res.statusCode / 100) + 'xx'
        };

        // Capture various metrics
        captureMetrics('http_requests_total', 1, tags);
        captureMetrics('http_request_duration_ms', duration, tags);
        
        // Capture status-code-specific metrics
        captureMetrics(`http_response_status_${res.statusCode}`, 1);

        // If it's an error response, capture error metrics
        if (res.statusCode >= 400) {
            captureMetrics('http_errors_total', 1, {
                ...tags,
                errorType: res.statusCode >= 500 ? 'server' : 'client'
            });
        }
    });

    next();
};

// System metrics collection
export const captureSystemMetrics = () => {
    // Memory usage
    const memoryUsage = process.memoryUsage();
    captureMetrics('memory_usage_bytes', memoryUsage.heapUsed, { type: 'heap' });
    captureMetrics('memory_usage_bytes', memoryUsage.heapTotal, { type: 'heapTotal' });
    captureMetrics('memory_usage_bytes', memoryUsage.rss, { type: 'rss' });
    
    // CPU usage (simple metric)
    const cpuUsage = process.cpuUsage();
    captureMetrics('cpu_usage_microseconds', cpuUsage.user, { type: 'user' });
    captureMetrics('cpu_usage_microseconds', cpuUsage.system, { type: 'system' });
};

// Database metrics collection
export const captureDatabaseMetrics = (operation, duration, success = true) => {
    captureMetrics('database_operations_total', 1, { operation, success });
    captureMetrics('database_operation_duration_ms', duration, { operation });
};

// Cache metrics collection
export const captureCacheMetrics = (operation, hit = true) => {
    captureMetrics('cache_operations_total', 1, { operation });
    captureMetrics('cache_hits_total', hit ? 1 : 0);
    captureMetrics('cache_misses_total', hit ? 0 : 1);
};

// Export metrics getter functions
export const getMetrics = (name, tags = {}) => metricsCollector.getMetric(name, tags);
export const getAllMetrics = () => metricsCollector.getAllMetrics();
export const getUptime = () => metricsCollector.getUptime();
export const resetMetrics = () => metricsCollector.resetMetrics();

// Start periodic system metrics collection
if (config.monitoring?.enableMetrics) {
    setInterval(captureSystemMetrics, 60000); // Every minute
}

// Export collector for testing
export const collector = metricsCollector;

/*
This metrics utility provides:

General Metrics Collection:


Counter metrics
Timing metrics
Tagged metrics
Metric aggregation


HTTP Metrics:


Request counts
Response times
Status codes
Error rates


System Metrics:


Memory usage
CPU usage
Uptime tracking
Resource monitoring


Specialized Metrics:


Database operations
Cache performance
Custom metrics
*/