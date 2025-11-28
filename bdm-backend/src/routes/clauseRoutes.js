// bdm-backend/src/routes/clauseRoutes.js
const express = require('express');
const router = express.Router();
const clauseController = require('../controllers/clauseController');

/* ========================================
   MERGE ROUTES (Must be before :id routes)
======================================== */
router.post('/merge', clauseController.mergeClauses);
router.get('/merged/all', clauseController.getMergedClauses);

/* ========================================
   SAMPLE CLAUSE ROUTES
======================================== */
router.get('/samples', clauseController.getAllSamples);
router.post('/:id/mark-sample', clauseController.markAsSample);
router.post('/:id/clone-sample', clauseController.cloneSampleClause);

/* ========================================
   AI GENERATION ROUTES
======================================== */
router.post('/generate-ai', clauseController.generateClausesWithAI);
router.post('/generate-single-ai', clauseController.generateSingleClauseWithAI);
router.post('/save-ai-generated', clauseController.saveAIGeneratedClauses);

/* ========================================
   BASIC CRUD ROUTES
======================================== */
router.get('/', clauseController.getAllClauses);
router.get('/category/:category', clauseController.getClausesByCategory);
router.get('/:id', clauseController.getClauseById);
router.post('/manual', clauseController.createClauseManually);
router.put('/:id', clauseController.updateClause);
router.delete('/:id', clauseController.deleteClause);

module.exports = router;