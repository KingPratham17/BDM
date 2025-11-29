// bdm-frontend/src/components/PreviewTemplate.jsx

import React, { useState } from "react";
import { X, ChevronDown, ChevronUp, FileText } from "lucide-react";

export default function PreviewTemplate({ template, onClose }) {
  if (!template) return null;

  const [openClauseIndex, setOpenClauseIndex] = useState(null);

  const toggleClause = (index) => {
    setOpenClauseIndex(openClauseIndex === index ? null : index);
  };
  
  // NOTE: This assumes an export mechanism exists on the backend to create a PDF from the template structure
  
  const handleExportPDF = () => {
    alert(
      "PDF export functionality is not implemented in the frontend. You would typically call a backend API endpoint here."
    );
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{template.template_name}</h2>
            <p style={styles.subtitle}>📄 {template.document_type}</p>
          </div>

          <button onClick={onClose} style={styles.closeBtn}>
            <X size={22} />
          </button>
        </div>
        {template.description && (
          <p style={styles.description}>{template.description}</p>
        )}
        <hr style={styles.divider} />
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            📚 Clauses ({template.clauses?.length || 0})
          </h3>

          {template.clauses?.length === 0 ? (
            <p style={styles.empty}>No clauses added in this template.</p>
          ) : (
            template.clauses.map((clause, index) => (
              <div key={index} style={styles.clauseCard}>
                <div
                  style={styles.clauseHeader}
                  onClick={() => toggleClause(index)}
                >
                  <div style={styles.clauseInfo}>
                    <span style={styles.clauseNumber}>{index + 1}.</span>
                    <span style={styles.clauseTitle}>{clause.clause_type}</span>
                    <span style={styles.categoryBadge}>{clause.category}</span>
                  </div>

                  {openClauseIndex === index ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </div>
                {openClauseIndex === index && (
                  <div style={styles.clauseContent}>
                    <p>{clause.content}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div style={styles.footer}>
          <button style={styles.btnSecondary} onClick={onClose}>
            Close Preview
          </button>

          <button style={styles.btnPrimary} onClick={handleExportPDF}>
            <FileText size={18} style={{ marginRight: 6 }} />
            Export as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(4px)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "center",
    paddingTop: "2rem",
    overflowY: "auto",
  },

  modal: {
    width: "85%",
    maxWidth: "900px",
    background: "rgba(255,255,255,0.95)",
    borderRadius: "16px",
    padding: "2rem",
    boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
    maxHeight: "85vh",
    overflowY: "auto",
    overflowX: "hidden",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
  },

  title: {
    margin: 0,
    fontSize: "1.8rem",
    fontWeight: 700,
  },

  subtitle: {
    margin: 0,
    marginTop: "4px",
    fontSize: "0.95rem",
    color: "#64748b",
  },

  closeBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px",
  },

  description: {
    marginTop: "1rem",
    marginBottom: "1rem",
    color: "#475569",
    lineHeight: 1.6,
  },

  divider: {
    margin: "1.5rem 0",
    opacity: 0.3,
  },

  section: {
    marginBottom: "2rem",
  },

  sectionTitle: {
    fontSize: "1.2rem",
    marginBottom: "1rem",
    fontWeight: 600,
  },

  empty: {
    color: "#94a3b8",
  },

  clauseCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    marginBottom: "1rem",
    background: "#f8fafc",
    overflow: "hidden",
  },

  clauseHeader: {
    padding: "0.9rem 1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
  },

  clauseInfo: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },

  clauseNumber: {
    fontWeight: 600,
    color: "#0f172a",
  },

  clauseTitle: {
    fontWeight: 500,
  },

  categoryBadge: {
    background: "#e0e7ff",
    color: "#4338ca",
    padding: "2px 8px",
    borderRadius: "8px",
    fontSize: "0.7rem",
  },

  clauseContent: {
    padding: "1rem",
    paddingTop: 0,
    color: "#334155",
    lineHeight: 1.6,
    overflowWrap: "break-word",
    wordBreak: "break-word",
  },

  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "1rem",
    marginTop: "2rem",
  },

  btnSecondary: {
    background: "#e2e8f0",
    padding: "0.6rem 1.4rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: 500,
  },

  btnPrimary: {
    background: "#2563eb",
    color: "white",
    padding: "0.6rem 1.4rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
  },
};
