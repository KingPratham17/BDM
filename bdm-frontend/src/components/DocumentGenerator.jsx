// bdm-frontend/src/components/DocumentGenerator.jsx

import { useEffect, useState } from 'react';
import { documentsAPI, templatesAPI, pdfAPI, clausesAPI } from '../services/api';
import { FileText, Download, Eye, X, Sparkles, Trash2, Save, Globe, Edit3, CheckCircle} from 'lucide-react';
import PDFViewer from './PDFViewer';
import TranslateModal from './TranslateModal';
import DocumentEditor from './DocumentEditor';

/**
 * DocumentGenerator — Single-file optimized version
 * - Preserves all existing features (AI generation, templates, translation, PDF, edit)
 * - Fixes AI button misalignment by adding a dedicated toolbar container
 */

const LANGUAGES = [
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'pt', label: 'Portuguese', flag: '🇵🇹' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
  // === INDIAN LANGUAGES ===
  { code: 'hi', label: 'Hindi', flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali', flag: '🇮🇳' },
  { code: 'te', label: 'Telugu', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', flag: '🇮🇳' },
  { code: 'gu', label: 'Gujarati', flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada', flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', flag: '🇮🇳' },
  { code: 'pa', label: 'Punjabi', flag: '🇮🇳' },
  { code: 'ur', label: 'Urdu', flag: '🇮🇳' },
];

export default function DocumentGenerator() {
  // ===== BULK (TEMPLATE) EXCEL STATE =====
  const [bulkExcelFile, setBulkExcelFile] = useState(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // ===== CORE STATE =====
  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [quickAIMode, setQuickAIMode] = useState(false);

  // Editor state (NEW)
  const [editingDocument, setEditingDocument] = useState(null);

  // Translation state
  const [activeDocTranslations, setActiveDocTranslations] = useState({});
  const [translateModalOpen, setTranslateModalOpen] = useState(false);
  const [translatePreview, setTranslatePreview] = useState(null);
  const [translateEnglish, setTranslateEnglish] = useState('');
  const [translateConfirmed, setTranslateConfirmed] = useState(false);
  const [currentDocIdForTranslate, setCurrentDocIdForTranslate] = useState(null);
  const [currentTranslateLang, setCurrentTranslateLang] = useState('es');
  const [translationIdSaved, setTranslationIdSaved] = useState(null);
  const [translating, setTranslating] = useState(false);

  // AI generation state (OLD STEP-BASED FLOW)
  const [aiStep, setAiStep] = useState(1);
  const [aiDocType, setAiDocType] = useState('');
  const [aiInitialContext, setAiInitialContext] = useState('');
  const [aiGeneratedClauses, setAiGeneratedClauses] = useState([]);
  const [aiPlaceholders, setAiPlaceholders] = useState([]);
  const [aiPlaceholderValues, setAiPlaceholderValues] = useState({});
  const [aiDocumentName, setAiDocumentName] = useState('');

  // AI Bulk Excel Generation (NEW, uses aiDocType as document_type)
  const [aiExcelFile, setAiExcelFile] = useState(null);
  const [aiBulkLoading, setAiBulkLoading] = useState(false);

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplatePreviewModal, setShowTemplatePreviewModal] = useState(false);
  const [previewTemplateData, setPreviewTemplateData] = useState(null);
  const [placeholders, setPlaceholders] = useState([]);
  const [placeholderValues, setPlaceholderValues] = useState({});
  const [documentName, setDocumentName] = useState('');
  const [showValuePreviewModal, setShowValuePreviewModal] = useState(false);
  const [previewContentWithValues, setPreviewContentWithValues] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [loadingModalData, setLoadingModalData] = useState(false);
  const [notification, setNotification] = useState(null);

  // ===== EFFECTS =====
  useEffect(() => {
    loadTemplates();
    loadDocuments();
  }, []);

  // ===== UTILITY FUNCTIONS =====
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const resetQuickAIForm = () => {
    setAiStep(1);
    setAiDocType('');
    setAiInitialContext('');
    setAiGeneratedClauses([]);
    setAiPlaceholders([]);
    setAiPlaceholderValues({});
    setAiDocumentName('');
  };

  const resetTemplateForm = () => {
    setSelectedTemplate(null);
    setPlaceholders([]);
    setPlaceholderValues({});
    setDocumentName('');
    const selectElement = document.querySelector('.template-select-dropdown');
    if (selectElement) selectElement.value = '';
  };

  // ===== DATA LOADING =====
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await templatesAPI.getAll();
      setTemplates(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Error loading templates:", err);
      showNotification('Failed to load templates', 'error');
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const res = await documentsAPI.getAll();
      setDocuments(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Error loading documents:", err);
      showNotification('Failed to load documents list', 'error');
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // ===== AI CLAUSE GENERATION (STEP 1) =====
  const handleAIGenerateClauses = async (e) => {
    e.preventDefault();
    if (!aiDocType) return showNotification('Please enter document type', 'error');

    let parsedContext = {};
    if (aiInitialContext) {
      try {
        parsedContext = JSON.parse(aiInitialContext);
      } catch (err) {
        return showNotification('Invalid JSON in initial context.', 'error');
      }
    }

    setGeneratingDoc(true);
    try {
      const res = await clausesAPI.generateAI({
        document_type: aiDocType,
        category: aiDocType,
        context: parsedContext
      });

      const generatedClauses = res?.data?.data?.clauses;
      if (!Array.isArray(generatedClauses) || generatedClauses.length === 0) {
        throw new Error("AI did not return valid clauses.");
      }

      setAiGeneratedClauses(generatedClauses);

      // Extract placeholders
      const foundPlaceholders = new Set();
      generatedClauses.forEach(clause => {
        if (clause && typeof clause.content === 'string') {
          const matches = clause.content.match(/\[([^\]]+)\]/g);
          if (matches) {
            matches.forEach(m => {
              const placeholder = m.substring(1, m.length - 1).trim();
              if (placeholder) foundPlaceholders.add(placeholder);
            });
          }
        }
      });

      const placeholderArray = Array.from(foundPlaceholders);
      setAiPlaceholders(placeholderArray);

      const initialValues = {};
      placeholderArray.forEach(p => initialValues[p] = '');
      setAiPlaceholderValues(initialValues);
      setAiDocumentName(`${aiDocType}_AI_${Date.now()}`);
      setAiStep(2);

      showNotification(`AI generated ${generatedClauses.length} clauses. Fill ${placeholderArray.length} placeholders.`, 'success');
    } catch (err) {
      console.error("Error generating AI clauses:", err);
      showNotification(`Failed to generate clauses with AI: ${err.message}`, 'error');
      resetQuickAIForm();
    } finally {
      setGeneratingDoc(false);
    }
  };

  // ===== AI PREVIEW & SAVE (STEP 2) =====
  const handlePreviewAIValues = () => {
    if (!Array.isArray(aiGeneratedClauses) || aiGeneratedClauses.length === 0) {
      return showNotification("No AI clauses generated yet.", "error");
    }

    const previewClauses = aiGeneratedClauses.map(clause => {
      let filledContent = String(clause?.content || '');
      aiPlaceholders.forEach(placeholder => {
        const value = aiPlaceholderValues[placeholder] || `[${placeholder}]`;
        const escapedPlaceholder = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        filledContent = filledContent.replace(new RegExp(`\\[${escapedPlaceholder}\\]`, 'g'), value);
      });
      return { ...clause, content: filledContent };
    });

    setPreviewContentWithValues(previewClauses);
    setShowValuePreviewModal(true);
  };

  const handleAISaveDocument = async (e) => {
    if (e) e.preventDefault();

    if (!aiDocumentName || !Array.isArray(aiGeneratedClauses) || aiGeneratedClauses.length === 0) {
      return showNotification('Missing document name or generated clauses.', 'error');
    }

    const finalClauses = aiGeneratedClauses.map(clause => {
      let filledContent = String(clause?.content || '');
      aiPlaceholders.forEach(placeholder => {
        const value = aiPlaceholderValues[placeholder] || `[${placeholder}]`;
        const escapedPlaceholder = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        filledContent = filledContent.replace(new RegExp(`\\[${escapedPlaceholder}\\]`, 'g'), value);
      });
      return { ...clause, content: filledContent };
    });

    setShowValuePreviewModal(false);
    setGeneratingDoc(true);

    try {
      await documentsAPI.generate({
        document_name: aiDocumentName,
        document_type: aiDocType,
        content_json: { clauses: finalClauses },
        variables: aiPlaceholderValues
      });

      await loadDocuments();
      showNotification('Document saved successfully!', 'success');
      resetQuickAIForm();
    } catch (err) {
      console.error("Error saving AI document:", err);
      showNotification(`Failed to save: ${err.message || 'Server error'}`, 'error');
    } finally {
      setGeneratingDoc(false);
    }
  };

  // ===== 🆕 AI BULK GENERATION (EXCEL → AI → PDFs → ZIP) =====
  const handleAiBulkGenerate = async () => {
    try {
      if (!aiExcelFile) {
        return showNotification('Please upload an Excel file for AI bulk generation.', 'error');
      }
      if (!aiDocType) {
        return showNotification('Please enter document type before AI bulk generation.', 'error');
      }

      setAiBulkLoading(true);
      showNotification('Starting AI bulk generation. Please wait...', 'info');

      const response = await documentsAPI.aiBulkGenerateFromExcel(
        aiDocType,
        aiExcelFile
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `AI_Bulk_Documents_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showNotification('AI bulk documents generated successfully. ZIP downloaded.', 'success');
    } catch (error) {
      console.error('AI Bulk Error:', error);
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        'Failed to generate AI bulk documents';
      showNotification(msg, 'error');
    } finally {
      setAiBulkLoading(false);
    }
  };

  // ===== TRANSLATION HANDLERS =====
  const handleTranslateRequest = async (docId, lang) => {
    setTranslating(true);
    setTranslateConfirmed(false);
    setTranslationIdSaved(null);
    setCurrentDocIdForTranslate(docId);
    setCurrentTranslateLang(lang);

    try {
      console.log(`🌐 Requesting translation for doc ${docId} to ${lang}`);

      const enResp = await documentsAPI.getContent(docId, 'en');
      console.log('English response:', enResp);

      let enText = '';
      if (enResp?.data) {
        if (typeof enResp.data === 'string') {
          enText = enResp.data;
        } else if (enResp.data.text) {
          enText = enResp.data.text;
        } else if (enResp.data.data && enResp.data.data.text) {
          enText = enResp.data.data.text;
        }
      }

      setTranslateEnglish(enText);

      const previewResp = await documentsAPI.translatePreview(docId, lang);
      console.log('Preview response:', previewResp);

      const pData = previewResp?.data || previewResp;

      if (!pData?.success) {
        throw new Error(pData?.error || 'Preview failed');
      }

      setTranslatePreview({
        previewId: pData.previewId,
        translated: pData.translated,
        expiresAt: pData.expiresAt
      });

      setTranslateModalOpen(true);
      showNotification('Translation preview generated!', 'success');

    } catch (err) {
      console.error('Translate preview failed', err);
      showNotification('Translation failed: ' + (err.message || err), 'error');
    } finally {
      setTranslating(false);
    }
  };

  const handleTranslateConfirm = async () => {
    if (!translatePreview?.previewId) {
      return showNotification('No preview to confirm', 'error');
    }

    try {
      console.log(`✅ Confirming translation: ${translatePreview.previewId}`);

      const resp = await documentsAPI.translateConfirm(translatePreview.previewId);
      const data = resp?.data || resp;

      if (!data?.success) {
        throw new Error(data?.error || 'Confirm failed');
      }

      setTranslateConfirmed(true);
      setTranslationIdSaved(data.translationId || null);

      setActiveDocTranslations(prev => ({
        ...prev,
        [currentDocIdForTranslate]: {
          lang: currentTranslateLang,
          translationId: data.translationId
        }
      }));

      showNotification('Translation confirmed and saved!', 'success');

    } catch (err) {
      console.error('Translate confirm error', err);
      showNotification('Confirmation failed: ' + (err.message || err), 'error');
    }
  };

  const handleTranslateDownloadPdf = async (which) => {
    if (!currentDocIdForTranslate) return;

    if ((which === 'translated' || which === 'both') && !translateConfirmed) {
      return showNotification('Please confirm translation first!', 'error');
    }

    const body = {
      lang: which === 'both' ? 'both' : (which === 'en' ? 'en' : currentTranslateLang)
    };

    if (translationIdSaved) {
      body.translationId = translationIdSaved;
    }

    try {
      console.log(`📥 Downloading PDF: ${which}`, body);

      const blobResp = await documentsAPI.generatePdf(currentDocIdForTranslate, body);
      const blob = blobResp.data || blobResp;

      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const nameSuffix = which === 'both' ? 'bilingual' : (which === 'en' ? 'en' : currentTranslateLang);
      a.href = url;
      a.download = `document_${currentDocIdForTranslate}_${nameSuffix}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showNotification('PDF download started!', 'success');
    } catch (err) {
      console.error('PDF download error', err);
      showNotification('Download failed: ' + (err.message || err), 'error');
    }
  };

  // ===== TEMPLATE HANDLERS =====
  const handlePreviewTemplate = async (templateSummary) => {
    setLoadingModalData(true);
    setShowTemplatePreviewModal(true);
    setPreviewTemplateData(null);

    try {
      const res = await templatesAPI.getById(templateSummary.id);
      setPreviewTemplateData(res.data.data);
    } catch (err) {
      console.error("Error fetching template:", err);
      showNotification('Failed to load template details', 'error');
      setShowTemplatePreviewModal(false);
    } finally {
      setLoadingModalData(false);
    }
  };

  const handleSelectTemplate = async (templateSummary) => {
    setLoadingTemplates(true);
    setSelectedTemplate(null);
    setPlaceholders([]);
    setPlaceholderValues({});
    setDocumentName('');
    setShowTemplatePreviewModal(false);

    try {
      const res = await templatesAPI.getById(templateSummary.id);
      const templateData = res.data.data;

      if (!templateData || !Array.isArray(templateData.clauses)) {
        throw new Error('Invalid template data');
      }

      setSelectedTemplate(templateData);

      // Extract placeholders
      const foundPlaceholders = new Set();
      templateData.clauses.forEach(clause => {
        if (clause && typeof clause.content === 'string') {
          const matches = clause.content.match(/\[([^\]]+)\]/g);
          if (matches) {
            matches.forEach(match => {
              const p = match.substring(1, match.length - 1).trim();
              if (p) foundPlaceholders.add(p);
            });
          }
        }
      });

      const placeholderArray = Array.from(foundPlaceholders);
      setPlaceholders(placeholderArray);

      const initialValues = {};
      placeholderArray.forEach(p => initialValues[p] = '');
      setPlaceholderValues(initialValues);
      setDocumentName(`${templateData.template_name}_${Date.now()}`);

      showNotification(`Template selected. Fill ${placeholderArray.length} placeholders.`, 'info');
    } catch (err) {
      console.error("Error selecting template:", err);
      showNotification('Failed to load template', 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handlePlaceholderChange = (placeholder, value, isAiForm = false) => {
    if (isAiForm) {
      setAiPlaceholderValues(prev => ({ ...prev, [placeholder]: value }));
    } else {
      setPlaceholderValues(prev => ({ ...prev, [placeholder]: value }));
    }
  };

  const handlePreviewWithValues = () => {
    if (!selectedTemplate || !Array.isArray(selectedTemplate.clauses)) {
      showNotification("Cannot preview: Template missing", 'error');
      return;
    }

    const previewClauses = selectedTemplate.clauses.map(clause => {
      let filledContent = clause.content || '';
      placeholders.forEach(placeholder => {
        const value = placeholderValues[placeholder] || `[${placeholder}]`;
        const escapedPlaceholder = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        filledContent = filledContent.replace(new RegExp(`\\[${escapedPlaceholder}\\]`, 'g'), value);
      });
      return { ...clause, content: filledContent };
    });

    setPreviewContentWithValues(previewClauses);
    setShowValuePreviewModal(true);
  };

  const handleGenerateFromTemplate = async () => {
    if (!selectedTemplate) return showNotification('Please select a template first', 'error');

    const emptyPlaceholders = placeholders.filter(p => !placeholderValues[p]);
    if (emptyPlaceholders.length > 0) {
      const confirmContinue = window.confirm(
        `Warning: ${emptyPlaceholders.length} placeholders are empty:\n- ${emptyPlaceholders.join('\n- ')}\n\nContinue anyway?`
      );
      if (!confirmContinue) return;
    }

    try {
      setGeneratingDoc(true);
      await documentsAPI.generate({
        template_id: selectedTemplate.id,
        document_name: documentName || `${selectedTemplate.template_name}_${Date.now()}`,
        document_type: selectedTemplate.document_type,
        context: placeholderValues
      });

      await loadDocuments();
      showNotification('Document generated successfully!', 'success');
      resetTemplateForm();
      setShowValuePreviewModal(false);
    } catch (err) {
      console.error("Error generating from template:", err);
      showNotification('Generation failed', 'error');
    } finally {
      setGeneratingDoc(false);
    }
  };

  // ===== DOCUMENT LIST HANDLERS =====
  
  const handleEditDocument = (doc) => {
    setEditingDocument(doc);
  };

  const handleEditorClose = () => {
    setEditingDocument(null);
    // Reload documents after closing the editor, in case changes were made.
    loadDocuments();
  };


  const handlePreviewPDF = (docId) => {
    const url = pdfAPI.getPreviewUrl(docId);
    setPdfUrl(url);
  };

  const handleDownloadPDF = (docId, name) => {
    pdfAPI.download(docId, `${name}.pdf`);
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await documentsAPI.delete(docId);
      await loadDocuments();
      showNotification('Document deleted', 'success');

      if (pdfUrl && pdfUrl.includes(`/documents/${docId}/`)) {
        setPdfUrl(null);
      }

      setActiveDocTranslations(prev => {
        const newState = { ...prev };
        delete newState[docId];
        return newState;
      });
    } catch (err) {
      console.error("Error deleting document:", err);
      showNotification('Failed to delete document', 'error');
    }
  };

  // ===== TEMPLATE BULK EXCEL HANDLERS =====
  const handleBulkExcelFileChange = (e) => {
    const file = e.target.files?.[0];
    setBulkExcelFile(file || null);
  };

  const handleBulkGenerateFromExcel = async () => {
    if (!selectedTemplate) {
      return showNotification('Please select a template first', 'error');
    }
    if (!bulkExcelFile) {
      return showNotification('Please upload an Excel file first', 'error');
    }

    try {
      setBulkGenerating(true);
      showNotification('Starting bulk generation. Please wait...', 'info');

      const res = await documentsAPI.bulkGenerateFromExcel(selectedTemplate.id, bulkExcelFile);
      const blob = new Blob([res.data], { type: 'application/zip' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulk_documents_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showNotification('Bulk documents generated successfully. ZIP downloaded.', 'success');
    } catch (err) {
      console.error('Bulk Excel generation error:', err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err.message ||
        'Failed to bulk-generate documents';
      showNotification(msg, 'error');
    } finally {
      setBulkGenerating(false);
    }
  };

  const renderPlaceholderInput = (placeholder, isAiForm = false) => {
    const lowerCaseName = placeholder.toLowerCase().trim();
    const value = isAiForm ? aiPlaceholderValues[placeholder] : placeholderValues[placeholder];
    const changeHandler = (e) => handlePlaceholderChange(placeholder, e.target.value, isAiForm);
    const inputId = `${placeholder.replace(/\s+/g, '-')}-${isAiForm ? 'ai' : 'template'}`;

    const dateKeywords = ['date', 'start date', 'end date', 'effective date', 'signing date'];
    const isDateField = dateKeywords.includes(lowerCaseName) || lowerCaseName.endsWith(' date');

    const signatureKeywords = ['signature', 'candidate signature', 'employer signature'];
    const isSignatureField = signatureKeywords.includes(lowerCaseName) || lowerCaseName.endsWith(' signature');

    if (isDateField) {
      return <input type="date" id={inputId} className="form-input" value={value || ''} onChange={changeHandler} required />;
    }
    if (isSignatureField) {
      return <input type="text" id={inputId} className="form-input signature-input" value={value || ''} onChange={changeHandler} placeholder="Type name to sign..." required />;
    }
    return <input type="text" id={inputId} className="form-input" value={value || ''} onChange={changeHandler} required />;
  };

  // ===== RENDER =====
  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>📄 Document Generator</h1>

      {notification && (
        <div className={`alert alert-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => { setQuickAIMode(true); resetTemplateForm(); }}
          className={`btn ${quickAIMode ? 'btn-primary' : 'btn-outline'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Sparkles size={18} /> Quick AI Generate
        </button>
        <button
          onClick={() => { setQuickAIMode(false); resetQuickAIForm(); }}
          className={`btn ${!quickAIMode ? 'btn-primary' : 'btn-outline'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <FileText size={18} /> Use Template
        </button>
      </div>

      {/* TEMPLATE BULK GENERATION BLOCK (shows only when a template is selected) */}
      {selectedTemplate && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            📊 Generate Document through Excel (Template-Based)
          </h2>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="file-upload-wrapper">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => document.getElementById("excelFileInput").click()}
                disabled={bulkGenerating}
                style={{ marginRight: "10px" }}
              >
                {bulkExcelFile ? "Uploaded" : "Choose Excel File"}
              </button>

              <input
                id="excelFileInput"
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={handleBulkExcelFileChange}
                disabled={bulkGenerating}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBulkGenerateFromExcel}
              disabled={bulkGenerating || !bulkExcelFile}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {bulkGenerating ? 'Generating...' : 'Generate Documents'}
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#555' }}>
            Note: If the Excel columns don’t match the template placeholders, an error message will be shown.
          </p>
        </div>
      )}

      {/* ========================= QUICK AI MODE ========================= */}
      {quickAIMode && (
        <>
          {/* OLD STEP-BASED AI FLOW */}
          <div className="card" style={{ marginBottom: '2rem', marginTop: '1.5rem' }}>
            {aiStep === 1 && (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                  ⚡ Quick AI Generate - Step 1
                </h2>
                <form onSubmit={handleAIGenerateClauses}>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <input
                      type="text"
                      placeholder="Document Type (e.g., offerletter, nda) *"
                      value={aiDocType}
                      onChange={(e) => setAiDocType(e.target.value)}
                      className="form-input"
                      required
                    />
                    <textarea
                      placeholder="Optional initial context (JSON format)"
                      value={aiInitialContext}
                      onChange={(e) => setAiInitialContext(e.target.value)}
                      className="form-textarea"
                      rows="3"
                    />
                    <button type="submit" disabled={generatingDoc} className="btn btn-primary">
                      {generatingDoc ? 'Generating...' : '➡️ Generate Clauses'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {aiStep === 2 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                    ⚡ Step 2: Fill Placeholders for "{aiDocType}"
                  </h2>
                  <button onClick={resetQuickAIForm} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
                    Start Over
                  </button>
                </div>

                <form onSubmit={handleAISaveDocument}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Document Name</label>
                    <input
                      type="text"
                      value={aiDocumentName}
                      onChange={(e) => setAiDocumentName(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>

                  {aiPlaceholders.length > 0 && (
                    <>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                        Fill Placeholders ({aiPlaceholders.length})
                      </h3>
                      <div className="placeholder-grid" style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                        {aiPlaceholders.map((placeholder) => (
                          <div key={placeholder} className="form-group-inline">
                            <label>{placeholder}</label>
                            {renderPlaceholderInput(placeholder, true)}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button type="button" onClick={handlePreviewAIValues} className="btn btn-secondary" style={{ flex: 1 }}>
                      <Eye size={16} /> Preview
                    </button>
                    <button type="submit" disabled={generatingDoc} className="btn btn-success" style={{ flex: 1 }}>
                      <Save size={18} /> {generatingDoc ? 'Saving...' : 'Save Document'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* 🆕 AI BULK GENERATION CARD (EXCEL-BASED) */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              🤖 AI Bulk Document Generation from Excel
            </h2>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              Uses the same <strong>Document Type</strong> as above (<code>{aiDocType || 'not set'}</code>) and
              row values from the Excel file as context for AI.
            </p>

            {/* Hidden Excel Input for AI bulk */}
            <input
              id="aiExcelInput"
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => setAiExcelFile(e.target.files?.[0] || null)}
            />

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                style={{ marginRight: '10px' }}
                onClick={() => document.getElementById('aiExcelInput').click()}
                disabled={aiBulkLoading}
              >
                {aiExcelFile ? 'Excel Uploaded ✔' : 'Choose Excel File'}
              </button>

              <button
                className="btn btn-success"
                onClick={handleAiBulkGenerate}
                disabled={!aiExcelFile || aiBulkLoading}
              >
                {aiBulkLoading ? 'Generating AI PDFs...' : 'Generate AI PDFs from Excel'}
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#555' }}>
              Make sure Excel headers match the placeholders / context keys expected by your AI templates,
              like <code>Employee Name</code>, <code>Job Title</code>, <code>Salary</code>, etc.
            </p>
          </div>
        </>
      )}

      {/* ========================= TEMPLATE MODE ========================= */}
      {!quickAIMode && !selectedTemplate && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>📋 Select a Template</h2>
          {loadingTemplates ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : templates.length === 0 ? (
            <div className="empty-state"><p>No templates available.</p></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {templates.map((template) => (
                <div key={template.id} className="card template-select-card">
                  {template.is_ai_generated && <span className="ai-badge">🤖 AI</span>}
                  <h3>{template.template_name}</h3>
                  <p>📄 {template.document_type}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button onClick={() => handlePreviewTemplate(template)} className="btn btn-outline" style={{ flex: 1 }}>
                      <Eye size={14} /> Preview
                    </button>
                    <button onClick={() => handleSelectTemplate(template)} className="btn btn-primary" style={{ flex: 1 }}>
                      Select
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!quickAIMode && selectedTemplate && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2>✏️ Fill Template: {selectedTemplate.template_name}</h2>
            <button onClick={resetTemplateForm} className="btn btn-secondary">Change</button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleGenerateFromTemplate(); }}>
            <input
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              className="form-input"
              placeholder="Document name"
              style={{ marginBottom: '1rem' }}
              required
            />

            {placeholders.length > 0 && (
              <div className="placeholder-grid" style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                {placeholders.map((placeholder) => (
                  <div key={placeholder} className="form-group-inline">
                    <label>{placeholder}</label>
                    {renderPlaceholderInput(placeholder, false)}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" onClick={handlePreviewWithValues} className="btn btn-secondary" style={{ flex: 1 }}>
                <Eye size={16} /> Preview
              </button>
              <button type="submit" disabled={generatingDoc} className="btn btn-success" style={{ flex: 1 }}>
                {generatingDoc ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================= DOCUMENT LIST ========================= */}
      <div className="card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>📚 Generated Documents</h2>
        {loadingDocuments ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : documents.length === 0 ? (
          <div className="empty-state"><p>No documents yet.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {documents.map((doc) => {
              const hasConfirmedTranslation = activeDocTranslations[doc.id];

              return (
                <div key={doc.id} className="card document-list-item-card">
                  <div>
                    <h3 className="document-name">{doc.document_name}</h3>
                    <p className="document-meta">
                      📄 {doc.document_type} • {new Date(doc.created_at).toLocaleDateString()}
                      {hasConfirmedTranslation && (
                        <span style={{ marginLeft: '0.5rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <CheckCircle size={14} /> {hasConfirmedTranslation.lang.toUpperCase()} Translated
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="document-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => handlePreviewPDF(doc.id)} className="btn btn-secondary btn-sm">
                      <Eye size={14} /> Preview
                    </button>
                    
                    <button onClick={() => handleEditDocument(doc)} className="btn btn-info btn-sm">
                      <Edit3 size={14} /> Edit
                    </button>

                    <button onClick={() => handleDownloadPDF(doc.id, doc.document_name)} className="btn btn-success btn-sm">
                      <Download size={14} /> Download
                    </button>
                    <button onClick={() => handleDeleteDocument(doc.id)} className="btn btn-danger btn-sm">
                      <Trash2 size={14} /> Delete
                    </button>

                    <div style={{
                      marginLeft: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center'
                    }}>
                      <Globe size={16} color="white" />
                      <select
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.875rem'
                        }}
                        onChange={(e) => {
                          if (e.target.value && e.target.value !== 'select') {
                            handleTranslateRequest(doc.id, e.target.value);
                          }
                        }}
                        disabled={translating}
                      >
                        <option value="select">Translate to...</option>
                        {LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.label}
                          </option>
                        ))}
                      </select>
                      {translating && currentDocIdForTranslate === doc.id && (
                        <div className="spinner-small" style={{ width: '14px', height: '14px' }}></div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PDF PREVIEW MODAL */}
      {pdfUrl && (
        <div className="modal-overlay" onClick={() => setPdfUrl(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', width: '1200px' }}>
            <div className="modal-header">
              <h3>PDF Preview</h3>
              <button onClick={() => setPdfUrl(null)} className="btn-close-modal"><X size={24} /></button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <PDFViewer pdfUrl={pdfUrl} />
            </div>
          </div>
        </div>
      )}

      {/* TRANSLATION MODAL */}
      <TranslateModal
        open={translateModalOpen}
        onClose={() => {
          setTranslateModalOpen(false);
          setTranslatePreview(null);
          setTranslateConfirmed(false);
          setTranslationIdSaved(null);
        }}
        english={translateEnglish}
        translated={translatePreview?.translated || ''}
        lang={currentTranslateLang}
        confirmed={translateConfirmed}
        onConfirm={handleTranslateConfirm}
        onDownload={handleTranslateDownloadPdf}
      />

      {/* DOCUMENT EDITOR MODAL */}
      {editingDocument && (
        <DocumentEditor
          document={editingDocument}
          onClose={handleEditorClose}
          onSave={handleEditorClose}
        />
      )}
    </div>
  );
}
