const express = require('express');
const helmet = require('helmet');
const apiRoutes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security headers with helmet
app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS headers for desktop and web clients
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-version');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// JSON body parser with 20MB limit for backup/restore payloads
app.use(express.json({ limit: '20mb' }));

// Mount all API routes under /api
app.use('/api', apiRoutes);

// Health check also reachable at root /health for hosting environments
app.get('/health', (req, res) => res.json({ ok: true }));

// Global error handler
app.use(errorHandler);

module.exports = app;

