// bdm-frontend/src/components/DocumentEditor.jsx
import { useRef, useState, useEffect } from "react";
import JoditEditor from "jodit-react";
import { Save, X, FileText, Eye, Download } from "lucide-react";
import { documentsAPI, pdfAPI } from "../services/api";
import { getJoditConfig } from "../config/joditConfig";

// Side-effect imports (ensure wiring + UI dialogs are registered once)
import "../utils/joditAiWiring";
import "../utils/uiDialogs";

/**
 * DocumentEditor
 * - Preserves your existing UI and flows
 * - Cleans AI/meta boilerplate before saving/preview/download
 * - Keeps AI Summarize button available in toolbar
 */
const DocumentEditor = ({ document, onClose, onSave }) => {
  const editor = useRef(null);

  const [content, setContent] = useState(() => {
    if (document?.content_json?.clauses) {
      return document.content_json.clauses
        .map((c) => c.content || "")
        .join("<br/><br/>");
    }
    return "";
  });

  const [saving, setSaving] = useState(false);

  // Use your config — ensure AI button visible
  const joditConfig = getJoditConfig({
    height: 600,
    enableAI: true,
    enableTranslationPreview: true, // preserved flag (ignored by getJoditConfig if unknown)
    enableCollaboration: false,
    theme: "default",
  });

  // Helper to show messages using uiDialogs when available (fallback to alert)
  const notify = (message, opts = {}) => {
    try {
      if (window.uiDialogs && typeof window.uiDialogs.showToast === "function") {
        window.uiDialogs.showToast(message, opts);
      } else {
        alert(message);
      }
    } catch (err) {
      try {
        alert(message);
      } catch (e) {
        console.warn("notify fallback failed", e);
      }
    }
  };

  //
  // CLEANING: remove AI/meta boilerplate, comments, simple emojis, etc.
  // Conservative filters — edit patterns array if you need to add/remove phrases.
  //
  function cleanDocumentContent(html) {
    if (!html) return "";
    // Remove HTML comments
    let s = String(html).replace(/<!--[\s\S]*?-->/g, "");

    // Patterns to remove
    const patterns = [
      /\bGenerated\s+by\b[\s\S]{0,200}/gi,
      /\bAI[-\s]?generated\b/gi,
      /\bAI\s*summary\b/gi,
      /\bAI\s*summary\s*requested\b/gi,
      /\bSummary\s*generated\b/gi,
      /\bSome\s+Company\b/gi,
      /🤖/g,
      /\bPowered\s+by\b[\s\S]{0,80}/gi,
      /\bGenerated\s+with\b[\s\S]{0,80}/gi,
      /\bThis\s+document\s+was\s+generated\b[\s\S]{0,120}/gi,
      /\bAI summary failed\b[\s\S]*/gi,
      /AI endpoint returned [0-9]{3}[\s\S]*/gi,
    ];

    patterns.forEach((p) => {
      s = s.replace(p, "");
    });

    // Collapse repeated whitespace/newlines left by removals
    s = s.replace(/\s{2,}/g, " ").trim();

    return s;
  }

  const insertCompanyHeader = () => {
    const headerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 24px; font-weight: bold; color: #2563eb; margin: 0;">
          INCTURE
        </h1>
        <p style="margin: 4px 0; font-size: 14px; color: #64748b;">
          Abbhi Tech park,Mysuru,Karnataka 571001
        </p>
        <p style="margin: 4px 0; font-size: 14px; color: #64748b;">
          Phone: +91 1234567890 • Email:contact@incture.com
        </p>
      </div>
    `;

    setContent((prev) => headerHTML + prev);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Clean before saving to ensure no AI/meta boilerplate remains
      const cleanedContent = cleanDocumentContent(content);

      const updatedDoc = {
        ...document,
        content_json: {
          clauses: [
            {
              clause_type: "edited_content",
              content: cleanedContent,
            },
          ],
        },
      };

      await documentsAPI.update(document.id, updatedDoc);
      onSave && onSave(updatedDoc);

      notify("Document saved successfully!", { duration: 2200 });
    } catch (error) {
      console.error("Save failed:", error);
      notify("Failed to save document", { level: "error", duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    const cleanedForPreview = cleanDocumentContent(content);
    const previewWindow = window.open("", "_blank");
    previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${document?.document_name || "Document Preview"}</title>
          <style>
            body {
              font-family: 'Times New Roman', Times, serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>${cleanedForPreview}</body>
      </html>
    `);
    previewWindow.document.close();
  };

  const handleDownload = () => {
    const cleanedForDownload = cleanDocumentContent(content);
    const blob = new Blob(
      [
        `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${document?.document_name || "document"}</title>
          <style>
            body {
              font-family: 'Times New Roman', Times, serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>${cleanedForDownload}</body>
      </html>
    `,
      ],
      { type: "text/html" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${document?.document_name || "document"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    // Optionally: keep content in sync if document prop changes
    setContent(() => {
      if (document?.content_json?.clauses) {
        return document.content_json.clauses
          .map((c) => c.content || "")
          .join("<br/><br/>");
      }
      return "";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "1200px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <FileText size={24} color="#2563eb" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
                {document?.document_name}
              </h2>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                Document Editor
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn-close-modal" aria-label="Close editor">
            <X size={24} />
          </button>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button onClick={insertCompanyHeader} className="btn btn-primary">
            📄 Insert Company Header
          </button>

          <button onClick={handlePreview} className="btn btn-success">
            <Eye size={16} /> Preview
          </button>

          <button onClick={handleDownload} className="btn btn-secondary">
            <Download size={16} /> Download HTML
          </button>

          <button
            onClick={() =>
              pdfAPI.download(document.id, document.document_name)
            }
            className="btn btn-warning"
          >
            <Download size={16} /> Download PDF
          </button>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          <div
            style={{
              backgroundColor: "white",
              minHeight: "500px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              borderRadius: "8px",
              overflow: "hidden",
              padding: "10px",
            }}
          >
            <JoditEditor
              ref={editor}
              value={content}
              config={joditConfig}
              onBlur={(newContent) => setContent(newContent)}
              onChange={(newContent) => setContent(newContent)}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ fontSize: "14px", color: "#64748b" }}>
            {String(content || "").length} characters
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              aria-label="Save document"
            >
              <Save size={16} style={{ marginRight: 8 }} />
              {saving ? "Saving..." : "Save Document"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentEditor;
