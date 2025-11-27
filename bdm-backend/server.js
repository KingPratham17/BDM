const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const { testConnection } = require('./src/config/database');
const aiService = require('./src/services/aiService');
const documentRoutes = require('./src/routes/documentRoutes');
const clauseRoutes = require('./src/routes/clauseRoutes');
const templateRoutes = require('./src/routes/templateRoutes');
const pdfRoutes = require('./src/routes/pdfRoutes');
const translateRoutes = require('./src/routes/translateRoutes'); // <-- added

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000'],
  credentials: true
}));

// Keep body-parser for compatibility, but ensure reasonable limits
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'BDM Backend'
  });
});

// AI configuration endpoint
app.get('/ai-config', (req, res) => {
  const config = aiService.getAIConfig();
  res.json({
    success: true,
    ai_config: config
  });
});

// API Routes
app.use('/api/documents', documentRoutes);
app.use('/api/clauses', clauseRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/pdf', pdfRoutes);

// Mount translation routes (non-destructive, additive)
app.use('/api/translate', translateRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Business Document Management (BDM) API',
    version: '1.0.0',
    endpoints: {
      documents: '/api/documents',
      clauses: '/api/clauses',
      templates: '/api/templates',
      translate: '/api/translate',
      health: '/health'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    app.listen(PORT, () => {
      console.log('================================================');
      console.log(`🚀 BDM Backend Server running on port ${PORT}`);
      console.log(`📍 Base URL: http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API Docs: http://localhost:${PORT}/`);
      console.log('================================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
