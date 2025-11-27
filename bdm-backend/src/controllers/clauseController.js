// bdm-backend/src/controllers/clauseController.js

const clauseModel = require('../models/clauseModel');
const aiService = require('../services/aiService');
const documentModel = require('../models/documentModel');
const responseHandler = require('../utils/responseHandler');

class ClauseController {

  // ============================================================
  // BASIC CRUD
  // ============================================================

  async getAllClauses(req, res) {
    try {
      const { category, clause_type, is_sample, is_merged } = req.query;

      const filters = {};
      if (category) filters.category = category;
      if (clause_type) filters.clause_type = clause_type;

      if (is_sample !== undefined) {
        filters.is_sample = is_sample === 'true';
      }

      if (is_merged === 'true') {
        filters.is_merged = true;
      }

      const clauses = await clauseModel.findAll(filters);

      return responseHandler.success(res, clauses);
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to fetch clauses', error);
    }
  }

  async getClauseById(req, res) {
    try {
      const { id } = req.params;
      const clause = await clauseModel.findById(id);

      if (!clause) {
        return responseHandler.notFound(res, 'Clause not found');
      }

      return responseHandler.success(res, clause);
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to fetch clause', error);
    }
  }

  async createClauseManually(req, res) {
    try {
      const { clause_type, content, content_html, category, is_sample } = req.body;

      if (!clause_type || !content || !category) {
        return responseHandler.badRequest(res, 'clause_type, content and category are required');
      }

      const clause = await clauseModel.createClause({
        clause_type,
        content,
        content_html: content_html || null,
        category,
        is_ai_generated: false,
        is_sample: is_sample || false
      });

      return responseHandler.created(res, clause, 'Clause created manually');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to create clause', error);
    }
  }

  async updateClause(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const clause = await clauseModel.update(id, updateData);

      if (!clause) {
        return responseHandler.notFound(res, 'Clause not found');
      }

      return responseHandler.success(res, clause, 'Clause updated successfully');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to update clause', error);
    }
  }

  async deleteClause(req, res) {
    try {
      const { id } = req.params;
      const deleted = await clauseModel.delete(id);

      if (!deleted) {
        return responseHandler.notFound(res, 'Clause not found');
      }

      return responseHandler.success(res, null, 'Clause deleted successfully');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to delete clause', error);
    }
  }

  async getClausesByCategory(req, res) {
    try {
      const { category } = req.params;
      const clauses = await clauseModel.findByCategory(category);

      return responseHandler.success(res, clauses);
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to fetch clauses', error);
    }
  }

  // ============================================================
  // TASK 1: SAMPLE CLAUSE SUPPORT
  // ============================================================

  async getAllSampleClauses(req, res) {
    try {
      const { category } = req.query;
      const samples = await clauseModel.findAllSamples(category || null);

      return responseHandler.success(res, samples, 'Sample clauses retrieved successfully');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to fetch sample clauses', error);
    }
  }

  async markAsSample(req, res) {
    try {
      const { id } = req.params;
      const { is_sample } = req.body;

      if (is_sample === undefined) {
        return responseHandler.badRequest(res, 'is_sample is required');
      }

      const clause = await clauseModel.markAsSample(id, is_sample);

      if (!clause) {
        return responseHandler.notFound(res, 'Clause not found');
      }

      return responseHandler.success(
        res,
        clause,
        is_sample ? 'Clause marked as sample' : 'Clause unmarked as sample'
      );
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to update sample status', error);
    }
  }

  async cloneSampleClause(req, res) {
    try {
      const { id } = req.params;
      const { category } = req.body;

      const clonedClause = await clauseModel.cloneFromSample(id, category);

      return responseHandler.created(res, clonedClause, 'Sample clause cloned successfully');
    } catch (error) {
      if (error.message === 'Sample clause not found') {
        return responseHandler.notFound(res, error.message);
      }
      return responseHandler.serverError(res, 'Failed to clone sample clause', error);
    }
  }

  // ============================================================
  // TASK 2: MERGE CLAUSES SUPPORT
  // ============================================================

  async mergeClauses(req, res) {
    try {
      const { clause_ids, category, clause_type, is_sample } = req.body;

      if (!clause_ids || !Array.isArray(clause_ids) || clause_ids.length < 2) {
        return responseHandler.badRequest(res, 'clause_ids must contain at least 2 IDs');
      }

      console.log(`🔗 Merging clauses: ${clause_ids.join(', ')}`);

      const merged = await clauseModel.mergeClauses(clause_ids, {
        category,
        clause_type,
        is_sample: is_sample || false
      });

      return responseHandler.created(res, merged, 'Clauses merged successfully');
    } catch (error) {
      console.error('Merge error:', error);
      return responseHandler.serverError(res, 'Failed to merge clauses', error);
    }
  }

  async getMergeHistory(req, res) {
    try {
      const { id } = req.params;

      const history = await clauseModel.getMergeHistory(id);

      return responseHandler.success(res, history, 'Merge history retrieved');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to get merge history', error);
    }
  }

  // ============================================================
  // TASK 3: HTML CONTENT SUPPORT
  // ============================================================

  async updateHTMLContent(req, res) {
    try {
      const { id } = req.params;
      const { content_html } = req.body;

      if (!content_html) {
        return responseHandler.badRequest(res, 'content_html is required');
      }

      const updated = await clauseModel.updateHTMLContent(id, content_html);

      if (!updated) {
        return responseHandler.notFound(res, 'Clause not found');
      }

      return responseHandler.success(res, updated, 'HTML content updated successfully');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to update HTML content', error);
    }
  }

  // ============================================================
  // AI GENERATION (MULTIPLE / SINGLE)
  // ============================================================

  async generateClausesWithAI(req, res) {
    try {
      const { document_type, category, context = {} } = req.body;

      if (!document_type) {
        return responseHandler.badRequest(res, 'document_type is required');
      }

      const aiResult = await aiService.generateClauses(document_type, context);

      if (!aiResult.success) {
        return responseHandler.error(res, 'AI generation failed', 500, aiResult.error);
      }

      const generated = aiResult.clauses.map(c => ({
        ...c,
        category: category || document_type,
        is_ai_generated: true,
        preview: true
      }));

      await documentModel.logAIGeneration({
        request_type: 'clause_generation',
        prompt: `Generate clauses for ${document_type}`,
        response_data: { count: generated.length },
        tokens_used: aiResult.tokensUsed
      });

      return responseHandler.success(
        res,
        { clauses: generated, tokens_used: aiResult.tokensUsed },
        'AI clauses generated'
      );
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to generate clauses with AI', error);
    }
  }

  async saveAIGeneratedClauses(req, res) {
    try {
      const { clauses } = req.body;

      if (!clauses || !Array.isArray(clauses) || clauses.length === 0) {
        return responseHandler.badRequest(res, 'clauses array is required');
      }

      const saved = await clauseModel.createMany(
        clauses.map(c => ({
          clause_type: c.clause_type,
          content: c.content,
          content_html: c.content_html || null,
          category: c.category,
          is_ai_generated: true
        }))
      );

      return responseHandler.created(res, {
        clauses: saved,
        count: saved.length
      }, 'AI clauses saved');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to save AI clauses', error);
    }
  }

  async generateSingleClauseWithAI(req, res) {
    try {
      const { clause_type, category, context = {} } = req.body;

      if (!clause_type || !category) {
        return responseHandler.badRequest(res, 'clause_type and category are required');
      }

      const aiResult = await aiService.generateSingleClause(
        clause_type,
        category,
        context
      );

      if (!aiResult.success) {
        return responseHandler.error(res, 'AI generation failed', 500, aiResult.error);
      }

      const saved = await clauseModel.createClause({
        clause_type: aiResult.clause.clause_type,
        content: aiResult.clause.content,
        category,
        is_ai_generated: true
      });

      await documentModel.logAIGeneration({
        request_type: 'single_clause',
        prompt: `Generate ${clause_type}`,
        response_data: { clause_id: saved.id },
        tokens_used: aiResult.tokensUsed
      });

      return responseHandler.created(res, saved, 'AI clause generated');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to generate single clause', error);
    }
  }
}

module.exports = new ClauseController();
