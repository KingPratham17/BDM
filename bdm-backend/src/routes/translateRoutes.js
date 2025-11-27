// src/routes/translateRoutes.js
const express = require('express');
const router = express.Router();
const { previewTranslate, confirmTranslate } = require('../controllers/translateController');

// POST /api/translate/preview
router.post('/preview', previewTranslate);

// POST /api/translate/confirm
router.post('/confirm', confirmTranslate);

module.exports = router;
