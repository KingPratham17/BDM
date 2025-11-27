// bdm-backend/src/controllers/pdfController.js

const pdfService = require('../services/pdfService');
const documentModel = require('../models/documentModel');
const responseHandler = require('../utils/responseHandler');
const fs = require('fs'); // <--- REQUIRED fs MODULE
const path = require('path'); // <--- REQUIRED path MODULE

class PDFController {

  // Generate PDF and return as buffer (Used internally by others)
  async generatePDF(req, res) {
    try {
      const { id } = req.params;
      console.log(`📄 Generating PDF for document ${id}...`);

      const document = await documentModel.findById(id);
      if (!document) {
        return responseHandler.notFound(res, 'Document not found');
      }

      const options = {
        companyName: req.query.companyName || 'Company Name',
        includeLogo: req.query.includeLogo === 'true'
      };

      const pdfBuffer = await pdfService.generatePDF(document, options);

      // Check buffer before sending
      if (!pdfBuffer || pdfBuffer.length === 0) {
        console.error(`❌ Empty PDF buffer generated for document ${id} in generatePDF.`);
        return responseHandler.serverError(res, 'Failed to generate PDF: Empty buffer returned.');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      // NOTE: No Content-Disposition here, caller decides (download vs inline)
      res.send(pdfBuffer);

    } catch (error) {
      console.error('PDF generation error:', error);
      return responseHandler.serverError(res, 'Failed to generate PDF', error);
    }
  }

  // Download PDF with custom filename
  async downloadPDF(req, res) {
    try {
      const { id } = req.params;
      const { filename } = req.query;
      console.log(`⬇️ Downloading PDF for document ${id}...`);

      const document = await documentModel.findById(id);
      if (!document) {
        return responseHandler.notFound(res, 'Document not found');
      }

      const options = {
        companyName: req.query.companyName || 'Company Name'
      };

      const pdfBuffer = await pdfService.generatePDF(document, options);

       // Check buffer before sending
       if (!pdfBuffer || pdfBuffer.length === 0) {
         console.error(`❌ Empty PDF buffer generated for download, doc ${id}.`);
         return responseHandler.serverError(res, 'Failed to download PDF: Generated empty buffer.');
       }

      const downloadFilename = filename || `${document.document_name || `document_${id}`}.pdf`; // Added fallback name

      res.setHeader('Content-Type', 'application/pdf');
      // Disposition 'attachment' forces download
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);
      console.log(`✅ PDF download initiated: ${downloadFilename}`);

    } catch (error) {
      console.error('PDF download error:', error);
      return responseHandler.serverError(res, 'Failed to download PDF', error);
    }
  }

  // Preview PDF in browser (with DEBUG file save)
  async previewPDF(req, res) {
    try {
      const { id } = req.params;
      console.log(`👁️ Generating PDF preview for document ${id}...`);

      const document = await documentModel.findById(id);
      if (!document) {
        return responseHandler.notFound(res, 'Document not found');
      }

      const options = {
        companyName: req.query.companyName || 'Company Name'
      };

      // Generate the PDF buffer (using the service with logging)
      const pdfBuffer = await pdfService.generatePDF(document, options);

      // --- TEMPORARY DEBUG: SAVE BUFFER TO FILE ---
      const debugFilePath = path.join(__dirname, `../../debug_preview_${id}_${Date.now()}.pdf`); // Save in backend root
      try {
        // Ensure buffer exists before writing
        if (pdfBuffer && pdfBuffer.length > 0) {
            fs.writeFileSync(debugFilePath, pdfBuffer);
            console.log(`💾 DEBUG: Saved preview PDF buffer (Length: ${pdfBuffer.length}) to: ${debugFilePath}`);
        } else {
            console.error(`❌ DEBUG: Cannot save empty PDF buffer for doc ${id}.`);
        }
      } catch (saveError) {
        console.error(`❌ DEBUG: Failed to save debug PDF file:`, saveError);
      }
      // --- END TEMPORARY DEBUG ---


      // Ensure buffer has content before sending
       if (!pdfBuffer || pdfBuffer.length === 0) {
           console.error(`❌ Attempted to send empty PDF buffer for preview, doc ${id}.`);
           return responseHandler.serverError(res, 'Failed to preview PDF: Generated empty buffer.');
       }


      // Set headers for inline display
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline'); // Crucial for preview
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF
      res.send(pdfBuffer);

    } catch (error) {
      console.error('PDF preview error:', error);
      // Ensure error details are logged before sending generic response
      return responseHandler.serverError(res, 'Failed to preview PDF', error);
    }
  }

  // Generate and save PDF to file system
  async generateAndSavePDF(req, res) {
    try {
      const { id } = req.params;
      console.log(`💾 Generating and saving PDF for document ${id}...`);

      const document = await documentModel.findById(id);
      if (!document) {
        return responseHandler.notFound(res, 'Document not found');
      }

      const options = {
        companyName: req.query.companyName || 'Company Name'
      };

      const pdfBuffer = await pdfService.generatePDF(document, options);

       // Check buffer before saving
       if (!pdfBuffer || pdfBuffer.length === 0) {
         console.error(`❌ Empty PDF buffer generated for save-to-file, doc ${id}.`);
         return responseHandler.serverError(res, 'Failed to generate and save PDF: Generated empty buffer.');
       }


      // Save to file system using the service function
      const filepath = await pdfService.savePDF(document, pdfBuffer);

      // Update document record with PDF path
      await documentModel.update(id, { pdf_path: filepath });

      return responseHandler.success(res, {
        document_id: id,
        pdf_path: filepath,
        // Provide download URL relative to API base
        pdf_url: `/api/pdf/documents/${id}/download`
      }, 'PDF generated and saved successfully');

    } catch (error) {
      console.error('PDF save error:', error);
      return responseHandler.serverError(res, 'Failed to generate and save PDF', error);
    }
  }

  // Bulk PDF generation
  async generateBulkPDFs(req, res) {
    try {
      const { document_ids } = req.body;
      if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
        return responseHandler.badRequest(res, 'document_ids array is required');
      }

      console.log(`📦 Generating ${document_ids.length} PDFs...`);
      const results = [];
      const errors = [];

      // Process sequentially to avoid overwhelming resources
      for (const docId of document_ids) {
        try {
          const document = await documentModel.findById(docId);
          if (!document) {
            errors.push({ document_id: docId, error: 'Document not found', status: 'failed' });
            continue;
          }

          const pdfBuffer = await pdfService.generatePDF(document);

          // Check buffer
           if (!pdfBuffer || pdfBuffer.length === 0) {
             console.error(`❌ Empty PDF buffer generated during bulk for doc ${docId}.`);
             throw new Error("Generated empty PDF buffer."); // Cause this iteration to fail
           }


          const filepath = await pdfService.savePDF(document, pdfBuffer);
          await documentModel.update(docId, { pdf_path: filepath });

          results.push({
            document_id: docId,
            document_name: document.document_name,
            pdf_path: filepath,
            status: 'success'
          });

        } catch (error) {
          console.error(`❌ Bulk PDF Error for doc ${docId}:`, error.message);
          errors.push({
            document_id: docId,
            error: error.message || 'Unknown generation error',
            status: 'failed'
          });
        }
      } // End loop

      return responseHandler.success(res, {
        total: document_ids.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      }, `Bulk PDF generation completed: ${results.length} successful, ${errors.length} failed`);

    } catch (error) {
      // Catch errors in the overall bulk process setup
      console.error('Overall Bulk PDF generation error:', error);
      return responseHandler.serverError(res, 'Bulk PDF generation failed', error);
    }
  }
}

module.exports = new PDFController();