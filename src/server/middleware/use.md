import { auth, authorizeApiKey } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';

// Apply authentication
app.use('/api', auth);

// Apply rate limiting
app.use('/api', rateLimitMiddleware.api);
app.use('/api/analytics', rateLimitMiddleware.analytics);

// Apply both
app.use('/api/protected', 
    auth, 
    authorizeApiKey, 
    rateLimitMiddleware.api
);