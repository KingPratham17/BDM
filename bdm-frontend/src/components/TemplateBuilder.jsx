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
import PreviewTemplate from "./PreviewTemplate"; // Assuming you import the correct PreviewTemplate component

export default function TemplateBuilder() {
  // Main states
  const [templates, setTemplates] = useState([]);
  const [allClauses, setAllClauses] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [aiLoading, setAiLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Drag-drop
  const [draggedClause, setDraggedClause] = useState(null);

  // Manual builder states
  const [editMode, setEditMode] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState(null);

  const [manualTemplateName, setManualTemplateName] = useState("");
  const [manualTemplateType, setManualTemplateType] = useState("");
  const [manualDescription, setManualDescription] = useState("");

  const [selectedClauses, setSelectedClauses] = useState([]);
  const [savingManual, setSavingManual] = useState(false);

  // Preview modal (Live Builder Preview)
  const [showPreview, setShowPreview] = useState(false);
  const [previewHTML, setPreviewHTML] = useState("");

  // 🆕 Detailed Template Preview modal (for existing templates)
  const [showTemplateDetailPreview, setShowTemplateDetailPreview] = useState(false);
  const [templateToPreview, setTemplateToPreview] = useState(null);

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadTemplates(), loadClauses()]);
    } catch (err) {
      showNotification("Failed to load initial data", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await templatesAPI.getAll();
      setTemplates(res?.data?.data || []);
    } catch (err) {
      showNotification("Failed to load templates", "error");
    }
  };

  const loadClauses = async () => {
    try {
      const res = await clausesAPI.getAll();
      const clauses = res?.data?.data || [];
      setAllClauses(clauses);

      // 🆕 Extract unique categories and sort them
      const uniqueCategories = [
        ...new Set(clauses.map((c) => c.category).filter(Boolean)),
      ].sort();
      setCategories(uniqueCategories);

    } catch (err) {
      showNotification("Failed to load clauses", "error");
    }
  };

  // Notification helper
  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ---------------------- AI Template ----------------------

  const handleAICreateTemplate = async () => {
    const docType = window.prompt(
      "Enter document type (e.g., offer_letter):"
    );
    if (!docType) return;

    const templateName = window.prompt(
      "Enter template name:",
      `${docType}_AI_${Date.now()}`
    );
    if (!templateName) return;

    try {
      setAiLoading(true);
      await templatesAPI.generateAIComplete({
        template_name: templateName,
        document_type: docType,
        description: `AI-generated template for ${docType}`,
      });

      await loadTemplates();
      showNotification("AI Template created successfully", "success");
    } catch (err) {
      showNotification("Failed to generate AI template", "error");
    } finally {
      setAiLoading(false);
    }
  };

  // --------------------- Edit Template ----------------------

  const handleSelectTemplateForEdit = async (templateId) => {
    if (!templateId) return resetManualForm();

    try {
      const res = await templatesAPI.getById(templateId);
      const t = res.data.data;

      setManualTemplateName(t.template_name);
      setManualTemplateType(t.document_type);
      setManualDescription(t.description);
      // Ensure selectedClauses receives clause objects, not just IDs
      setSelectedClauses(t.clauses || []);

      setEditMode(true);
      setCurrentTemplateId(t.id);

      // Close detailed preview if open
      setShowTemplateDetailPreview(false);
      setTemplateToPreview(null);

      showNotification(`Editing template: ${t.template_name}`, "info");
    } catch (err) {
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

  // ------------------ Drag & Drop ------------------

  const handleDragStart = (e, clause) => {
    setDraggedClause(clause);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedClause) return;

    if (selectedClauses.find((c) => c.id === draggedClause.id)) {
      showNotification("Clause already added!", "warning");
    } else {
      setSelectedClauses((prev) => [...prev, draggedClause]);
    }

    setDraggedClause(null);
  };

  // ------------------ Clause Actions ------------------

  const handleRemoveClause = (id) => {
    setSelectedClauses((prev) => prev.filter((c) => c.id !== id));
  };

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

  // ------------------ Save / Update ------------------

  const handleSaveOrUpdateManualTemplate = async () => {
    if (!manualTemplateName || !manualTemplateType || selectedClauses.length === 0) {
      return showNotification("Fill all details + add clauses", "error");
    }

    const payload = {
      template_name: manualTemplateName,
      document_type: manualTemplateType,
      description:
        manualDescription || `Template for ${manualTemplateType}`,
      clause_ids: selectedClauses.map((c) => c.id),
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
    } catch (err) {
      showNotification("Save failed!", "error");
    } finally {
      setSavingManual(false);
    }
  };

  // 🆕 ------------------ Delete Template ------------------

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;

    try {
      await templatesAPI.delete(templateId);
      await loadTemplates();
      showNotification("Template deleted successfully!", "success");
      // If the deleted template was the one being edited, reset the form.
      if (currentTemplateId === templateId) {
        resetManualForm();
      }
    } catch (err) {
      showNotification("Failed to delete template", "error");
    }
  };

  // 🆕 ------------------ Template Detail Preview ------------------

  const handleTemplateDetailPreview = async (templateId) => {
    try {
      const res = await templatesAPI.getById(templateId);
      const t = res.data.data;

      // Note: t.clauses might be empty for newly generated AI templates, 
      // but for templates retrieved by getById, they should be present.

      setTemplateToPreview(t);
      setShowTemplateDetailPreview(true);
    } catch (err) {
      showNotification("Failed to load template details for preview", "error");
    }
  };

  // ------------------ Live Preview ------------------

  const generateLivePreview = () => {
    if (selectedClauses.length === 0) {
      return showNotification("Add at least one clause", "error");
    }

    let html = `
      <h2 style="text-align:center; margin-bottom:20px;">
        ${manualTemplateName || "Untitled Template"}
      </h2>
      <p style="text-align:center; color:#555; margin-top:-10px;">
        ${manualTemplateType}
      </p>
      <hr style="margin:20px 0;">
    `;

    selectedClauses.forEach((c, i) => {
      html += `
        <h3 style="margin-top:18px;">${i + 1}. ${c.clause_type}</h3>
        <p style="line-height:1.6;">${c.content}</p>
      `;
    });

    setPreviewHTML(html);
    setShowPreview(true);
  };

  // ------------------ Filtering ------------------

  const filteredClauses = useMemo(() => {
    if (!selectedCategory) return allClauses;
    return allClauses.filter((c) => c.category === selectedCategory);
  }, [allClauses, selectedCategory]);

  const clausesByCategory = useMemo(() => {
    return filteredClauses.reduce((acc, c) => {
      (acc[c.category] = acc[c.category] || []).push(c);
      return acc;
    }, {});
  }, [filteredClauses]);

  // ==========================================================
  // ======================== RENDER ===========================
  // ==========================================================

  return (
    <div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>📝 Template Builder</h1>

      {notification && (
        <div className={`alert alert-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* AI */}
      <button
        className="btn btn-primary"
        onClick={handleAICreateTemplate}
        disabled={aiLoading}
      >
        <Sparkles size={18} />{" "}
        {aiLoading ? "Generating..." : "Generate Template with AI"}
      </button>

      <hr style={{ margin: "2rem 0" }} />

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.5fr",
          gap: "2rem",
          marginTop: "1rem",
        }}
      >
        {/* ---------------- LEFT ---------------- */}
        <div className="card">
          <h3>📚 Available Clauses</h3>

          <label>Filter Category</label>
          <select
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <div className="clause-library-list">
            {loading ? (
              <p>Loading clauses...</p>
            ) : Object.keys(clausesByCategory).length === 0 ? (
              <p>No clauses found matching the filter.</p>
            ) : (
              Object.keys(clausesByCategory).map((cat) => (
                <div key={cat}>
                  <h4>📁 {cat}</h4>

                  {clausesByCategory[cat].map((clause) => (
                    <div
                      key={clause.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, clause)}
                      className="draggable-clause-item"
                    >
                      <GripVertical size={16} />
                      <div>
                        <p>{clause.clause_type}</p>
                        <p>{clause.content.substring(0, 60)}...</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ---------------- RIGHT ---------------- */}
        <div className="card">
          <h3>Template Details</h3>

          <input
            placeholder="Template Name *"
            value={manualTemplateName}
            onChange={(e) => setManualTemplateName(e.target.value)}
            className="form-input"
          />

          <input
            placeholder="Document Type *"
            value={manualTemplateType}
            onChange={(e) => setManualTemplateType(e.target.value)}
            className="form-input"
            style={{ marginTop: "0.5rem" }}
          />

          <textarea
            placeholder="Description"
            value={manualDescription}
            onChange={(e) => setManualDescription(e.target.value)}
            className="form-textarea"
            rows="2"
            style={{ marginTop: "0.5rem" }}
          />

          {/* Drop Zone */}
          <div
            className="manual-drop-zone"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {selectedClauses.length === 0 ? (
              <p>Drag clauses here</p>
            ) : (
              selectedClauses.map((clause, index) => (
                <div key={clause.id} className="dropped-clause-item">
                  <div>
                    <span>{index + 1}. </span>
                    <strong>{clause.clause_type}</strong>{" "}
                    <span>({clause.category})</span>
                  </div>

                  <p>{clause.content.substring(0, 80)}...</p>

                  <div className="clause-actions">
                    <button
                      onClick={() => moveClauseUp(index)}
                      disabled={index === 0}
                      className="btn-icon"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveClauseDown(index)}
                      disabled={index === selectedClauses.length - 1}
                      className="btn-icon"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={() => handleRemoveClause(clause.id)}
                      className="btn-icon btn-remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", marginTop: "1rem", gap: "1rem" }}>
            <button className="btn btn-secondary" onClick={generateLivePreview}>
              <Eye size={18} /> Preview Document
            </button>

            {editMode && (
              <button onClick={resetManualForm} className="btn btn-danger">
                <XCircle size={18} /> Cancel Edit
              </button>
            )}
          </div>
        </div>
      </div>

      <hr style={{ margin: "2rem 0" }} />

      {/* Templates List */}
      <div className="card">
        <h2>📋 Existing Templates</h2>

        <select
          id="edit-template-select"
          className="form-select"
          value={editMode ? currentTemplateId || "" : ""}
          onChange={(e) => handleSelectTemplateForEdit(e.target.value)}
        >
          <option value="">-- Select to Edit --</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.template_name}
            </option>
          ))}
        </select>

        <div className="grid grid-2">
          {templates.map((t) => (
            <div key={t.id} className="card existing-template-card">
              <h3>{t.template_name}</h3>
              <p>📄 {t.document_type}</p>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleTemplateDetailPreview(t.id)}
                >
                  <Eye size={14} /> Preview
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => handleSelectTemplateForEdit(t.id)}
                >
                  Edit
                </button>

                <button
                  className="btn btn-danger"
                  onClick={() => handleDeleteTemplate(t.id)}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Sheet (Live Builder) */}
      {showPreview && (
        <div style={styles.overlay}>
          <div style={styles.sheet}>
            <div style={styles.sheetHeader}>
              <h2 style={{ margin: 0 }}>Preview</h2>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveOrUpdateManualTemplate}
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

      {/* 🆕 Template Detail Preview Modal (for existing templates) */}
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

// =================== SHEET STYLES (Used for Live Preview) ====================

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(3px)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    paddingTop: "30px",
    overflowY: "auto",
  },
  sheet: {
    width: "80%",
    maxWidth: "900px",
    background: "white",
    borderRadius: "14px",
    padding: "24px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
    animation: "fadeIn 0.25s ease",
    maxHeight: "90vh",
    overflowY: "auto",
    overflowX: "hidden",
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