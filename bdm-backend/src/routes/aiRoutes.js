// src/routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Primary summarization route
router.post('/', aiController.handleAIRequest);

// Optional aliases (helpful while debugging frontend path issues)
router.post('/summarize', aiController.handleAIRequest);

module.exports = router;
