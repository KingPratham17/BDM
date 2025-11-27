// bdm-backend/src/controllers/documentController.js

const aiService = require('../services/aiService');
const clauseModel = require('../models/clauseModel');
const templateModel = require('../models/templateModel');
const documentModel = require('../models/documentModel');
const responseHandler = require('../utils/responseHandler');

// Helper function to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

class DocumentController {

  // Generate or save a document based on input
  async generateDocument(req, res) {
    try {
      const { document_type, context, document_name, template_id, content_json } = req.body;

      console.log('--- ENTERING generateDocument ---');
      console.log('Request Metadata:', { 
        has_template_id: !!template_id, 
        has_content_json: !!content_json, 
        doc_type: document_type, 
        name: document_name 
      });

      // PATH 1: Save pre-filled content (e.g., from AI Step 2)
      if (content_json && typeof content_json === 'object' && Array.isArray(content_json.clauses) && !template_id) {
        console.log('✅✅✅ EXECUTING PATH 1: Direct content_json save');

        if (!document_name || !document_type) {
          console.error('❌ Path 1 Error: Missing document_name or document_type.');
          return responseHandler.badRequest(res, 'Invalid input for direct save: document_name and document_type required.');
        }

        console.log(`💾 Saving document "${document_name}" directly from provided content_json...`);
        const document = await documentModel.create({
          template_id: null,
          document_name: document_name,
          document_type: document_type,
          content_json: content_json,
          variables: context || {}
        });

        console.log(`✅ Path 1: Document ${document.id} saved directly.`);
        await documentModel.logAIGeneration({
          request_type: 'ai_document_step2_save',
          prompt: `Saving pre-filled ${document_type} document`,
          response_data: {
            clauses_count: content_json.clauses.length,
            document_id: document.id
          },
          tokens_used: 0
        });

        return responseHandler.created(res, { document }, 'Document created successfully from provided content');
      }

      // PATH 2: Use an existing template
      else if (template_id) {
        console.log(`✅✅✅ EXECUTING PATH 2: Using template ID: ${template_id}`);

        const template = await templateModel.findById(template_id);
        if (!template) {
          console.error(`❌ Path 2 Error: Template not found for ID: ${template_id}`);
          return responseHandler.notFound(res, 'Template not found');
        }

        let filledContent = { clauses: template.clauses || [] };
        if (context && Object.keys(context).length > 0 && Array.isArray(template.clauses)) {
          console.log('✏️ Filling template clauses with context...');
          filledContent.clauses = template.clauses.map(clause => {
            let clauseText = String(clause?.content || '');
            Object.keys(context).forEach(placeholder => {
              const value = context[placeholder] || `[${placeholder}]`;
              const escapedPlaceholder = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              clauseText = clauseText.replace(new RegExp(`\\[${escapedPlaceholder}\\]`, 'g'), value);
            });
            return {...clause, content: clauseText};
          });
          console.log('✅ Template clauses filled on backend.');
        } else {
          console.log('No context provided or template has no clauses, using raw template content.');
        }

        console.log(`💾 Saving document generated from template ${template_id}...`);
        const document = await documentModel.create({
          template_id: template.id,
          document_name: document_name || `${template.template_name}_${Date.now()}`,
          document_type: template.document_type,
          content_json: filledContent,
          variables: context || {}
        });

        console.log(`✅ Path 2: Document ${document.id} saved from template.`);
        return responseHandler.created(res, { document, template }, 'Document generated from template successfully');
      }

      // PATH 3: Generate everything from scratch
      else {
        console.log(`✅✅✅ EXECUTING PATH 3: Fallback - Generate from scratch via AI`);
        if (!document_type) {
          console.error('❌ Path 3 Error: document_type is missing.');
          return responseHandler.badRequest(res, 'document_type is required for AI generation from scratch.');
        }

        console.log(`🧬 Generating clauses via AI for: ${document_type}...`);
        const clausesResult = await aiService.generateClauses(document_type, context || {});
        if (!clausesResult.success || !Array.isArray(clausesResult.clauses) || clausesResult.clauses.length === 0) {
          console.error('❌ Path 3 Error: AI failed to generate clauses:', clausesResult.error);
          return responseHandler.error(res, `Failed to generate clauses via AI: ${clausesResult.error || 'Unknown AI error'}`, 500);
        }
        console.log(`👍 Path 3: AI generated ${clausesResult.clauses.length} clauses.`);

        let finalAiContent = { clauses: clausesResult.clauses };
        if (context && Object.keys(context).length > 0) {
          console.log('✏️ Path 3: Post-AI filling based on context...');
          finalAiContent.clauses = clausesResult.clauses.map(clause => {
            let clauseText = String(clause?.content || '');
            Object.keys(context).forEach(placeholder => {
              const value = context[placeholder] || `[${placeholder}]`;
              const escapedPlaceholder = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              clauseText = clauseText.replace(new RegExp(`\\[${escapedPlaceholder}\\]`, 'g'), value);
            });
            return {...clause, content: clauseText};
          });
          console.log('✅ Path 3: Clauses filled post-AI generation.');
        }

        console.log('💾 Path 3: Saving document generated fully by AI...');
        const document = await documentModel.create({
          template_id: null,
          document_name: document_name || `${document_type}_AI_${Date.now()}`,
          document_type: document_type,
          content_json: finalAiContent,
          variables: context || {}
        });

        await documentModel.logAIGeneration({
          request_type: 'direct_ai_document',
          prompt: `Generate ${document_type} document from scratch` + (context ? ' with context' : ''),
          response_data: {
            clauses_count: clausesResult.clauses.length,
            document_id: document.id
          },
          tokens_used: clausesResult.tokensUsed || 0
        });
        console.log(`✅ Path 3: Document ${document.id} saved.`);
        return responseHandler.created(res, { document, clauses: finalAiContent.clauses }, 'Document generated fully by AI successfully');
      }

    } catch (error) {
      console.error('❌ Unexpected error in generateDocument:', error);
      return responseHandler.serverError(res, 'Failed to generate document due to an internal error', error);
    }
  }

  // Get all documents
  async getAllDocuments(req, res) {
    try {
      const { document_type } = req.query;
      const filters = {};
      if (document_type) filters.document_type = document_type;
      const documents = await documentModel.findAll(filters);
      return responseHandler.success(res, documents);
    } catch (error) {
      console.error("Error fetching all documents:", error);
      return responseHandler.serverError(res, 'Failed to fetch documents', error);
    }
  }

  // Get assembled document content (plain text) or a confirmed translation
  async getDocumentContent(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return responseHandler.badRequest(res, 'Invalid document id');

      const { lang = 'en' } = req.query;

      const document = await documentModel.findById(id);
      if (!document) return responseHandler.notFound(res, 'Document not found');

      // Assemble English text from content_json.clauses
      let englishText = '';
      if (document.content_json && Array.isArray(document.content_json.clauses)) {
        englishText = document.content_json.clauses.map(c => String(c.content || '')).join('\n\n');
      } else if (document.content_json && typeof document.content_json === 'string') {
        englishText = document.content_json;
      } else {
        englishText = document.document_name || '';
      }

      if (lang === 'en') {
        return responseHandler.success(res, { text: englishText });
      }

      // For other languages: look up confirmed translation
      const { pool } = require('../config/database');

      const [rows] = await pool.execute(
        `SELECT content, status FROM translations
         WHERE original_id = ? AND original_type = ? AND lang = ? AND status = 'confirmed'
         ORDER BY updated_at DESC LIMIT 1`,
        [id, 'document', lang]
      );

      if (rows && rows.length > 0) {
        return responseHandler.success(res, { 
          text: rows[0].content, 
          lang, 
          source: 'translation' 
        });
      }

      return responseHandler.success(res, { 
        text: englishText, 
        lang, 
        source: 'original', 
        translation_available: false 
      });
    } catch (err) {
      console.error('Error in getDocumentContent:', err);
      return responseHandler.serverError(res, 'Failed to fetch document content', err);
    }
  }

  // Generate PDF (single language or bilingual)
  async documentGeneratePdf(req, res) {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (!documentId) return responseHandler.badRequest(res, 'Invalid document id');

      const { lang = 'en', translationId = null, filename = null } = req.body;

      // Load the document
      const document = await documentModel.findById(documentId);
      if (!document) return responseHandler.notFound(res, 'Document not found');

      // Helper to assemble English text
      const assembleEnglish = (doc) => {
        const cj = doc.content_json;
        if (cj && Array.isArray(cj.clauses)) {
          return cj.clauses.map(c => String(c.content || '')).join('\n\n');
        }
        if (typeof cj === 'string') return cj;
        return doc.document_name || '';
      };

      // Single English PDF
      if (lang === 'en') {
        const pdfBuf = await require('../services/pdfService').generatePDF(document);
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename || `document_${documentId}_en.pdf`}"`,
          'Content-Length': pdfBuf.length
        });
        return res.send(pdfBuf);
      }

      // Single translated PDF (non-bilingual)
      if (lang !== 'both') {
        let translated = null;
        if (translationId) {
          const tRows = await documentModel._rawQuery(
            `SELECT content FROM translations WHERE id = ?`, 
            [translationId]
          );
          if (tRows && tRows.length) translated = tRows[0].content;
        }
        if (!translated) {
          const tByDoc = await documentModel._rawQuery(
            `SELECT content FROM translations 
             WHERE original_type='document' AND original_id=? AND lang=? AND status='confirmed' 
             ORDER BY updated_at DESC LIMIT 1`,
            [documentId, lang]
          );
          if (tByDoc && tByDoc.length) translated = tByDoc[0].content;
        }
        if (!translated) {
          return responseHandler.badRequest(res, 'No confirmed translation found. Preview and confirm first.');
        }

        const translatedDoc = {
          ...document,
          content_json: { clauses: [{ content: translated, clause_type: 'translated' }] }
        };
        const pdfBuf = await require('../services/pdfService').generatePDF(translatedDoc);
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename || `document_${documentId}_${lang}.pdf`}"`,
          'Content-Length': pdfBuf.length
        });
        return res.send(pdfBuf);
      }

      // BILINGUAL PDF
      let translated = null;
      if (translationId) {
        const tRows = await documentModel._rawQuery(
          `SELECT content, lang FROM translations WHERE id = ?`, 
          [translationId]
        );
        if (tRows && tRows.length) translated = tRows[0].content;
      }
      if (!translated) {
        const tByDoc = await documentModel._rawQuery(
          `SELECT content, lang FROM translations 
           WHERE original_type='document' AND original_id=? AND status='confirmed' 
           ORDER BY updated_at DESC LIMIT 1`,
          [documentId]
        );
        if (tByDoc && tByDoc.length) translated = tByDoc[0].content;
      }
      if (!translated) {
        return responseHandler.badRequest(res, 'No confirmed translation available for bilingual PDF');
      }

      const englishText = assembleEnglish(document);

      const html = `
        <html><head>
          <meta charset="utf-8" />
          <style>
            body{font-family: Arial, Helvetica, sans-serif;padding:20px}
            .two-col{display:flex;gap:20px}
            .col{flex:1;border:1px solid #eee;padding:16px}
            h4{margin-top:0}
            pre{white-space:pre-wrap;font-family:inherit}
          </style>
        </head>
        <body>
          <h3>Document ${documentId} – Bilingual</h3>
          <div class="two-col">
            <div class="col"><h4>English (Original)</h4><pre>${escapeHtml(englishText)}</pre></div>
            <div class="col"><h4>Translated</h4><pre>${escapeHtml(translated)}</pre></div>
          </div>
        </body></html>
      `;

      const pdfBuf = await require('../services/pdfService').generateFromHtml(html, {
        displayHeaderFooter: false
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename || `document_${documentId}_bilingual.pdf`}"`,
        'Content-Length': pdfBuf.length
      });
      return res.send(pdfBuf);

    } catch (err) {
      console.error('documentGeneratePdf error', err);
      return responseHandler.serverError(res, 'PDF generation failed', err);
    }
  }

  // Get document by ID
  async getDocumentById(req, res) {
    try {
      const { id } = req.params;
      const document = await documentModel.findById(id);
      if (!document) {
        return responseHandler.notFound(res, 'Document not found');
      }
      return responseHandler.success(res, document);
    } catch (error) {
      console.error(`Error fetching document by ID ${req.params.id}:`, error);
      return responseHandler.serverError(res, 'Failed to fetch document', error);
    }
  }

  // Update document
  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const document = await documentModel.update(id, updateData);
      if (!document) {
        return responseHandler.notFound(res, 'Document not found');
      }
      return responseHandler.success(res, document, 'Document updated successfully');
    } catch (error) {
      console.error(`Error updating document ${req.params.id}:`, error);
      return responseHandler.serverError(res, 'Failed to update document', error);
    }
  }

  // Delete document
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      console.log(`🗑️ Attempting to delete document ID: ${id}`);
      const deleted = await documentModel.delete(id);
      if (!deleted) {
        console.warn(`⚠️ Document ID ${id} not found for deletion.`);
        return responseHandler.notFound(res, 'Document not found or already deleted');
      }
      console.log(`✅ Document ID ${id} deleted successfully.`);
      return responseHandler.success(res, null, 'Document deleted successfully');
    } catch (error) {
      console.error(`❌ Error deleting document ${req.params.id}:`, error);
      return responseHandler.serverError(res, 'Failed to delete document', error);
    }
  }
}

module.exports = new DocumentController();