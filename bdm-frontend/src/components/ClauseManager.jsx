import { useEffect, useState, useRef } from 'react';
import { clausesAPI } from '../services/api';
import AIButton from './AIButton';
import {
  Pencil,
  Trash2,
  PlusCircle,
  Sparkles,
  Copy,
  GitMerge,
  Star,
  Eye,
  ChevronDown,
  X
} from 'lucide-react';
import '../styles/ClauseManager.css';


const removeRTL = (html) => {
  return html
    .replace(/\u202B|\u202E|\u202A|\u202D|\u2066|\u2067|\u2068|\u200F|\u200E/g, "")
    .replace(/dir="rtl"/g, "")
    .replace(/direction:\s*rtl/gi, "");
};

// Simple inline rich text editor component (keeps using execCommand for simplicity)


function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    underline: false,
    list: false,
    heading: false
  });

  // Remove all RTL markers
  const sanitizeLTR = (html) => {
    return html
      .replace(/dir="rtl"/g, '')
      .replace(/direction:\s*rtl/gi, '')
      .replace(/\u202B|\u202E|\u200F|\u200E/g, '');
  };

  const updateActiveState = () => {
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      list: document.queryCommandState("insertUnorderedList"),
      heading: document.queryCommandValue("formatBlock") === "h3"
    });
  };

  const applyFormat = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    triggerChange();
    updateActiveState();
  };

  const handleToggle = (format) => {
    if (format === "list") return applyFormat("insertUnorderedList");
    if (format === "heading") return applyFormat("formatBlock", "h3");
    return applyFormat(format);
  };

const triggerChange = () => {
  let html = editorRef.current?.innerHTML || '';
  html = removeRTL(html);   // remove mirroring characters
  editorRef.current.innerHTML = html; // update editor
  onChange(html);
};


  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    triggerChange();
  };

  return (
    <div className="rte">
      <div className="rte-toolbar">

        <button
          type="button"
          className={`rte-btn ${active.bold ? "active" : ""}`}
          onClick={() => handleToggle("bold")}
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          className={`rte-btn ${active.italic ? "active" : ""}`}
          onClick={() => handleToggle("italic")}
        >
          <em>I</em>
        </button>

        <button
          type="button"
          className={`rte-btn ${active.underline ? "active" : ""}`}
          onClick={() => handleToggle("underline")}
        >
          <u>U</u>
        </button>

        <button
          type="button"
          className={`rte-btn ${active.list ? "active" : ""}`}
          onClick={() => handleToggle("list")}
        >
          • List
        </button>

        <button
          type="button"
          className={`rte-btn ${active.heading ? "active" : ""}`}
          onClick={() => handleToggle("heading")}
        >
          H
        </button>

      </div>

      <div
        className="rte-editor"
        contentEditable
        ref={editorRef}
        onInput={() => { triggerChange(); updateActiveState(); }}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: value || "" }}
        data-placeholder={placeholder}
      />
    </div>
  );
}


function ClauseCard({
  clause,
  mergeMode,
  isSelected,
  isDragOver,
  onEdit,
  onDelete,
  onToggleSample,
  onClone,
  onToggleSelect,
  onPreview,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop
}) {
  // safe preview snippet
  const snippet = (clause.content_html || clause.content || '').slice(0, 220);

  return (
    <div
      className={`clause-card ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable={mergeMode}
      onDragStart={(e) => onDragStart(e, clause)}
      onDragOver={(e) => onDragOver(e, clause)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, clause)}
    >
      <div className="card-badges">
        {clause.is_ai_generated && <span className="badge badge-ai">🤖 AI</span>}
        {clause.is_sample && <span className="badge badge-sample">⭐ Sample</span>}
        {clause.parent_clause_ids && <span className="badge badge-merged">🔗 Merged</span>}
      </div>

      {mergeMode && (
        <input
          type="checkbox"
          className="merge-checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(clause)}
        />
      )}

      <h4 className="clause-type">{clause.clause_type}</h4>
      <p className="clause-meta">📁 {clause.category}</p>

      <div
        className="clause-snippet"
        dangerouslySetInnerHTML={{ __html: snippet + (snippet.length >= 220 ? '...' : '') }}
      />

      <div className="card-actions">
        <button className="btn btn-ghost" onClick={() => onPreview(clause)} title="Preview">
          <Eye size={14} /> Preview
        </button>
        <button className="btn btn-warning" onClick={() => onEdit(clause)} title="Edit">
          <Pencil size={14} /> Edit
        </button>
        {clause.is_sample && (
          <button className="btn btn-success" onClick={() => onClone(clause)} title="Clone">
            <Copy size={14} /> Clone
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => onToggleSample(clause)} title="Toggle Sample">
          <Star size={14} /> {clause.is_sample ? 'Unsample' : 'Sample'}
        </button>
        <button className="btn btn-danger" onClick={() => onDelete(clause.id)} title="Delete">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}

export default function ClauseManager() {
  const [clauses, setClauses] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    clause_type: '',
    content: '',
    content_html: '',
    category: '',
    is_sample: false
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiFullLoading, setAiFullLoading] = useState(false);
  const [aiSingleLoading, setAiSingleLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [showSamplesOnly, setShowSamplesOnly] = useState(false);
  const [notification, setNotification] = useState(null);

  // Merge UI state
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [mergeMode, setMergeMode] = useState(false);
  const [draggedClause, setDraggedClause] = useState(null);
  const [dragOverClause, setDragOverClause] = useState(null);

  // Preview state
  const [previewClause, setPreviewClause] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadClauses();
    // eslint-disable-next-line
  }, [showSamplesOnly]);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadClauses = async (params = {}) => {
    try {
      setLoading(true);
      const query = { ...params };
      if (filterCategory) query.category = filterCategory;
      if (showSamplesOnly) query.is_sample = 'true';
      const res = await clausesAPI.getAll(query);
      setClauses(res?.data?.data || []);
    } catch (err) {
      console.error('Failed to load clauses', err);
      showNotification('Failed to load clauses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const htmlToPlainText = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent || div.innerText || '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.clause_type || !formData.content_html || !formData.category) {
      return showNotification('Please fill clause type, content and category', 'error');
    }

    setSaving(true);
    try {
      const payload = {
        clause_type: formData.clause_type,
        content: htmlToPlainText(formData.content_html),
        content_html: formData.content_html,
        category: formData.category,
        is_sample: formData.is_sample
      };

      if (formData.id) {
        await clausesAPI.update(formData.id, payload);
        showNotification('Clause updated', 'success');
      } else {
        await clausesAPI.createManual(payload);
        showNotification('Clause created', 'success');
      }

      setFormData({
        id: null,
        clause_type: '',
        content: '',
        content_html: '',
        category: '',
        is_sample: false
      });
      await loadClauses();
    } catch (err) {
      console.error('Save failed', err);
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
      is_sample: clause.is_sample || false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClause = async (id) => {
    if (!window.confirm('Delete this clause?')) return;
    try {
      await clausesAPI.delete(id);
      showNotification('Deleted', 'success');
      if (formData.id === id) {
        setFormData({
          id: null,
          clause_type: '',
          content: '',
          content_html: '',
          category: '',
          is_sample: false
        });
      }
      await loadClauses();
    } catch (err) {
      console.error(err);
      showNotification('Delete failed', 'error');
    }
  };

  // SAMPLE FUNCTIONS
  const handleToggleSample = async (clause) => {
    try {
      await clausesAPI.markAsSample(clause.id, !clause.is_sample);
      showNotification(clause.is_sample ? 'Unmarked sample' : 'Marked sample', 'success');
      await loadClauses();
    } catch (err) {
      console.error(err);
      showNotification('Failed to update sample', 'error');
    }
  };

  const handleCloneSample = async (clause) => {
    const newCategory = window.prompt('Clone to which category?', clause.category || '');
    if (!newCategory) return;
    try {
      await clausesAPI.cloneSample(clause.id, { category: newCategory });
      showNotification('Sample cloned', 'success');
      await loadClauses();
    } catch (err) {
      console.error(err);
      showNotification('Clone failed', 'error');
    }
  };

  // MERGE FUNCTIONS
  const toggleMergeMode = () => {
    setMergeMode(!mergeMode);
    setSelectedForMerge([]);
    setDraggedClause(null);
    setDragOverClause(null);
  };

  const toggleSelectForMerge = (clause) => {
    setSelectedForMerge((prev) => {
      if (prev.find((c) => c.id === clause.id)) return prev.filter((c) => c.id !== clause.id);
      return [...prev, clause];
    });
  };

  const handleMergeSelected = async () => {
    if (selectedForMerge.length < 2) {
      return showNotification('Select at least 2 clauses to merge', 'error');
    }

    const clauseTypes = selectedForMerge.map((c) => c.clause_type).join('_and_');
    const mergedCategory = `merged_${selectedForMerge[0].category || 'general'}`;

    if (!window.confirm(`Merge ${selectedForMerge.length} clauses into "${clauseTypes}"?`)) return;

    try {
      await clausesAPI.mergeClauses({
        clause_ids: selectedForMerge.map((c) => c.id),
        category: mergedCategory,
        clause_type: clauseTypes
      });
      showNotification('Merged successfully', 'success');
      setMergeMode(false);
      setSelectedForMerge([]);
      await loadClauses();
    } catch (err) {
      console.error(err);
      showNotification('Merge failed', 'error');
    }
  };

  // Drag & drop merge
  const handleDragStart = (e, clause) => {
    if (!mergeMode) return;
    setDraggedClause(clause);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetClause) => {
    if (!mergeMode || !draggedClause || draggedClause.id === targetClause.id) return;
    e.preventDefault();
    setDragOverClause(targetClause);
  };

  const handleDragLeave = () => setDragOverClause(null);

  const handleDrop = async (e, targetClause) => {
    e.preventDefault();
    if (!draggedClause || draggedClause.id === targetClause.id) return;

    const mergedType = `${draggedClause.clause_type}_and_${targetClause.clause_type}`;
    const mergedCategory = `merged_${draggedClause.category || 'general'}`;

    if (!window.confirm(`Merge "${draggedClause.clause_type}" and "${targetClause.clause_type}"?`)) {
      setDraggedClause(null);
      setDragOverClause(null);
      return;
    }

    try {
      await clausesAPI.mergeClauses({
        clause_ids: [draggedClause.id, targetClause.id],
        category: mergedCategory,
        clause_type: mergedType
      });
      showNotification('Merge success', 'success');
      setDraggedClause(null);
      setDragOverClause(null);
      await loadClauses();
    } catch (err) {
      console.error(err);
      showNotification('Merge failed', 'error');
    }
  };

  // AI functions
  const handleAIFullDocument = async () => {
    const docType = window.prompt('Document type to generate (e.g., offer_letter):');
    if (!docType) return;
    try {
      setAiFullLoading(true);
      const res = await clausesAPI.generateAI({ document_type: docType, category: docType });
      const generated = res?.data?.data?.clauses || [];
      if (generated.length === 0) return showNotification('AI returned no clauses', 'error');

      const preview = generated.map((c, i) => `${i + 1}. ${c.clause_type}`).join('\n');
      if (window.confirm(`Generated ${generated.length} clauses:\n\n${preview}\n\nSave them?`)) {
        await clausesAPI.saveAIGenerated(generated);
        showNotification('AI clauses saved', 'success');
        await loadClauses();
      }
    } catch (err) {
      console.error(err);
      showNotification('AI generation failed', 'error');
    } finally {
      setAiFullLoading(false);
    }
  };

  const handleAISingleClause = async () => {
    const clauseType = window.prompt('Clause type (e.g., confidentiality):');
    if (!clauseType) return;
    const category = window.prompt('Category (e.g., nda):');
    if (!category) return;

    try {
      setAiSingleLoading(true);
      await clausesAPI.generateSingleAI({ clause_type: clauseType, category });
      showNotification('AI single clause saved', 'success');
      await loadClauses();
    } catch (err) {
      console.error(err);
      showNotification('AI failed', 'error');
    } finally {
      setAiSingleLoading(false);
    }
  };

  const handlePreviewClause = (clause) => {
    setPreviewClause(clause);
    setShowPreview(true);
  };

  const groupedClauses = clauses.reduce((acc, c) => {
    const cat = c.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  return (
    <div className="page-wrap">
      <div className="header-row">
        <div>
          <h1 className="page-title">Clause Manager</h1>
          <p className="subtitle">Manage, merge, preview and generate legal/business clauses — beautiful UI.</p>
        </div>
        <div className="header-actions">
          <button className={`mode-btn ${mergeMode ? 'active' : ''}`} onClick={toggleMergeMode}>
            <GitMerge size={16} /> {mergeMode ? 'Exit Merge Mode' : 'Merge Mode'}
          </button>


          <button
               className="mode-btn"
                            onClick={() => loadClauses({ is_merged: 'true' })}
            >
              🔗 View Merged
          </button>
          <label className="checkbox-inline">
            <input type="checkbox" checked={showSamplesOnly} onChange={(e) => setShowSamplesOnly(e.target.checked)} />
            <Star size={14} /> Samples
          </label>
          <AIButton onClick={handleAISingleClause} loading={aiSingleLoading} label="AI Single" />
          <AIButton onClick={handleAIFullDocument} loading={aiFullLoading} label="AI Full Set" />
        </div>
      </div>

      {notification && <div className={`toast toast-${notification.type}`}>{notification.message}</div>}

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label className="label">Clause Type</label>
              <input
                className="input"
                placeholder="e.g., header, compensation"
                value={formData.clause_type}
                onChange={(e) => setFormData({ ...formData, clause_type: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Category</label>
              <input
                className="input"
                placeholder="e.g., offer_letter, nda"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label">Content (Rich Text — HTML saved)</label>
              <RichTextEditor
                value={formData.content_html}
                onChange={(html) => setFormData({ ...formData, content_html: html })}
                placeholder="Write clause content. Use [Placeholders]."
              />
            </div>

            <div className="form-row form-row-actions" style={{ gridColumn: '1 / -1' }}>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={formData.is_sample}
                  onChange={(e) => setFormData({ ...formData, is_sample: e.target.checked })}
                />
                <Star size={14} /> Mark as Sample
              </label>

              <div className="form-btns">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  <PlusCircle size={16} /> {saving ? 'Saving...' : formData.id ? 'Update Clause' : 'Create Clause'}
                </button>
                {formData.id && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() =>
                      setFormData({
                        id: null,
                        clause_type: '',
                        content: '',
                        content_html: '',
                        category: '',
                        is_sample: false
                      })
                    }
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="controls-row">
        <div className="search-area">
          <input
            className="input input-sm"
            placeholder="Filter category..."
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          />
          <button className="btn btn-outline" onClick={() => loadClauses()}>
            Apply
          </button>
        </div>

        {mergeMode && selectedForMerge.length >= 2 && (
          <div>
            <button className="btn btn-success" onClick={handleMergeSelected}>
              <GitMerge size={14} /> Merge {selectedForMerge.length}
            </button>
          </div>
        )}
      </div>

      <div className="groups">
        {loading ? (
          <div className="loading">Loading clauses...</div>
        ) : Object.keys(groupedClauses).length === 0 ? (
          <div className="empty">No clauses found.</div>
        ) : (
          Object.keys(groupedClauses)
            .sort()
            .map((category) => (
              <details key={category} className="group" open>
                <summary className="group-summary">
                  <div>
                    <span className="group-title">📁 {category}</span>
                    <span className="group-count">{groupedClauses[category].length}</span>
                  </div>
                  <ChevronDown size={18} />
                </summary>

                <div className="cards-grid">
                  {groupedClauses[category].map((clause) => {
                    const isSelected = selectedForMerge.some((c) => c.id === clause.id);
                    const isDragOver = dragOverClause?.id === clause.id;
                    return (
                      <ClauseCard
                        key={clause.id}
                        clause={clause}
                        mergeMode={mergeMode}
                        isSelected={isSelected}
                        isDragOver={isDragOver}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClause}
                        onToggleSample={handleToggleSample}
                        onClone={handleCloneSample}
                        onToggleSelect={toggleSelectForMerge}
                        onPreview={handlePreviewClause}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      />
                    );
                  })}
                </div>
              </details>
            ))
        )}
      </div>

      {/* Preview modal */}
      {showPreview && previewClause && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{previewClause.clause_type}</h3>
                <p className="meta">{previewClause.category} {previewClause.is_sample ? ' • ⭐ Sample' : ''}</p>
              </div>
              <button className="close-btn" onClick={() => setShowPreview(false)}><X /></button>
            </div>
            <div className="modal-body">
              <div className="preview-content" dangerouslySetInnerHTML={{ __html: previewClause.content_html || previewClause.content }} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowPreview(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
