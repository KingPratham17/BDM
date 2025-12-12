// src/controllers/aiController.js
const aiService = require('../services/aiService');

/**
 * Naive local fallback summarizer: pick first N sentences.
 * Keeps things deterministic for frontend testing when AI provider is missing.
 */
function localFallbackSummary(text, maxSentences = 2) {
  if (!text) return '';
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  // split into sentences (simple)
  const sentences = cleaned.match(/[^\.!\?]+[\.!\?]+|[^\.!\?]+$/g) || [cleaned];
  const selected = sentences.slice(0, maxSentences).map(s => s.trim());
  let summary = selected.join(' ');
  if (summary.length < 30 && cleaned.length > summary.length) summary = summary + '...';
  return summary;
}

/**
 * Controller: handle POST /api/ai
 * Expected body: { type: 'summarize', content, selection, options }
 */
exports.handleAIRequest = async (req, res) => {
  try {
    const { type, content, selection, options } = req.body || {};

    if (!type) {
      return res.status(400).json({ success: false, error: 'Missing "type" in request body' });
    }

    if (type === 'summarize') {
      const textToSummarize = (selection && selection.length) ? selection : content;
      if (!textToSummarize || !String(textToSummarize).trim()) {
        return res.status(400).json({ success: false, error: 'No content to summarize' });
      }

      // Build a simple chat-style prompt/messages for your AIService
      const length = (options && options.length) || 'short'; // short|medium|long
      const systemPrompt = 'You are a helpful assistant that summarizes text concisely and clearly. Return only the summary text.';
      const userPrompt = `Please provide a ${length} summary of the following text. Be concise and use plain sentences:\n\n${textToSummarize}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      try {
        const result = await aiService.makeAIRequest(messages, 0.3);
        // aiService.makeAIRequest is expected to return an object like { content: "...", tokensUsed, model }
        const summary = (result && (result.content || result.summary)) || null;

        if (!summary) {
          // If AI returned unexpected shape, fallback locally
          const fallback = localFallbackSummary(textToSummarize, length === 'long' ? 6 : (length === 'medium' ? 4 : 2));
          return res.json({
            success: true,
            summary: fallback,
            info: { fallback: true, reason: 'AI returned no summary field', model: result && result.model }
          });
        }

        return res.json({
          success: true,
          summary: summary,
          tokensUsed: result.tokensUsed || 0,
          model: result.model || null
        });

      } catch (aiErr) {
        // AI call failed — log and serve fallback
        console.error('AI Service error:', aiErr && (aiErr.message || aiErr));
        const fallback = localFallbackSummary(textToSummarize, length === 'long' ? 6 : (length === 'medium' ? 4 : 2));
        return res.status(200).json({
          success: true,
          summary: fallback,
          info: { fallback: true, reason: 'AI call failed', error: aiErr && (aiErr.message || aiErr) }
        });
      }
    }

    return res.status(400).json({ success: false, error: `Unknown AI request type: ${type}` });
  } catch (err) {
    console.error('AI Controller Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process AI request' });
  }
};
