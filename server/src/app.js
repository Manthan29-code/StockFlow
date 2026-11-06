const express = require('express');
const helmet = require('helmet');
const apiRoutes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security headers with helmet
app.use(helmet());

// JSON body parser with 20MB limit for backup/restore payloads
app.use(express.json({ limit: '20mb' }));

// Mount all API routes under /api
app.use('/api', apiRoutes);

// Health check also reachable at root /health for hosting environments
app.get('/health', (req, res) => res.json({ ok: true }));

// Global error handler
app.use(errorHandler);

module.exports = app;

