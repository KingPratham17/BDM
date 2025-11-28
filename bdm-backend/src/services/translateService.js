// src/services/translateService.js
const { randomUUID } = require('crypto');
const { pool } = require('../config/database');
const aiService = require('./aiService');

const LANGUAGE_NAMES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'pt': 'Portuguese',
  'zh': 'Chinese (Simplified)',
  'hi': 'Hindi',
  'ar': 'Arabic',
  'ru': 'Russian',
  'ta': 'Tamil',
  'te': 'Telugu',
  'kn': 'Kannada',
  'ml': 'Malayalam',
  'mr': 'Marathi',
  'gu': 'Gujarati',
  'bn': 'Bengali',
  'pa': 'Punjabi'
};

// ✨ UPDATED: HTML-aware translation prompt
const PROMPT_TEMPLATE = (text, targetLang) => {
  // Check if input is HTML
  const isHTML = /<[a-z][\s\S]*>/i.test(text);
  
  if (isHTML) {
    return `You are a professional translation assistant specialized in legal and business documents.

Translate the following HTML content into ${LANGUAGE_NAMES[targetLang] || targetLang}.

CRITICAL RULES FOR HTML TRANSLATION:
1. Preserve ALL HTML tags EXACTLY as they are (<p>, <h1>, <table>, <ul>, etc.)
2. Translate ONLY the text content INSIDE the HTML tags
3. Keep ALL placeholders exactly as-is (e.g., [Company Name], [Employee Name])
4. Maintain ALL HTML structure and formatting
5. For tables: keep <table>, <tr>, <td>, <th> structure, translate only cell contents
6. Return the COMPLETE translated HTML

EXAMPLE:
Input: <p>Dear [Candidate Name],</p><p>We are pleased to offer you the position of [Position].</p>
Output (Spanish): <p>Estimado/a [Candidate Name],</p><p>Nos complace ofrecerle el puesto de [Position].</p>

SOURCE HTML:
${text}

TRANSLATED HTML:`;
  } else {
    // Plain text translation (backward compatibility)
    return `You are a professional translation assistant specialized in legal and business documents.

Translate the following text into ${LANGUAGE_NAMES[targetLang] || targetLang}.

CRITICAL RULES:
1. Preserve ALL placeholders exactly as they are (e.g., [Company Name], [Employee Name])
2. Preserve ALL formatting including line breaks and paragraph structure
3. Maintain professional, formal tone appropriate for legal/business documents
4. Return ONLY the translated text, no explanations

SOURCE TEXT:
${text}

TRANSLATED TEXT:`;
  }
};

// ✨ MAIN: Generate translation (HTML-aware)
async function generateTranslation(text, targetLang) {
  try {
    console.log(`🌐 Generating translation to ${targetLang} (${text.length} chars)`);
    
    // Detect if content is HTML
    const isHTML = /<[a-z][\s\S]*>/i.test(text);
    if (isHTML) {
      console.log('✨ Detected HTML content - using HTML-aware translation');
    }
    
    const systemMsg = {
      role: 'system',
      content: isHTML 
        ? 'You are a precise HTML-aware translator specialized in legal and business documents. You preserve ALL HTML tags exactly while translating text content. You maintain placeholders and return ONLY the translated HTML.'
        : 'You are a precise translator specialized in legal and business documents. You preserve placeholders, formatting, and maintain professional tone. You return ONLY the translated text without commentary.'
    };
    
    const userMsg = {
      role: 'user',
      content: PROMPT_TEMPLATE(text, targetLang)
    };

    // Use aiService (handles OpenRouter/OpenAI fallback)
    const result = await aiService.makeAIRequest([systemMsg, userMsg], 0.3);

    if (!result || typeof result.content !== 'string') {
      throw new Error('AI translation returned invalid response');
    }

    const translated = result.content.trim();
    
    // ✨ Validation for HTML translations
    if (isHTML) {
      // Basic validation: check if output still has HTML tags
      if (!/<[a-z][\s\S]*>/i.test(translated)) {
        console.warn('⚠️ Warning: HTML input but plain text output. May be translation issue.');
      }
      
      // Check if placeholders preserved
      const inputPlaceholders = (text.match(/\[([^\]]+)\]/g) || []);
      const outputPlaceholders = (translated.match(/\[([^\]]+)\]/g) || []);
      
      if (inputPlaceholders.length !== outputPlaceholders.length) {
        console.warn(`⚠️ Warning: Placeholder count mismatch. Input: ${inputPlaceholders.length}, Output: ${outputPlaceholders.length}`);
      }
    }
    
    console.log(`✅ Translation generated: ${translated.length} chars`);
    
    return { 
      translated, 
      meta: { 
        tokensUsed: result.tokensUsed || 0, 
        model: result.model || 'unknown',
        isHTML: isHTML
      } 
    };
    
  } catch (error) {
    console.error('Translation generation error:', error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

// Create translation preview
async function createPreview({ originalId, originalType, lang, text, createdBy }) {
  try {
    // Generate translation using AI (now HTML-aware)
    const { translated, meta } = await generateTranslation(text, lang);
    
    // Create unique preview ID
    const previewId = randomUUID();
    
    // Preview expires in 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Store preview in database
    await pool.execute(
      `INSERT INTO translation_previews
        (preview_id, original_id, original_type, lang, translated_content, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        previewId, 
        originalId || null, 
        originalType || 'document', 
        lang, 
        translated, 
        createdBy || null, 
        expiresAt
      ]
    );

    // Log AI usage (non-fatal)
    try {
      await pool.execute(
        `INSERT INTO ai_generation_logs 
         (request_type, prompt, response_data, tokens_used, cost_estimate, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          'translation_preview',
          text.length > 1000 ? text.slice(0, 1000) + '...' : text,
          JSON.stringify({ 
            lang, 
            model: meta.model,
            original_length: text.length,
            translated_length: translated.length,
            is_html: meta.isHTML || false
          }),
          meta.tokensUsed || 0,
          0.0
        ]
      );
    } catch (logError) {
      console.warn('AI log insert failed (non-fatal):', logError.message);
    }

    console.log(`✅ Preview created: ${previewId}, expires: ${expiresAt}`);

    return { 
      previewId, 
      translated, 
      expiresAt, 
      meta 
    };
    
  } catch (error) {
    console.error('createPreview error:', error);
    throw error;
  }
}

// Confirm translation preview
async function confirmPreview({ previewId, userId }) {
  try {
    // Fetch preview and ensure not expired
    const [rows] = await pool.execute(
      `SELECT * FROM translation_previews 
       WHERE preview_id = ? AND expires_at > NOW()`,
      [previewId]
    );
    
    if (!rows || rows.length === 0) {
      throw new Error('Preview not found or expired');
    }

    const preview = rows[0];

    console.log(`💾 Confirming translation: doc=${preview.original_id}, lang=${preview.lang}`);

    // Upsert into translations table
    await pool.execute(
      `INSERT INTO translations 
       (original_id, original_type, lang, content, status, created_by, verified_by, created_at)
       VALUES (?, ?, ?, ?, 'confirmed', ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
         content = VALUES(content), 
         status = 'confirmed', 
         updated_at = CURRENT_TIMESTAMP, 
         verified_by = VALUES(verified_by)`,
      [
        preview.original_id, 
        preview.original_type, 
        preview.lang, 
        preview.translated_content, 
        preview.created_by, 
        userId || preview.created_by
      ]
    );

    // Mark preview as confirmed
    await pool.execute(
      `UPDATE translation_previews 
       SET confirmed = TRUE 
       WHERE preview_id = ?`,
      [previewId]
    );

    // Get the translation ID
    const [tRows] = await pool.execute(
      `SELECT id FROM translations 
       WHERE original_id = ? AND original_type = ? AND lang = ?`,
      [preview.original_id, preview.original_type, preview.lang]
    );

    const translationId = tRows[0]?.id ?? null;

    console.log(`✅ Translation confirmed with ID: ${translationId}`);

    return { 
      translationId, 
      original: preview 
    };
    
  } catch (error) {
    console.error('confirmPreview error:', error);
    throw error;
  }
}

module.exports = { 
  createPreview, 
  confirmPreview, 
  generateTranslation 
};
