const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');

// Get all templates
router.get('/', templateController.getAllTemplates);

// Get template by ID
router.get('/:id', templateController.getTemplateById);

// Get templates by document type
router.get('/document-type/:document_type', templateController.getTemplatesByDocumentType);

// Create new template (manual)
router.post('/', templateController.createTemplate);

// Save template (after AI generation)
router.post('/save-template', templateController.saveTemplate);

// Update template
router.put('/:id', templateController.updateTemplate);

// Delete template
router.delete('/:id', templateController.deleteTemplate);

// Add clause to template
router.post('/:id/add-clause', templateController.addClause);

// Remove clause from template
router.delete('/:id/remove-clause/:clause_id', templateController.removeClause);

// Generate AI-powered template
router.post('/generate-ai-template', templateController.generateAITemplate);
router.post('/generate-ai-complete', templateController.generateCompleteTemplateWithAI);
module.exports = router;