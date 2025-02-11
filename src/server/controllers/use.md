import trackingController from './controllers/trackingController.js';
import analyticsController from './controllers/analyticsController.js';

// In your routes
router.post('/track', trackingController.trackEvents);
router.get('/dashboard', analyticsController.getDashboardData);