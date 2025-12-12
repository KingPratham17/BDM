// tests/api/clauses.test.js
const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../src/config/database');

describe('Clauses API Tests', () => {
  let testClauseId;
  let server;

  // Setup: Create test clause before tests
  beforeAll(async () => {
    // Start server
    server = app.listen(0); // Use random port for testing
    
    const [result] = await pool.execute(
      `INSERT INTO clauses (clause_type, content, category, is_ai_generated) 
       VALUES (?, ?, ?, ?)`,
      ['test_clause', 'Test content', 'test_category', false]
    );
    testClauseId = result.insertId;
  });

  // Cleanup: Remove test data after tests
  afterAll(async () => {
    try {
      // Delete test data
      await pool.execute('DELETE FROM clauses WHERE id = ?', [testClauseId]);
      await pool.execute('DELETE FROM clauses WHERE category = ?', ['test_category']);
      
      // Close server
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      
      // Close database connection
      await pool.end();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  // =================== GET Tests ===================
  describe('GET /api/clauses', () => {
    it('should return all clauses', async () => {
      const res = await request(app)
        .get('/api/clauses')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('should filter clauses by category', async () => {
      const res = await request(app)
        .get('/api/clauses?category=test_category')
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].category).toBe('test_category');
      }
    });
  });

  describe('GET /api/clauses/:id', () => {
    it('should return a specific clause', async () => {
      const res = await request(app)
        .get(`/api/clauses/${testClauseId}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('id', testClauseId);
      expect(res.body.data).toHaveProperty('clause_type', 'test_clause');
    });

    it('should return 404 for non-existent clause', async () => {
      const res = await request(app)
        .get('/api/clauses/999999')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // =================== POST Tests ===================
  describe('POST /api/clauses/manual', () => {
    let createdClauseId;

    afterEach(async () => {
      // Clean up created clauses
      if (createdClauseId) {
        await pool.execute('DELETE FROM clauses WHERE id = ?', [createdClauseId]);
        createdClauseId = null;
      }
    });

    it('should create a new clause', async () => {
      const newClause = {
        clause_type: 'new_test_clause',
        content: 'New test content',
        category: 'test_category',
        is_sample: false
      };

      const res = await request(app)
        .post('/api/clauses/manual')
        .send(newClause)
        .expect(201);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.clause_type).toBe(newClause.clause_type);

      createdClauseId = res.body.data.id;
    });

    it('should return 400 for missing required fields', async () => {
      const invalidClause = { clause_type: 'invalid' };

      const res = await request(app)
        .post('/api/clauses/manual')
        .send(invalidClause)
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // =================== PUT Tests ===================
  describe('PUT /api/clauses/:id', () => {
    it('should update an existing clause', async () => {
      const updates = {
        content: 'Updated test content',
        clause_type: 'updated_test_clause'
      };

      const res = await request(app)
        .put(`/api/clauses/${testClauseId}`)
        .send(updates)
        .expect(200);

      expect(res.body.data.content).toBe(updates.content);
      expect(res.body.data.clause_type).toBe(updates.clause_type);
    });

    it('should return 404 for non-existent clause', async () => {
      const res = await request(app)
        .put('/api/clauses/999999')
        .send({ content: 'test' })
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // =================== DELETE Tests ===================
  describe('DELETE /api/clauses/:id', () => {
    it('should delete a clause', async () => {
      const [result] = await pool.execute(
        `INSERT INTO clauses (clause_type, content, category, is_ai_generated) 
         VALUES (?, ?, ?, ?)`,
        ['delete_test', 'Delete content', 'test', false]
      );
      const deleteId = result.insertId;

      const res = await request(app)
        .delete(`/api/clauses/${deleteId}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);

      const [rows] = await pool.execute('SELECT * FROM clauses WHERE id = ?', [deleteId]);
      expect(rows.length).toBe(0);
    });

    it('should return 404 for non-existent clause', async () => {
      const res = await request(app)
        .delete('/api/clauses/999999')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // =================== Merge Tests ===================
  describe('POST /api/clauses/merge', () => {
    let mergeClauseIds = [];

    afterEach(async () => {
      if (mergeClauseIds.length > 0) {
        const placeholders = mergeClauseIds.map(() => '?').join(',');
        await pool.execute(
          `DELETE FROM clauses WHERE id IN (${placeholders})`,
          mergeClauseIds
        );
        mergeClauseIds = [];
      }
    });

    it('should merge two clauses', async () => {
      const [result1] = await pool.execute(
        `INSERT INTO clauses (clause_type, content, category) VALUES (?, ?, ?)`,
        ['merge1', 'Content 1', 'test']
      );
      const [result2] = await pool.execute(
        `INSERT INTO clauses (clause_type, content, category) VALUES (?, ?, ?)`,
        ['merge2', 'Content 2', 'test']
      );

      mergeClauseIds = [result1.insertId, result2.insertId];

      const res = await request(app)
        .post('/api/clauses/merge')
        .send({
          clause_ids: [result1.insertId, result2.insertId],
          clause_type: 'merged_clause',
          category: 'merged_test'
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('parent_clause_ids');
      mergeClauseIds.push(res.body.data.id);
    });

    it('should return 400 for invalid merge request', async () => {
      const res = await request(app)
        .post('/api/clauses/merge')
        .send({
          clause_ids: [999999, 999998]
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });
  });
});