// bdm-frontend/src/components/ClauseManager.jsx
import { useEffect, useState, useRef, useMemo } from 'react';
import { clausesAPI } from '../services/api';
import AIButton from './AIButton';
import { 
  Pencil, Trash2, PlusCircle, Sparkles, Eye, X, 
  GitMerge, Star, Copy, Check 
} from 'lucide-react';
import '../styles/ClauseManager.css';
// ====================================
// Rich Text Editor Component
// ====================================
function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    underline: false,
    ul: false,
    ol: false
  });

  useEffect(() => {
    if (editorRef.current && value !== undefined) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  const updateActiveState = () => {
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
    });
  };

  const execCommand = (cmd) => {
    document.execCommand(cmd, false, null);
    editorRef.current?.focus();
    updateActiveState();
    onChange(editorRef.current.innerHTML);
  };

  const handleInput = () => {
    updateActiveState();
    onChange(editorRef.current.innerHTML);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  return (
    <div className="rte-wrapper">

      {/* Toolbar */}
      <div className="rte-toolbar">
        <button
          type="button"
          className={active.bold ? "active" : ""}
          onClick={() => execCommand("bold")}
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          className={active.italic ? "active" : ""}
          onClick={() => execCommand("italic")}
        >
          <em>I</em>
        </button>

        <button
          type="button"
          className={active.underline ? "active" : ""}
          onClick={() => execCommand("underline")}
        >
          <u>U</u>
        </button>

        <button
          type="button"
          className={active.ul ? "active" : ""}
          onClick={() => execCommand("insertUnorderedList")}
        >
          •
        </button>

        <button
          type="button"
          className={active.ol ? "active" : ""}
          onClick={() => execCommand("insertOrderedList")}
        >
          1.
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        className="rte-editor"
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onClick={updateActiveState}
        onKeyUp={updateActiveState}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      ></div>
    </div>
  );
}

// ====================================
// Main ClauseManager Component
// ====================================
export default function ClauseManager() {
  const [clauses, setClauses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSingleLoading, setAiSingleLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    id: null,
    clause_type: '',
    content: '',
    content_html: '',
    category: '',
    is_sample: false
  });

  // Filter state
  const [view, setView] = useState('normal');
  const [filterCategory, setFilterCategory] = useState('');

  // Notification state
  const [notification, setNotification] = useState(null);

  // Merge state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [pendingMerge, setPendingMerge] = useState(null);

  // Drag and drop state
  const [draggedClause, setDraggedClause] = useState(null);
  const [dragOverClause, setDragOverClause] = useState(null);

  // Preview state
  const [previewClause, setPreviewClause] = useState(null);

  useEffect(() => {
    loadClauses();
  }, []);

  // ====================================
  // Helper Functions
  // ====================================
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const resetForm = () => {
    setFormData({
      id: null,
      clause_type: '',
      content: '',
      content_html: '',
      category: '',
      is_sample: false
    });
  };

  const exitMergeMode = () => {
    setMergeMode(false);
    setSelectedForMerge([]);
    setPendingMerge(null);
    setDraggedClause(null);
    setDragOverClause(null);
  };

  // ====================================
  // Data Loading
  // ====================================
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

  // ====================================
  // CRUD Operations
  // ====================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.clause_type || !formData.category || !formData.content_html) {
      return showNotification('Please fill all required fields', 'error');
    }

    setSaving(true);
    try {
      // Extract plain text from HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formData.content_html;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';

      const payload = {
        clause_type: formData.clause_type,
        content: plainText,
        content_html: formData.content_html,
        category: formData.category,
        is_sample: formData.is_sample
      };

      if (formData.id) {
        await clausesAPI.update(formData.id, payload);
        showNotification('Clause updated successfully!', 'success');
      } else {
        await clausesAPI.createManual(payload);
        showNotification('Clause created successfully!', 'success');
      }

      resetForm();
      loadClauses();
    } catch (error) {
      console.error('Failed to save clause:', error);
      showNotification('Failed to save clause', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (clause) => {
    setFormData({
      id: clause.id,
      clause_type: clause.clause_type,
      content: clause.content,
      content_html: clause.content_html || clause.content,
      category: clause.category,
      is_sample: !!clause.is_sample
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this clause?')) return;

    try {
      await clausesAPI.delete(id);
      loadClauses();
      showNotification('Clause deleted', 'success');
      
      if (formData.id === id) {
        resetForm();
      }
    } catch (error) {
      console.error('Failed to delete clause:', error);
      showNotification('Failed to delete clause', 'error');
    }
  };

  // ====================================
  // Merge Operations
  // ====================================
  const toggleMergeSelection = (clause) => {
    if (selectedForMerge.some(c => c.id === clause.id)) {
      setSelectedForMerge(prev => prev.filter(c => c.id !== clause.id));
    } else {
      setSelectedForMerge(prev => [...prev, clause]);
    }
  };

const handleMergeSelected = () => {
  if (selectedForMerge.length < 2) {
    return showNotification('Select at least 2 clauses to merge', 'error');
  }

  const clause_ids = selectedForMerge.map(c => c.id);
  const clause_type = selectedForMerge.map(c => c.clause_type).join('_and_');
  const category = `merged_${selectedForMerge[0].category || 'general'}`;

  setPendingMerge({
    clause_ids,
    clause_type,
    category,
    sources: selectedForMerge
  });
};


const confirmMerge = async () => {
  if (!pendingMerge) return;

  const clause_ids = pendingMerge.clause_ids;
  const clause_type = pendingMerge.clause_type;
  const category = pendingMerge.category;

  try {
    await clausesAPI.mergeClauses({
      clause_ids,
      clause_type,
      category,
      is_sample: false
    });

    showNotification('Clauses merged successfully!', 'success');

    exitMergeMode();
    loadClauses();
  } catch (error) {
    console.error('Merge failed:', error);
    showNotification('Failed to merge clauses', 'error');
  }
};


  // ====================================
  // Drag and Drop
  // ====================================
  const handleDragStart = (e, clause) => {
    if (!mergeMode) return;
    setDraggedClause(clause);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, clause) => {
    if (!mergeMode || !draggedClause) return;
    e.preventDefault();
    setDragOverClause(clause);
  };

  const handleDragLeave = () => {
    setDragOverClause(null);
  };

const handleDrop = (e, targetClause) => {
  e.preventDefault();

  if (!draggedClause || draggedClause.id === targetClause.id) {
    setDraggedClause(null);
    setDragOverClause(null);
    return;
  }

  // Build merge payload
  setPendingMerge({
    clause_ids: [draggedClause.id, targetClause.id],
    clause_type: `${draggedClause.clause_type}_and_${targetClause.clause_type}`,
    category: `merged_${draggedClause.category || targetClause.category}`,
    sources: [draggedClause, targetClause]
  });

  setDraggedClause(null);
  setDragOverClause(null);
};


  // ====================================
  // Sample Operations
  // ====================================
  const toggleSample = async (clause) => {
    try {
      await clausesAPI.markAsSample(clause.id, !clause.is_sample);
      showNotification(
        clause.is_sample ? 'Unmarked as sample' : 'Marked as sample',
        'success'
      );
      loadClauses();
    } catch (error) {
      console.error('Failed to toggle sample:', error);
      showNotification('Failed to update sample status', 'error');
    }
  };

  const cloneSample = async (clause) => {
    const newCategory = prompt('Enter category for cloned clause:', clause.category);
    if (!newCategory) return;

    try {
      await clausesAPI.cloneSample(clause.id, { category: newCategory });
      showNotification('Sample cloned successfully', 'success');
      loadClauses();
    } catch (error) {
      console.error('Failed to clone sample:', error);
      showNotification('Failed to clone sample', 'error');
    }
  };

  // ====================================
  // AI Operations
  // ====================================
  const handleAIGenerateFullSet = async () => {
    const docType = window.prompt('Enter document type (e.g., offer_letter, nda):');
    if (!docType) return;

    try {
      setAiLoading(true);
      const res = await clausesAPI.generateAI({
        document_type: docType,
        category: docType
      });

      const generatedClauses = res.data.data.clauses;

      if (generatedClauses && generatedClauses.length > 0) {
        const preview = generatedClauses.map((c, i) =>
          `${i + 1}. ${c.clause_type}: ${(c.content || '').substring(0, 80)}...`
        ).join('\n\n');

        if (window.confirm(
          `Generated ${generatedClauses.length} clauses for "${docType}":\n\n${preview}\n\nSave these clauses?`
        )) {
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

  const handleAIGenerateSingle = async () => {
    const clause_type = window.prompt('Enter clause type (e.g., "Confidentiality"):');
    if (!clause_type) return;

    const category = window.prompt('Enter category (e.g., "nda"):');
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

  // ====================================
  // Data Grouping and Filtering
  // ====================================
  const groupedClauses = useMemo(() => {
    let filteredList = clauses;

    if (filterCategory) {
      filteredList = clauses.filter(c =>
        c.category?.toLowerCase().includes(filterCategory.toLowerCase())
      );
    }

    return filteredList.reduce((acc, clause) => {
      const category = clause.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(clause);
      return acc;
    }, {});
  }, [clauses, filterCategory]);

  // ====================================
  // Render
  // ====================================
  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        📜 Clause Manager
        {mergeMode && (
          <span style={{
            marginLeft: '1rem',
            fontSize: '0.875rem',
            padding: '0.25rem 0.75rem',
            background: '#fef3c7',
            color: '#92400e',
            borderRadius: '9999px'
          }}>
            MERGE MODE
          </span>
        )}
      </h1>

      {notification && (
        <div className={`alert alert-${notification.type}`} style={{ marginBottom: '1rem' }}>
          {notification.message}
        </div>
      )}

      {/* Pending Merge Confirmation Bar */}
      {pendingMerge && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Merge Ready:</strong>{' '}
            {pendingMerge.sources.map(s => s.clause_type).join(' + ')} →{' '}
            <em>{pendingMerge.clause_type}</em>
            <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>
              (category: {pendingMerge.category})
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPendingMerge(null)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={confirmMerge}
              className="btn btn-success"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <GitMerge size={16} /> Confirm Merge
            </button>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <button
          onClick={() => mergeMode ? exitMergeMode() : setMergeMode(true)}
          className={`btn ${mergeMode ? 'btn-warning' : 'btn-outline'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <GitMerge size={16} />
          {mergeMode ? 'Exit Merge Mode' : 'Merge Mode'}
        </button>

        {mergeMode && selectedForMerge.length >= 2 && (
          <button
            onClick={handleMergeSelected}
            className="btn btn-success"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <GitMerge size={16} />
            Merge {selectedForMerge.length} Selected
          </button>
        )}

        <AIButton
          onClick={handleAIGenerateSingle}
          loading={aiSingleLoading}
          label="Generate Single (AI)"
        />

        <AIButton
          onClick={handleAIGenerateFullSet}
          loading={aiLoading}
          label="Generate Full Set (AI)"
        />
      </div>

  {/* Create/Edit Clause Card */}
<div className="clause-card">
  <h2 className="clause-card-title">
    {formData.id ? '✏️ Edit Clause' : '➕ Create New Clause'}
  </h2>

  <form onSubmit={handleSubmit} className="clause-form">

    {/* Input Row */}
    <div className="clause-input-row">
      <input
        type="text"
        placeholder="Clause Type (e.g., compensation) *"
        value={formData.clause_type}
        onChange={(e) =>
          setFormData({ ...formData, clause_type: e.target.value })
        }
        required
        className="clause-input"
      />

      <input
        type="text"
        placeholder="Category (e.g., offer_letter) *"
        value={formData.category}
        onChange={(e) =>
          setFormData({ ...formData, category: e.target.value })
        }
        required
        className="clause-input"
      />
    </div>

    {/* BIG Textarea-like Editor */}
    <label className="clause-textarea-label">Clause Content *</label>
    <div className="clause-textarea-box">
      <RichTextEditor
        value={formData.content_html}
        onChange={(html) => setFormData({ ...formData, content_html: html })}
      />
    </div>

    {/* Sample Checkbox */}
    <label className="clause-checkbox">
      <input
        type="checkbox"
        checked={formData.is_sample}
        onChange={(e) =>
          setFormData({ ...formData, is_sample: e.target.checked })
        }
      />
      <span>Mark as sample clause</span>
    </label>

    {/* Buttons */}
    <div className="clause-actions">
      <button
        type="submit"
        disabled={saving}
        className="clause-btn-primary"
      >
        {formData.id ? 'Update Clause' : 'Create Clause'}
      </button>

      {formData.id && (
        <button
          type="button"
          onClick={resetForm}
          className="clause-btn-secondary"
        >
          Cancel Edit
        </button>
      )}
    </div>

  </form>
</div>

{/* View Switcher */}
<div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
  <button
    className={`btn ${view === 'normal' ? 'btn-primary' : 'btn-light'}`}
    onClick={() => setView('normal')}
  >
    Normal Clauses
  </button>

  <button
    className={`btn ${view === 'merged' ? 'btn-primary' : 'btn-light'}`}
    onClick={() => setView('merged')}
  >
    Merged Clauses
  </button>
</div>

{/* Filter */}
<div style={{ marginBottom: '1rem' }}>
  <label style={{ marginRight: '0.5rem', fontWeight: 600 }}>
    {view === 'merged' ? 'Filter Merged Categories:' : 'Filter Categories:'}
  </label>

  <input
    type="text"
    placeholder={view === 'merged' ? "Filter merged_* categories..." : "Filter categories..."}
    value={filterCategory}
    onChange={(e) => setFilterCategory(e.target.value)}
    style={{
      padding: '0.5rem',
      borderRadius: '6px',
      border: '1px solid #e2e8f0',
      minWidth: '250px'
    }}
  />
</div>
{/* Clauses List */}
{loading ? (
  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
    <p>Loading clauses...</p>
  </div>
) : (
  <div className="clause-groups">
    {Object.keys(groupedClauses).length === 0 ? (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
        <p>No clauses found {filterCategory ? 'matching that filter' : ''}.</p>
      </div>
    ) : (
      Object.keys(groupedClauses)

        // 🔥 FILTER: Normal vs Merged
        .filter(cat =>
          view === 'merged'
            ? cat.startsWith('merged_')        // show merged only
            : !cat.startsWith('merged_')       // show normal only
        )

        // 🔥 FILTER: category search input
        .filter(cat =>
          filterCategory.trim() === '' 
            ? true 
            : cat.toLowerCase().includes(filterCategory.toLowerCase())
        )

        .sort()
        .map((category) => (
          <details key={category} open className="clause-category-group">
            <summary
              style={{
                fontWeight: 600,
                fontSize: '1.1rem',
                padding: '0.75rem',
                cursor: 'pointer',
                background: '#f8fafc',
                borderRadius: '8px',
                marginBottom: '0.75rem'
              }}
            >
              {category} ({groupedClauses[category].length})
            </summary>

            <div
              className="grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1rem'
              }}
            >
              {groupedClauses[category].map((clause) => (
                <div
                  key={clause.id}
                  draggable={mergeMode}
                  onDragStart={(e) => handleDragStart(e, clause)}
                  onDragOver={(e) => handleDragOver(e, clause)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, clause)}
                  onClick={() => mergeMode && toggleMergeSelection(clause)}
                  className="card"
                  style={{
                    cursor: mergeMode ? 'pointer' : 'default',
                    border: selectedForMerge.some(c => c.id === clause.id)
                      ? '2px solid #3b82f6'
                      : dragOverClause?.id === clause.id
                      ? '2px dashed #3b82f6'
                      : '1px solid #e2e8f0',
                    background: selectedForMerge.some(c => c.id === clause.id)
                      ? '#eff6ff'
                      : 'white'
                  }}
                >

                  {/* Title + Badges */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem'
                    }}
                  >
                    <h3 style={{ fontWeight: 600, margin: 0 }}>
                      {clause.clause_type}
                    </h3>

                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {clause.is_ai_generated && (
                        <span
                          className="badge"
                          style={{
                            background: '#dbeafe',
                            color: '#1e40af',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem'
                          }}
                        >
                          AI
                        </span>
                      )}

                      {clause.is_sample && (
                        <span
                          className="badge"
                          style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem'
                          }}
                        >
                          ⭐ Sample
                        </span>
                      )}

                      {clause.parent_clause_ids && (
                        <span
                          className="badge"
                          style={{
                            background: '#f3e8ff',
                            color: '#6b21a8',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem'
                          }}
                        >
                          🔗 Merged
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content Preview */}
                  <div
                    style={{
                      color: '#475569',
                      fontSize: '0.875rem',
                      marginBottom: '1rem',
                      maxHeight: '100px',
                      overflow: 'hidden'
                    }}
                    dangerouslySetInnerHTML={{
                      __html:
                        (clause.content_html || clause.content).substring(0, 200) +
                        ((clause.content_html || clause.content).length > 200 ? '...' : '')
                    }}
                  />

                  {/* Action buttons */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginTop: 'auto',
                      flexWrap: 'wrap'
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewClause(clause);
                      }}
                      className="btn btn-outline btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Eye size={14} /> Preview
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(clause);
                      }}
                      className="btn btn-warning btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Pencil size={14} /> Edit
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSample(clause);
                      }}
                      className="btn btn-outline btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Star size={14} />
                      {clause.is_sample ? 'Unmark' : 'Sample'}
                    </button>

                    {clause.is_sample && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cloneSample(clause);
                        }}
                        className="btn btn-success btn-sm"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <Copy size={14} /> Clone
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(clause.id);
                      }}
                      className="btn btn-danger btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Trash2 size={14} /> Delete
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


      {/* Preview Modal */}
      {previewClause && (
        <div
          className="modal-overlay"
          onClick={() => setPreviewClause(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '800px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <div
              className="modal-header"
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h3 style={{ margin: 0 }}>{previewClause.clause_type}</h3>
              <button
                onClick={() => setPreviewClause(null)}
                className="btn-close-modal"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div
              className="modal-body"
              style={{ padding: '1.5rem' }}
              dangerouslySetInnerHTML={{
                __html: previewClause.content_html || previewClause.content
              }}
            />

            <div
              className="modal-footer"
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end'
              }}
            >
              <button
                onClick={() => setPreviewClause(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}