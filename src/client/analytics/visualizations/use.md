import charts from './visualizations/charts.js';
import reports from './visualizations/reports.js';

// Generate a report
const analyticsData = await fetchAnalyticsData();
const report = await reports.generateAnalyticsReport(analyticsData, 'daily');

// Create visualizations
const trafficChart = charts.createTrafficChart(report.details.trafficSources);
const behaviorChart = charts.createBehaviorFlowChart(report.details.userBehavior);