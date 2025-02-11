(() => {
    'use strict';

    // Initialize tracker
    const tracker = new UserTracker({
        endpoint: '/api/tracking',
        batchSize: 10,
        flushInterval: 5000
    });

    // Dashboard functionality
    class Dashboard {
        constructor() {
            this.timeRange = '7d';
            this.charts = {};
            this.metrics = {};
            this.initialize();
        }

        async initialize() {
            this.setupEventListeners();
            await this.loadDashboardData();
            this.startRealTimeUpdates();
        }

        setupEventListeners() {
            // Time range selector
            const rangeSelector = document.getElementById('dateRangePicker');
            if (rangeSelector) {
                rangeSelector.addEventListener('change', (e) => {
                    this.timeRange = e.target.value;
                    this.loadDashboardData();
                });
            }

            // Add responsive handlers
            window.addEventListener('resize', this.handleResize.bind(this));
        }

        async loadDashboardData() {
            try {
                this.showLoading();
                const data = await this.fetchDashboardData();
                this.updateDashboard(data);
                this.hideLoading();
            } catch (error) {
                console.error('Error loading dashboard data:', error);
                this.showError('Failed to load dashboard data');
            }
        }

        async fetchDashboardData() {
            const response = await fetch(`/api/analytics/dashboard?range=${this.timeRange}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch dashboard data');
            }

            return response.json();
        }

        updateDashboard(data) {
            this.updateMetrics(data);
            this.updateCharts(data);
            this.updateTables(data);
        }

        updateMetrics({ pageViews, userSessions }) {
            // Update summary metrics
            this.updateMetric('totalVisitors', pageViews.reduce((sum, pv) => sum + pv.uniqueUsers, 0));
            this.updateMetric('activeSessions', userSessions[userSessions.length - 1].sessions);
            this.updateMetric('avgSessionDuration', this.calculateAverageSessionDuration(userSessions));
            this.updateMetric('bounceRate', this.calculateBounceRate(pageViews));
        }

        updateCharts(data) {
            // Traffic Overview Chart
            this.updateTrafficChart(data.pageViews);
            
            // User Behavior Chart
            this.updateBehaviorChart(data.interactions);
            
            // Device Distribution Chart
            this.updateDeviceChart(data.devices);
            
            // Performance Chart
            this.updatePerformanceChart(data.performance);
        }

        updateTrafficChart(pageViews) {
            const ctx = document.getElementById('trafficChart');
            if (!ctx) return;

            if (this.charts.traffic) {
                this.charts.traffic.destroy();
            }

            this.charts.traffic = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: pageViews.map(pv => pv.date),
                    datasets: [{
                        label: 'Page Views',
                        data: pageViews.map(pv => pv.views),
                        borderColor: '#0088FE',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        updateBehaviorChart(interactions) {
            const ctx = document.getElementById('behaviorChart');
            if (!ctx) return;

            if (this.charts.behavior) {
                this.charts.behavior.destroy();
            }

            this.charts.behavior = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: interactions.map(i => i.type),
                    datasets: [{
                        data: interactions.map(i => i.count),
                        backgroundColor: ['#0088FE', '#00C49F', '#FFBB28']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        updateDeviceChart(devices) {
            const ctx = document.getElementById('deviceChart');
            if (!ctx) return;

            if (this.charts.devices) {
                this.charts.devices.destroy();
            }

            this.charts.devices = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: devices.map(d => d.type),
                    datasets: [{
                        data: devices.map(d => d.count),
                        backgroundColor: ['#0088FE', '#00C49F', '#FFBB28']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        updatePerformanceChart(performance) {
            const ctx = document.getElementById('performanceChart');
            if (!ctx) return;

            if (this.charts.performance) {
                this.charts.performance.destroy();
            }

            this.charts.performance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: performance.map(p => p.timestamp),
                    datasets: [{
                        label: 'Load Time',
                        data: performance.map(p => p.loadTime),
                        borderColor: '#0088FE',
                        tension: 0.4
                    }, {
                        label: 'First Paint',
                        data: performance.map(p => p.fcp),
                        borderColor: '#00C49F',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        startRealTimeUpdates() {
            setInterval(async () => {
                try {
                    const realTimeData = await this.fetchRealTimeData();
                    this.updateRealTimeMetrics(realTimeData);
                } catch (error) {
                    console.error('Error updating real-time data:', error);
                }
            }, 5000);
        }

        async fetchRealTimeData() {
            const response = await fetch('/api/analytics/realtime', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch real-time data');
            }

            return response.json();
        }

        updateRealTimeMetrics(data) {
            const realtimeContainer = document.getElementById('realtimeActivity');
            if (!realtimeContainer) return;

            const events = data.slice(0, 5).map(event => {
                return `
                    <div class="realtime-event">
                        <span class="event-type">${event.eventType}</span>
                        <span class="event-count">${event.count}</span>
                        <span class="event-time">${this.formatTime(event.minute)}</span>
                    </div>
                `;
            }).join('');

            realtimeContainer.innerHTML = `
                <div class="realtime-events">${events}</div>
            `;
        }

        // Utility Methods
        formatTime(timestamp) {
            return new Date(timestamp).toLocaleTimeString();
        }

        calculateAverageSessionDuration(sessions) {
            if (!sessions.length) return 0;
            const totalDuration = sessions.reduce((sum, session) => sum + (session.avgDuration || 0), 0);
            return Math.round(totalDuration / sessions.length);
        }

        calculateBounceRate(pageViews) {
            if (!pageViews.length) return 0;
            const bounces = pageViews.filter(pv => pv.bounced).length;
            return ((bounces / pageViews.length) * 100).toFixed(1);
        }

        updateMetric(id, value) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = this.formatMetricValue(id, value);
            }
        }

        formatMetricValue(metricId, value) {
            switch (metricId) {
                case 'bounceRate':
                    return `${value}%`;
                case 'avgSessionDuration':
                    return this.formatDuration(value);
                case 'totalVisitors':
                case 'activeSessions':
                    return value.toLocaleString();
                default:
                    return value;
            }
        }

        formatDuration(milliseconds) {
            const seconds = Math.floor(milliseconds / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);

            if (hours > 0) {
                return `${hours}h ${minutes % 60}m`;
            } else if (minutes > 0) {
                return `${minutes}m ${seconds % 60}s`;
            } else {
                return `${seconds}s`;
            }
        }

        handleResize() {
            Object.values(this.charts).forEach(chart => {
                if (chart && chart.resize) {
                    chart.resize();
                }
            });
        }

        showLoading() {
            const loader = document.getElementById('loading');
            if (loader) {
                loader.classList.add('active');
            }
        }

        hideLoading() {
            const loader = document.getElementById('loading');
            if (loader) {
                loader.classList.remove('active');
            }
        }

        showError(message) {
            // Implement error notification
            console.error(message);
        }

        getAuthToken() {
            return localStorage.getItem('authToken') || '';
        }
    }

    // Export for global use
    window.Dashboard = Dashboard;
    window.tracker = tracker;

    // Initialize dashboard when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        new Dashboard();
    });
})();

/*
bundle.js:


Tracking initialization
Dashboard functionality
Real-time updates
Chart management
Data formatting
Event handling
Error handling
*/