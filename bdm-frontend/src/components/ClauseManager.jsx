// bdm-frontend/src/components/ClauseManager.jsx

import { useEffect, useState, useMemo } from 'react';
import { clausesAPI } from '../services/api';
import AIButton from './AIButton';
import { Pencil, Trash2, PlusCircle, Sparkles } from 'lucide-react';

// Initial state for the form
const emptyClause = { id: null, clause_type: '', content: '', category: '' };

export default function ClauseManager() {
  const [clauses, setClauses] = useState([]);
  const [formData, setFormData] = useState(emptyClause);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSingleLoading, setAiSingleLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadClauses();
  }, []);

  // --- 1. NOTIFICATION HELPER ---
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- 2. DATA FETCHING ---
  const loadClauses = async () => {
    try {
      setLoading(true);
      const response = await clausesAPI.getAll();
      setClauses(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch clauses:', error);
      showNotification('Failed to load clauses', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- 3. CRUD & AI HANDLERS ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.clause_type || !formData.content || !formData.category) {
      return showNotification('Please fill all fields', 'error');
    }
    
    setSaving(true);
    try {
      if (formData.id) {
        // MODIFIED: Handle UPDATE
        await clausesAPI.update(formData.id, formData);
        showNotification('Clause updated successfully!', 'success');
      } else {
        // Handle CREATE
        await clausesAPI.createManual(formData);
        showNotification('Clause created successfully!', 'success');
      }
      setFormData(emptyClause); // Reset form
      loadClauses(); // Reload list
    } catch (error) {
      console.error('Failed to save clause:', error);
      showNotification('Failed to save clause', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (clause) => {
    setFormData(clause);
    window.scrollTo(0, 0); // Scroll to top to see the form
  };

  const handleCancelEdit = () => {
    setFormData(emptyClause);
  };

  const handleDeleteClause = async (id) => {
    if (!window.confirm('Are you sure you want to delete this clause?')) return;
    try {
      await clausesAPI.delete(id);
      loadClauses();
      showNotification('Clause deleted', 'success');
      if (formData.id === id) {
        setFormData(emptyClause); // Clear form if we just deleted what we were editing
      }
    } catch (error) {
      console.error('Failed to delete clause:', error);
      showNotification('Failed to delete clause', 'error');
    }
  };

  // AI: Generate Full Set
  const handleAIGenerateFullSet = async () => {
    const docType = window.prompt('Enter document type to generate a full set of clauses (e.g., offer_letter, nda):');
    if (!docType) return;

    try {
      setAiLoading(true);
      // 1. Generate (Preview)
      const res = await clausesAPI.generateAI({ 
        document_type: docType,
        category: docType 
      });
      
      const generatedClauses = res.data.data.clauses;
      
      if (generatedClauses && generatedClauses.length > 0) {
        // 2. Show preview
        const preview = generatedClauses.map((c, i) => 
          `${i + 1}. ${c.clause_type}: ${c.content.substring(0, 100)}...`
        ).join('\n\n');
        
        // 3. Confirm and Save
        if (window.confirm(`Generated ${generatedClauses.length} clauses for "${docType}":\n\n${preview}\n\nSave these clauses?`)) {
          await clausesAPI.saveAIGenerated(generatedClauses);
          loadClauses();
          showNotification('AI clauses saved!', 'success');
        }
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      showNotification('AI generation failed', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  // NEW: AI: Generate Single Clause
  const handleAIGenerateSingle = async () => {
    const clause_type = window.prompt('Enter the clause type (e.g., "Non-Compete", "Confidentiality"):');
    if (!clause_type) return;
    
    const category = window.prompt('Enter the category (e.g., "nda", "employment_contract"):');
    if (!category) return;

    try {
      setAiSingleLoading(true);
      await clausesAPI.generateSingleAI({ clause_type, category });
      loadClauses();
      showNotification(`AI clause "${clause_type}" saved!`, 'success');
    } catch (error) {
      console.error('AI single generation failed:', error);
      showNotification('AI generation failed', 'error');
    } finally {
      setAiSingleLoading(false);
    }
  };

  // --- 4. DATA GROUPING & FILTERING ---
  const groupedClauses = useMemo(() => {
    const groups = clauses.reduce((acc, clause) => {
      const category = clause.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(clause);
      return acc;
    }, {});

    // Filter the groups based on the search term
    if (!filterCategory) {
      return groups;
    }

    const filteredGroups = {};
    for (const category in groups) {
      if (category.toLowerCase().includes(filterCategory.toLowerCase())) {
        filteredGroups[category] = groups[category];
      }
    }
    return filteredGroups;
  }, [clauses, filterCategory]);

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem' }}>📜 Clause Manager</h1>

      {notification && <div className={`alert alert-${notification.type}`}>{notification.message}</div>}

      {/* MODIFIED: Create/Edit Clause Form */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
          {formData.id ? 'Edit Clause' : 'Create New Clause'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <input
              type="text"
              placeholder="Clause Type (e.g., header, compensation)"
              value={formData.clause_type}
              onChange={(e) => setFormData({ ...formData, clause_type: e.target.value })}
              className="input"
            />
            <textarea
              placeholder="Clause Content... (Use [Placeholders] for variables)"
              rows="4"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="textarea"
            />
            <input
              type="text"
              placeholder="Category (e.g., offer_letter, nda)"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input"
            />
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="submit"
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                disabled={saving}
              >
                <PlusCircle size={16} /> {saving ? 'Saving...' : (formData.id ? 'Save Changes' : 'Add Clause Manually')}
              </button>
              
              {/* NEW: Cancel Edit Button */}
              {formData.id && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    backgroundColor: '#64748b',
                    color: 'white',
                    padding: '0.6rem 1.2rem',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </form>
        
        {/* AI Button Bar */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
          <AIButton 
            onClick={handleAIGenerateSingle} 
            loading={aiSingleLoading} 
            label="Generate Single Clause (AI)" 
          />
          <AIButton 
            onClick={handleAIGenerateFullSet} 
            loading={aiLoading} 
            label="Generate Full Set (AI)" 
          />
        </div>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ marginRight: '0.5rem' }}>Filter by Category:</label>
        <input
          type="text"
          placeholder="Start typing a category..."
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', minWidth: '250px' }}
        />
      </div>

      {/* --- NEW: Grouped Clauses List --- */}
      {loading ? (
        <p>Loading clauses...</p>
      ) : (
        <div className="clause-groups">
          {Object.keys(groupedClauses).length === 0 ? (
            <p>No clauses found{filterCategory ? ' matching that filter' : ''}.</p>
          ) : (
            Object.keys(groupedClauses).sort().map((category) => (
              <details key={category} open className="clause-category-group">
                <summary>
                  {category} ({groupedClauses[category].length})
                </summary>
                <div className="grid">
                  {groupedClauses[category].map((clause) => (
                    <div key={clause.id} className="card">
                      <h3 style={{ fontWeight: 600 }}>{clause.clause_type}</h3>
                      {clause.is_ai_generated && <span className="badge badge-ai">AI</span>}
                      <p style={{ color: '#475569', whiteSpace: 'pre-line', margin: '0.5rem 0' }}>{clause.content}</p>
                      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                        <button
                          style={{
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                          onClick={() => handleEdit(clause)}
                        >
                          <Pencil size={16} /> Edit
                        </button>
                        <button
                          style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                          onClick={() => handleDeleteClause(clause.id)}
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>
      )}
    </div>
  );
}