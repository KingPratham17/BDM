import { useEffect, useState } from 'react';
import { FileText, Layout, FileEdit, TrendingUp } from 'lucide-react';
import { clausesAPI, templatesAPI, documentsAPI, systemAPI } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    clauses: 0,
    templates: 0,
    documents: 0,
    ai_model: 'Loading...'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [clausesRes, templatesRes, documentsRes, aiConfigRes] = await Promise.all([
        clausesAPI.getAll(),
        templatesAPI.getAll(),
        documentsAPI.getAll(),
        systemAPI.aiConfig()
      ]);

      setStats({
        clauses: clausesRes.data.data.length,
        templates: templatesRes.data.data.length,
        documents: documentsRes.data.data?.length || 0,
        ai_model: aiConfigRes.data.ai_config?.model || 'N/A'
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>
        📊 Dashboard
      </h1>

      <div className="grid grid-3">
        <div className="card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <FileEdit size={24} color="#2563eb" />
            <h3 style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Clauses</h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.clauses}</p>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <Layout size={24} color="#10b981" />
            <h3 style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Templates</h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.templates}</p>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <FileText size={24} color="#f59e0b" />
            <h3 style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Documents</h3>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 700 }}> {stats.documents}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
          System Information
        </h2>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>AI Model</p>
            <p style={{ fontWeight: 600 }}>{stats.ai_model}</p>
          </div>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Status</p>
            <span className="badge badge-success">✅ Operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}