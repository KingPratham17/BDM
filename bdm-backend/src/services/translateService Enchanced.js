// src/services/translateServiceEnhanced.js
const { randomUUID } = require('crypto');
const { pool } = require('../config/database');
const aiService = require('./aiService');

// =================== LANGUAGE CONFIGURATIONS ===================
const SUPPORTED_LANGUAGES = {
  // European Languages
  'es': { name: 'Spanish', flag: '🇪🇸', rtl: false },
  'fr': { name: 'French', flag: '🇫🇷', rtl: false },
  'de': { name: 'German', flag: '🇩🇪', rtl: false },
  'pt': { name: 'Portuguese', flag: '🇵🇹', rtl: false },
  'ru': { name: 'Russian', flag: '🇷🇺', rtl: false },
  
  // Asian Languages
  'zh': { name: 'Chinese (Simplified)', flag: '🇨🇳', rtl: false },
  'ja': { name: 'Japanese', flag: '🇯🇵', rtl: false },
  'ko': { name: 'Korean', flag: '🇰🇷', rtl: false },
  
  // Indian Languages
  'hi': { name: 'Hindi', flag: '🇮🇳', rtl: false },
  'bn': { name: 'Bengali', flag: '🇮🇳', rtl: false },
  'te': { name: 'Telugu', flag: '🇮🇳', rtl: false },
  'mr': { name: 'Marathi', flag: '🇮🇳', rtl: false },
  'ta': { name: 'Tamil', flag: '🇮🇳', rtl: false },
  'gu': { name: 'Gujarati', flag: '🇮🇳', rtl: false },
  'kn': { name: 'Kannada', flag: '🇮🇳', rtl: false },
  'ml': { name: 'Malayalam', flag: '🇮🇳', rtl: false },
  'pa': { name: 'Punjabi', flag: '🇮🇳', rtl: false },
  
  // Middle Eastern
  'ar': { name: 'Arabic', flag: '🇸🇦', rtl: true },
  'ur': { name: 'Urdu', flag: '🇵🇰', rtl: true },
};

// =================== ENHANCED TRANSLATION PROMPT ===================
const buildTranslationPrompt = (text, targetLang, options = {}) => {
  const langInfo = SUPPORTED_LANGUAGES[targetLang];
  const isHTML = /<[a-z][\s\S]*>/i.test(text);
  
  let prompt = `You are a professional legal and business document translator.

TRANSLATE TO: ${langInfo.name} (${targetLang})
${langInfo.rtl ? '⚠️ This is an RTL (Right-to-Left) language' : ''}

${isHTML ? `
CRITICAL HTML TRANSLATION RULES:
1. Preserve ALL HTML tags exactly: <h1>, <p>, <table>, <ul>, etc.
2. Translate ONLY text content inside tags
3. Keep ALL placeholders: [Company Name], [Employee Name], etc.
4. Maintain HTML structure completely
5. For tables: Keep <table>, <tr>, <td>, <th> structure
` : `
CRITICAL PLAIN TEXT RULES:
1. Preserve ALL placeholders: [Company Name], [Employee Name]
2. Maintain line breaks and formatting
3. Professional, formal tone
`}

QUALITY REQUIREMENTS:
- Accurate legal/business terminology
- Natural, fluent ${langInfo.name}
- Culturally appropriate
- Professional tone maintained
${options.preserveFormatting ? '- Preserve all spacing and indentation' : ''}

SOURCE TEXT:
${text}

TRANSLATED TEXT:`;

  return prompt;
};

// =================== MAIN TRANSLATION FUNCTION ===================
async function generateTranslation(text, targetLang, options = {}) {
  try {
    console.log(`🌐 Translating to ${targetLang} (${text.length} chars)`);
    
    // Validate language
    if (!SUPPORTED_LANGUAGES[targetLang]) {
      throw new Error(`Unsupported language: ${targetLang}`);
    }

    // Build prompt
    const prompt = buildTranslationPrompt(text, targetLang, options);
    
    const systemMsg = {
      role: 'system',
      content: `You are an expert translator specializing in legal and business documents. 
You preserve HTML structure, maintain placeholders, and ensure professional quality.
Return ONLY the translated text, no commentary.`
    };
    
    const userMsg = { role: 'user', content: prompt };

    // Call AI service
    const result = await aiService.makeAIRequest([systemMsg, userMsg], 0.2);

    if (!result || typeof result.content !== 'string') {
      throw new Error('AI translation returned invalid response');
    }

    const translated = result.content.trim();
    
    // Validation
    const isHTML = /<[a-z][\s\S]*>/i.test(text);
    if (isHTML && !/<[a-z][\s\S]*>/i.test(translated)) {
      console.warn('⚠️ HTML input but plain text output - translation may be invalid');
    }

    // Validate placeholder preservation
    const inputPlaceholders = (text.match(/\[([^\]]+)\]/g) || []).length;
    const outputPlaceholders = (translated.match(/\[([^\]]+)\]/g) || []).length;
    
    if (inputPlaceholders !== outputPlaceholders) {
      console.warn(`⚠️ Placeholder mismatch: ${inputPlaceholders} → ${outputPlaceholders}`);
    }

    console.log(`✅ Translation complete: ${translated.length} chars`);
    
    return { 
      translated, 
      meta: { 
        tokensUsed: result.tokensUsed || 0, 
        model: result.model || 'unknown',
        isHTML: isHTML,
        language: SUPPORTED_LANGUAGES[targetLang].name,
        rtl: SUPPORTED_LANGUAGES[targetLang].rtl
      } 
    };
    
  } catch (error) {
    console.error('❌ Translation failed:', error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

// =================== PREVIEW CREATION ===================
async function createPreview({ originalId, originalType, lang, text, createdBy }) {
  try {
    // Generate translation
    const { translated, meta } = await generateTranslation(text, lang);
    
    // Create preview ID
    const previewId = randomUUID();
    
    // Set expiry (30 minutes)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Store in database
    await pool.execute(
      `INSERT INTO translation_previews
        (preview_id, original_id, original_type, lang, translated_content, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [previewId, originalId || null, originalType || 'document', lang, translated, createdBy || null, expiresAt]
    );

    // Log AI usage
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
            is_html: meta.isHTML,
            rtl: meta.rtl
          }),
          meta.tokensUsed || 0,
          0.0
        ]
      );
    } catch (logError) {
      console.warn('⚠️ AI log failed (non-fatal):', logError.message);
    }

    console.log(`✅ Preview created: ${previewId}`);

    return { previewId, translated, expiresAt, meta };
    
  } catch (error) {
    console.error('❌ createPreview failed:', error);
    throw error;
  }
}

// =================== CONFIRMATION ===================
async function confirmPreview({ previewId, userId }) {
  try {
    // Fetch preview
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

    // Upsert into translations
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

    // Mark as confirmed
    await pool.execute(
      `UPDATE translation_previews SET confirmed = TRUE WHERE preview_id = ?`,
      [previewId]
    );

    // Get translation ID
    const [tRows] = await pool.execute(
      `SELECT id FROM translations 
       WHERE original_id = ? AND original_type = ? AND lang = ?`,
      [preview.original_id, preview.original_type, preview.lang]
    );

    const translationId = tRows[0]?.id ?? null;

    console.log(`✅ Translation confirmed: ID=${translationId}`);

    return { translationId, original: preview };
    
  } catch (error) {
    console.error('❌ confirmPreview failed:', error);
    throw error;
  }
}

// =================== BATCH TRANSLATION ===================
async function batchTranslate({ texts, targetLang, options = {} }) {
  try {
    console.log(`📦 Batch translating ${texts.length} items to ${targetLang}`);
    
    const results = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const { translated, meta } = await generateTranslation(texts[i], targetLang, options);
        results.push({ index: i, success: true, translated, meta });
      } catch (error) {
        console.error(`❌ Failed to translate item ${i}:`, error);
        results.push({ index: i, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Batch complete: ${successCount}/${texts.length} successful`);
    
    return { results, totalProcessed: texts.length, successCount };
    
  } catch (error) {
    console.error('❌ Batch translation failed:', error);
    throw error;
  }
}

// =================== EXPORTS ===================
module.exports = { 
  createPreview, 
  confirmPreview, 
  generateTranslation,
  batchTranslate,
  SUPPORTED_LANGUAGES
};