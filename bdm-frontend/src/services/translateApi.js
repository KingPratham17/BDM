// src/services/translateApi.js
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export async function previewTranslation({ originalId, originalType = 'document', text, lang }) {
  const res = await fetch(`${API_BASE}/api/translate/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalId, originalType, text, lang })
  });
  return res.json();
}

export async function confirmTranslation({ previewId }) {
  const res = await fetch(`${API_BASE}/api/translate/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ previewId })
  });
  return res.json();
}

// Optional: request server-side PDF generation using translated content
export async function requestPdf({ content, filename = 'document.pdf' }) {
  const res = await fetch(`${API_BASE}/api/pdf/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, filename })
  });
  // If server streams or sends a URL, handle accordingly
  return res.blob ? res.blob() : res.json();
}
