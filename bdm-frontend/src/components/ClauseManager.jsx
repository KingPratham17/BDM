// bdm-frontend/src/components/ClauseManager.jsx

import { useEffect, useState, useMemo } from 'react';
import { clausesAPI } from '../services/api';
import AIButton from './AIButton';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';

// Initial form state
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

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null); // "single" | "fullset"
  const [modalInputs, setModalInputs] = useState({
    clause_type: '',
    category: '',
    document_type: ''
  });

  useEffect(() => {
    loadClauses();
  }, []);

  // --- Notification helper ---
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- Fetch all clauses ---
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

  // --- Save clause ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.clause_type || !formData.content || !formData.category) {
      return showNotification('Please fill all fields', 'error');
    }

    setSaving(true);
    try {
      if (formData.id) {
        await clausesAPI.update(formData.id, formData);
        showNotification('Clause updated successfully!', 'success');
      } else {
        await clausesAPI.createManual(formData);
        showNotification('Clause created successfully!', 'success');
      }
      setFormData(emptyClause);
      loadClauses();
    } catch (error) {
      console.error('Failed to save clause:', error);
      showNotification('Failed to save clause', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Edit ---
  const handleEdit = (clause) => {
    setFormData(clause);
    window.scrollTo(0, 0);
  };

  // --- Cancel editing ---
  const handleCancelEdit = () => setFormData(emptyClause);

  // --- Delete clause (unchanged as per your request) ---
  const handleDeleteClause = async (id) => {
    if (!window.confirm('Are you sure you want to delete this clause?')) return;

    try {
      await clausesAPI.delete(id);
      loadClauses();
      showNotification('Clause deleted', 'success');

      if (formData.id === id) setFormData(emptyClause);
    } catch (error) {
      console.error('Failed to delete clause:', error);
      showNotification('Failed to delete clause', 'error');
    }
  };

  // =============== AI MODALS ===================

  const openSingleModal = () => {
    setModalType('single');
    setModalInputs({ clause_type: '', category: '' });
    setShowModal(true);
  };

  const openFullSetModal = () => {
    setModalType('fullset');
    setModalInputs({ document_type: '' });
    setShowModal(true);
  };

  const handleModalSubmit = async () => {
    if (modalType === "single") {
      if (!modalInputs.clause_type || !modalInputs.category) {
        showNotification("Fill all fields", "error");
        return;
      }
      try {
        setAiSingleLoading(true);
        await clausesAPI.generateSingleAI({
          clause_type: modalInputs.clause_type,
          category: modalInputs.category
        });

        loadClauses();
        showNotification(`AI clause "${modalInputs.clause_type}" saved!`, 'success');
        setShowModal(false);
      } catch (error) {
        console.error("AI single generation failed:", error);
        showNotification("AI generation failed", "error");
      } finally {
        setAiSingleLoading(false);
      }
    }

    if (modalType === "fullset") {
      if (!modalInputs.document_type) {
        showNotification("Enter document type", "error");
        return;
      }
      try {
        setAiLoading(true);

        const res = await clausesAPI.generateAI({
          document_type: modalInputs.document_type,
          category: modalInputs.document_type
        });

        const generatedClauses = res.data.data.clauses;

        if (generatedClauses && generatedClauses.length > 0) {
          const preview = generatedClauses
            .map((c, i) => `${i + 1}. ${c.clause_type}: ${c.content.substring(0, 100)}...`)
            .join("\n\n");

          if (window.confirm(`Generated ${generatedClauses.length} clauses:\n\n${preview}\n\nSave?`)) {
            await clausesAPI.saveAIGenerated(generatedClauses);
            loadClauses();
            showNotification("AI clauses saved!", "success");
          }
        }

        setShowModal(false);
      } catch (error) {
        console.error("AI full set generation failed:", error);
        showNotification("AI generation failed", "error");
      } finally {
        setAiLoading(false);
      }
    }
  };

  // =============== GROUP CLAUSES ===============
  const groupedClauses = useMemo(() => {
    const groups = clauses.reduce((acc, clause) => {
      const category = clause.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(clause);
      return acc;
    }, {});

    if (!filterCategory) return groups;

    const filtered = {};
    for (const cat in groups) {
      if (cat.toLowerCase().includes(filterCategory.toLowerCase())) {
        filtered[cat] = groups[cat];
      }
    }
    return filtered;
  }, [clauses, filterCategory]);

  // ================= SIMPLE MODAL =================
  const SimpleModal = ({ title, children, onSubmit, onClose }) => (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '12px',
        width: '450px',
        maxWidth: '90%',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>{title}</h2>
        {children}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
          <button
            onClick={onClose}
            style={{
              background: '#64748b',
              color: 'white',
              padding: '0.5rem 1.2rem',
              borderRadius: '8px',
              border: 'none'
            }}>
            Cancel
          </button>

          <button
            onClick={onSubmit}
            style={{
              background: '#2563eb',
              color: 'white',
              padding: '0.5rem 1.2rem',
              borderRadius: '8px',
              border: 'none'
            }}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );

  // ================== RENDER ==================
  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>📜 Clause Manager</h1>

      {notification && (
        <div className={`alert alert-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* FORM */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
          {formData.id ? "Edit Clause" : "Create New Clause"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: "1rem" }}>
            <input
              type="text"
              className="input"
              placeholder="Clause Type"
              value={formData.clause_type}
              onChange={(e) => setFormData({ ...formData, clause_type: e.target.value })}
            />

            <textarea
              rows="4"
              className="textarea"
              placeholder="Clause Content..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            />

            <input
              type="text"
              className="input"
              placeholder="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />

            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: "#10b981",
                  color: "white",
                  padding: "0.6rem 1.2rem",
                  borderRadius: "8px",
                  border: "none"
                }}>
                <PlusCircle size={16} />
                {saving ? "Saving..." : formData.id ? "Save Changes" : "Add Clause"}
              </button>

              {formData.id && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    background: "#64748b",
                    color: "white",
                    padding: "0.6rem 1.2rem",
                    borderRadius: "8px",
                    border: "none"
                  }}>
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </form>

        {/* AI BUTTONS */}
        <div style={{ marginTop: "1rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem", display: "flex", gap: "1rem" }}>
          <AIButton label="Generate Single Clause (AI)" onClick={openSingleModal} loading={aiSingleLoading} />
          <AIButton label="Generate Full Set (AI)" onClick={openFullSetModal} loading={aiLoading} />
        </div>
      </div>

      {/* FILTER */}
      <input
        type="text"
        placeholder="Filter by category..."
        value={filterCategory}
        onChange={(e) => setFilterCategory(e.target.value)}
        style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "1rem" }}
      />

      {/* GROUPED CLAUSES */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        Object.keys(groupedClauses).sort().map((category) => (
          <details key={category} open>
            <summary>{category} ({groupedClauses[category].length})</summary>

            <div className="grid">
              {groupedClauses[category].map((c) => (
                <div key={c.id} className="card">
                  <h3>{c.clause_type}</h3>
                  <p style={{ whiteSpace: "pre-line" }}>{c.content}</p>

                  <div style={{ display: "flex", gap: "1rem" }}>
                    <button
                      onClick={() => handleEdit(c)}
                      style={{ background: "#f59e0b", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: "6px" }}>
                      <Pencil size={16} /> Edit
                    </button>

                    <button
                      onClick={() => handleDeleteClause(c.id)}
                      style={{ background: "#ef4444", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: "6px" }}>
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))
      )}

      {/* MODAL */}
      {showModal && (
        <SimpleModal
          title={
            modalType === "single"
              ? "Generate Single Clause (AI)"
              : "Generate Full Clause Set (AI)"
          }
          onSubmit={handleModalSubmit}
          onClose={() => setShowModal(false)}
        >
          {/* Clean modal UI fields */}
          {modalType === "single" && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                <label style={{ fontWeight: 600 }}>Clause Type</label>
                <input
                  className="input"
                  placeholder="e.g. Compensation Clause"
                  value={modalInputs.clause_type}
                  onChange={(e) =>
                    setModalInputs({ ...modalInputs, clause_type: e.target.value })
                  }
                />
              </div>

              <div style={{ display: 'grid', gap: '0.4rem' }}>
                <label style={{ fontWeight: 600 }}>Category</label>
                <input
                  className="input"
                  placeholder="e.g. offer_letter / nda"
                  value={modalInputs.category}
                  onChange={(e) =>
                    setModalInputs({ ...modalInputs, category: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {modalType === "fullset" && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                <label style={{ fontWeight: 600 }}>Document Type</label>
                <input
                  className="input"
                  placeholder="e.g. Offer Letter / NDA"
                  value={modalInputs.document_type}
                  onChange={(e) =>
                    setModalInputs({
                      ...modalInputs,
                      document_type: e.target.value
                    })
                  }
                />
              </div>
            </div>
          )}
        </SimpleModal>
      )}
    </div>
  );
}
