const clauseModel = require('../models/clauseModel');
const aiService = require('../services/aiService');
const documentModel = require('../models/documentModel');
const responseHandler = require('../utils/responseHandler');
const db = require('../config/database');
class ClauseController {
  async getAllClauses(req, res) {
    try {
      const { category, clause_type } = req.query;
      
      const filters = {};
      if (category) filters.category = category;
      if (clause_type) filters.clause_type = clause_type;

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
      const { clause_type, content, category } = req.body;

      if (!clause_type || !content || !category) {
        return responseHandler.badRequest(res, 'clause_type, content, and category are required');
      }

      const clause = await clauseModel.createClause({
          clause_type,
          content,
          category,
          is_ai_generated: false
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

  // Get clauses by category
  async getClausesByCategory(req, res) {
    try {
      const { category } = req.params;
      const clauses = await clauseModel.findByCategory(category);

      return responseHandler.success(res, clauses);
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to fetch clauses', error);
    }
  }

  async generateClausesWithAI(req, res) {
    try {
      const { document_type, category, context = {} } = req.body;

      if (!document_type) {
        return responseHandler.badRequest(res, 'document_type is required');
      }

      console.log('🤖 Generating clauses with AI...');
      
      const aiResult = await aiService.generateClauses(document_type, context);

      if (!aiResult.success) {
        return responseHandler.error(res, 'AI generation failed', 500, aiResult.error);
      }

      const generatedClauses = aiResult.clauses.map(clause => ({
        ...clause,
        category: category || document_type,
        is_ai_generated: true,
        preview: true 
      }));

      await documentModel.logAIGeneration({
        request_type: 'clause_generation',
        prompt: `Generate ${document_type} clauses`,
        response_data: { clauses_count: generatedClauses.length },
        tokens_used: aiResult.tokensUsed
      });

      return responseHandler.success(res, {
        clauses: generatedClauses,
        tokens_used: aiResult.tokensUsed,
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

      console.log('💾 Saving AI-generated clauses...');

 
      for (const clause of clauses) {
        if (!clause.clause_type || !clause.content || !clause.category) {
          return responseHandler.badRequest(res, 'Each clause must have clause_type, content, and category');
        }
      }


      const savedClauses = await clauseModel.createMany(
        clauses.map(clause => ({
          clause_type: clause.clause_type,
          content: clause.content,
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

      console.log(`🤖 Generating SINGLE clause with AI: ${clause_type} for ${category}`);
      
      const aiResult = await aiService.generateSingleClause(clause_type, category, context);

      if (!aiResult.success) {
        return responseHandler.error(res, 'AI generation failed', 500, aiResult.error);
      }
      const clauseData = {
        clause_type: aiResult.clause.clause_type,
        content: aiResult.clause.content,
        category: category, 
        is_ai_generated: true
      };
      
      const savedClause = await clauseModel.createClause(clauseData);
      
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