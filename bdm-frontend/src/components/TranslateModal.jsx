// bdm-frontend/src/components/TranslateModal.jsx - FIXED VERSION
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function TranslateModal({
  open = false,
  onClose = () => {},
  english = '',
  translated = '',
  lang = 'es',
  confirmed = false,
  onConfirm = () => {},
  onDownload = () => {}
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // FIXED: Properly handle text rendering
  const renderTextOrEmpty = (text) => {
    // Handle different text types
    let displayText = '';
    
    if (!text) {
      return <div style={{ color: '#64748b', fontStyle: 'italic' }}>No content available.</div>;
    }
    
    // If text is an object, try to extract string
    if (typeof text === 'object') {
      if (text.text) {
        displayText = String(text.text);
      } else {
        displayText = JSON.stringify(text, null, 2);
      }
    } else {
      displayText = String(text);
    }
    
    if (displayText.trim().length === 0) {
      return <div style={{ color: '#64748b', fontStyle: 'italic' }}>No content available.</div>;
    }
    
    return <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{displayText}</pre>;
  };

  return (
    <div className="modal-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1000, width: '92%', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header" style={{ alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Translation Preview & Confirmation</h3>
            <small style={{ color: '#64748b' }}>Language: {lang.toUpperCase()}</small>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button aria-label="Close" onClick={onClose} className="btn-close-modal" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X />
            </button>
          </div>
        </div>

        <div className="modal-body modal-body-scrollable" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>English (original)</div>
            <div style={{ background: '#fff', border: '1px solid #e6eef8', borderRadius: 8, padding: 12, minHeight: 240, overflowY: 'auto' }}>
              {renderTextOrEmpty(english)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>Translated ({lang.toUpperCase()})</div>
              {confirmed ? (
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✅ Confirmed</div>
              ) : (
                <div style={{ fontSize: 12, color: '#6b7280' }}>Preview</div>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e6eef8', borderRadius: 8, padding: 12, minHeight: 240, overflowY: 'auto' }}>
              {renderTextOrEmpty(translated)}
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid #eef2f7' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={onClose}>Close</button>

            {!confirmed ? (
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await onConfirm();
                  } catch (e) {
                    console.error('Confirm error:', e);
                  }
                }}
              >
                Confirm Translation
              </button>
            ) : (
              <button className="btn btn-success" disabled>
                ✅ Translation Confirmed
              </button>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline"
              onClick={() => onDownload('en')}
              title="Download English PDF"
            >
              Download (EN)
            </button>

            <button
              className="btn btn-outline"
              onClick={() => onDownload('translated')}
              title="Download translated PDF"
              disabled={!confirmed}
            >
              Download ({lang.toUpperCase()})
            </button>

            <button
              className="btn btn-primary"
              onClick={() => onDownload('both')}
              title="Download bilingual PDF (side-by-side)"
              disabled={!confirmed}
            >
              Download Both
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}