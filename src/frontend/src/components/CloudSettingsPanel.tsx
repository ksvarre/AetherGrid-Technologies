import React, { useState, useEffect } from 'react';

interface CloudSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudSettingsPanel: React.FC<CloudSettingsPanelProps> = ({ isOpen, onClose }) => {
  const [provider, setProvider] = useState<'local' | 'gemini' | 'azure'>('local');
  const [geminiKey, setGeminiKey] = useState('');
  const [azureKey, setAzureKey] = useState('');
  const [azureEndpoint, setAzureEndpoint] = useState('');
  const [azureDeployment, setAzureDeployment] = useState('');

  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showAzureKey, setShowAzureKey] = useState(false);

  // Sync / Ingestion status states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    success: boolean;
    message: string;
    code?: string;
    count?: number;
  } | null>(null);

  // Load from localStorage on mount or open
  useEffect(() => {
    if (isOpen) {
      const savedProvider = localStorage.getItem('aethergrid_cloud_provider') as 'local' | 'gemini' | 'azure';
      const savedGeminiKey = localStorage.getItem('aethergrid_gemini_key') || '';
      const savedAzureKey = localStorage.getItem('aethergrid_azure_key') || '';
      const savedAzureEndpoint = localStorage.getItem('aethergrid_azure_endpoint') || '';
      const savedAzureDeployment = localStorage.getItem('aethergrid_azure_deployment') || '';

      if (savedProvider) setProvider(savedProvider);
      setGeminiKey(savedGeminiKey);
      setAzureKey(savedAzureKey);
      setAzureEndpoint(savedAzureEndpoint);
      setAzureDeployment(savedAzureDeployment);
      setSyncStatus(null);
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('aethergrid_cloud_provider', provider);
    localStorage.setItem('aethergrid_gemini_key', geminiKey.trim());
    localStorage.setItem('aethergrid_azure_key', azureKey.trim());
    localStorage.setItem('aethergrid_azure_endpoint', azureEndpoint.trim());
    localStorage.setItem('aethergrid_azure_deployment', azureDeployment.trim());
    onClose();
  };

  const handleSyncWorkspace = async () => {
    setIsSyncing(true);
    setSyncStatus(null);

    // Save temporary credentials locally first so they persist if the user refreshes
    localStorage.setItem('aethergrid_cloud_provider', provider);
    localStorage.setItem('aethergrid_gemini_key', geminiKey.trim());
    localStorage.setItem('aethergrid_azure_key', azureKey.trim());
    localStorage.setItem('aethergrid_azure_endpoint', azureEndpoint.trim());
    localStorage.setItem('aethergrid_azure_deployment', azureDeployment.trim());

    try {
      const response = await fetch('http://localhost:5000/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cloud-provider': provider,
          'x-gemini-api-key': geminiKey.trim(),
          'x-azure-api-key': azureKey.trim(),
          'x-azure-endpoint': azureEndpoint.trim(),
          'x-azure-deployment': azureDeployment.trim(),
        },
      });

      if (!response.ok) {
        throw new Error(`Workspace re-indexing query returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.cloudError) {
        setSyncStatus({
          success: false,
          code: data.cloudError.code,
          message: data.cloudError.message,
          count: data.count,
        });
      } else {
        setSyncStatus({
          success: true,
          message: `Successfully re-indexed knowledge workspace. Loaded ${data.count || 0} chunks with cloud enrichment!`,
          count: data.count,
        });
      }
    } catch (err: any) {
      console.error("Workspace sync triggered error:", err);
      setSyncStatus({
        success: false,
        code: 'CONNECTION_FAILED',
        message: 'Could not connect to AetherGrid Ingestion Server on http://localhost:5000. Verify the backend service is active.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="citation-drawer-overlay" 
      onClick={onClose}
      style={{
        zIndex: 1000,
        animation: 'fade-in 0.2s ease'
      }}
    >
      <form 
        className="citation-drawer glass-panel" 
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => e.preventDefault()}
        style={{
          width: '520px',
          padding: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem',
          borderLeft: '1px solid rgba(0, 242, 254, 0.2)',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.6)',
          overflowY: 'auto'
        }}
      >
        <div className="drawer-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="drawer-title" style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, fontSize: '1.4rem' }}>
            ⚙️ LLM Gateway Strategy
          </h2>
          <button 
            type="button"
            className="drawer-close" 
            onClick={onClose}
            style={{ fontSize: '1.8rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
          Boost query synthesis and structural data extraction (attendees, dates, priority, action items, decisions) by connecting AetherGrid to high-fidelity cloud models. Credentials are saved <strong>only locally</strong> in your browser's private memory storage and sent transiently.
        </p>

        {/* Strategy Provider Dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-cyan)', fontFamily: 'Outfit', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Select LLM Engine Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as any)}
            style={{
              background: 'rgba(10, 16, 28, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              color: 'var(--text-primary)',
              fontFamily: 'Outfit',
              fontWeight: 500,
              fontSize: '0.95rem',
              outline: 'none',
              cursor: 'pointer',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent-cyan)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
          >
            <option value="local">🔌 Local Offline Mode (Standard TF-IDF)</option>
            <option value="gemini">⚡ Google Gemini API (Sleek Cloud RAG)</option>
            <option value="azure">🌐 Azure OpenAI Service (Enterprise Private LLM)</option>
          </select>
        </div>

        {/* Dynamic Provider Input Sections */}
        {provider === 'gemini' && (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem', background: 'rgba(0, 242, 254, 0.02)', borderRadius: '10px', border: '1px solid rgba(0, 242, 254, 0.1)' }}>
            <h4 style={{ color: 'var(--accent-blue)', margin: 0, fontFamily: 'Outfit', fontSize: '1rem' }}>Google Gemini Configuration</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Gemini API Key</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  style={{
                    width: '100%',
                    background: 'rgba(8, 12, 20, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.65rem 2.5rem 0.65rem 0.75rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {showGeminiKey ? '🙈 Hide' : '👁️ Show'}
                </button>
              </div>
            </div>
          </div>
        )}

        {provider === 'azure' && (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem', background: 'rgba(124, 58, 237, 0.03)', borderRadius: '10px', border: '1px solid rgba(124, 58, 237, 0.15)' }}>
            <h4 style={{ color: '#c084fc', margin: 0, fontFamily: 'Outfit', fontSize: '1rem' }}>Azure OpenAI Configuration</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Endpoint URL</label>
              <input
                type="text"
                value={azureEndpoint}
                onChange={(e) => setAzureEndpoint(e.target.value)}
                placeholder="https://your-resource.openai.azure.com/"
                style={{
                  background: 'rgba(8, 12, 20, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.75rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Deployment Name</label>
              <input
                type="text"
                value={azureDeployment}
                onChange={(e) => setAzureDeployment(e.target.value)}
                placeholder="gpt-4o-mini"
                style={{
                  background: 'rgba(8, 12, 20, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.75rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Azure API Key</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showAzureKey ? 'text' : 'password'}
                  value={azureKey}
                  onChange={(e) => setAzureKey(e.target.value)}
                  placeholder="Azure Key Token..."
                  style={{
                    width: '100%',
                    background: 'rgba(8, 12, 20, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.65rem 2.5rem 0.65rem 0.75rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowAzureKey(!showAzureKey)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {showAzureKey ? '🙈 Hide' : '👁️ Show'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sync & Re-index Workspace Tool */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Workspace Indexes</span>
            <button
              type="button"
              className="download-document-btn"
              onClick={handleSyncWorkspace}
              disabled={isSyncing || (provider !== 'local' && (provider === 'gemini' ? !geminiKey : (!azureKey || !azureEndpoint || !azureDeployment)))}
              style={{
                background: 'rgba(0, 242, 254, 0.1)',
                border: '1px solid rgba(0, 242, 254, 0.3)',
                borderRadius: '8px',
                color: 'var(--accent-cyan)',
                padding: '8px 16px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontFamily: 'Outfit',
                fontWeight: 600,
                opacity: (isSyncing || (provider !== 'local' && (provider === 'gemini' ? !geminiKey : (!azureKey || !azureEndpoint || !azureDeployment)))) ? 0.4 : 1,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {isSyncing ? (
                <>
                  <span className="loading-dot" style={{ width: '6px', height: '6px', margin: 0 }}></span>
                  <span>Syncing Corpus...</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                  </svg>
                  <span>Sync & Re-index Workspace</span>
                </>
              )}
            </button>
          </div>

          {/* Detailed sync error validation or success alerts */}
          {syncStatus && (
            <div 
              className={`alert-banner ${syncStatus.success ? 'success' : 'warning'} animate-slide-up`}
              style={{
                margin: 0,
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                border: syncStatus.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                background: syncStatus.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)'
              }}
            >
              {syncStatus.success ? (
                <div>
                  <strong style={{ color: 'var(--color-success)', display: 'block', marginBottom: '0.25rem' }}>✓ Core Synchronization Succeeded</strong>
                  <span style={{ color: 'var(--text-primary)' }}>{syncStatus.message}</span>
                </div>
              ) : (
                <div>
                  <strong style={{ color: 'var(--color-warning)', display: 'block', marginBottom: '0.25rem' }}>⚠️ Synchronization Degraded [Code: {syncStatus.code}]</strong>
                  <span style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>{syncStatus.message}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>
                    Workspace parsing successfully fell back to local offline algorithms. Saved {syncStatus.count || 0} chunks without cloud enrichment. Please verify credentials.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              padding: '0.65rem 1.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Outfit',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            style={{
              background: 'var(--grad-primary)',
              border: 'none',
              borderRadius: '8px',
              color: '#080c14',
              padding: '0.65rem 2rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Outfit',
              boxShadow: 'var(--box-shadow-glow)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 242, 254, 0.35)'}
            onMouseOut={(e) => e.currentTarget.style.boxShadow = 'var(--box-shadow-glow)'}
          >
            Apply & Save
          </button>
        </div>
      </form>
    </div>
  );
};
