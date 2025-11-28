// bdm-backend/src/routes/documentRoutes.js
const express = require('express');
const router = express.Router();

const documentController = require('../controllers/documentController');
const translateController = require('../controllers/translateController');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

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

/* ---------------------------------------------------------
   🔥 IMPORTANT: STATIC ROUTES FIRST (NO :id ABOVE THESE)
--------------------------------------------------------- */

// Bulk Excel generation (TEMPLATE BASED)
router.post(
  '/bulk-generate-from-excel',
  upload.single('file'),
  ensureHandler(documentController.bulkGenerateFromExcel, 'documentController.bulkGenerateFromExcel')
);

// AI Bulk Excel generation (AI GENERATED DOCUMENTS)
router.post(
  '/ai-bulk-generate-from-excel',
  upload.single('file'),
  ensureHandler(documentController.aiBulkGenerateFromExcel, 'documentController.aiBulkGenerateFromExcel')
);

/* ---------------------------------------------------------
   📄 DOCUMENT ROUTES
--------------------------------------------------------- */

// Create document from template or AI-filled content
router.post(
  '/generate-document',
  ensureHandler(documentController.generateDocument, 'documentController.generateDocument')
);

// Fetch all documents
router.get(
  '/',
  ensureHandler(documentController.getAllDocuments, 'documentController.getAllDocuments')
);

/* ---------------------------------------------------------
   ❗ KEEP /:id ROUTES LAST (they catch everything)
--------------------------------------------------------- */

// Get document by ID
router.get(
  '/:id',
  ensureHandler(documentController.getDocumentById, 'documentController.getDocumentById')
);

// Get content of document (original or translation)
router.get(
  '/:id/content',
  ensureHandler(documentController.getDocumentContent, 'documentController.getDocumentContent')
);

// Request translation preview
router.post(
  '/:id/translate-preview',
  ensureHandler(translateController.previewTranslate, 'translateController.previewTranslate')
);

// Confirm translation
router.post(
  '/translate-confirm',
  ensureHandler(translateController.confirmTranslate, 'translateController.confirmTranslate')
);

// Generate PDF
router.post(
  '/:id/generate-pdf',
  ensureHandler(documentController.documentGeneratePdf, 'documentController.documentGeneratePdf')
);

// Update document
router.put(
  '/:id',
  ensureHandler(documentController.updateDocument, 'documentController.updateDocument')
);

// Delete document
router.delete(
  '/:id',
  ensureHandler(documentController.deleteDocument, 'documentController.deleteDocument')
);

module.exports = router;
