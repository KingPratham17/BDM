// src/controllers/translateController.js
const translateService = require('../services/translateService');
const documentModel = require('../models/documentModel');
const responseHandler = require('../utils/responseHandler');

// Helper to assemble English text from a document row
function assembleDocumentText(document) {
  if (!document) return '';
  if (document.content_json && Array.isArray(document.content_json.clauses)) {
    return document.content_json.clauses
      .map(c => String(c.content || ''))
      .join('\n\n');
  }
  if (document.content_json && typeof document.content_json === 'string') {
    return document.content_json;
  }
  return document.document_name || '';
}

async function previewTranslate(req, res) {
  try {
    // Accept either body.text OR fetch the document by :id
    const docId = parseInt(req.params.id, 10) || null;
    const { originalId, originalType, text, lang } = req.body;
    const userId = req.user?.id || req.body.userId || null;

    if (!lang) {
      return res.status(400).json({ 
        success: false,
        error: 'lang parameter is required' 
      });
    }

    let textToTranslate = text;
    
    // If no text provided, try to fetch from document
    if (!textToTranslate) {
      const targetId = originalId || docId;
      if (targetId) {
        const doc = await documentModel.findById(targetId);
        if (!doc) {
          return res.status(404).json({ 
            success: false,
            error: 'Document not found for preview' 
          });
        }
        textToTranslate = assembleDocumentText(doc);
      }
    }

    if (!textToTranslate) {
      return res.status(400).json({ 
        success: false,
        error: 'No text available to translate. Provide text or ensure document exists.' 
      });
    }

    console.log(`🌐 Creating translation preview: doc=${docId}, lang=${lang}`);
    
    const result = await translateService.createPreview({
      originalId: originalId || docId || null,
      originalType: originalType || 'document',
      lang,
      text: textToTranslate,
      createdBy: userId
    });

    console.log(`✅ Preview created: ID=${result.previewId}`);

    return res.json({ 
      success: true, 
      previewId: result.previewId, 
      translated: result.translated, 
      expiresAt: result.expiresAt 
    });
    
  } catch (err) {
    console.error('previewTranslate error', err);
    return res.status(500).json({ 
      success: false,
      error: err.message || 'Translation preview failed' 
    });
  }
}

async function confirmTranslate(req, res) {
  try {
    const { previewId } = req.body;
    const userId = req.user?.id || req.body.userId || null;
    
    if (!previewId) {
      return res.status(400).json({ 
        success: false,
        error: 'previewId is required' 
      });
    }

    console.log(`✅ Confirming translation preview: ${previewId}`);

    const result = await translateService.confirmPreview({ 
      previewId, 
      userId 
    });

    console.log(`✅ Translation confirmed: ID=${result.translationId}`);

    return res.json({ 
      success: true, 
      translationId: result.translationId || null 
    });
    
  } catch (err) {
    console.error('confirmTranslate error', err);
    return res.status(500).json({ 
      success: false,
      error: err.message || 'Confirm failed' 
    });
  }
}

module.exports = { previewTranslate, confirmTranslate };