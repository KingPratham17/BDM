// bdm-backend/src/controllers/clauseController.js
const clauseModel = require('../models/clauseModel');
const aiService = require('../services/aiService');
const documentModel = require('../models/documentModel');
const responseHandler = require('../utils/responseHandler');

class ClauseController {

  /* ========================================
     BASIC CRUD OPERATIONS
  ======================================== */

  async getAllClauses(req, res) {
    try {
      const { category, clause_type, is_sample, is_merged } = req.query;
      
      const filters = {};
      if (category) filters.category = category;
      if (clause_type) filters.clause_type = clause_type;
      if (is_sample !== undefined) filters.is_sample = is_sample === 'true';
      if (is_merged === 'true') filters.is_merged = true;

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
        return responseHandler.badRequest(res, 'clause_type, content, and category are required');
      }

      const clause = await clauseModel.createClause({
        clause_type,
        content,
        content_html: content_html || null,
        category,
        is_ai_generated: false,
        is_sample: is_sample || false
      });

      return responseHandler.created(res, clause, 'Clause created successfully');
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

  /* ========================================
     MERGE OPERATIONS
  ======================================== */

  async mergeClauses(req, res) {
    try {
      const { clause_ids, clause_type, category, is_sample } = req.body;

      // Validation
      if (!Array.isArray(clause_ids) || clause_ids.length < 2) {
        return responseHandler.badRequest(res, 'At least 2 clause_ids required for merge');
      }

      console.log('🔀 Merging clauses:', {
        clause_ids,
        clause_type,
        category,
        is_sample
      });

      const mergedClause = await clauseModel.mergeClauses(clause_ids, {
        clause_type,
        category,
        is_sample
      });

      console.log('✅ Merge successful:', mergedClause.id);

      return responseHandler.created(res, mergedClause, 'Clauses merged successfully');
    } catch (error) {
      console.error('❌ Merge failed:', error.message);
      
      if (error.message.includes('Missing clause IDs')) {
        return responseHandler.badRequest(res, error.message);
      }
      
      return responseHandler.serverError(res, 'Failed to merge clauses', error);
    }
  }

  async getMergedClauses(req, res) {
    try {
      const filters = { is_merged: true };
      
      if (req.query.category) {
        filters.category = req.query.category;
      }

      const mergedClauses = await clauseModel.findAll(filters);

      return responseHandler.success(res, mergedClauses);
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to fetch merged clauses', error);
    }
  }

  /* ========================================
     SAMPLE CLAUSE OPERATIONS
  ======================================== */

  async markAsSample(req, res) {
    try {
      const { id } = req.params;
      const { is_sample } = req.body;

      if (is_sample === undefined) {
        return responseHandler.badRequest(res, 'is_sample field required');
      }

      const updated = await clauseModel.markAsSample(id, is_sample);

      if (!updated) {
        return responseHandler.notFound(res, 'Clause not found');
      }

      return responseHandler.success(
        res, 
        updated, 
        is_sample ? 'Marked as sample' : 'Unmarked as sample'
      );
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to update sample status', error);
    }
  }

  async getAllSamples(req, res) {
    try {
      const { category } = req.query;
      const samples = await clauseModel.findAllSamples(category);

      return responseHandler.success(res, samples);
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to fetch sample clauses', error);
    }
  }

  async cloneSampleClause(req, res) {
    try {
      const { id } = req.params;
      const { category } = req.body || req.query;

      const cloned = await clauseModel.cloneFromSample(id, category);

      return responseHandler.created(res, cloned, 'Sample clause cloned successfully');
    } catch (error) {
      if (error.message === 'Sample clause not found' || 
          error.message === 'Clause is not marked as a sample') {
        return responseHandler.notFound(res, error.message);
      }
      
      return responseHandler.serverError(res, 'Failed to clone sample clause', error);
    }
  }

  /* ========================================
     AI GENERATION OPERATIONS
  ======================================== */

  async generateClausesWithAI(req, res) {
    try {
      const { document_type, category, context = {} } = req.body;

      if (!document_type) {
        return responseHandler.badRequest(res, 'document_type is required');
      }

      console.log('🤖 Generating clauses with AI for:', document_type);
      
      const aiResult = await aiService.generateClauses(document_type, context);

      if (!aiResult.success) {
        return responseHandler.error(res, 'AI generation failed', 500, aiResult.error);
      }

      const generatedClauses = aiResult.clauses.map(clause => ({
        ...clause,
        category: category || document_type,
        is_ai_generated: true,
        preview: true  // Flag to indicate these are preview, not saved yet
      }));

      // Log AI usage
      await documentModel.logAIGeneration({
        request_type: 'clause_generation',
        prompt: `Generate ${document_type} clauses`,
        response_data: { clauses_count: generatedClauses.length },
        tokens_used: aiResult.tokensUsed
      });

      return responseHandler.success(res, {
        clauses: generatedClauses,
        tokens_used: aiResult.tokensUsed,
        model: aiResult.model,
        message: 'Clauses generated. Review and save them.'
      }, 'AI clauses generated successfully');

    } catch (error) {
      console.error('AI clause generation error:', error);
      return responseHandler.serverError(res, 'Failed to generate clauses with AI', error);
    }
  }

  async saveAIGeneratedClauses(req, res) {
    try {
      const { clauses } = req.body;

      if (!clauses || !Array.isArray(clauses) || clauses.length === 0) {
        return responseHandler.badRequest(res, 'clauses array is required');
      }

      console.log('💾 Saving AI-generated clauses:', clauses.length);

      // Validate each clause
      for (const clause of clauses) {
        if (!clause.clause_type || !clause.content || !clause.category) {
          return responseHandler.badRequest(
            res, 
            'Each clause must have clause_type, content, and category'
          );
        }
      }

      const savedClauses = await clauseModel.createMany(
        clauses.map(clause => ({
          clause_type: clause.clause_type,
          content: clause.content,
          content_html: clause.content_html || null,
          category: clause.category,
          is_ai_generated: true
        }))
      );

      return responseHandler.created(res, {
        clauses: savedClauses,
        count: savedClauses.length
      }, 'AI-generated clauses saved successfully');

    } catch (error) {
      return responseHandler.serverError(res, 'Failed to save AI-generated clauses', error);
    }
  }

  async generateSingleClauseWithAI(req, res) {
    try {
      const { clause_type, category, context = {} } = req.body;

      if (!clause_type || !category) {
        return responseHandler.badRequest(res, 'clause_type and category are required');
      }

      console.log(`🤖 Generating single AI clause: ${clause_type} for ${category}`);
      
      const aiResult = await aiService.generateSingleClause(clause_type, category, context);

      if (!aiResult.success) {
        return responseHandler.error(res, 'AI generation failed', 500, aiResult.error);
      }

      const clauseData = {
        clause_type: aiResult.clause.clause_type,
        content: aiResult.clause.content,
        content_html: aiResult.clause.content_html || null,
        category: category,
        is_ai_generated: true
      };
      
      const savedClause = await clauseModel.createClause(clauseData);
      
      // Log AI usage
      await documentModel.logAIGeneration({
        request_type: 'single_clause',
        prompt: `Generate ${clause_type} for ${category}`,
        response_data: { clause_id: savedClause.id },
        tokens_used: aiResult.tokensUsed
      });

      return responseHandler.created(res, savedClause, 'AI clause generated and saved');

    } catch (error) {
      console.error('AI single clause generation error:', error);
      return responseHandler.serverError(res, 'Failed to generate single clause', error);
    }
  }
}

module.exports = new ClauseController();