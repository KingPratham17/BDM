import { Sparkles } from 'lucide-react';

export default function AIButton({ onClick, loading = false, label = "Use AI 🤖" }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="btn-ai"
    >
      <Sparkles size={18} />
      {loading ? 'Generating...' : label}
    </button>
  );
}
