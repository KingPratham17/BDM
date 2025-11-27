// src/models/documentModel.js
const { pool } = require('../config/database');

class DocumentModel {
  // Low-level raw query helper used by controllers for ad-hoc queries (e.g. translations table)
  // Returns rows array or null on error (controller can handle null)
  async _rawQuery(sql, params = []) {
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (err) {
      console.error('_rawQuery error:', err, { sql, params });
      return null;
    }
  }

  // Check existence helper (optional)
  async exists(id) {
    const [rows] = await pool.execute('SELECT id FROM documents WHERE id = ?', [id]);
    return rows.length > 0;
  }

  // Create a new document
  async create(documentData) {
    const { 
      template_id = null,
      document_name,
      document_type,
      content_json,
      variables = {},
      pdf_path = null
    } = documentData;
    
    const query = `
      INSERT INTO documents (template_id, document_name, document_type, content_json, variables, pdf_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [
      template_id,
      document_name,
      document_type,
      JSON.stringify(content_json),
      JSON.stringify(variables),
      pdf_path
    ]);
    
    return this.findById(result.insertId);
  }

  // Get all documents (supports optional filters)
  async findAll(filters = {}) {
    let query = 'SELECT * FROM documents WHERE 1=1';
    const params = [];

    if (filters.document_type) {
      query += ' AND document_type = ?';
      params.push(filters.document_type);
    }

    if (filters.template_id) {
      query += ' AND template_id = ?';
      params.push(filters.template_id);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(query, params);
    
    // Safely parse JSON fields
    return rows.map(row => {
      let content_json = null;
      let variables = null;

      try {
        if (row.content_json && typeof row.content_json === 'string') {
          content_json = JSON.parse(row.content_json);
        } else {
          content_json = row.content_json;
        }
      } catch (e) {
        console.error(`Failed to parse content_json for doc ${row.id}:`, e);
        content_json = {};
      }
      
      try {
        if (row.variables && typeof row.variables === 'string') {
          variables = JSON.parse(row.variables);
        } else {
          variables = row.variables;
        }
      } catch (e) {
        console.error(`Failed to parse variables for doc ${row.id}:`, e);
        variables = {};
      }

      return {
        ...row,
        content_json: content_json || {},
        variables: variables || {}
      };
    });
  }

  // Get document by ID
  async findById(id) {
    const query = 'SELECT * FROM documents WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    
    if (rows.length === 0) return null;
    
    const document = rows[0];
    
    // Parse JSON fields only if they're strings
    try {
      if (typeof document.content_json === 'string') {
        document.content_json = JSON.parse(document.content_json);
      }
    } catch (e) {
      console.error(`Failed to parse content_json for doc ${document.id}:`, e);
      document.content_json = document.content_json || {};
    }
    
    try {
      if (typeof document.variables === 'string') {
        document.variables = JSON.parse(document.variables);
      }
    } catch (e) {
      console.error(`Failed to parse variables for doc ${document.id}:`, e);
      document.variables = document.variables || {};
    }
    
    return document;
  }

  // Get documents by document type
  async findByDocumentType(documentType) {
    const query = 'SELECT * FROM documents WHERE document_type = ? ORDER BY created_at DESC';
    const [rows] = await pool.execute(query, [documentType]);
    
    return rows.map(row => {
      try {
        row.content_json = typeof row.content_json === 'string' ? JSON.parse(row.content_json) : row.content_json;
      } catch (e) { row.content_json = {}; }
      try {
        row.variables = typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables;
      } catch (e) { row.variables = {}; }
      return row;
    });
  }

  // Update document
  async update(id, updateData) {
    const fields = [];
    const params = [];

    if (updateData.document_name !== undefined) {
      fields.push('document_name = ?');
      params.push(updateData.document_name);
    }

    if (updateData.content_json !== undefined) {
      fields.push('content_json = ?');
      params.push(JSON.stringify(updateData.content_json));
    }

    if (updateData.variables !== undefined) {
      fields.push('variables = ?');
      params.push(JSON.stringify(updateData.variables));
    }

    if (updateData.pdf_path !== undefined) {
      fields.push('pdf_path = ?');
      params.push(updateData.pdf_path);
    }

    if (fields.length === 0) return this.findById(id);

    params.push(id);
    const query = `UPDATE documents SET ${fields.join(', ')} WHERE id = ?`;
    
    await pool.execute(query, params);
    return this.findById(id);
  }

  // Delete document
  async delete(id) {
    const query = 'DELETE FROM documents WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // Log AI generation
  async logAIGeneration(logData) {
    const { request_type, prompt, response_data, tokens_used = 0, cost_estimate = 0 } = logData;
    
    const query = `
      INSERT INTO ai_generation_logs (request_type, prompt, response_data, tokens_used, cost_estimate)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await pool.execute(query, [
      request_type,
      prompt,
      JSON.stringify(response_data),
      tokens_used,
      cost_estimate
    ]);
  }
}

module.exports = new DocumentModel();
