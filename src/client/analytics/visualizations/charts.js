import { LineChart, BarChart, PieChart, AreaChart } from 'recharts';

class ChartConfigurations {
    constructor() {
        this.colors = {
            primary: '#0088FE',
            secondary: '#00C49F',
            tertiary: '#FFBB28',
            quaternary: '#FF8042',
            error: '#FF0000',
            success: '#00FF00',
            warning: '#FFA500'
        };

        this.defaultConfig = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        };
    }

    // Traffic Overview Chart
    createTrafficChart(data) {
        return {
            ...this.defaultConfig,
            type: 'line',
            data: {
                labels: data.map(d => d.timestamp),
                datasets: [{
                    label: 'Page Views',
                    data: data.map(d => d.pageViews),
                    borderColor: this.colors.primary,
                    fill: false
                }, {
                    label: 'Unique Visitors',
                    data: data.map(d => d.uniqueVisitors),
                    borderColor: this.colors.secondary,
                    fill: false
                }]
            }
        };
    }

    // User Session Chart
    createSessionChart(data) {
        return {
            ...this.defaultConfig,
            type: 'bar',
            data: {
                labels: data.map(d => d.hour),
                datasets: [{
                    label: 'Active Sessions',
                    data: data.map(d => d.sessions),
                    backgroundColor: this.colors.primary
                }]
            }
        };
    }

    // User Behavior Flow Chart
    createBehaviorFlowChart(data) {
        return {
            ...this.defaultConfig,
            type: 'sankey',
            data: {
                datasets: [{
                    data: data,
                    colorFrom: this.colors.primary,
                    colorTo: this.colors.secondary
                }]
            }
        };
    }

    // Device Distribution Chart
    createDeviceChart(data) {
        return {
            ...this.defaultConfig,
            type: 'pie',
            data: {
                labels: data.map(d => d.device),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: Object.values(this.colors)
                }]
            }
        };
    }

    // Performance Metrics Chart
    createPerformanceChart(data) {
        return {
            ...this.defaultConfig,
            type: 'line',
            data: {
                labels: data.map(d => d.timestamp),
                datasets: [{
                    label: 'Page Load Time',
                    data: data.map(d => d.loadTime),
                    borderColor: this.colors.primary,
                    fill: false
                }, {
                    label: 'First Paint',
                    data: data.map(d => d.firstPaint),
                    borderColor: this.colors.secondary,
                    fill: false
                }]
            }
        };
    }

    // Error Rate Chart
    createErrorChart(data) {
        return {
            ...this.defaultConfig,
            type: 'line',
            data: {
                labels: data.map(d => d.timestamp),
                datasets: [{
                    label: 'Error Rate',
                    data: data.map(d => d.errorRate),
                    borderColor: this.colors.error,
                    fill: false
                }]
            }
        };
    }

    // User Interaction Heatmap
    createInteractionHeatmap(data) {
        return {
            ...this.defaultConfig,
            type: 'heatmap',
            data: {
                datasets: [{
                    data: data,
                    backgroundColor: context => {
                        const value = context.dataset.data[context.dataIndex];
                        return this.getHeatmapColor(value.intensity);
                    }
                }]
            }
        };
    }

    // Conversion Funnel Chart
    createFunnelChart(data) {
        return {
            ...this.defaultConfig,
            type: 'funnel',
            data: {
                labels: data.map(d => d.stage),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: Object.values(this.colors)
                }]
            }
        };
    }

    // Real-time Activity Chart
    createRealtimeChart(data) {
        return {
            ...this.defaultConfig,
            type: 'line',
            data: {
                labels: data.map(d => d.time),
                datasets: [{
                    label: 'Active Users',
                    data: data.map(d => d.activeUsers),
                    borderColor: this.colors.primary,
                    fill: true,
                    backgroundColor: `${this.colors.primary}33`
                }]
            },
            options: {
                ...this.defaultConfig,
                animation: {
                    duration: 0
                },
                scales: {
                    x: {
                        type: 'realtime',
                        realtime: {
                            duration: 20000,
                            refresh: 1000,
                            delay: 2000,
                            onRefresh: chart => {
                                chart.data.datasets.forEach(dataset => {
                                    dataset.data.push({
                                        x: Date.now(),
                                        y: Math.random() * 100
                                    });
                                });
                            }
                        }
                    }
                }
            }
        };
    }

    // Utility Methods
    getHeatmapColor(intensity) {
        const value = Math.min(Math.max(intensity, 0), 1);
        return `rgba(255, 0, 0, ${value})`;
    }

    formatTooltip(value, name, props) {
        return [`${value}`, name];
    }

    customLegendRenderer(entry) {
        return (
            <div className="custom-legend-item">
                <span style={{ backgroundColor: entry.color }}></span>
                {entry.value}
            </div>
        );
    }

    // Animation configurations
    getAnimationConfig(type) {
        switch (type) {
            case 'bounce':
                return {
                    duration: 1000,
                    easing: 'ease-in-out',
                    from: { opacity: 0, transform: 'scale(0.9)' },
                    to: { opacity: 1, transform: 'scale(1)' }
                };
            case 'fade':
                return {
                    duration: 1000,
                    easing: 'ease-in-out',
                    from: { opacity: 0 },
                    to: { opacity: 1 }
                };
            default:
                return this.defaultConfig.animation;
        }
    }
}

export default new ChartConfigurations();

/*
charts.js provides:


Configurable chart types (Line, Bar, Pie, Area)
Consistent styling and theming
Interactive features (tooltips, legends)
Animation configurations
Real-time update capabilities
*/