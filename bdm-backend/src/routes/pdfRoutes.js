const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');

// Generate PDF (returns PDF buffer)
router.get('/documents/:id/pdf', pdfController.generatePDF);

// Download PDF with custom filename
router.get('/documents/:id/download', pdfController.downloadPDF);

// Preview PDF in browser
router.get('/documents/:id/preview', pdfController.previewPDF);

// Generate and save PDF to file system
router.post('/documents/:id/generate-save', pdfController.generateAndSavePDF);

// Bulk PDF generation
router.post('/bulk-generate', pdfController.generateBulkPDFs);

module.exports = router;