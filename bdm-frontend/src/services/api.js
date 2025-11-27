// bdm-frontend/src/services/api.js

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Clauses API ---
export const clausesAPI = {
  getAll: (params = {}) => api.get('/clauses', { params }),
  getById: (id) => api.get(`/clauses/${id}`),
  getByCategory: (category) => api.get(`/clauses/category/${category}`),

  createManual: (data) =>
    api.post('/clauses/manual', {
      clause_type: data.clause_type,
      content: data.content,
      category: data.category,
    }),

  generateAI: (data) =>
    api.post('/clauses/generate-ai', {
      document_type: data.document_type || 'general',
      category: data.category || 'general',
      context: data.context || {},
    }),

  generateSingleAI: (data) =>
    api.post('/clauses/generate-single-ai', {
      clause_type: data.clause_type,
      category: data.category,
      context: data.context || {},
    }),

  saveAIGenerated: (data) => api.post('/clauses/save-ai-generated', { clauses: data }),

  update: (id, data) =>
    api.put(`/clauses/${id}`, {
      clause_type: data.clause_type,
      content: data.content,
      category: data.category,
    }),

  delete: (id) => api.delete(`/clauses/${id}`),
};

// --- Templates API ---
export const templatesAPI = {
  getAll: (params = {}) => api.get('/templates', { params }),
  getById: (id) => api.get(`/templates/${id}`),

  createManual: (data) => api.post('/templates', data),

  generateAIComplete: (data) =>
    api.post('/templates/generate-ai-complete', {
      template_name: data.template_name || 'AI Generated Template',
      document_type: data.document_type || 'general',
      description: data.description || '',
      context: data.context || {},
    }),

  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  addClause: (id, data) => api.post(`/templates/${id}/add-clause`, data),
  removeClause: (id, clauseId) => api.delete(`/templates/${id}/remove-clause/${clauseId}`),
};

// --- Documents API ---
export const documentsAPI = {
  getAll: (params = {}) => api.get('/documents', { params }),
  getById: (id) => api.get(`/documents/${id}`),

  // --- CORRECTED generate function ---
  generate: (data) => {
    const payload = {
      document_name: data.document_name || `Document_${Date.now()}`,
      document_type: data.document_type || 'general',
      context: data.variables || data.context || {},
    };

    if (data.template_id) {
      payload.template_id = data.template_id;
    }

    if (data.content_json) {
      payload.content_json = data.content_json;
    }

    console.log('Sending payload to POST /documents/generate-document:', payload);
    return api.post('/documents/generate-document', payload);
  },

  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),

  // ----- Translation & PDF helpers -----

  // Request a translation preview for a document (creates translation_previews row)
  translatePreview: (documentId, lang) =>
    api.post(`/documents/${documentId}/translate-preview`, { lang }),

  // Confirm a previously-created preview (persist to translations table)
  translateConfirm: (previewId) =>
    api.post(`/documents/translate-confirm`, { previewId }),

  // Get assembled document content (english or a confirmed translation)
  // e.g. documentsAPI.getContent(docId, 'en') or ('es')
  getContent: (documentId, lang = 'en') =>
    api.get(`/documents/${documentId}/content`, { params: { lang } }),

  // Generate PDF for the document.
  // body: { lang: 'en'|'es'|'both', translationId?, filename? }
  // returns axios response with blob data
  generatePdf: (documentId, body = { lang: 'en' }) =>
    api.post(`/documents/${documentId}/generate-pdf`, body, { responseType: 'blob' }),
};

// --- PDF API (existing) ---
export const pdfAPI = {
  // Helper to get base URL (removes /api part)
  getBaseUrl: () => API_BASE_URL.replace('/api', ''),

  // Helper to construct the full preview URL
  getPreviewUrl: (id) => `${API_BASE_URL.replace('/api', '')}/api/pdf/documents/${id}/preview`,

  download: (id, filename) => {
    // Construct URL using base and encode filename
    const url = `${API_BASE_URL.replace('/api', '')}/api/pdf/documents/${id}/download${filename ? `?filename=${encodeURIComponent(filename)}` : ''}`;
    window.open(url, '_blank');
  },

  generateAndSave: (id) => api.post(`/pdf/documents/${id}/generate-save`),
};

// --- System API ---
export const systemAPI = {
  health: () => api.get('http://localhost:5000/health'),
  aiConfig: () => api.get('http://localhost:5000/ai-config'),
};

// Export the base axios instance
export default api;
