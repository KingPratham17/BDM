// bdm-frontend/src/components/TemplateBuilder.jsx

import { useEffect, useState, useMemo } from "react";
import { templatesAPI, clausesAPI } from "../services/api";
import {
  Sparkles,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  XCircle,
  Eye
} from "lucide-react";
import PreviewTemplate from "./PreviewTemplate";

export default function TemplateBuilder() {
  // =================== States ===================
  const [templates, setTemplates] = useState([]);
  const [allClauses, setAllClauses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);

  const [aiLoading, setAiLoading] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [notification, setNotification] = useState(null);

  // Drag & Drop
  const [draggedClause, setDraggedClause] = useState(null);

  // Manual template builder
  const [editMode, setEditMode] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState(null);
  const [manualTemplateName, setManualTemplateName] = useState("");
  const [manualTemplateType, setManualTemplateType] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [selectedClauses, setSelectedClauses] = useState([]);

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewHTML, setPreviewHTML] = useState("");

  // Template detail preview
  const [showTemplateDetailPreview, setShowTemplateDetailPreview] = useState(false);
  const [templateToPreview, setTemplateToPreview] = useState(null);

  // AI Template Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiDocType, setAiDocType] = useState("");
  const [aiTemplateName, setAiTemplateName] = useState("");

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);

  // =================== Effects ===================
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadTemplates(), loadClauses()]);
    } catch {
      showNotification("Failed to load initial data", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await templatesAPI.getAll();
      setTemplates(res?.data?.data || []);
    } catch {
      showNotification("Failed to load templates", "error");
    }
  };

  const loadClauses = async () => {
    try {
      const res = await clausesAPI.getAll();
      const clauses = res?.data?.data || [];
      setAllClauses(clauses);

      // Extract unique categories
      const uniqueCategories = [
        ...new Set(clauses.map(c => c.category).filter(Boolean))
      ].sort();
      setCategories(uniqueCategories);
    } catch {
      showNotification("Failed to load clauses", "error");
    }
  };

  // =================== Notifications ===================
  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // =================== AI Template ===================
  const handleAICreateTemplate = () => {
    setAiDocType("");
    setAiTemplateName("");
    setShowAiModal(true);
  };

  const submitAiTemplate = async () => {
    if (!aiDocType || !aiTemplateName) return showNotification("Fill both fields", "error");
    try {
      setAiLoading(true);
      await templatesAPI.generateAIComplete({
        template_name: aiTemplateName,
        document_type: aiDocType,
        description: `AI-generated template for ${aiDocType}`
      });
      await loadTemplates();
      showNotification("AI Template created successfully", "success");
      setShowAiModal(false);
    } catch {
      showNotification("Failed to generate AI template", "error");
    } finally {
      setAiLoading(false);
    }
  };

  // =================== Manual Template ===================
  const handleSelectTemplateForEdit = async (templateId) => {
    if (!templateId) return resetManualForm();
    try {
      const res = await templatesAPI.getById(templateId);
      const t = res.data.data;
      setManualTemplateName(t.template_name);
      setManualTemplateType(t.document_type);
      setManualDescription(t.description);
      setSelectedClauses(t.clauses || []);
      setEditMode(true);
      setCurrentTemplateId(t.id);
      setShowTemplateDetailPreview(false);
      setTemplateToPreview(null);
      showNotification(`Editing template: ${t.template_name}`, "info");
    } catch {
      showNotification("Failed to load template details", "error");
    }
  };

  const resetManualForm = () => {
    setManualTemplateName("");
    setManualTemplateType("");
    setManualDescription("");
    setSelectedClauses([]);
    setCurrentTemplateId(null);
    setEditMode(false);
    const el = document.getElementById("edit-template-select");
    if (el) el.value = "";
  };

  const handleSaveOrUpdateManualTemplate = async () => {
    if (!manualTemplateName || !manualTemplateType || selectedClauses.length === 0) {
      return showNotification("Fill all details + add clauses", "error");
    }
    const payload = {
      template_name: manualTemplateName,
      document_type: manualTemplateType,
      description: manualDescription || `Template for ${manualTemplateType}`,
      clause_ids: selectedClauses.map(c => c.id)
    };
    setSavingManual(true);
    try {
      if (editMode) {
        await templatesAPI.update(currentTemplateId, payload);
        showNotification("Template updated!", "success");
      } else {
        await templatesAPI.createManual(payload);
        showNotification("Template created!", "success");
      }
      resetManualForm();
      await loadTemplates();
      setShowPreview(false);
    } catch {
      showNotification("Save failed!", "error");
    } finally {
      setSavingManual(false);
    }
  };

  // =================== Delete Template ===================
  const confirmDeleteTemplate = (templateId) => {
    setTemplateToDelete(templateId);
    setShowDeleteModal(true);
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    try {
      await templatesAPI.delete(templateToDelete);
      await loadTemplates();
      showNotification("Template deleted successfully!", "success");
      if (currentTemplateId === templateToDelete) resetManualForm();
    } catch {
      showNotification("Failed to delete template", "error");
    } finally {
      setShowDeleteModal(false);
      setTemplateToDelete(null);
    }
  };

  // =================== Drag & Drop ===================
  const handleDragStart = (e, clause) => {
    setDraggedClause(clause);
    e.dataTransfer.effectAllowed = "copy";
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedClause) return;
    if (selectedClauses.find(c => c.id === draggedClause.id)) {
      showNotification("Clause already added!", "warning");
    } else {
      setSelectedClauses(prev => [...prev, draggedClause]);
    }
    setDraggedClause(null);
  };

  const handleRemoveClause = (id) => setSelectedClauses(prev => prev.filter(c => c.id !== id));
  const moveClauseUp = (i) => {
    if (i === 0) return;
    const arr = [...selectedClauses];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    setSelectedClauses(arr);
  };
  const moveClauseDown = (i) => {
    if (i === selectedClauses.length - 1) return;
    const arr = [...selectedClauses];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    setSelectedClauses(arr);
  };

  // =================== Preview ===================
  const generateLivePreview = () => {
    if (selectedClauses.length === 0) return showNotification("Add at least one clause", "error");
    let html = `<h2 style="text-align:center; margin-bottom:20px;">${manualTemplateName || "Untitled Template"}</h2>
                <p style="text-align:center; color:#555; margin-top:-10px;">${manualTemplateType}</p>
                <hr style="margin:20px 0;">`;
    selectedClauses.forEach((c, i) => {
      html += `<h3 style="margin-top:18px;">${i + 1}. ${c.clause_type}</h3>
               <p style="line-height:1.6;">${c.content}</p>`;
    });
    setPreviewHTML(html);
    setShowPreview(true);
  };

  // =================== Filtering ===================
  const filteredClauses = useMemo(() => selectedCategory ? allClauses.filter(c => c.category === selectedCategory) : allClauses, [allClauses, selectedCategory]);
  const clausesByCategory = useMemo(() => {
    return filteredClauses.reduce((acc, c) => {
      (acc[c.category] = acc[c.category] || []).push(c);
      return acc;
    }, {});
  }, [filteredClauses]);

  // =================== Template Detail Preview ===================
  const handleTemplateDetailPreview = async (templateId) => {
    try {
      const res = await templatesAPI.getById(templateId);
      setTemplateToPreview(res.data.data);
      setShowTemplateDetailPreview(true);
    } catch {
      showNotification("Failed to load template details", "error");
    }
  };

  // =================== RENDER ===================
  return (
    <div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>📝 Template Builder</h1>

      {notification && <div className={`alert alert-${notification.type}`}>{notification.message}</div>}

      {/* AI Button */}
      <button className="btn btn-primary" onClick={handleAICreateTemplate} disabled={aiLoading}>
        <Sparkles size={18} /> {aiLoading ? "Generating..." : "Generate Template with AI"}
      </button>

      {/* ================== MAIN GRID ================== */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "2rem", marginTop: "1rem" }}>

        {/* ---------------- LEFT ---------------- */}
        <div className="card">
          <h3>📚 Available Clauses</h3>
          <label>Filter Category</label>
          <select className="form-select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>

          <div className="clause-library-list">
            {loading ? <p>Loading clauses...</p> : 
              Object.keys(clausesByCategory).length === 0 ? <p>No clauses found.</p> :
              Object.keys(clausesByCategory).map((cat) => (
                <div key={cat}>
                  <h4>📁 {cat}</h4>
                  {clausesByCategory[cat].map((clause) => (
                    <div key={clause.id} draggable onDragStart={(e) => handleDragStart(e, clause)} className="draggable-clause-item">
                      <GripVertical size={16} />
                      <div>
                        <p>{clause.clause_type}</p>
                        <p>{clause.content.substring(0, 60)}...</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            }
          </div>
        </div>

        {/* ---------------- RIGHT ---------------- */}
        <div className="card">
          <h3>Template Details</h3>

          <input placeholder="Template Name *" className="form-input" value={manualTemplateName} onChange={e => setManualTemplateName(e.target.value)} />
          <input placeholder="Document Type *" className="form-input" style={{ marginTop: "0.5rem" }} value={manualTemplateType} onChange={e => setManualTemplateType(e.target.value)} />
          <textarea placeholder="Description" className="form-textarea" rows={2} style={{ marginTop: "0.5rem" }} value={manualDescription} onChange={e => setManualDescription(e.target.value)} />

          <div className="manual-drop-zone" onDragOver={handleDragOver} onDrop={handleDrop} style={{ marginTop: "1rem", minHeight: "100px", border: "1px dashed #ccc", padding: "10px" }}>
            {selectedClauses.length === 0 ? <p>Drag clauses here</p> : 
              selectedClauses.map((clause, index) => (
                <div key={clause.id} className="dropped-clause-item" style={{ borderBottom: "1px solid #eee", padding: "5px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span>{index+1}. </span>
                    <strong>{clause.clause_type}</strong> <span>({clause.category})</span>
                    <p>{clause.content.substring(0, 80)}...</p>
                  </div>
                  <div className="clause-actions" style={{ display: "flex", gap: "5px" }}>
                    <button onClick={() => moveClauseUp(index)} disabled={index===0} className="btn-icon"><ArrowUp size={14} /></button>
                    <button onClick={() => moveClauseDown(index)} disabled={index===selectedClauses.length-1} className="btn-icon"><ArrowDown size={14} /></button>
                    <button onClick={() => handleRemoveClause(clause.id)} className="btn-icon btn-remove"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))
            }
          </div>

          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
            <button className="btn btn-secondary" onClick={generateLivePreview}><Eye size={18} /> Preview Document</button>
            {editMode && <button onClick={resetManualForm} className="btn btn-danger"><XCircle size={18} /> Cancel Edit</button>}
          </div>
        </div>
      </div>

      {/* ---------------- Existing Templates ---------------- */}
      <div className="card" style={{ marginTop: "2rem" }}>
        <h2>📋 Existing Templates</h2>
        <select id="edit-template-select" className="form-select" value={editMode ? currentTemplateId || "" : ""} onChange={e => handleSelectTemplateForEdit(e.target.value)}>
          <option value="">-- Select to Edit --</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
        </select>

        <div className="grid grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          {templates.map(t => (
            <div key={t.id} className="card existing-template-card" style={{ padding: "1rem", border: "1px solid #ddd" }}>
              <h3>{t.template_name}</h3>
              <p>📄 {t.document_type}</p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-secondary" onClick={() => handleTemplateDetailPreview(t.id)}><Eye size={14} /> Preview</button>
                <button className="btn btn-primary" onClick={() => handleSelectTemplateForEdit(t.id)}>Edit</button>
                <button className="btn btn-danger" onClick={() => confirmDeleteTemplate(t.id)}><Trash2 size={14} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================== Modals ================== */}

      {/* AI Modal */}
      {showAiModal && (
        <div style={styles.overlay}>
          <div style={{ ...styles.sheet, maxWidth: "400px" }}>
            <h2 style={{ marginBottom: "1rem" }}>Generate AI Template</h2>
            <input className="form-input" placeholder="Document Type" value={aiDocType} onChange={e => setAiDocType(e.target.value)} style={{ marginBottom: "0.5rem" }}/>
            <input className="form-input" placeholder="Template Name" value={aiTemplateName} onChange={e => setAiTemplateName(e.target.value)} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn btn-secondary" onClick={() => setShowAiModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitAiTemplate} disabled={aiLoading}>{aiLoading ? "Generating..." : "Generate"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={styles.overlay}>
          <div style={{ ...styles.sheet, maxWidth: "400px" }}>
            <h2>Confirm Delete</h2>
            <p>Are you sure you want to delete this template?</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteTemplate}>Delete</button>
            </div>
          </div>
        </div>
      )}

           {/* Live Preview */}
      {showPreview && (
        <div style={styles.overlay}>
          <div style={styles.sheet}>
            <div style={styles.sheetHeader}>
              <h2 style={{ margin: 0 }}>Preview</h2>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveOrUpdateManualTemplate}
                  disabled={savingManual}
                >
                  {savingManual ? "Saving..." : "Save Template"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowPreview(false)}
                >
                  Cancel
                </button>
              </div>
            </div>

            <hr style={{ margin: "10px 0" }} />

            <div
              style={styles.document}
              dangerouslySetInnerHTML={{ __html: previewHTML }}
            />
          </div>
        </div>
      )}

      {/* Template Detail Preview Modal */}
      {showTemplateDetailPreview && templateToPreview && (
        <PreviewTemplate
          template={templateToPreview}
          onClose={() => {
            setShowTemplateDetailPreview(false);
            setTemplateToPreview(null);
          }}
        />
      )}
    </div>
  );
}
// =================== SHEET STYLES ===================
const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(3px)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",        // center vertically
    padding: "20px",             // small padding for breathing room
    overflowY: "auto",
  },
  sheet: {
    width: "100%",
    maxWidth: "480px",           // fixed-ish modal width
    background: "white",
    borderRadius: "14px",
    padding: "24px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
    animation: "fadeIn 0.25s ease",
  },
  sheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  document: {
    fontFamily: "Georgia, serif",
    fontSize: "1rem",
    lineHeight: "1.8",
  },
};
