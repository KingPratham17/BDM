// bdm-frontend/src/components/TranslateDropdown.jsx
import React from 'react';

/**
 * TranslateDropdown
 *
 * Props:
 * - selected: currently selected language code (e.g. 'es')
 * - onChange: function(lang) => void  (called when selection changes)
 * - onTranslate: function(lang) => void (called when user clicks Translate)
 *
 * Example usage:
 * <TranslateDropdown selected="es" onChange={(l)=>setLang(l)} onTranslate={(l)=>doTranslate(docId,l)} />
 */

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ru', label: 'Russian' },
  // Add or remove languages as needed
];

export default function TranslateDropdown({ selected = 'es', onChange = () => {}, onTranslate = () => {} }) {
  const handleSelectChange = (e) => {
    const lang = e.target.value;
    onChange(lang);
  };

  const handleTranslateClick = () => {
    onTranslate(selected);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select
        value={selected}
        onChange={handleSelectChange}
        aria-label="Select language"
        style={{
          padding: '0.4rem 0.6rem',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          background: 'white',
          fontSize: '0.95rem'
        }}
      >
        {LANGUAGES.map((lng) => (
          <option key={lng.code} value={lng.code}>
            {lng.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleTranslateClick}
        className="btn btn-outline"
        style={{
          padding: '0.36rem 0.6rem',
          borderRadius: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}
      >
        Translate
      </button>
    </div>
  );
}
