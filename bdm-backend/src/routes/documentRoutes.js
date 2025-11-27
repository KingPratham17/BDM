// bdm-backend/src/routes/documentRoutes.js
const express = require('express');
const router = express.Router();

const documentController = require('../controllers/documentController');
const translateController = require('../controllers/translateController');

// small helper: returns a fallback handler that responds 501 and logs the missing name
function ensureHandler(fn, name) {
  if (typeof fn === 'function') return fn;
  console.warn(`⚠️ Route handler missing: ${name}. Using fallback 501 responder.`);
  return (req, res) => {
    res.status(501).json({
      success: false,
      error: `Handler "${name}" not implemented on server. Check controllers/${name} export.`
    });
  };
}

// Use ensureHandler when wiring routes so server doesn't crash if a function is missing
router.post('/generate-document', ensureHandler(documentController.generateDocument, 'documentController.generateDocument'));
router.get('/', ensureHandler(documentController.getAllDocuments, 'documentController.getAllDocuments'));
router.get('/:id', ensureHandler(documentController.getDocumentById, 'documentController.getDocumentById'));

// Get assembled document content (plain or translated)
router.get('/:id/content', ensureHandler(documentController.getDocumentContent, 'documentController.getDocumentContent')); // ?lang=es

// Translate preview for document (can accept text body or assemble from document id)
router.post('/:id/translate-preview', ensureHandler(translateController.previewTranslate, 'translateController.previewTranslate'));

// Confirm a translation preview (persist)
router.post('/translate-confirm', ensureHandler(translateController.confirmTranslate, 'translateController.confirmTranslate'));

// Generate PDF (single language or bilingual)
// If your documentController doesn't implement documentGeneratePdf, this will return 501 instead of crashing the server
router.post('/:id/generate-pdf', ensureHandler(documentController.documentGeneratePdf, 'documentController.documentGeneratePdf'));

// Update document
router.put('/:id', ensureHandler(documentController.updateDocument, 'documentController.updateDocument'));

// Delete document
router.delete('/:id', ensureHandler(documentController.deleteDocument, 'documentController.deleteDocument'));


module.exports = router;
