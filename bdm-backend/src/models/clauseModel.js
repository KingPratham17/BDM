const { pool } = require('../config/database');

class ClauseModel {
  // bdm-backend/src/models/clauseModel.js

  // Helper to find similar clause types in the same category
  async findSimilarClauseTypes(clause_type, category) {
    const query = 'SELECT clause_type FROM clauses WHERE clause_type LIKE ? AND category = ?';
    // Find 'header', 'header-1', 'header-2', etc.
    const [rows] = await pool.execute(query, [`${clause_type}%`, category]);
    return rows.map(r => r.clause_type);
  }

  // Create a single clause (MODIFIED for duplicate handling)
  async createClause(clauseData) {
    let { clause_type, content, category, is_ai_generated = false } = clauseData;

    // --- DUPLICATE HANDLING LOGIC ---
    const similarTypes = await this.findSimilarClauseTypes(clause_type, category);
    
    if (similarTypes.includes(clause_type)) {
      // If 'header' already exists, find the next available number
      let counter = 1;
      let newClauseType = `${clause_type}-${counter}`;
      
      // Keep incrementing (header-1, header-2) until we find an unused name
      while (similarTypes.includes(newClauseType)) {
        counter++;
        newClauseType = `${clause_type}-${counter}`;
      }
      clause_type = newClauseType; // Assign the new, unique name
      console.log(`Duplicate found. Renaming clause to: ${clause_type}`);
    }
    // --- END DUPLICATE HANDLING ---

    const query = `
      INSERT INTO clauses (clause_type, content, category, is_ai_generated)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      clause_type,
      content,
      category,
      is_ai_generated
    ]);

    return {
      id: result.insertId,
      ...clauseData,
      clause_type // Return the (potentially modified) clause_type
    };
  }

  // Create multiple clauses at once (MODIFIED to use new createClause)
  async createMany(clausesArray) {
    const createdClauses = [];
    // We must loop (not Promise.all) to ensure duplicate check logic
    // runs sequentially for each clause in the array.
    for (const clause of clausesArray) {
      const created = await this.createClause(clause);
      createdClauses.push(created);
    }
    return createdClauses;
  }
  // Get all clauses with optional filters
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

    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Get clause by ID
  async findById(id) {
    const query = 'SELECT * FROM clauses WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  // Get multiple clauses by IDs
  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT * FROM clauses WHERE id IN (${placeholders})`;
    const [rows] = await pool.execute(query, ids);
    return rows;
  }

  // Update a clause
  async update(id, updateData) {
    const { clause_type, content, category } = updateData;
    const query = `
      UPDATE clauses
      SET clause_type = ?, content = ?, category = ?
      WHERE id = ?
    `;
    await pool.execute(query, [clause_type, content, category, id]);
    return this.findById(id);
  }

  // Delete a clause
  async delete(id) {
    const query = 'DELETE FROM clauses WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // Get clauses by category
  async findByCategory(category) {
    const query = 'SELECT * FROM clauses WHERE category = ? ORDER BY clause_type';
    const [rows] = await pool.execute(query, [category]);
    return rows;
  }
}

module.exports = new ClauseModel();
