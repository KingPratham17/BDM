const templateModel = require('../models/templateModel');
const responseHandler = require('../utils/responseHandler');
const AIService = require('../services/aiService');
const clauseModel = require('../models/clauseModel');
class TemplateController {
  
  // Get all templates
  async getAllTemplates(req, res) {
    try {
      const { document_type } = req.query;
      
      const filters = {};
      if (document_type) filters.document_type = document_type;

      const templates = await templateModel.findAll(filters);
      
      return responseHandler.success(res, templates);
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to fetch templates', error);
    }
  }

  // Get template by ID
  async getTemplateById(req, res) {
    try {
      const { id } = req.params;
      const template = await templateModel.findById(id);

      if (!template) {
        return responseHandler.notFound(res, 'Template not found');
      }

      return responseHandler.success(res, template);
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to fetch template', error);
    }
  }

  // Create new template (manual)
  async createTemplate(req, res) {
    try {
      const { template_name, document_type, description, clause_ids } = req.body;

      if (!template_name || !document_type) {
        return responseHandler.badRequest(res, 'template_name and document_type are required');
      }

      const template = await templateModel.create({
        template_name,
        document_type,
        description,
        is_ai_generated: false
      }, clause_ids || []);

      return responseHandler.created(res, template, 'Template created successfully');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to create template', error);
    }
  }

  // Save template (used after AI generation)
  async saveTemplate(req, res) {
    try {
      const { template_name, document_type, description, clause_ids, is_ai_generated = true } = req.body;

      if (!template_name || !document_type || !clause_ids || clause_ids.length === 0) {
        return responseHandler.badRequest(res, 'template_name, document_type, and clause_ids are required');
      }

      const template = await templateModel.create({
        template_name,
        document_type,
        description,
        is_ai_generated
      }, clause_ids);

      return responseHandler.created(res, template, 'Template saved successfully');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to save template', error);
    }
  }

  // Update template
  async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const template = await templateModel.update(id, updateData);

      if (!template) {
        return responseHandler.notFound(res, 'Template not found');
      }

      return responseHandler.success(res, template, 'Template updated successfully');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to update template', error);
    }
  }

  // Delete template
  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const deleted = await templateModel.delete(id);

      if (!deleted) {
        return responseHandler.notFound(res, 'Template not found');
      }

      return responseHandler.success(res, null, 'Template deleted successfully');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to delete template', error);
    }
  }

  // Add clause to template
  async addClause(req, res) {
    try {
      const { id } = req.params;
      const { clause_id, position } = req.body;

      if (!clause_id) {
        return responseHandler.badRequest(res, 'clause_id is required');
      }

      const template = await templateModel.addClause(id, clause_id, position);

      if (!template) {
        return responseHandler.notFound(res, 'Template not found');
      }

      return responseHandler.success(res, template, 'Clause added to template successfully');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to add clause to template', error);
    }
  }

  // Remove clause from template
  async removeClause(req, res) {
    try {
      const { id, clause_id } = req.params;

      const template = await templateModel.removeClause(id, clause_id);

      if (!template) {
        return responseHandler.notFound(res, 'Template not found');
      }

      return responseHandler.success(res, template, 'Clause removed from template successfully');
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to remove clause from template', error);
    }
  }

  // AI-Powered Complete Template Generation (FIX for 404)
  async generateCompleteTemplateWithAI(req, res) {
    try {
      const { document_type, context = {}, template_name, description } = req.body;

      if (!document_type || !template_name) {
        return responseHandler.badRequest(res, 'document_type and template_name are required');
      }

      console.log(`🤖 Generating complete AI template for: ${document_type}`);

      // Step 1: Generate all clauses using the AI service
      // This re-uses the same powerful function from your aiService
      const clausesResult = await AIService.generateClauses(document_type, context);
      
      if (!clausesResult.success) {
        return responseHandler.error(res, 'Failed to generate clauses from AI', 500, clausesResult.error);
      }

      if (clausesResult.clauses.length === 0) {
        return responseHandler.badRequest(res, 'AI returned no clauses for this document type');
      }

      console.log(`💾 Saving ${clausesResult.clauses.length} generated clauses...`);

      // Step 2: Save these new clauses to the database
      const savedClauses = await clauseModel.createMany(
        clausesResult.clauses.map(clause => ({
          ...clause,
          is_ai_generated: true,
          category: document_type // Ensure category matches the document type
        }))
      );

      const clauseIds = savedClauses.map(c => c.id);

      console.log(`📄 Creating template with ${clauseIds.length} clauses...`);

      // Step 3: Create the final template with the new clause IDs
      const template = await templateModel.create({
        template_name,
        document_type,
        description: description || `AI-generated template for ${document_type}`,
        is_ai_generated: true
      }, clauseIds); // Pass the array of IDs

      return responseHandler.created(res, template, 'Complete AI template generated and saved successfully');

  T} catch (error) {
      console.error('Error in generateCompleteTemplateWithAI:', error);
      return responseHandler.serverError(res, 'Failed to generate complete AI template', error);
    }
  }
   // Generate AI-powered template
  async generateAITemplate(req, res) {
    try {
      const { document_type, description } = req.body;

      if (!document_type) {
        return responseHandler.badRequest(res, 'document_type is required');
      }

      const aiResult = await AIService.generateTemplateStructure(document_type, description || '');

      if (!aiResult.success) {
        return responseHandler.serverError(res, 'AI template generation failed', aiResult.error);
      }

      // Optionally save AI template to DB
      const savedTemplate = await templateModel.create({
        template_name: aiResult.template.template_name,
        document_type: aiResult.template.document_type,
        description: aiResult.template.description,
        is_ai_generated: true
      }, aiResult.template.recommended_clause_types || []);

      return responseHandler.created(res, savedTemplate, 'AI template generated and saved successfully');

    } catch (error) {
      console.error(error);
      return responseHandler.serverError(res, 'Server error', error.message);
    }
  }

  // Get templates by document type
  async getTemplatesByDocumentType(req, res) {
    try {
      const { document_type } = req.params;
      const templates = await templateModel.findByDocumentType(document_type);

      return responseHandler.success(res, templates);
    } catch (error) {
      return responseHandler.serverError(res, 'Failed to fetch templates', error);
    }
  }
}

module.exports = new TemplateController();