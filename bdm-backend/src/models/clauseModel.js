// bdm-backend/src/models/clauseModel.js
const { pool } = require('../config/database');

class ClauseModel {
  
  /* ========================================
     HELPER FUNCTIONS
  ======================================== */
  
  async findSimilarClauseTypes(clause_type, category) {
    const query = 'SELECT clause_type FROM clauses WHERE clause_type LIKE ? AND category = ?';
    const [rows] = await pool.execute(query, [`${clause_type}%`, category]);
    return rows.map(r => r.clause_type);
  }

  async getUniqueClauseType(clause_type, category) {
    const similar = await this.findSimilarClauseTypes(clause_type, category);
    
    if (!similar.includes(clause_type)) {
      return clause_type;
    }
    
    let counter = 1;
    let newClauseType = `${clause_type}-${counter}`;
    
    while (similar.includes(newClauseType)) {
      counter++;
      newClauseType = `${clause_type}-${counter}`;
    }
    
    return newClauseType;
  }

  parseJSONField(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        console.error('JSON parse error:', e);
        return null;
      }
    }
    return null;
  }

  /* ========================================
     CREATE OPERATIONS
  ======================================== */

  async createClause(data) {
    const {
      clause_type,
      content,
      content_html = null,
      category,
      is_ai_generated = false,
      is_sample = false,
      parent_clause_ids = null,
      formatting_metadata = null,
      merge_order = null
    } = data;

    // Auto-generate unique clause_type if duplicate exists
    const finalClauseType = await this.getUniqueClauseType(clause_type, category);

    const query = `
      INSERT INTO clauses 
      (clause_type, content, content_html, category, is_ai_generated, is_sample, 
       parent_clause_ids, formatting_metadata, merge_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      finalClauseType,
      content,
      content_html,
      category,
      is_ai_generated ? 1 : 0,
      is_sample ? 1 : 0,
      parent_clause_ids ? JSON.stringify(parent_clause_ids) : null,
      formatting_metadata ? JSON.stringify(formatting_metadata) : null,
      merge_order
    ]);

    return this.findById(result.insertId);
  }

  async createMany(clausesArray) {
    const created = [];
    for (const clauseData of clausesArray) {
      const clause = await this.createClause(clauseData);
      created.push(clause);
    }
    return created;
  }

  /* ========================================
     MERGE OPERATION
  ======================================== */

  async mergeClauses(clause_ids, options = {}) {
    if (!Array.isArray(clause_ids) || clause_ids.length < 2) {
      throw new Error('At least 2 clause IDs required for merge');
    }

    // Fetch all clauses
    const clauses = await this.findByIds(clause_ids);
    
    if (clauses.length !== clause_ids.length) {
      const foundIds = clauses.map(c => c.id);
      const missing = clause_ids.filter(id => !foundIds.includes(id));
      throw new Error(`Missing clause IDs: ${missing.join(', ')}`);
    }

    // Maintain order based on provided IDs
    const orderedClauses = clause_ids.map(id => 
      clauses.find(c => c.id === id)
    );

    // Determine merged clause properties
    const baseClause = orderedClauses[0];
    const clause_type = options.clause_type || 
      orderedClauses.map(c => c.clause_type).join('_and_');
    
    const category = options.category || 
      `merged_${baseClause.category || 'general'}`;

    // Merge content (plain text)
    const mergedContent = orderedClauses
      .map(c => c.content)
      .join('\n\n');

    // Merge HTML content (preserve formatting)
    const mergedHTML = orderedClauses
      .map(c => c.content_html || c.content)
      .join('<br><br>\n');

    // Create formatting metadata
    const metadata = {
      merged_at: new Date().toISOString(),
      source_count: clause_ids.length,
      sources: orderedClauses.map((c, idx) => ({
        id: c.id,
        clause_type: c.clause_type,
        category: c.category,
        order: idx + 1
      }))
    };

    // Create the merged clause
    return this.createClause({
      clause_type,
      content: mergedContent,
      content_html: mergedHTML,
      category,
      is_ai_generated: false,
      is_sample: options.is_sample || false,
      parent_clause_ids: clause_ids,
      formatting_metadata: metadata,
      merge_order: 0
    });
  }

  /* ========================================
     READ OPERATIONS
  ======================================== */

  async findAll(filters = {}) {
    let query = 'SELECT * FROM clauses WHERE 1=1';
    const params = [];

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.clause_type) {
      query += ' AND clause_type = ?';
      params.push(filters.clause_type);
    }

    if (filters.is_sample !== undefined) {
      query += ' AND is_sample = ?';
      params.push(filters.is_sample ? 1 : 0);
    }

    if (filters.is_merged === true) {
      query += ' AND parent_clause_ids IS NOT NULL';
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(query, params);
    
    // Parse JSON fields
    return rows.map(row => ({
      ...row,
      parent_clause_ids: this.parseJSONField(row.parent_clause_ids),
      formatting_metadata: this.parseJSONField(row.formatting_metadata)
    }));
  }

  async findById(id) {
    const query = 'SELECT * FROM clauses WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      ...row,
      parent_clause_ids: this.parseJSONField(row.parent_clause_ids),
      formatting_metadata: this.parseJSONField(row.formatting_metadata)
    };
  }

  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT * FROM clauses WHERE id IN (${placeholders})`;
    const [rows] = await pool.execute(query, ids);
    
    return rows.map(row => ({
      ...row,
      parent_clause_ids: this.parseJSONField(row.parent_clause_ids),
      formatting_metadata: this.parseJSONField(row.formatting_metadata)
    }));
  }

  async findByCategory(category) {
    const query = 'SELECT * FROM clauses WHERE category = ? ORDER BY clause_type';
    const [rows] = await pool.execute(query, [category]);
    
    return rows.map(row => ({
      ...row,
      parent_clause_ids: this.parseJSONField(row.parent_clause_ids),
      formatting_metadata: this.parseJSONField(row.formatting_metadata)
    }));
  }

  /* ========================================
     UPDATE OPERATIONS
  ======================================== */

  async update(id, updateData) {
    const allowedFields = [
      'clause_type', 'content', 'content_html', 'category',
      'is_ai_generated', 'is_sample', 'parent_clause_ids',
      'formatting_metadata', 'merge_order'
    ];

    const fields = [];
    const params = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        
        if (key === 'is_ai_generated' || key === 'is_sample') {
          params.push(updateData[key] ? 1 : 0);
        } else if (key === 'parent_clause_ids' || key === 'formatting_metadata') {
          params.push(updateData[key] ? JSON.stringify(updateData[key]) : null);
        } else {
          params.push(updateData[key]);
        }
      }
    });

    if (fields.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    const query = `UPDATE clauses SET ${fields.join(', ')} WHERE id = ?`;
    
    await pool.execute(query, params);
    return this.findById(id);
  }

  /* ========================================
     DELETE OPERATIONS
  ======================================== */

  async delete(id) {
    const query = 'DELETE FROM clauses WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }

  /* ========================================
     SAMPLE CLAUSE OPERATIONS
  ======================================== */

  async markAsSample(id, isSample) {
    await pool.execute(
      'UPDATE clauses SET is_sample = ? WHERE id = ?',
      [isSample ? 1 : 0, id]
    );
    return this.findById(id);
  }

  async findAllSamples(category = null) {
    let query = 'SELECT * FROM clauses WHERE is_sample = 1';
    const params = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY category, clause_type';
    
    const [rows] = await pool.execute(query, params);
    return rows.map(row => ({
      ...row,
      parent_clause_ids: this.parseJSONField(row.parent_clause_ids),
      formatting_metadata: this.parseJSONField(row.formatting_metadata)
    }));
  }

  async cloneFromSample(sampleId, newCategory) {
    const sample = await this.findById(sampleId);
    
    if (!sample) {
      throw new Error('Sample clause not found');
    }
    
    if (!sample.is_sample) {
      throw new Error('Clause is not marked as a sample');
    }

    return this.createClause({
      clause_type: sample.clause_type,
      content: sample.content,
      content_html: sample.content_html,
      category: newCategory || sample.category,
      is_ai_generated: false,
      is_sample: false
    });
  }
}

module.exports = new ClauseModel();