import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { FileText, Layout, FileEdit, Home } from 'lucide-react'; // <-- added Languages icon
import ClauseManager from './components/ClauseManager';
import TemplateBuilder from './components/TemplateBuilder';
import DocumentGenerator from './components/DocumentGenerator';
import Dashboard from './components/Dashboard';

import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="header">
          <div className="header-content">
            <Link to="/" className="logo">
              <FileText size={32} />
              <span>BDM System</span>
            </Link>
            <nav className="nav">
              <Link to="/" className="nav-link">
                <Home size={18} />
                Dashboard
              </Link>
              <Link to="/clauses" className="nav-link">
                <FileEdit size={18} />
                Clauses
              </Link>
              <Link to="/templates" className="nav-link">
                <Layout size={18} />
                Templates
              </Link>
              <Link to="/documents" className="nav-link">
                <FileText size={18} />
                Documents
              </Link>
             
            </nav>
          </div>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clauses" element={<ClauseManager />} />
            <Route path="/templates" element={<TemplateBuilder />} />
            <Route path="/documents" element={<DocumentGenerator />} />
           
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
