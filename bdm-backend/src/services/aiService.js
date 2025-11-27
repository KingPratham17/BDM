const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

// Determine which AI service to use
const USE_OPENROUTER = process.env.USE_OPENROUTER === 'true';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'meta-llama/llama-3.1-8b-instruct';

// Fallback models (priority order)
const FALLBACK_MODELS = process.env.AI_FALLBACK_MODELS
  ? process.env.AI_FALLBACK_MODELS.split(',')
  : [
      'google/gemini-flash-1.5',
      'mistralai/mistral-7b-instruct',
      'microsoft/phi-3-mini-128k-instruct'
    ];

// Initialize OpenAI client (fallback)
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

class AIService {

  // Generic AI request handler with automatic fallback
  async makeAIRequest(messages, temperature = 0.7) {
    if (USE_OPENROUTER && OPENROUTER_API_KEY) {
      return await this.callOpenRouterWithFallback(messages, temperature);
    } else if (OPENAI_API_KEY) {
      return await this.callOpenAI(messages, temperature);
    } else {
      throw new Error('No AI API key configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY in .env');
    }
  }

  // OpenRouter with automatic model fallback
  async callOpenRouterWithFallback(messages, temperature) {
    const modelsToTry = [AI_MODEL, ...FALLBACK_MODELS];
    let lastError = null;

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];

      try {
        console.log(`🤖 Attempting with model ${i + 1}/${modelsToTry.length}: ${model}`);
        const result = await this.callOpenRouter(messages, temperature, model);
        console.log(`✅ Success with model: ${model}`);
        return result;

      } catch (error) {
        lastError = error;
        const errorMsg = error.message || JSON.stringify(error);

        if (errorMsg.includes('rate-limited') || errorMsg.includes('429')) {
          console.log(`⚠️ Rate limited on ${model}, trying next model...`);
          continue;
        }

        if (errorMsg.includes('404') || errorMsg.includes('not found')) {
          console.log(`⚠️ Model ${model} not available, trying next...`);
          continue;
        }

        console.log(`⚠️ Error with ${model}: ${errorMsg.substring(0, 100)}...`);
        console.log(`   Trying next model...`);
        continue;
      }
    }

    throw new Error(`All AI models failed. Last error: ${lastError?.message || lastError}`);
  }

  // OpenRouter API call
  async callOpenRouter(messages, temperature, model = null) {
    try {
      const modelToUse = model || AI_MODEL;

      const requestBody = {
        model: modelToUse,
        messages: messages,
        temperature: temperature
      };

      if (modelToUse.includes('gpt') || modelToUse.includes('claude')) {
        requestBody.response_format = { type: "json_object" };
      }

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:5000',
            'X-Title': 'BDM System'
          },
          timeout: 30000
        }
      );

      return {
        content: response.data.choices[0].message.content,
        tokensUsed: response.data.usage?.total_tokens || 0,
        model: modelToUse
      };

    } catch (error) {
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  }

  // OpenAI API call (fallback)
  async callOpenAI(messages, temperature) {
    try {
      console.log('🤖 Using OpenAI (fallback)');

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: messages,
        temperature: temperature,
        response_format: { type: "json_object" }
      });

      return {
        content: completion.choices[0].message.content,
        tokensUsed: completion.usage.total_tokens,
        model: process.env.OPENAI_MODEL
      };

    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw new Error(`OpenAI API failed: ${error.message}`);
    }
  }

  // ✨ ONLY CHANGE: Added _extractJSON helper
  _extractJSON(raw) {
    const trimmed = raw.trim();
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');

    if (first === -1 || last === -1 || last <= first) {
      console.error('❌ No JSON object found:', trimmed.substring(0, 600));
      throw new Error('AI response contains no valid JSON object');
    }

    return trimmed.substring(first, last + 1);
  }

  // ✨ UPDATED: Generate all clauses with HTML logging
  async generateClauses(documentType, context = {}) {
    try {
      const prompt = this.buildClauseGenerationPrompt(documentType, context);

      const messages = [
        {
          role: 'system',
          content: `You are a professional document generator. Generate structured, professional document clauses in JSON format with HTML content.

CRITICAL RULES - OBEY EXACTLY:
- NEVER write any explanation, greeting, or text outside the JSON
- NEVER say "Here is", "Sure", "Okay", etc.
- Start your response with { and end with }
- Return ONLY valid JSON, nothing else, no markdown, no code blocks

Each clause "content" field MUST be valid HTML.
Use semantic HTML tags: <h1>, <h2>, <p>, <ul>, <ol>, <table>, <strong>, <em>
For tables, use proper structure with <table><thead><tbody>
Preserve placeholders like [Company Name] inside HTML tags`
        },
        { role: 'user', content: prompt }
      ];

      const result = await this.makeAIRequest(messages, 0.7);
      
      // ✨ USE EXTRACTOR instead of manual cleaning
      const cleaned = this._extractJSON(result.content);

      let response;
      try {
        response = JSON.parse(cleaned);
      } catch (e) {
        console.error('❌ JSON Parse failed. Extracted:', cleaned.substring(0, 800));
        throw new Error(`Invalid JSON from AI: ${e.message}`);
      }

      if (!response.clauses || !Array.isArray(response.clauses)) {
        throw new Error('AI response missing "clauses" array');
      }

      for (const clause of response.clauses) {
        if (!clause.clause_type || !clause.content || !clause.category) {
          throw new Error('Clause missing required fields');
        }
      }

      // ✨ NEW: Beautiful HTML logging (this is what you wanted!)
      console.log('\n' + '='.repeat(80));
      console.log(`✅ Generated ${response.clauses.length} clauses using ${result.model}`);
      console.log('='.repeat(80));
      console.log('\n📝 RAW HTML CLAUSES (EXACTLY AS STORED IN DATABASE):\n');
      
      response.clauses.forEach((c, i) => {
        console.log(`\n${i + 1}. [${c.clause_type.toUpperCase()}] - Category: ${c.category}`);
        console.log('─'.repeat(80));
        console.log(c.content);
        console.log('─'.repeat(80));
      });
      
      console.log(`\n✅ Total: ${response.clauses.length} HTML clauses generated successfully\n`);
      console.log('='.repeat(80) + '\n');

      return {
        success: true,
        clauses: response.clauses,
        tokensUsed: result.tokensUsed,
        model: result.model
      };

    } catch (error) {
      console.error('❌ AI Generation Error:', error.message || error);
      return { success: false, error: error.message || 'Clause generation failed' };
    }
  }

  // Build prompt for clause generation
  buildClauseGenerationPrompt(documentType, context) {
    const contextStr = Object.keys(context).length > 0
      ? `\n\nContext Information:\n${JSON.stringify(context, null, 2)}`
      : '';

    const clauseSuggestions = this.getClauseSuggestionsForDocumentType(documentType);

    return `Generate all necessary clauses for a ${documentType} document.${contextStr}

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON - start with { and end with }
2. Each clause "content" MUST be valid HTML
3. Use proper HTML tags for structure
4. For offer letters with compensation tables, use full <table> structure
5. Use placeholders like [Company Name], [Employee Name] inside HTML
6. No markdown, no code blocks, no explanations - just raw JSON

EXAMPLE FORMAT (you must follow this exactly):
{
  "clauses": [
    {
      "clause_type": "header",
      "content": "<h1>[Company Name]</h1><p>[Company Address]</p>",
      "category": "${documentType}"
    },
    {
      "clause_type": "compensation",
      "content": "<h2>Compensation Package</h2><table><thead><tr><th>Component</th><th>Amount</th></tr></thead><tbody><tr><td>Base Salary</td><td>[Salary]</td></tr></tbody></table>",
      "category": "${documentType}"
    }
  ]
}

${clauseSuggestions}

NOW GENERATE THE DOCUMENT IN THIS EXACT JSON FORMAT WITH HTML CONTENT.`;
  }

  // Get clause suggestions based on document type
  getClauseSuggestionsForDocumentType(documentType) {
    const suggestions = {
      offer_letter: `Generate these clauses with HTML formatting:
1. header - Company details with <h1> and <p>
2. greeting - "Dear [Candidate Name]," 
3. opening - Introduction paragraph
4. position_details - Job title and department with <h2> and <p>
5. compensation - MUST use full HTML <table> with proper structure
6. benefits - Use <ul> for list
7. start_date - Use <p> with <strong>
8. probation_period - If applicable
9. terms - Use <ol> or <p>
10. closing - Professional closing
11. signature - Signature block with line breaks

CRITICAL: compensation clause MUST be a complete HTML table like:
<table><thead><tr><th>Component</th><th>Amount</th></tr></thead><tbody><tr><td>Base Salary</td><td>[Salary]</td></tr><tr><td>Bonus</td><td>[Bonus]</td></tr></tbody></table>`,

      nda: `Generate with HTML:
1. header - Use <h1>
2. parties - Use <p> or <ul>
3. definitions - Use <h2> and definition list
4. confidential_information - <p> with <strong>
5. obligations - <ol> for numbered items
6. exclusions - <ul> for bullets
7. term - <p>
8. remedies - <p> or <ul>
9. signature - Signature blocks`,

      employment_contract: `Generate comprehensive contract with HTML:
1. Use <h1> for main title
2. Use <h2> for major sections  
3. Use <table> for compensation breakdown
4. Use <ol> for terms and conditions
5. Use <p> for paragraphs`,

      invoice: `Generate invoice with HTML:
1. header - Company info
2. invoice_details - Invoice number, date, etc.
3. bill_to - Customer information
4. items_table - MUST use full HTML <table>
5. totals - Use <table> for subtotal/tax/total`,

      default: `Generate with proper HTML structure:
- Use <h1> for title
- Use <h2> for sections
- Use <table> for tabular data
- Use <ul>/<ol> for lists
- Use <p> for paragraphs`
    };

    return suggestions[documentType] || suggestions.default;
  }

  // Generate template structure with AI suggestions
  async generateTemplateStructure(documentType, description = '', availableClauses = []) {
    try {
      const clausesList = availableClauses.length > 0
        ? `\n\nAvailable clauses:\n${JSON.stringify(availableClauses.map(c => ({
            id: c.id, clause_type: c.clause_type, preview: c.content.substring(0, 100)
          })), null, 2)}`
        : '';

      const prompt = `Create optimal template structure for ${documentType}. ${description}${clausesList}
Return ONLY valid JSON with recommended_clause_ids and missing_clauses. Start with { and end with }`;

      const messages = [
        { role: 'system', content: 'Return ONLY valid JSON, no explanations. Start with { and end with }' },
        { role: 'user', content: prompt }
      ];

      const result = await this.makeAIRequest(messages, 0.6);
      const cleaned = this._extractJSON(result.content);

      return {
        success: true,
        template: JSON.parse(cleaned),
        tokensUsed: result.tokensUsed,
        model: result.model
      };

    } catch (error) {
      console.error('Template Generation Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Fill template with actual data
  async fillTemplate(clauses, data) {
    try {
      const prompt = `Fill placeholders in these HTML clauses with the provided data.
Clauses: ${JSON.stringify(clauses, null, 2)}
Data: ${JSON.stringify(data, null, 2)}

Preserve ALL HTML tags. Replace placeholders like [Company Name] with actual values.
Return ONLY JSON starting with { and ending with } - no explanations.`;

      const messages = [
        { role: 'system', content: 'You replace placeholders while keeping HTML intact. Return ONLY valid JSON starting with { and ending with }' },
        { role: 'user', content: prompt }
      ];

      const result = await this.makeAIRequest(messages, 0.3);
      const cleaned = this._extractJSON(result.content);

      const response = JSON.parse(cleaned);

      return {
        success: true,
        filledDocument: response,
        tokensUsed: result.tokensUsed,
        model: result.model
      };

    } catch (error) {
      console.error('Template Fill Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate a single clause
  async generateSingleClause(clauseType, category, context = {}) {
    try {
      const contextStr = Object.keys(context).length > 0
        ? `\n\nContext:\n${JSON.stringify(context, null, 2)}`
        : '';

      const prompt = `Generate ONE professional clause with HTML content.
Type: ${clauseType}
Category: ${category}${contextStr}

Return ONLY JSON in this exact format (start with { and end with }):
{
  "clause": {
    "clause_type": "${clauseType}",
    "content": "<valid HTML here>"
  }
}

No explanations, no markdown blocks, just the raw JSON object.`;

      const messages = [
        { role: 'system', content: 'Return ONLY valid JSON starting with { and ending with }. No explanations.' },
        { role: 'user', content: prompt }
      ];

      const result = await this.makeAIRequest(messages, 0.7);
      const cleaned = this._extractJSON(result.content);

      const response = JSON.parse(cleaned);

      if (!response.clause?.content) {
        throw new Error('Invalid single clause response');
      }

      // ✨ Log the HTML clause
      console.log('\n' + '='.repeat(80));
      console.log(`✅ Generated single clause: [${clauseType}]`);
      console.log('─'.repeat(80));
      console.log(response.clause.content);
      console.log('='.repeat(80) + '\n');

      return {
        success: true,
        clause: response.clause,
        tokensUsed: result.tokensUsed,
        model: result.model
      };

    } catch (error) {
      console.error('Single Clause Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current AI configuration
  getAIConfig() {
    return {
      provider: USE_OPENROUTER ? 'OpenRouter' : 'OpenAI',
      model: USE_OPENROUTER ? AI_MODEL : (process.env.OPENAI_MODEL || 'gpt-3.5-turbo'),
      is_free: AI_MODEL.includes(':free'),
      api_configured: USE_OPENROUTER ? !!OPENROUTER_API_KEY : !!OPENAI_API_KEY,
      output_format: 'HTML'
    };
  }
}

module.exports = new AIService();