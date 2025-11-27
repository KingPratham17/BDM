import { useRef, useState } from "react";
import JoditEditor from "jodit-react";
import { Save, X, FileText, Eye, Download } from "lucide-react";
import { documentsAPI, pdfAPI } from "../services/api";

const DocumentEditor = ({ document, onClose, onSave }) => {
    const editor = useRef(null);

    const [content, setContent] = useState(() => {
        if (document.content_json?.clauses) {
            return document.content_json.clauses
                .map((c) => c.content || "")
                .join("<br/><br/>");
        }
        return "";
    });

    const [saving, setSaving] = useState(false);

    const joditConfig = {
        readonly: false,
        height: 500,
        allowResizeX: false,
        allowResizeY: true,
        toolbarAdaptive: false,
        toolbarSticky: false,
        removeButtons: ["video"],
        buttons: [
            "bold",
            "italic",
            "underline",
            "strikethrough",
            "|",
            "font",
            "fontsize",
            "brush",
            "paragraph",
            "|",
            "ul",
            "ol",
            "align",
            "|",
            "table",
            "link",
            "image",
            "|",
            "left",
            "center",
            "right",
            "justify",
            "|",
            "undo",
            "redo",
            "eraser",
            "fullsize",
            "source",
        ],
    };

    const insertCompanyHeader = () => {
        const headerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 24px; font-weight: bold; color: #2563eb; margin: 0;">
          [COMPANY NAME]
        </h1>
        <p style="margin: 4px 0; font-size: 14px; color: #64748b;">
          [Company Address] • [City, State ZIP]
        </p>
        <p style="margin: 4px 0; font-size: 14px; color: #64748b;">
          Phone: [Phone] • Email: [Email]
        </p>
      </div>
    `;

        setContent(headerHTML + content);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updatedDoc = {
                ...document,
                content_json: {
                    clauses: [
                        {
                            clause_type: "edited_content",
                            content: content,
                        },
                    ],
                },
            };

            await documentsAPI.update(document.id, updatedDoc);
            onSave && onSave(updatedDoc);
            alert("Document saved successfully!");
        } catch (error) {
            console.error("Save failed:", error);
            alert("Failed to save document");
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = () => {
        const previewWindow = window.open("", "_blank");
        previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${document.document_name}</title>
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
        <body>${content}</body>
      </html>
    `);
        previewWindow.document.close();
    };

    const handleDownload = () => {
        const blob = new Blob(
            [
                `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${document.document_name}</title>
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
        <body>${content}</body>
      </html>
    `,
            ],
            { type: "text/html" }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${document.document_name}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

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
                                {document.document_name}
                            </h2>
                            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                                Document Editor
                            </p>
                        </div>
                    </div>

                    <button onClick={onClose} className="btn-close-modal">
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
                        {content.length} characters
                    </div>

                    <div style={{ display: "flex", gap: "12px" }}>
                        <button onClick={onClose} className="btn btn-secondary">
                            Cancel
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="btn btn-primary"
                        >
                            <Save size={16} />
                            {saving ? "Saving..." : "Save Document"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentEditor;
