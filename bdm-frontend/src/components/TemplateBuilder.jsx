// bdm-frontend/src/components/TemplateBuilder.jsx
import { useEffect, useState, useMemo } from 'react';
import { templatesAPI, clausesAPI } from '../services/api';
import { Sparkles, Trash2, GripVertical, PlusCircle, Save, ArrowUp, ArrowDown, XCircle } from 'lucide-react';

export default function TemplateBuilder() {
  // Existing states...
  const [templates, setTemplates] = useState([]);
  const [allClauses, setAllClauses] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [draggedClause, setDraggedClause] = useState(null);

  // State for manual template building / editing
  const [editMode, setEditMode] = useState(false); // NEW: Track if editing
  const [currentTemplateId, setCurrentTemplateId] = useState(null); // NEW: ID of template being edited
  const [manualTemplateName, setManualTemplateName] = useState('');
  const [manualTemplateType, setManualTemplateType] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [selectedClauses, setSelectedClauses] = useState([]);
  const [savingManual, setSavingManual] = useState(false);

  // --- Initial Data Loading ---
  useEffect(() => {
    loadInitialData(); // Combined loading function
  }, []);

  // --- Category Extraction ---
  useEffect(() => {
    const uniqueCategories = [...new Set(allClauses.map(c => c.category))].filter(Boolean).sort();
    setCategories(uniqueCategories);
  }, [allClauses]);

  // --- Combined Initial Data Load ---
  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadTemplates(), loadClauses()]); // Load both in parallel
    } catch (err) {
      showNotification('Failed to load initial data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Data Loading Functions ---
  const loadTemplates = async () => {
    try {
      const res = await templatesAPI.getAll();
      // backend responses in your project normally are in res.data.data
      setTemplates(res?.data?.data || res?.data || []);
    } catch (err) {
      console.error("Error loading templates:", err);
      showNotification('Failed to load templates', 'error');
      setTemplates([]);
    }
  };

  const loadClauses = async () => {
    try {
      const res = await clausesAPI.getAll();
      setAllClauses(res?.data?.data || res?.data || []);
    } catch (err) {
      console.error("Error loading clauses:", err);
      showNotification('Failed to load clauses', 'error');
      setAllClauses([]);
    }
  };

  // --- Notification Helper ---
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- AI Template Generation ---
  const handleAICreateTemplate = async () => {
    const docType = window.prompt('Enter document type (e.g., offer_letter, nda, employment_contract):');
    if (!docType) return;
    const templateName = window.prompt('Enter a name for the AI Generated template:', `${docType}_AI_Template_${Date.now()}`);
    if (!templateName) return;

    try {
      setAiLoading(true);
      const res = await templatesAPI.generateAIComplete({
        template_name: templateName,
        document_type: docType,
        description: `AI-generated ${docType} template`
      });

      // Try to detect created template object/ID from common shapes:
      // - res.data.data (your standard responseHandler.success/created)
      // - res.data (sometimes)
      // - res (edge cases)
      const payload = res?.data?.data || res?.data || res;
      const newTemplateId = payload?.id || payload?.template_id || payload?.template?.id || null;

      if (newTemplateId) {
        showNotification('AI template created — opening editor...', 'success');
        // Load template details and open in editor
        await handleSelectTemplateForEdit(newTemplateId);
      } else {
        // Fallback: reload templates and show message
        await loadTemplates();
        showNotification('AI template created. Could not auto-open editor (unexpected response shape).', 'warning');
        console.warn('AI create response (unexpected shape):', res);
      }
    } catch (err) {
      console.error("Error creating AI template:", err);
      showNotification('Failed to create template with AI', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  // --- ⭐ Load Template for Editing ---
  const handleSelectTemplateForEdit = async (templateId) => {
    if (!templateId) {
      // Clear edit mode if "-- Select --" is chosen
      resetManualForm();
      return;
    }

    try {
      setLoading(true); // Indicate loading template details
      const res = await templatesAPI.getById(templateId);
      const templateToEdit = res?.data?.data || res?.data || null;

      if (templateToEdit) {
        setManualTemplateName(templateToEdit.template_name || '');
        setManualTemplateType(templateToEdit.document_type || '');
        setManualDescription(templateToEdit.description || '');
        // Ensure clauses is an array, even if null/undefined from API
        setSelectedClauses(templateToEdit.clauses || []);
        setCurrentTemplateId(templateToEdit.id || templateToEdit.template_id || null); // Store the ID of the template being edited
        setEditMode(true); // Set edit mode
        showNotification(`Editing template: ${templateToEdit.template_name}`, 'info');
      } else {
        showNotification('Template not found', 'error');
        resetManualForm();
      }
    } catch (err) {
      console.error("Error loading template for edit:", err);
      showNotification('Failed to load template details for editing', 'error');
      resetManualForm();
    } finally {
      setLoading(false);
    }
  };

  // --- Reset Manual Form ---
  const resetManualForm = () => {
    setManualTemplateName('');
    setManualTemplateType('');
    setManualDescription('');
    setSelectedClauses([]);
    setCurrentTemplateId(null);
    setEditMode(false);
    // Also reset the dropdown visually if needed
    const selectElement = document.getElementById('edit-template-select');
    if (selectElement) selectElement.value = '';
  };

  // --- Native HTML Drag & Drop Handlers ---
  const handleDragStart = (e, clause) => {
    setDraggedClause(clause);
    e.dataTransfer.effectAllowed = 'copy';
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleDrop = (e) => {
    e.preventDefault();
    if (draggedClause && !selectedClauses.find(c => c.id === draggedClause.id)) {
      setSelectedClauses(prevClauses => [...prevClauses, draggedClause]);
    } else if (draggedClause) {
      showNotification('Clause is already in the template', 'warning');
    }
    setDraggedClause(null);
  };
  const handleDragEnd = () => {
    setDraggedClause(null);
  };

  // --- Manual Template Clause Management ---
  const handleRemoveClause = async (clauseId) => {
    // 1. Optimistically update local state for immediate feedback
    setSelectedClauses(prevClauses => prevClauses.filter(c => c.id !== clauseId));

    // 2. If we are in edit mode, call the API to remove it from the backend template
    if (editMode && currentTemplateId) {
      if (!window.confirm('Also remove this clause from the saved template in the database?')) {
        showNotification('Clause removed visually. Update template to save changes.', 'info');
        return;
      }
      try {
        await templatesAPI.removeClause(currentTemplateId, clauseId);
        showNotification('Clause removed from saved template', 'success');
      } catch (err) {
        console.error("API Error removing clause:", err);
        showNotification('Failed to remove clause from saved template', 'error');
      }
    } else {
      showNotification('Clause removed from current unsaved template', 'info');
    }
  };

  const moveClauseUp = (index) => {
    if (index === 0) return;
    const newClauses = [...selectedClauses];
    [newClauses[index - 1], newClauses[index]] = [newClauses[index], newClauses[index - 1]];
    setSelectedClauses(newClauses);
  };
  const moveClauseDown = (index) => {
    if (index === selectedClauses.length - 1) return;
    const newClauses = [...selectedClauses];
    [newClauses[index], newClauses[index + 1]] = [newClauses[index + 1], newClauses[index]];
    setSelectedClauses(newClauses);
  };

  // --- ⭐ Save or Update Manual Template ---
  const handleSaveOrUpdateManualTemplate = async () => {
    if (!manualTemplateName || !manualTemplateType || selectedClauses.length === 0) {
      return showNotification('Please fill template name, type, and add at least one clause', 'error');
    }

    const templateData = {
      template_name: manualTemplateName,
      document_type: manualTemplateType,
      description: manualDescription || `Manually created/updated ${manualTemplateType} template`,
      clause_ids: selectedClauses.map(c => c.id)
    };

    setSavingManual(true);
    try {
      if (editMode && currentTemplateId) {
        // --- UPDATE EXISTING ---
        await templatesAPI.update(currentTemplateId, {
          template_name: templateData.template_name,
          document_type: templateData.document_type,
          description: templateData.description
        });
        // Optionally update clause relations here with dedicated endpoints
        showNotification('Template metadata updated! (Clause list update requires API changes)', 'success');
      } else {
        // --- CREATE NEW ---
        const res = await templatesAPI.createManual({
          template_name: templateData.template_name,
          document_type: templateData.document_type,
          description: templateData.description,
          clause_ids: templateData.clause_ids
        });
        // If backend returns the created template, open editor automatically
        const created = res?.data?.data || res?.data || res;
        const createdId = created?.id || created?.template_id || null;
        if (createdId) {
          await handleSelectTemplateForEdit(createdId);
          showNotification('Manual template saved and opened for editing', 'success');
        } else {
          showNotification('Manual template saved. (Could not auto-open editor)', 'success');
        }
      }

      // reset form only if everything succeeded
      // resetManualForm(); // we keep user in edit mode if we opened the new template
      await loadTemplates(); // Reload the list of existing templates
    } catch (err) {
      console.error(`Error ${editMode ? 'updating' : 'saving'} manual template:`, err);
      showNotification(`Failed to ${editMode ? 'update' : 'save'} template`, 'error');
    } finally {
      setSavingManual(false);
    }
  };

  // --- Delete Existing Template ---
  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      await templatesAPI.delete(id);
      await loadTemplates(); // Reload templates list
      showNotification('Template deleted', 'success');
      // If the deleted template was being edited, reset the form
      if (id === currentTemplateId) {
        resetManualForm();
      }
    } catch (err) {
      console.error("Error deleting template:", err);
      showNotification('Failed to delete template', 'error');
    }
  };

  // --- Filtering & Grouping Logic ---
  const filteredClauses = useMemo(() => {
    if (!selectedCategory) {
      return allClauses;
    }
    return allClauses.filter(c => c.category === selectedCategory);
  }, [allClauses, selectedCategory]);

  const clausesByCategory = useMemo(() => {
    return filteredClauses.reduce((acc, clause) => {
      const cat = clause.category || 'Uncategorized';
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(clause);
      return acc;
    }, {});
  }, [filteredClauses]);

  // --- JSX Rendering ---
  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
        📝 Template Builder
      </h1>

      {notification && (<div className={`alert alert-${notification.type}`}>{notification.message}</div>)}

      {/* AI Template Generator Button */}
      <div style={{ marginBottom: '2rem' }}>
        <button onClick={handleAICreateTemplate} className="btn btn-primary ai-button" disabled={aiLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={18} /> {aiLoading ? 'Generating...' : 'Generate Template with AI'}
        </button>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>Creates a complete template automatically.</p>
      </div>

      <hr style={{ margin: '2rem 0' }} />

      {/* Manual Drag & Drop Template Builder */}
      <h2>{editMode ? '✏️ Edit Template Manually' : '🏗️ Build Template Manually'} (Drag & Drop)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', marginTop: '1rem', marginBottom: '2rem' }}>

        {/* LEFT: Available Clauses */}
        <div className="card">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>📚 Available Clauses Library</h3>
          {/* Category Filter */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Filter by Category:</label>
            <select className="form-select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} >
              <option value="">All Categories</option>
              {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div className="clause-library-list">
            {Object.keys(clausesByCategory).length === 0 ? (<p className="empty-state-small">No clauses found.</p>) : (
              Object.keys(clausesByCategory).sort().map(category => (
                <div key={category} className="clause-category-group-manual" >
                  <h4 className="category-header">📁 {category}</h4>
                  {clausesByCategory[category].map(clause => (
                    <div key={clause.id} draggable onDragStart={(e) => handleDragStart(e, clause)} onDragEnd={handleDragEnd} className="draggable-clause-item" >
                      <GripVertical size={16} className="drag-icon" />
                      <div className="clause-item-content">
                        <p className="clause-item-title">{clause.clause_type}</p>
                        <p className="clause-item-preview">{(clause.content || '').substring(0, 60)}...</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Template Builder Zone */}
        <div className="card">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
            Template Details & Drop Zone {editMode && `(Editing: ${manualTemplateName})`}
          </h3>
          <div style={{ marginBottom: '1rem' }}>
            <input type="text" placeholder="Template Name *" value={manualTemplateName} onChange={(e) => setManualTemplateName(e.target.value)} className="form-input" required />
            <input type="text" placeholder="Document Type *" value={manualTemplateType} onChange={(e) => setManualTemplateType(e.target.value)} className="form-input" required style={{ marginTop: '0.5rem' }} />
            <textarea placeholder="Description (optional)" value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} className="form-textarea" rows="2" style={{ marginTop: '0.5rem' }} />
          </div>

          {/* Drop Zone */}
          <div className="manual-drop-zone" onDragOver={handleDragOver} onDrop={handleDrop} style={{ backgroundColor: draggedClause ? '#eff6ff' : 'transparent' }}>
            {selectedClauses.length === 0 ? (<div className="empty-state-dropzone"><p>👈 Drag clauses here</p><p>Build your template</p></div>) : (
              selectedClauses.map((clause, index) => (
                <div key={`${clause.id}-${index}`} className="dropped-clause-item">
                  <div className="clause-details">
                    <span className="clause-order">{index + 1}.</span>
                    <span className="clause-type">{clause.clause_type}</span>
                    <span className="clause-category-badge">{clause.category}</span>
                  </div>
                  <p className="clause-content-preview">{(clause.content || '').substring(0, 100)}...</p>
                  <div className="clause-actions">
                    <button onClick={() => moveClauseUp(index)} disabled={index === 0} className="btn-icon"><ArrowUp size={14} /></button>
                    <button onClick={() => moveClauseDown(index)} disabled={index === selectedClauses.length - 1} className="btn-icon"><ArrowDown size={14} /></button>
                    <button onClick={() => handleRemoveClause(clause.id)} className="btn-icon btn-remove"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Save/Update and Cancel Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              onClick={handleSaveOrUpdateManualTemplate}
              disabled={savingManual || selectedClauses.length === 0 || !manualTemplateName || !manualTemplateType}
              className={`btn ${editMode ? 'btn-primary' : 'btn-success'} save-template-button`}
              style={{ flexGrow: 1 }}
            >
              <Save size={18} />
              {savingManual ? 'Saving...' : (editMode ? `Update Template (${selectedClauses.length} clauses)` : `Save New Template (${selectedClauses.length} clauses)`)}
            </button>
            {editMode && (
              <button onClick={resetManualForm} className="btn btn-secondary">
                <XCircle size={18} /> Cancel Edit
              </button>
            )}
          </div>
        </div>
      </div>

      <hr style={{ margin: '2rem 0' }} />

      {/* Existing Templates List */}
      <div className="card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
          📋 Existing Templates (Select to Edit)
        </h2>
        {loading ? (<div className="loading"><div className="spinner"></div><p>Loading...</p></div>) :
          templates.length === 0 ? (<div className="empty-state"><p>No templates found.</p></div>) : (
            <>
              {/* ⭐ Dropdown to select template for editing */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="edit-template-select" className="form-label">Select Template to Edit:</label>
                <select
                  id="edit-template-select"
                  className="form-select"
                  value={editMode ? currentTemplateId || '' : ''}
                  onChange={(e) => handleSelectTemplateForEdit(e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.template_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-2">
                {templates.map((template) => (
                  <div key={template.id} className="card existing-template-card">
                    {template.is_ai_generated && (<span className="ai-badge">🤖 AI</span>)}
                    <h3 className="template-name">{template.template_name}</h3>
                    <p className="template-meta">📄 Type: {template.document_type}</p>
                    {template.description && (<p className="template-description">{template.description}</p>)}
                    <div className="template-footer">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleSelectTemplateForEdit(template.id)}
                          className="btn btn-primary btn-edit-template"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
                        >
                          Edit
                        </button>
                        <button onClick={() => handleDeleteTemplate(template.id)} className="btn btn-danger btn-delete-template">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
      </div>
    </div>
  );
}
