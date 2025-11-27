const { pool } = require('../config/database');

class TemplateModel {
  
  // Create a new template with clauses
  async create(templateData, clauseIds = []) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const { template_name, document_type, description, is_ai_generated = false } = templateData;
      
      // Insert template
      const templateQuery = `
        INSERT INTO templates (template_name, document_type, description, is_ai_generated, clause_order)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const [templateResult] = await connection.execute(templateQuery, [
        template_name,
        document_type,
        description,
        is_ai_generated,
        JSON.stringify(clauseIds)
      ]);
      
      const templateId = templateResult.insertId;

      // Insert template-clause mappings
      if (clauseIds.length > 0) {
        const mappingQuery = `
          INSERT INTO template_clauses (template_id, clause_id, position)
          VALUES (?, ?, ?)
        `;
        
        for (let i = 0; i < clauseIds.length; i++) {
          await connection.execute(mappingQuery, [templateId, clauseIds[i], i + 1]);
        }
      }

      await connection.commit();
      
      return this.findById(templateId);

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get all templates
  async findAll(filters = {}) {
    let query = 'SELECT * FROM templates WHERE 1=1';
    const params = [];

    if (filters.document_type) {
      query += ' AND document_type = ?';
      params.push(filters.document_type);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Get template by ID with clauses
  async findById(id) {
    const templateQuery = 'SELECT * FROM templates WHERE id = ?';
    const [templates] = await pool.execute(templateQuery, [id]);
    
    if (templates.length === 0) return null;

    const template = templates[0];

    // Get associated clauses
    const clausesQuery = `
      SELECT c.*, tc.position 
      FROM clauses c
      INNER JOIN template_clauses tc ON c.id = tc.clause_id
      WHERE tc.template_id = ?
      ORDER BY tc.position
    `;
    
    const [clauses] = await pool.execute(clausesQuery, [id]);
    
    template.clauses = clauses;
    return template;
  }

  // Update template
  async update(id, updateData) {
    const { template_name, document_type, description } = updateData;
    
    const query = `
      UPDATE templates 
      SET template_name = ?, document_type = ?, description = ?
      WHERE id = ?
    `;
    
    await pool.execute(query, [template_name, document_type, description, id]);
    return this.findById(id);
  }

  // Delete template
  async delete(id) {
    const query = 'DELETE FROM templates WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // Add clause to template
  async addClause(templateId, clauseId, position = null) {
    if (position === null) {
      // Get max position
      const [rows] = await pool.execute(
        'SELECT MAX(position) as max_pos FROM template_clauses WHERE template_id = ?',
        [templateId]
      );
      position = (rows[0].max_pos || 0) + 1;
    }

    const query = `
      INSERT INTO template_clauses (template_id, clause_id, position)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE position = ?
    `;
    
    await pool.execute(query, [templateId, clauseId, position, position]);
    
    // Update clause_order in templates table
    await this.updateClauseOrder(templateId);
    
    return this.findById(templateId);
  }

  // Remove clause from template
  async removeClause(templateId, clauseId) {
    const query = 'DELETE FROM template_clauses WHERE template_id = ? AND clause_id = ?';
    await pool.execute(query, [templateId, clauseId]);
    
    // Update clause_order in templates table
    await this.updateClauseOrder(templateId);
    
    return this.findById(templateId);
  }

  // Update clause order in template
  async updateClauseOrder(templateId) {
    const [clauses] = await pool.execute(
      'SELECT clause_id FROM template_clauses WHERE template_id = ? ORDER BY position',
      [templateId]
    );
    
    const clauseIds = clauses.map(c => c.clause_id);
    
    await pool.execute(
      'UPDATE templates SET clause_order = ? WHERE id = ?',
      [JSON.stringify(clauseIds), templateId]
    );
  }

  // Get templates by document type
  async findByDocumentType(documentType) {
    const query = 'SELECT * FROM templates WHERE document_type = ? ORDER BY created_at DESC';
    const [rows] = await pool.execute(query, [documentType]);
    return rows;
  }
}

module.exports = new TemplateModel();
