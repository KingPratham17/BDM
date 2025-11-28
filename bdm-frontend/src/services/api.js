// bdm-frontend/src/services/api.js

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
// bdm-frontend/src/services/api.js - Clauses API section only
// (Keep your other API sections - templates, documents, etc.)

export const clausesAPI = {
  // Basic CRUD
  getAll: (params = {}) => api.get('/clauses', { params }),
  getById: (id) => api.get(`/clauses/${id}`),
  getByCategory: (category) => api.get(`/clauses/category/${category}`),

  createManual: (data) =>
    api.post('/clauses/manual', {
      clause_type: data.clause_type,
      content: data.content,
      content_html: data.content_html,
      category: data.category,
      is_sample: data.is_sample || false
    }),

  update: (id, data) =>
    api.put(`/clauses/${id}`, data),

  delete: (id) => api.delete(`/clauses/${id}`),

  // Merge operations

mergeClauses: (payload) =>
  api.post('/clauses/merge', {
    clause_ids: payload.clause_ids,
    clause_type: payload.clause_type,
    category: payload.category,
    is_sample: payload.is_sample || false
  }),

  getMergedClauses: (params = {}) =>
    api.get('/clauses/merged/all', { params }),

  // Sample operations
  getAllSamples: (params = {}) =>
    api.get('/clauses/samples', { params }),

  markAsSample: (id, is_sample) =>
    api.post(`/clauses/${id}/mark-sample`, { is_sample }),

  cloneSample: (id, data) =>
    api.post(`/clauses/${id}/clone-sample`, data),

  // AI operations
  generateAI: (data) =>
    api.post('/clauses/generate-ai', {
      document_type: data.document_type || 'general',
      category: data.category || 'general',
      context: data.context || {}
    }),

  generateSingleAI: (data) =>
    api.post('/clauses/generate-single-ai', {
      clause_type: data.clause_type,
      category: data.category,
      context: data.context || {}
    }),

  saveAIGenerated: (clauses) =>
    api.post('/clauses/save-ai-generated', { clauses }),
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

  generate: (data) => {
    const payload = {
      document_name: data.document_name || `Document_${Date.now()}`,
      document_type: data.document_type || 'general',
      context: data.variables || data.context || {},
    };

    if (data.template_id) payload.template_id = data.template_id;
    if (data.content_json) payload.content_json = data.content_json;

    return api.post('/documents/generate-document', payload);
  },

  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),

  // ⭐ TEMPLATE BULK EXCEL
  bulkGenerateFromExcel: (templateId, file) => {
    const formData = new FormData();
    formData.append('template_id', templateId);
    formData.append('file', file);

    return api.post('/documents/bulk-generate-from-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob',
    });
  },

  // ⭐ AI BULK EXCEL
  aiBulkGenerateFromExcel: (documentType, excelFile) => {
    const formData = new FormData();
    formData.append("file", excelFile);
    formData.append("document_type", documentType);

    return api.post('/documents/ai-bulk-generate-from-excel', formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      responseType: "blob",
    });
  },

  // ⭐ TRANSLATION
  translatePreview: (documentId, lang) =>
    api.post(`/documents/${documentId}/translate-preview`, { lang }),

  translateConfirm: (previewId) =>
    api.post(`/documents/translate-confirm`, { previewId }),

  getContent: (documentId, lang = 'en') =>
    api.get(`/documents/${documentId}/content`, { params: { lang } }),

  generatePdf: (documentId, body = { lang: 'en' }) =>
    api.post(`/documents/${documentId}/generate-pdf`, body, {
      responseType: 'blob',
    }),
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
