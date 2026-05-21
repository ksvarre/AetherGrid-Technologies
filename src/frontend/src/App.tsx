import React, { useState, useEffect } from 'react';
import { SearchConsole } from './components/SearchConsole';
import type { QueryResponse } from './components/SearchConsole';
import { SuggestedRoutingPanel } from './components/SuggestedRoutingPanel';
import { AuditQueue } from './components/AuditQueue';
import { AetherPulseAnalytics } from './components/AetherPulseAnalytics';
import { CloudSettingsPanel } from './components/CloudSettingsPanel';
import { OnboardingWizard } from './components/OnboardingWizard';
import { RoadmapView } from './components/RoadmapView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'audit' | 'analytics' | 'roadmap'>('search');
  const [searchResult, setSearchResult] = useState<QueryResponse | null>(null);
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [isSearchLoading, setIsSearchLoading] = useState<boolean>(false);
  const [systemHealth, setSystemHealth] = useState<'Healthy' | 'Warning' | 'Critical'>('Healthy');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  // Auto-launch onboarding on first visit
  useEffect(() => {
    const hasCompleted = localStorage.getItem('aethergrid_onboarding_complete');
    if (!hasCompleted) {
      // Small delay to let the app render first
      const timer = setTimeout(() => setIsOnboardingOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

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
          
          <button 
            id="roadmap-sidebar-btn"
            className={`menu-item ${activeTab === 'roadmap' ? 'active' : ''}`}
            onClick={() => setActiveTab('roadmap')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            Recommended Future Features
          </button>
        </nav>
      </aside>

      {/* 🖥️ Main View Container */}
      <main className="app-main">
        <header className="main-header">
          <div className="header-title">
            <h1>AetherGrid Knowledge Tracer</h1>
            <p>Smart Utility Balance & Grid Optimization Asset Ledger</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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

            {/* "?" Help / Restart Tour Button */}
            <button
              className="onboarding-help-btn"
              onClick={() => setIsOnboardingOpen(true)}
              title="Launch guided walkthrough"
            >
              ?
            </button>

            {/* Premium Settings Gear Button */}
            <button
              className="settings-gear-btn"
              onClick={() => setIsSettingsOpen(true)}
              title="Cloud LLM & Ingestion Gateway Strategy Settings"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                color: 'var(--text-secondary)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                outline: 'none'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(0, 242, 254, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(0, 242, 254, 0.35)';
                e.currentTarget.style.color = 'var(--accent-cyan)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 242, 254, 0.2)';
                e.currentTarget.style.transform = 'rotate(45deg) scale(1.05)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>
        </header>

        {/* Render Tab Contents */}
        <div className="tab-viewport">
          {activeTab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <SearchConsole 
                onSearchResult={handleSearchResult} 
                onLoadingChange={setIsSearchLoading}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
              
              {/* Show low-confidence suggested routing card next to results if needed (Exercise 2) */}
              {!isSearchLoading && searchResult && searchResult.confidenceScore < 0.40 && searchResult.suggestedRouting && (
                <SuggestedRoutingPanel 
                  routing={searchResult.suggestedRouting} 
                  query={currentQuery}
                />
              )}

              {/* Tier 3: Off-topic query — no expert routing possible */}
              {!isSearchLoading && searchResult && searchResult.confidenceScore < 0.40 && !searchResult.suggestedRouting && (
                <div className="glass-panel routing-panel animate-slide-in" style={{ borderColor: 'rgba(148, 163, 184, 0.2)' }}>
                  <div className="routing-header" style={{ color: 'var(--text-secondary)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3 style={{ margin: 0, fontFamily: 'Outfit', fontWeight: 700 }}>Query Outside Knowledge Scope</h3>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '1rem 0 0.5rem' }}>
                    The query <strong style={{ color: 'var(--text-primary)' }}>"{currentQuery}"</strong> does not match any AetherGrid knowledge domain or content in the indexed corpus. 
                    No subject-matter expert could be identified for routing.
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0', fontStyle: 'italic' }}>
                    💡 This query may be outside the scope of AetherGrid's documented knowledge base. If this topic should be covered, consider flagging the response as inaccurate to create a knowledge gap entry for the team lead to review.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'audit' && <AuditQueue />}

          {activeTab === 'analytics' && <AetherPulseAnalytics />}

          {activeTab === 'roadmap' && <RoadmapView />}
        </div>
      </main>

      {/* Glassmorphic Settings Drawer */}
      <CloudSettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Interactive Onboarding Walkthrough */}
      <OnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onNavigateTab={setActiveTab}
      />
    </div>
  );
};

export default App;
