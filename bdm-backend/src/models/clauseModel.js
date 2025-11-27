// bdm-backend/src/models/clauseModel.js

const { pool } = require('../config/database');

class ClauseModel {

  // ============================================================
  // TASK 1: SAMPLE CLAUSE SUPPORT
  // ============================================================

  // Mark clause as sample (reusable template)
  async markAsSample(clauseId, isSample = true) {
    const query = 'UPDATE clauses SET is_sample = ? WHERE id = ?';
    await pool.execute(query, [isSample, clauseId]);
    return this.findById(clauseId);
  }

  // Get all sample clauses (optionally by category)
  async findAllSamples(category = null) {
    let query = 'SELECT * FROM clauses WHERE is_sample = TRUE';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY category, clause_type';
    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Clone a sample clause (not marked as sample)
  async cloneFromSample(sampleId, newCategory = null) {
    const sample = await this.findById(sampleId);
    if (!sample) throw new Error('Sample clause not found');

    const clonedClause = {
      clause_type: sample.clause_type,
      content: sample.content,
      content_html: sample.content_html,
      category: newCategory || sample.category,
      is_ai_generated: false,
      is_sample: false,
      formatting_metadata: sample.formatting_metadata
    };

    return this.createClause(clonedClause);
  }

  // ============================================================
  // TASK 2: CLAUSE MERGING SUPPORT
  // ============================================================

  async mergeClauses(clauseIds, mergeOptions = {}) {
    if (!Array.isArray(clauseIds) || clauseIds.length < 2) {
      throw new Error('Need at least 2 clauses to merge');
    }

    // Load clauses in the ORDER provided
    const clauses = [];
    for (const id of clauseIds) {
      const clause = await this.findById(id);
      if (!clause) throw new Error(`Clause ID ${id} not found`);
      clauses.push(clause);
    }

    // Determine merged category & type
    const baseCategory = clauses[0].category;
    const mergedCategory = mergeOptions.category || `merged_${baseCategory}`;

    const mergedClauseType = mergeOptions.clause_type ||
      clauses.map(c => c.clause_type).join('_and_');

    // Merge CONTENT (text)
    const mergedContent = clauses.map(c => c.content).join('\n\n');

    // Merge HTML
    let mergedContentHtml = null;
    if (clauses.some(c => c.content_html)) {
      mergedContentHtml = clauses
        .map(c => c.content_html || c.content)
        .join('<br><br>');
    }

    // Build metadata
    const formattingMeta = {
      merged: true,
      merge_timestamp: new Date().toISOString(),
      source_clauses: clauses.map((c, i) => ({
        id: c.id,
        clause_type: c.clause_type,
        order: i + 1
      }))
    };

    const mergedClause = {
      clause_type: mergedClauseType,
      content: mergedContent,
      content_html: mergedContentHtml,
      category: mergedCategory,
      is_ai_generated: false,
      is_sample: mergeOptions.is_sample || false,
      parent_clause_ids: JSON.stringify(clauseIds),
      merge_order: clauseIds.length,
      formatting_metadata: JSON.stringify(formattingMeta)
    };

    return this.createMergedClause(mergedClause);
  }

  // Create merged clause without auto-increment suffix
  async createMergedClause(clauseData) {
    const {
      clause_type, content, content_html,
      category, is_ai_generated,
      is_sample, formatting_metadata,
      parent_clause_ids, merge_order
    } = clauseData;

    const query = `
      INSERT INTO clauses (
        clause_type, content, content_html, category,
        is_ai_generated, is_sample,
        formatting_metadata, parent_clause_ids, merge_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      clause_type,
      content,
      content_html || null,
      category,
      is_ai_generated,
      is_sample,
      formatting_metadata,
      parent_clause_ids,
      merge_order
    ]);

    return this.findById(result.insertId);
  }

  // Merge history resolution
  async getMergeHistory(clauseId) {
    const clause = await this.findById(clauseId);
    if (!clause || !clause.parent_clause_ids) {
      return { isMerged: false, parents: [] };
    }

    try {
      const parentIds = JSON.parse(clause.parent_clause_ids);
      const parents = await this.findByIds(parentIds);
      return { isMerged: true, parents };
    } catch (err) {
      console.error('Error parsing merge parents:', err);
      return { isMerged: false, parents: [] };
    }
  }

  // ============================================================
  // TASK 3: HTML CONTENT SUPPORT
  // ============================================================

  async createClauseWithHTML(clauseData) {
    const {
      clause_type, content, content_html,
      category, is_ai_generated = false,
      is_sample = false, formatting_metadata = null,
      parent_clause_ids = null
    } = clauseData;

    // Auto-increment duplicates
    const uniqueClauseType = await this.getUniqueClauseType(clause_type, category);

    const query = `
      INSERT INTO clauses (
        clause_type, content, content_html, category,
        is_ai_generated, is_sample,
        formatting_metadata, parent_clause_ids
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      uniqueClauseType,
      content,
      content_html || null,
      category,
      is_ai_generated,
      is_sample,
      formatting_metadata ? JSON.stringify(formatting_metadata) : null,
      parent_clause_ids
    ]);

    return {
      id: result.insertId,
      clause_type: uniqueClauseType,
      content,
      content_html,
      category,
      is_ai_generated,
      is_sample,
      formatting_metadata,
      parent_clause_ids
    };
  }

  async updateHTMLContent(clauseId, content_html) {
    const query = 'UPDATE clauses SET content_html = ? WHERE id = ?';
    await pool.execute(query, [content_html, clauseId]);
    return this.findById(clauseId);
  }

  // ============================================================
  // HELPERS (duplicate handling)
  // ============================================================

  async findSimilarClauseTypes(clause_type, category) {
    const [rows] = await pool.execute(
      'SELECT clause_type FROM clauses WHERE clause_type LIKE ? AND category = ?',
      [`${clause_type}%`, category]
    );
    return rows.map(r => r.clause_type);
  }

  async getUniqueClauseType(clause_type, category) {
    const similar = await this.findSimilarClauseTypes(clause_type, category);

    if (!similar.includes(clause_type)) {
      return clause_type;
    }

    let counter = 1;
    let newType = `${clause_type}-${counter}`;
    while (similar.includes(newType)) {
      counter++;
      newType = `${clause_type}-${counter}`;
    }
    return newType;
  }

  // ============================================================
  // MAIN CREATE (auto chooses HTML or normal)
  // ============================================================

  async createClause(clauseData) {
    if (clauseData.content_html || clauseData.parent_clause_ids) {
      return this.createClauseWithHTML(clauseData);
    }

    // Normal text clause
    let { clause_type, content, category, is_ai_generated = false, is_sample = false } = clauseData;

    const uniqueClauseType = await this.getUniqueClauseType(clause_type, category);

    const query = `
      INSERT INTO clauses (clause_type, content, category, is_ai_generated, is_sample)
      VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      uniqueClauseType,
      content,
      category,
      is_ai_generated,
      is_sample
    ]);

    return {
      id: result.insertId,
      clause_type: uniqueClauseType,
      content,
      category,
      is_ai_generated,
      is_sample
    };
  }

  async createMany(clausesArray) {
    const out = [];
    for (const c of clausesArray) {
      out.push(await this.createClause(c));
    }
    return out;
  }

  // ============================================================
  // READ METHODS
  // ============================================================

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
      params.push(filters.is_sample);
    }

    if (filters.is_merged) {
      query += ' AND parent_clause_ids IS NOT NULL';
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(query, params);

    // Parse JSON fields
    return rows.map(r => {
      if (r.formatting_metadata && typeof r.formatting_metadata === 'string') {
        try {
          r.formatting_metadata = JSON.parse(r.formatting_metadata);
        } catch {
          r.formatting_metadata = null;
        }
      }
      return r;
    });
  }

  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM clauses WHERE id = ?', [id]);
    if (!rows.length) return null;

    const clause = rows[0];

    if (clause.formatting_metadata && typeof clause.formatting_metadata === 'string') {
      try {
        clause.formatting_metadata = JSON.parse(clause.formatting_metadata);
      } catch {
        clause.formatting_metadata = null;
      }
    }

    return clause;
  }

  async findByIds(ids) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.execute(`SELECT * FROM clauses WHERE id IN (${placeholders})`, ids);
    return rows;
  }

  // ============================================================
  // UPDATE / DELETE
  // ============================================================

  async update(id, updateData) {
    const fields = [];
    const params = [];

    if (updateData.clause_type !== undefined) {
      fields.push('clause_type = ?');
      params.push(updateData.clause_type);
    }
    if (updateData.content !== undefined) {
      fields.push('content = ?');
      params.push(updateData.content);
    }
    if (updateData.content_html !== undefined) {
      fields.push('content_html = ?');
      params.push(updateData.content_html);
    }
    if (updateData.category !== undefined) {
      fields.push('category = ?');
      params.push(updateData.category);
    }
    if (updateData.is_sample !== undefined) {
      fields.push('is_sample = ?');
      params.push(updateData.is_sample);
    }

    if (!fields.length) return this.findById(id);

    params.push(id);

    await pool.execute(`UPDATE clauses SET ${fields.join(', ')} WHERE id = ?`, params);

    return this.findById(id);
  }

  async delete(id) {
    const [result] = await pool.execute('DELETE FROM clauses WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  async findByCategory(category) {
    const [rows] = await pool.execute(
      'SELECT * FROM clauses WHERE category = ? ORDER BY clause_type',
      [category]
    );
    return rows;
  }
}

module.exports = new ClauseModel();
