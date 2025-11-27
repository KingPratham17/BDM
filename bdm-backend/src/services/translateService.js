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

/* ============================================================
   🔥 FIX 1 — Extract Clean HTML/Text From AI Output
   Handles:
   - Markdown code blocks
   - JSON responses
   - AI wrapper text
   ============================================================ */
function extractHTML(raw) {
  if (!raw) return "";

  let text = raw.trim();

  // Remove markdown code fences
  text = text.replace(/```html|```/gi, '').trim();

  // If it looks like JSON, parse it and extract value fields
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.translated) return parsed.translated;
      if (parsed.translation) return parsed.translation;
      if (parsed.html) return parsed.html;
      if (parsed.content) return parsed.content;
      return text;
    } catch (_) {
      // Fall through to raw return
    }
  }

  return text;
}

/* ============================================================
   HTML-Aware Translation Prompt
   ============================================================ */
const PROMPT_TEMPLATE = (text, targetLang) => {
  const isHTML = /<[a-z][\s\S]*>/i.test(text);

  if (isHTML) {
    return `
You are a professional translation assistant specialized in legal and business documents.

Translate the following HTML content into ${LANGUAGE_NAMES[targetLang] || targetLang}.

CRITICAL HTML RULES:
1. Preserve ALL HTML tags EXACTLY (<p>, <h1>, <table>, etc.)
2. Translate ONLY inner text.
3. Do NOT modify placeholders like [Company Name].
4. Return CLEAN HTML, no explanations, no markdown.

SOURCE HTML:
${text}

TRANSLATED HTML:`;
  }

  return `
Translate the following text into ${LANGUAGE_NAMES[targetLang] || targetLang}.

Rules:
- Preserve placeholders [Company Name]
- Preserve formatting and line breaks
- No explanations, only translation

SOURCE:
${text}

TRANSLATED TEXT:`;
};

/* ============================================================
   MAIN: Generate Translation (HTML Safe)
   ============================================================ */
async function generateTranslation(text, targetLang) {
  try {
    console.log(`🌐 Translating to ${targetLang} (${text.length} chars)`);

    const isHTML = /<[a-z][\s\S]*>/i.test(text);

    const systemMsg = {
      role: "system",
      content: isHTML
        ? "You translate HTML exactly. Preserve ALL tags and placeholders. Return only HTML."
        : "You translate text precisely. Preserve placeholders. Return only translated text."
    };

    const userMsg = { role: "user", content: PROMPT_TEMPLATE(text, targetLang) };

    const result = await aiService.makeAIRequest([systemMsg, userMsg], 0.3);

    if (!result || typeof result.content !== "string") {
      throw new Error("Invalid AI translation response");
    }

    console.log("🔍 RAW AI OUTPUT:", result.content);

    // FIX — Extract valid HTML/text from messy AI output
    const translated = extractHTML(result.content).trim();

    if (!translated) throw new Error("Empty translation output");

    // Warn if HTML expected but missing
    if (isHTML && !/<[a-z][\s\S]*>/i.test(translated)) {
      console.warn("⚠️ Expected HTML output but got plain text");
    }

    console.log(`✅ Final translation length: ${translated.length}`);

    return {
      translated,
      meta: {
        tokensUsed: result.tokensUsed || 0,
        model: result.model || "unknown",
        isHTML: isHTML
      }
    };

  } catch (error) {
    console.error("❌ Translation generation error:", error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

/* ============================================================
   Create Translation Preview (stores in DB)
   ============================================================ */
async function createPreview({ originalId, originalType, lang, text, createdBy }) {
  try {
    const { translated, meta } = await generateTranslation(text, lang);

    const previewId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

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

    console.log(`✅ Preview saved: ${previewId}`);

    return { previewId, translated, expiresAt, meta };

  } catch (error) {
    console.error("createPreview error:", error);
    throw error;
  }
}

/* ============================================================
   Confirm Translation → Save Permanently
   ============================================================ */
async function confirmPreview({ previewId, userId }) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM translation_previews 
       WHERE preview_id = ? AND expires_at > NOW()`,
      [previewId]
    );

    if (!rows.length) throw new Error("Preview not found or expired");

    const preview = rows[0];

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

    await pool.execute(
      `UPDATE translation_previews SET confirmed = TRUE WHERE preview_id = ?`,
      [previewId]
    );

    const [tRows] = await pool.execute(
      `SELECT id FROM translations 
       WHERE original_id = ? AND original_type = ? AND lang = ?`,
      [preview.original_id, preview.original_type, preview.lang]
    );

    console.log(`✅ Translation confirmed (ID: ${tRows[0]?.id})`);

    return { translationId: tRows[0]?.id || null, original: preview };

  } catch (error) {
    console.error("confirmPreview error:", error);
    throw error;
  }
}

module.exports = {
  createPreview,
  confirmPreview,
  generateTranslation
};
