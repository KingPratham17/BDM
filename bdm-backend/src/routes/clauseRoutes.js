// bdm-backend/src/routes/clauseRoutes.js

const express = require('express');
const router = express.Router();
const clauseController = require('../controllers/clauseController');

// ============================================================
// IMPORTANT: Put specific routes BEFORE any dynamic :id routes
// ============================================================

// ==============================================
// MANUAL CLAUSE OPERATIONS
// ==============================================

// Get all clauses (filters supported)
router.get('/', clauseController.getAllClauses);

// Get clauses by category
router.get('/category/:category', clauseController.getClausesByCategory);

// ==============================================
// TASK 1: SAMPLE CLAUSE OPERATIONS
// ==============================================

// Get all sample clauses
router.get('/samples/all', clauseController.getAllSampleClauses);

// Clone a sample clause
router.post('/:id/clone', clauseController.cloneSampleClause);

// Mark/unmark clause as sample
router.patch('/:id/sample', clauseController.markAsSample);

// ==============================================
// TASK 2: CLAUSE MERGING OPERATIONS
// ==============================================

// Merge multiple clauses
router.post('/merge', clauseController.mergeClauses);

// Get merge history
router.get('/:id/merge-history', clauseController.getMergeHistory);

// ==============================================
// TASK 3: HTML CONTENT OPERATIONS
// ==============================================

// Update clause HTML content
router.patch('/:id/html', clauseController.updateHTMLContent);

// ==============================================
// AI-POWERED CLAUSE GENERATION
// ==============================================

// Generate multiple clauses with AI
router.post('/generate-ai', clauseController.generateClausesWithAI);

// Generate single clause with AI
router.post('/generate-single-ai', clauseController.generateSingleClauseWithAI);

// Save AI-generated clauses
router.post('/save-ai-generated', clauseController.saveAIGeneratedClauses);

// ==============================================
// CRUD MUST COME AFTER ALL SPECIAL ROUTES
// ==============================================

// Create clause manually
router.post('/manual', clauseController.createClauseManually);

// Get only merged clauses
router.get('/merged/all', async (req, res) => {
  try {
    const merged = await clauseModel.findAll({ is_merged: true });
    responseHandler.success(res, merged, "Merged clauses retrieved");
  } catch (err) {
    responseHandler.serverError(res, "Failed to load merged clauses", err);
  }
});


// Update clause
router.put('/:id', clauseController.updateClause);

// Delete clause
router.delete('/:id', clauseController.deleteClause);

// Get clause by ID (MUST BE LAST)
router.get('/:id', clauseController.getClauseById);

module.exports = router;
