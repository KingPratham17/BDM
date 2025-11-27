import { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function AIButton({ onClick, loading = false, label = "Use AI 🤖" }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="btn-ai"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '0.6rem 1.2rem',
        borderRadius: '8px',
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      <Sparkles size={18} />
      {loading ? 'Generating...' : label}
    </button>
  );
}
