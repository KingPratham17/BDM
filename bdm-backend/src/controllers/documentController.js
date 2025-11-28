// bdm-backend/src/controllers/documentController.js

const aiService = require('../services/aiService');
const clauseModel = require('../models/clauseModel');
const templateModel = require('../models/templateModel');
const documentModel = require('../models/documentModel');
const responseHandler = require('../utils/responseHandler');
const xlsx = require('xlsx');
const JSZip = require('jszip');
const pdfService = require('../services/pdfService');

// For translations
const { pool } = require('../config/database');

/* ---------------------------------------------------------
                    HELPER FUNCTIONS
--------------------------------------------------------- */

// Escape HTML for safe embedding
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

// Extract placeholders from template
function extractPlaceholdersFromTemplate(template) {
  const placeholders = new Set();
  if (template && Array.isArray(template.clauses)) {
    template.clauses.forEach(clause => {
      if (clause && typeof clause.content === 'string') {
        const matches = clause.content.match(/\[([^\]]+)\]/g);
        if (matches) {
          matches.forEach(m => {
            const name = m.substring(1, m.length - 1).trim();
            if (name) placeholders.add(name);
          });
        }
      }
    });
  }
  return Array.from(placeholders);
}

// Normalize keys - used for Excel mapping
function normalizeKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Clean type name for filenames
function buildTemplateBaseName(template) {
  let base = template?.template_name || template?.document_type || 'Document';
  base = String(base).replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
  if (!base) base = 'Document';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// Get best possible name from placeholders
function getPrimaryIdentifier(context) {
  if (!context || typeof context !== 'object') return null;

  const normMap = {};
  Object.entries(context).forEach(([key, value]) => {
    const nk = normalizeKey(key);
    if (!normMap[nk] && value != null && String(value).trim() !== '') {
      normMap[nk] = value;
    }
  });

  const preferredKeys = [
    'employee_name',
    'full_name',
    'name',
    'candidate_name',
    'recipient_name',
    'party_name',
    'vendor_name',
    'customer_name'
  ];

  for (const k of preferredKeys) {
    if (normMap[k]) return normMap[k];
  }

  for (const val of Object.values(context)) {
    if (val != null && String(val).trim() !== '') {
      return val;
    }
  }

  return null;
}

function cleanForFilename(str) {
  return String(str || '').replace(/[^a-zA-Z0-9]/g, '');
}

/* ---------------------------------------------------------
                      CONTROLLER CLASS
--------------------------------------------------------- */

class DocumentController {

  /* ---------------------------------------------------------
      1. GENERATE SINGLE DOCUMENT (TEMPLATE / DIRECT / AI)
  --------------------------------------------------------- */
  async generateDocument(req, res) {
    try {
      const { document_type, context, document_name, template_id, content_json } = req.body;

      // PATH 1 — Direct content save
      if (content_json && Array.isArray(content_json.clauses) && !template_id) {
        if (!document_name || !document_type) {
          return responseHandler.badRequest(res, 'document_name and document_type are required');
        }

        const document = await documentModel.create({
          template_id: null,
          document_name,
          document_type,
          content_json,
          variables: context || {}
        });

        return responseHandler.created(res, { document }, 'Document created successfully');
      }

      // PATH 2 — Generate from template
      if (template_id) {
        const template = await templateModel.findById(template_id);
        if (!template) {
          return responseHandler.notFound(res, 'Template not found');
        }

        let filledContent = { clauses: template.clauses || [] };

        if (context && Array.isArray(template.clauses)) {
          filledContent.clauses = template.clauses.map(clause => {
            let clauseText = String(clause?.content || '');
            Object.keys(context).forEach(placeholder => {
              const value = context[placeholder] || `[${placeholder}]`;
              const escaped = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              clauseText = clauseText.replace(new RegExp(`\\[${escaped}\\]`, 'g'), value);
            });
            return { ...clause, content: clauseText };
          });
        }

        const finalName = document_name || `${template.template_name}_${Date.now()}`;

        const document = await documentModel.create({
          template_id: template.id,
          document_name: finalName,
          document_type: template.document_type,
          content_json: filledContent,
          variables: context || {}
        });

        return responseHandler.created(res, { document, template }, 'Document generated from template');
      }

      // PATH 3 — Full AI generation
      if (!document_type) {
        return responseHandler.badRequest(res, 'document_type is required for AI generation');
      }

      const aiResult = await aiService.generateClauses(document_type, context || {});
      if (!aiResult.success || !Array.isArray(aiResult.clauses)) {
        return responseHandler.error(res, aiResult.error || 'AI failed', 500);
      }

      let finalContent = { clauses: aiResult.clauses };

      if (context && Object.keys(context).length > 0) {
        finalContent.clauses = aiResult.clauses.map(clause => {
          let text = String(clause?.content || '');
          Object.keys(context).forEach(placeholder => {
            const value = context[placeholder] || `[${placeholder}]`;
            const escaped = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            text = text.replace(new RegExp(`\\[${escaped}\\]`, 'g'), value);
          });
          return { ...clause, content: text };
        });
      }

      const finalDocName = document_name || `${document_type}_AI_${Date.now()}`;

      const document = await documentModel.create({
        template_id: null,
        document_name: finalDocName,
        document_type,
        content_json: finalContent,
        variables: context || {}
      });

      return responseHandler.created(res, { document, clauses: finalContent.clauses }, 'AI Document created');

    } catch (err) {
      console.error('generateDocument error:', err);
      return responseHandler.serverError(res, 'Failed to generate document', err);
    }
  }

  /* ---------------------------------------------------------
      2. BULK GENERATE FROM EXCEL (TEMPLATE BASED)
  --------------------------------------------------------- */
  async bulkGenerateFromExcel(req, res) {
    try {
      const { template_id } = req.body;
      const file = req.file;

      if (!template_id) {
        return responseHandler.badRequest(res, 'template_id is required');
      }
      if (!file || !file.buffer) {
        return responseHandler.badRequest(res, 'Excel file is required (field name: "file")');
      }

      const template = await templateModel.findById(template_id);
      if (!template) {
        return responseHandler.notFound(res, 'Template not found');
      }

      const placeholders = extractPlaceholdersFromTemplate(template);

      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

      if (!rows.length) {
        return responseHandler.badRequest(res, 'Uploaded Excel sheet is empty');
      }

      const excelHeadersRaw = Object.keys(rows[0]);
      const excelHeadersNorm = excelHeadersRaw.map(normalizeKey);

      const missing = placeholders.filter(ph => {
        const normPh = normalizeKey(ph);
        return !excelHeadersRaw.includes(ph) && !excelHeadersNorm.includes(normPh);
      });

      if (missing.length > 0) {
        return responseHandler.error(
          res,
          `Excel does not contain columns for: ${missing.join(', ')}`,
          400
        );
      }

      const zip = new JSZip();
      const templateBase = buildTemplateBaseName(template);

      let rowIndex = 0;

      for (const row of rows) {
        rowIndex++;

        const normHeaderMap = {};
        for (const [key, value] of Object.entries(row)) {
          const nk = normalizeKey(key);
          if (!normHeaderMap[nk]) normHeaderMap[nk] = value;
        }

        const context = {};
        placeholders.forEach(ph => {
          const normPh = normalizeKey(ph);
          let value = row[ph];
          if (value === undefined) value = normHeaderMap[normPh];
          context[ph] = value ?? '';
        });

        const emptyFields = placeholders.filter(
          ph => !context[ph] || String(context[ph]).trim() === ''
        );
        if (emptyFields.length) {
          return responseHandler.error(
            res,
            `Row ${rowIndex} missing values for: ${emptyFields.join(', ')}`,
            400
          );
        }

        const identifier = getPrimaryIdentifier(context);
        if (!identifier) {
          return responseHandler.error(
            res,
            `Row ${rowIndex}: No valid identifier for filename`,
            400
          );
        }

        const cleanId = cleanForFilename(identifier);
        const fileName = `${templateBase}_${cleanId}`;

        let filledContent = { clauses: template.clauses || [] };

        filledContent.clauses = template.clauses.map(clause => {
          let text = clause.content;
          Object.keys(context).forEach(ph => {
            const escaped = ph.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            text = text.replace(new RegExp(`\\[${escaped}\\]`, 'g'), context[ph]);
          });
          return { ...clause, content: text };
        });

        const document = await documentModel.create({
          template_id: template.id,
          document_name: fileName,
          document_type: template.document_type,
          content_json: filledContent,
          variables: context
        });

        const pdfBuffer = await pdfService.generatePDF(document);
        if (!pdfBuffer) {
          return responseHandler.serverError(res, `PDF generation failed at row ${rowIndex}`);
        }

        zip.file(`${fileName}.pdf`, pdfBuffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="bulk_documents_${Date.now()}.zip"`
      });

      return res.end(zipBuffer);

    } catch (err) {
      console.error('❌ bulkGenerateFromExcel error:', err);
      return responseHandler.serverError(res, 'Bulk Excel failed', err);
    }
  }

  /* ---------------------------------------------------------
      3. AI BULK GENERATE FROM EXCEL 
  --------------------------------------------------------- */
  async aiBulkGenerateFromExcel(req, res) {
    try {
      const { document_type } = req.body;
      const file = req.file;

      if (!document_type) {
        return responseHandler.badRequest(res, "document_type is required");
      }
      if (!file || !file.buffer) {
        return responseHandler.badRequest(res, "Excel file is required");
      }

      const workbook = xlsx.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows.length) {
        return responseHandler.badRequest(res, "Excel sheet is empty");
      }

      const zip = new JSZip();
      let rowIndex = 0;

      for (const row of rows) {
        rowIndex++;

        const normRow = {};
        Object.entries(row).forEach(([key, value]) => {
          normRow[normalizeKey(key)] = value;
        });

        const aiResult = await aiService.generateClauses(document_type, row);

        if (!aiResult.success || !Array.isArray(aiResult.clauses)) {
          return responseHandler.error(
            res,
            `AI generation failed at row ${rowIndex}: ${aiResult.error || "Unknown error"}`,
            500
          );
        }

        const finalClauses = aiResult.clauses.map(c => {
          let text = c.content;

          Object.entries(normRow).forEach(([normKey, value]) => {
            const placeholderRegex = new RegExp(`\\[${normKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\]`, "g");
            text = text.replace(placeholderRegex, value);
          });

          Object.entries(row).forEach(([rawKey, value]) => {
            const escaped = rawKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
            text = text.replace(new RegExp(`\\[${escaped}\\]`, "g"), value);
          });

          return { ...c, content: text };
        });

        const primaryIdentifier =
          row["Employee Name"] ||
          row["Full Name"] ||
          row["Name"] ||
          row["Candidate Name"] ||
          row["Student Name"] ||
          row["Party Name"] ||
          row["Vendor Name"] ||
          row["Customer Name"] ||
          Object.values(row).find(v => v && String(v).trim() !== "") ||
          `Row${rowIndex}`;

        const cleanIdentifier = String(primaryIdentifier).replace(/[^A-Za-z0-9]/g, "");
        const cleanDocType = document_type.replace(/[^A-Za-z0-9]/g, "");
        const finalFileName = `${cleanDocType}_${cleanIdentifier}`;

        const document = await documentModel.create({
          template_id: null,
          document_name: finalFileName,
          document_type,
          content_json: { clauses: finalClauses },
          variables: row
        });

        const pdfBuffer = await pdfService.generatePDF(document);

        if (!pdfBuffer || !pdfBuffer.length) {
          return responseHandler.serverError(res, `PDF generation failed at row ${rowIndex}`);
        }

        zip.file(`${finalFileName}.pdf`, pdfBuffer);
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="AI_BULK_${Date.now()}.zip"`
      });

      return res.end(zipBuffer);

    } catch (err) {
      console.error("❌ AI Bulk Excel error:", err);
      return responseHandler.serverError(res, "AI Bulk Excel generation failed", err);
    }
  }

  /* ---------------------------------------------------------
      4. GET ALL DOCUMENTS
  --------------------------------------------------------- */
  async getAllDocuments(req, res) {
    try {
      const { document_type } = req.query;
      const filters = {};

      if (document_type) filters.document_type = document_type;

      const documents = await documentModel.findAll(filters);
      return responseHandler.success(res, documents);

    } catch (err) {
      console.error("Error fetching all documents:", err);
      return responseHandler.serverError(res, "Failed to fetch documents", err);
    }
  }

  /* ---------------------------------------------------------
      5. GET ONE DOCUMENT
  --------------------------------------------------------- */
  async getDocumentById(req, res) {
    try {
      const { id } = req.params;

      const document = await documentModel.findById(id);
      if (!document) {
        return responseHandler.notFound(res, "Document not found");
      }

      return responseHandler.success(res, document);

    } catch (err) {
      console.error("Error fetching document:", err);
      return responseHandler.serverError(res, "Failed to fetch document", err);
    }
  }

  /* ---------------------------------------------------------
      6. UPDATE DOCUMENT
  --------------------------------------------------------- */
  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updated = await documentModel.update(id, updateData);

      if (!updated) {
        return responseHandler.notFound(res, "Document not found");
      }

      return responseHandler.success(res, updated, "Document updated successfully");

    } catch (err) {
      console.error("Error updating document:", err);
      return responseHandler.serverError(res, "Failed to update document", err);
    }
  }

  /* ---------------------------------------------------------
      7. DELETE DOCUMENT
  --------------------------------------------------------- */
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;

      const deleted = await documentModel.delete(id);

      if (!deleted) {
        return responseHandler.notFound(res, "Document not found or already deleted");
      }

      return responseHandler.success(res, null, "Document deleted successfully");

    } catch (err) {
      console.error("Delete error:", err);
      return responseHandler.serverError(res, "Failed to delete document", err);
    }
  }

  /* ---------------------------------------------------------
      8. GET DOCUMENT CONTENT (English or translated)
  --------------------------------------------------------- */
  async getDocumentContent(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { lang = "en" } = req.query;

      const document = await documentModel.findById(id);
      if (!document) return responseHandler.notFound(res, "Document not found");

      let english = "";
      if (document.content_json?.clauses) {
        english = document.content_json.clauses.map(c => c.content).join("\n\n");
      } else {
        english = document.document_name;
      }

      if (lang === "en") {
        return responseHandler.success(res, { text: english });
      }

      const [rows] = await pool.execute(
        `SELECT content FROM translations
         WHERE original_id = ? AND original_type = 'document' AND lang = ? AND status = 'confirmed'
         ORDER BY updated_at DESC LIMIT 1`,
        [id, lang]
      );

      if (rows.length === 0) {
        return responseHandler.success(res, {
          text: english,
          lang,
          source: "original",
          translation_available: false
        });
      }

      return responseHandler.success(res, {
        text: rows[0].content,
        lang,
        source: "translation"
      });

    } catch (err) {
      console.error("getDocumentContent error:", err);
      return responseHandler.serverError(res, "Failed to fetch content", err);
    }
  }

  /* ---------------------------------------------------------
      9. GENERATE PDF (EN / TRANSLATED / BILINGUAL)
  --------------------------------------------------------- */
  async documentGeneratePdf(req, res) {
    try {
      const documentId = parseInt(req.params.id, 10);
      const { lang = "en", translationId = null, filename = null } = req.body;

      const document = await documentModel.findById(documentId);
      if (!document) return responseHandler.notFound(res, "Document not found");

      const assembleEnglish = () => {
        if (document.content_json?.clauses) {
          return document.content_json.clauses.map(c => c.content).join("\n\n");
        }
        return document.document_name;
      };

      if (lang === "en") {
        const pdf = await pdfService.generatePDF(document);
        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename || "document_en.pdf"}"`
        });
        return res.send(pdf);
      }

      let translated = null;

      if (translationId) {
        const [t] = await pool.execute(
          `SELECT content FROM translations WHERE id = ?`,
          [translationId]
        );
        if (t.length) translated = t[0].content;
      }

      if (!translated) {
        const [t] = await pool.execute(
          `SELECT content FROM translations
           WHERE original_id=? AND original_type='document' AND lang=? AND status='confirmed'
           ORDER BY updated_at DESC LIMIT 1`,
          [documentId, lang]
        );
        if (t.length) translated = t[0].content;
      }

      if (!translated) {
        return responseHandler.badRequest(res, "No confirmed translation available");
      }

      if (lang !== "both") {
        const translatedDoc = {
          ...document,
          content_json: { clauses: [{ content: translated }] }
        };

        const pdf = await pdfService.generatePDF(translatedDoc);

        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename || "document_translated.pdf"}"`
        });

        return res.send(pdf);
      }

      const englishText = assembleEnglish();

      const html = `
        <html><head>
          <style>
            body{font-family: Arial;padding:20px}
            .row{display:flex;gap:20px}
            .col{flex:1;border:1px solid #ddd;padding:10px}
            pre{white-space:pre-wrap}
          </style>
        </head><body>
          <h3>Bilingual Document</h3>
          <div class="row">
            <div class="col"><h4>English</h4><pre>${englishText}</pre></div>
            <div class="col"><h4>Translated</h4><pre>${translated}</pre></div>
          </div>
        </body></html>`;

      const pdf = await pdfService.generateFromHtml(html);

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename || "document_bilingual.pdf"}"`
      });

      return res.send(pdf);

    } catch (err) {
      console.error("PDF generation error:", err);
      return responseHandler.serverError(res, "PDF generation failed", err);
    }
  }
}

module.exports = new DocumentController();