/*
import db from './config/database.js';
await db.connect();
*/

import mongoose from 'mongoose';
import { config } from './environment.js';

const dbConfig = {
    // Main database configuration
    main: {
        uri: config.mongoUri || 'mongodb://localhost:27017/analytics_tracker',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 100,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4,
            keepAlive: true,
            keepAliveInitialDelay: 300000,
            autoIndex: process.env.NODE_ENV !== 'production'
        }
    },

    // Replica set configuration
    replicaSet: {
        enabled: config.useReplicaSet || false,
        name: config.replicaSetName || 'rs0',
        nodes: config.replicaNodes || ['localhost:27017', 'localhost:27018', 'localhost:27019']
    },

    // Connection pooling settings
    pool: {
        maxPoolSize: config.dbMaxPoolSize || 100,
        minPoolSize: config.dbMinPoolSize || 5,
        maxIdleTimeMS: 30000,
        waitQueueTimeoutMS: 10000
    },

    // Retry settings
    retry: {
        maxAttempts: 5,
        initialDelayMS: 1000,
        maxDelayMS: 30000,
        factor: 2
    },

    // Collection settings
    collections: {
        tracking: {
            name: 'tracking_events',
            maxSize: 5368709120, // 5GB
            maxDocuments: 10000000
        },
        analytics: {
            name: 'analytics_data',
            maxSize: 2147483648  // 2GB
        },
        sessions: {
            name: 'user_sessions',
            maxSize: 1073741824  // 1GB
        }
    },

    // Index settings
    indexes: {
        tracking: [
            { fields: { timestamp: -1 } },
            { fields: { userId: 1, timestamp: -1 } },
            { fields: { eventType: 1, timestamp: -1 } }
        ],
        analytics: [
            { fields: { date: -1 } },
            { fields: { metric: 1, date: -1 } }
        ],
        sessions: [
            { fields: { userId: 1, startTime: -1 } },
            { fields: { status: 1, lastActivity: -1 } }
        ]
    }
};

// Connection management
class DatabaseManager {
    constructor() {
        this.connection = null;
        this.retryCount = 0;
    }

    async connect() {
        try {
            const options = {
                ...dbConfig.main.options,
                maxPoolSize: dbConfig.pool.maxPoolSize,
                minPoolSize: dbConfig.pool.minPoolSize
            };

            if (dbConfig.replicaSet.enabled) {
                options.replicaSet = dbConfig.replicaSet.name;
            }

            this.connection = await mongoose.connect(dbConfig.main.uri, options);
            console.log('Connected to MongoDB successfully');
            this.retryCount = 0;
            
            // Setup connection event handlers
            this.setupEventHandlers();
            
            return this.connection;
        } catch (error) {
            console.error('MongoDB connection error:', error);
            return this.handleConnectionError(error);
        }
    }

    setupEventHandlers() {
        mongoose.connection.on('error', this.handleConnectionError.bind(this));
        mongoose.connection.on('disconnected', this.handleDisconnect.bind(this));
        mongoose.connection.on('reconnected', () => {
            console.log('Reconnected to MongoDB');
        });

        // Handle process termination
        process.on('SIGINT', this.gracefulShutdown.bind(this));
        process.on('SIGTERM', this.gracefulShutdown.bind(this));
    }

    async handleConnectionError(error) {
        if (this.retryCount < dbConfig.retry.maxAttempts) {
            this.retryCount++;
            const delay = Math.min(
                dbConfig.retry.initialDelayMS * Math.pow(dbConfig.retry.factor, this.retryCount - 1),
                dbConfig.retry.maxDelayMS
            );

            console.log(`Retrying connection in ${delay}ms... (Attempt ${this.retryCount}/${dbConfig.retry.maxAttempts})`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.connect();
        }

        throw new Error(`Failed to connect to MongoDB after ${dbConfig.retry.maxAttempts} attempts`);
    }

    async handleDisconnect() {
        console.log('MongoDB disconnected');
        if (this.retryCount < dbConfig.retry.maxAttempts) {
            return this.connect();
        }
    }

    async gracefulShutdown() {
        try {
            await mongoose.connection.close();
            console.log('MongoDB connection closed through app termination');
            process.exit(0);
        } catch (error) {
            console.error('Error during graceful shutdown:', error);
            process.exit(1);
        }
    }

    // Utility methods for database operations
    async createIndexes() {
        try {
            for (const [collectionName, indexes] of Object.entries(dbConfig.indexes)) {
                const collection = this.connection.collection(dbConfig.collections[collectionName].name);
                await Promise.all(indexes.map(index => collection.createIndex(index.fields)));
            }
            console.log('Database indexes created successfully');
        } catch (error) {
            console.error('Error creating indexes:', error);
            throw error;
        }
    }

    async validateCollections() {
        try {
            for (const [name, settings] of Object.entries(dbConfig.collections)) {
                await this.connection.db.createCollection(settings.name, {
                    capped: Boolean(settings.maxSize),
                    size: settings.maxSize,
                    max: settings.maxDocuments
                });
            }
            console.log('Collections validated successfully');
        } catch (error) {
            console.error('Error validating collections:', error);
            throw error;
        }
    }

    getCollectionName(type) {
        return dbConfig.collections[type]?.name;
    }
}

// Export singleton instance
export default new DatabaseManager();

/*
database.js provides:


MongoDB connection configuration
Connection pooling settings
Retry logic and error handling
Collection management
Index creation
Graceful shutdown handling
Replica set support
Validation utilities
*/