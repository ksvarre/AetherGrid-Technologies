import React, { useState, useEffect } from 'react';
import { SearchConsole } from './components/SearchConsole';
import type { QueryResponse } from './components/SearchConsole';
import { SuggestedRoutingPanel } from './components/SuggestedRoutingPanel';
import { AuditQueue } from './components/AuditQueue';
import { AetherPulseAnalytics } from './components/AetherPulseAnalytics';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'audit' | 'analytics'>('search');
  const [searchResult, setSearchResult] = useState<QueryResponse | null>(null);
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [isSearchLoading, setIsSearchLoading] = useState<boolean>(false);
  const [systemHealth, setSystemHealth] = useState<'Healthy' | 'Warning' | 'Critical'>('Healthy');

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/metrics');
      if (response.ok) {
        const metrics = await response.json();
        setSystemHealth(metrics.healthLevel);
      }
    } catch (err) {
      console.warn("Failed fetching status from backend node, using defaults");
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    // Poll status every 15 seconds to sync telemetry
    const interval = setInterval(fetchSystemStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchResult = (result: QueryResponse | null, query: string) => {
    setSearchResult(result);
    setCurrentQuery(query);
  };

  return (
    <div className="app-container">
      {/* 🧭 Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">AG</div>
          <span className="logo-text">AetherGrid</span>
        </div>

        <nav className="sidebar-menu">
          <button 
            className={`menu-item ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            GridTrace Core
          </button>
          
          <button 
            className={`menu-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Audit Queue
          </button>
          
          <button 
            className={`menu-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            AetherPulse Metrics
          </button>
        </nav>

        {/* 🤖 Declared Assistant Core Signature */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Primary Assistant:</span>
          <span>Antigravity by Google DeepMind</span>
          <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.7rem' }}>Build Target: Self-Healing RAG</span>
        </div>
      </aside>

      {/* 🖥️ Main View Container */}
      <main className="app-main">
        <header className="main-header">
          <div className="header-title">
            <h1>AetherGrid Knowledge Tracer</h1>
            <p>Smart Utility Balance & Grid Optimization Asset Ledger</p>
          </div>

          {/* Glowing led badge */}
          <div className="status-badge">
            <div className={`status-dot ${
              systemHealth === 'Healthy' ? 'healthy' : systemHealth === 'Warning' ? 'warning' : 'critical'
            }`}></div>
            <span className="status-text" style={{
              color: systemHealth === 'Healthy' ? 'var(--color-success)' : systemHealth === 'Warning' ? 'var(--color-warning)' : 'var(--color-danger)'
            }}>
              SYSTEM {systemHealth === 'Healthy' ? 'ONLINE' : systemHealth === 'Warning' ? 'DEGRADED' : 'CRITICAL'}
            </span>
          </div>
        </header>

        {/* Render Tab Contents */}
        <div className="tab-viewport">
          {activeTab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <SearchConsole 
                onSearchResult={handleSearchResult} 
                onLoadingChange={setIsSearchLoading}
              />
              
              {/* Show low-confidence suggested routing card next to results if needed (Exercise 2) */}
              {!isSearchLoading && searchResult && searchResult.confidenceScore < 0.40 && searchResult.suggestedRouting && (
                <SuggestedRoutingPanel 
                  routing={searchResult.suggestedRouting} 
                  query={currentQuery}
                />
              )}
            </div>
          )}

          {activeTab === 'audit' && <AuditQueue />}

          {activeTab === 'analytics' && <AetherPulseAnalytics />}
        </div>
      </main>
    </div>
  );
};

export default App;
