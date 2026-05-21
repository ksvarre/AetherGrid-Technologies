import React, { useState } from 'react';

export interface Citation {
  chunkId: string;
  fileName: string;
  filePath: string;
  author: string;
  attendees: string[];
  date: string;
  matchedSnippet: string;
}

export interface SuggestedRouting {
  recipientName: string;
  recipientEmail: string;
  rationale: string;
  draftedQuestion: string;
}

export interface QueryResponse {
  answer: string;
  confidenceScore: number;
  citations: Citation[];
  suggestedRouting?: SuggestedRouting;
  domain: string;
  priority: 'High' | 'Medium' | 'Low';
  cloudError?: {
    code: string;
    message: string;
    fallbackActive: boolean;
  };
}

interface SearchConsoleProps {
  onSearchResult: (result: QueryResponse | null, query: string) => void;
  onLoadingChange: (loading: boolean) => void;
  onOpenSettings: () => void;
}

export const SearchConsole: React.FC<SearchConsoleProps> = ({ onSearchResult, onLoadingChange, onOpenSettings }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  
  // Feedback states
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [correctedText, setCorrectedText] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    onLoadingChange(true);
    setResult(null);
    onSearchResult(null, query);
    setActiveCitation(null);
    setShowFeedbackForm(false);
    setCorrectedText('');
    setFeedbackSuccess(false);

    // Retrieve transient credentials from localStorage
    const provider = localStorage.getItem('aethergrid_cloud_provider') || 'local';
    const geminiKey = localStorage.getItem('aethergrid_gemini_key') || '';
    const azureKey = localStorage.getItem('aethergrid_azure_key') || '';
    const azureEndpoint = localStorage.getItem('aethergrid_azure_endpoint') || '';
    const azureDeployment = localStorage.getItem('aethergrid_azure_deployment') || '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-cloud-provider': provider,
      'x-gemini-api-key': geminiKey,
      'x-azure-api-key': azureKey,
      'x-azure-endpoint': azureEndpoint,
      'x-azure-deployment': azureDeployment,
    };

    try {
      const response = await fetch('http://localhost:5000/api/query', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      });
      if (!response.ok) {
        throw new Error('Search failed to execute');
      }
      const data: QueryResponse = await response.json();
      setResult(data);
      onSearchResult(data, query);
    } catch (err) {
      console.error(err);
      // Fallback local error response state
      const errResponse: QueryResponse = {
        answer: "System was unable to establish connection with AetherGrid Ingestion Server on localhost:5000. Please verify the backend is running.",
        confidenceScore: 0,
        citations: [],
        domain: 'System Diagnostics',
        priority: 'High'
      };
      setResult(errResponse);
      onSearchResult(errResponse, query);
    } finally {
      setLoading(false);
      onLoadingChange(false);
    }
  };

  const handleFeedbackSubmit = async (status: 'correct' | 'incorrect') => {
    if (!result) return;
    
    try {
      const payload = {
        query,
        answer: result.answer,
        confidenceScore: result.confidenceScore,
        status,
        correctedAnswer: status === 'incorrect' ? correctedText : undefined,
        domain: result.domain
      };

      const response = await fetch('http://localhost:5000/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setFeedbackSuccess(true);
        setShowFeedbackForm(false);
        setTimeout(() => setFeedbackSuccess(false), 4000);
      }
    } catch (err) {
      console.error("Failed to submit search feedback:", err);
    }
  };

  // Helper to parse **bold** markdown tags into <strong> elements
  const parseBoldText = (input: string, keyPrefix: string): React.ReactNode[] => {
    if (!input) return [];
    if (!input.includes('**')) return [input];
    
    const regex = /\*\*([\s\S]+?)\*\*/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(input)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(input.substring(lastIndex, matchIndex));
      }
      parts.push(
        <strong 
          key={`${keyPrefix}-bold-${matchIndex}`} 
          style={{ color: 'var(--text-primary)', fontWeight: 800 }}
        >
          {match[1]}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < input.length) {
      parts.push(input.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [input];
  };

  // Turn [1], [2] annotations into beautiful clickable interactive elements
  const renderFormattedAnswer = (text: string) => {
    if (!result || result.citations.length === 0) {
      return (
        <div className="answer-text" style={{ whiteSpace: 'pre-wrap' }}>
          {parseBoldText(text, 'fallback')}
        </div>
      );
    }

    const parts: React.ReactNode[] = [];
    let currentIdx = 0;
    
    // Regular expression matching citation marks like [1], [2], etc.
    const citationRegex = /\[(\d+)\]/g;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      const citationNumber = parseInt(match[1], 10);
      
      // Push text segment leading up to match
      if (matchIndex > currentIdx) {
        const textSegment = text.substring(currentIdx, matchIndex);
        parts.push(...parseBoldText(textSegment, `pre-${matchIndex}`));
      }
      
      // Verify citation index exists
      const citationObj = result.citations[citationNumber - 1];
      if (citationObj) {
        parts.push(
          <span 
            key={`cit-${matchIndex}`} 
            className={`citation-ref ${activeCitation?.chunkId === citationObj.chunkId ? 'active' : ''}`}
            onClick={() => setActiveCitation(citationObj)}
            title={`Source: ${citationObj.fileName}`}
          >
            {citationNumber}
          </span>
        );
      } else {
        parts.push(match[0]); // Fallback if number is invalid
      }
      
      currentIdx = citationRegex.lastIndex;
    }
    
    if (currentIdx < text.length) {
      const textSegment = text.substring(currentIdx);
      parts.push(...parseBoldText(textSegment, `post-${currentIdx}`));
    }

    return (
      <div className="answer-text" style={{ whiteSpace: 'pre-wrap' }}>
        {parts.length > 0 ? parts : text}
      </div>
    );
  };

  /**
   * Smart citation snippet renderer:
   * - Detects tabular data from Excel (.xlsx/.xls) and renders as an HTML table
   * - Falls back to standard quoted text for non-tabular content (transcripts, Word docs, PPTX)
   */
  const renderSnippetContent = (snippet: string, fileName: string) => {
    const isExcel = /\.xlsx?$/i.test(fileName);
    
    // Detect tabular pattern: rows separated by semicolons, cells formatted as "Header: Value"
    const rows = snippet.split(/;\s*\n|;\s*$/).map(r => r.trim()).filter(Boolean);
    const isTabular = isExcel && rows.length > 0 && rows.every(row => row.includes(':'));

    if (isTabular) {
      // Extract unique headers from all rows to build consistent columns
      const allHeaders: string[] = [];
      const parsedRows: Record<string, string>[] = [];

      // Remove "Sheet: ..." prefix line if present
      let dataRows = rows;
      if (rows[0]?.startsWith('Sheet:')) {
        dataRows = rows.slice(1);
      }

      for (const row of dataRows) {
        const cells = row.split(/,\s*(?=[A-Za-z_][A-Za-z0-9_ ]*:)/);
        const rowData: Record<string, string> = {};
        for (const cell of cells) {
          const colonIdx = cell.indexOf(':');
          if (colonIdx > 0) {
            const header = cell.substring(0, colonIdx).trim();
            const value = cell.substring(colonIdx + 1).trim();
            if (!allHeaders.includes(header)) allHeaders.push(header);
            rowData[header] = value;
          }
        }
        if (Object.keys(rowData).length > 0) parsedRows.push(rowData);
      }

      if (parsedRows.length > 0 && allHeaders.length > 0) {
        return (
          <div className="drawer-snippet-box" style={{ padding: 0, overflow: 'auto' }}>
            {rows[0]?.startsWith('Sheet:') && (
              <div style={{ 
                padding: '0.5rem 0.75rem', 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: 'var(--accent-cyan)', 
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0, 242, 254, 0.03)'
              }}>
                📊 {rows[0].split('|')[0]?.trim()}
              </div>
            )}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
            }}>
              <thead>
                <tr>
                  {allHeaders.map(h => (
                    <th key={h} style={{
                      padding: '0.5rem 0.6rem',
                      textAlign: 'left',
                      color: 'var(--accent-cyan)',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      borderBottom: '2px solid rgba(0, 242, 254, 0.2)',
                      whiteSpace: 'nowrap',
                      background: 'rgba(0, 242, 254, 0.03)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, rowIdx) => (
                  <tr key={rowIdx} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.2s',
                  }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {allHeaders.map(h => (
                      <td key={h} style={{
                        padding: '0.45rem 0.6rem',
                        color: 'var(--text-primary)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}>{row[h] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }

    // Default: plain text snippet display
    return (
      <div className="drawer-snippet-box">
        "{snippet}"
      </div>
    );
  };

  return (
    <div className="search-console">
      {/* Ask Input form */}
      <form onSubmit={handleSearch} className="search-bar-container">
        <input
          type="text"
          className="search-input"
          placeholder="Ask AetherGrid Knowledge Base... (e.g. Helium hardware, MAE forecasting error, Elena microgrid specs)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="search-button" disabled={loading || !query.trim()}>
          {loading ? (
            <span>Processing...</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Ask Engine</span>
            </>
          )}
        </button>
      </form>

      {/* Loading Indicator */}
      {loading && (
        <div className="loading-indicator">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <span style={{ color: 'var(--text-secondary)', marginLeft: '1rem', fontFamily: 'Outfit', fontWeight: 600 }}>Analyzing Synaptic Database</span>
        </div>
      )}

      {/* Results View */}
      {result && !loading && (
        <div className="glass-panel answer-box animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {result.cloudError && (
            <div 
              className="alert-banner warning animate-slide-up"
              style={{
                margin: 0,
                border: '1px solid rgba(245, 158, 11, 0.35)',
                background: 'rgba(245, 158, 11, 0.05)',
                borderRadius: '10px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                boxShadow: '0 8px 32px rgba(245, 158, 11, 0.08)',
                backdropFilter: 'blur(4px)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#fbbf24', fontSize: '0.95rem' }}>
                <span>⚠️</span>
                <span>Cloud Engine Offline — Safe Fallback Active</span>
                <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>
                  {result.cloudError.code}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                {result.cloudError.message}
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Your search query was immediately routed to the local offline indexing engine to prevent service disruption.
              </p>
              <button
                type="button"
                onClick={onOpenSettings}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: '0.25rem',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  color: '#fbbf24',
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#fbbf24';
                  e.currentTarget.style.color = '#080c14';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)';
                  e.currentTarget.style.color = '#fbbf24';
                }}
              >
                <span>⚙️</span>
                <span>Manage API Credentials</span>
              </button>
            </div>
          )}
          <div className="answer-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem' }}>
            <span className="answer-domain">{result.domain}</span>
            <div className="answer-confidence">
              <span>Search Confidence:</span>
              <div className="confidence-bar-bg">
                <div 
                  className="confidence-bar-fill" 
                  style={{ 
                    width: `${result.confidenceScore * 100}%`,
                    backgroundColor: result.confidenceScore > 0.7 ? 'var(--color-success)' : result.confidenceScore > 0.4 ? 'var(--color-warning)' : 'var(--color-danger)'
                  }}
                ></div>
              </div>
              <span style={{ 
                color: result.confidenceScore > 0.7 ? 'var(--color-success)' : result.confidenceScore > 0.4 ? 'var(--color-warning)' : 'var(--color-danger)',
                fontWeight: 700
              }}>
                {(result.confidenceScore * 100).toFixed(0)}%
              </span>
              <span className={`priority-badge ${result.priority.toLowerCase()}`} style={{ marginLeft: '1rem' }}>
                {result.priority} Priority
              </span>
            </div>
          </div>

          <div className="answer-body">
            {renderFormattedAnswer(result.answer)}
          </div>

          {/* User Feedback Loop (Exercise 2) */}
          <div className="feedback-actions">
            <button 
              className="feedback-btn correct-btn"
              onClick={() => handleFeedbackSubmit('correct')}
            >
              👍 Correct & High Quality
            </button>
            <button 
              className="feedback-btn reject-btn"
              onClick={() => setShowFeedbackForm(!showFeedbackForm)}
            >
              👎 Inaccurate or Missing Info (Flag Gap)
            </button>
          </div>

          {showFeedbackForm && (
            <div className="feedback-form-panel animate-slide-up">
              <h4 style={{ color: 'var(--accent-cyan)', fontFamily: 'Outfit' }}>Submit Correction Details</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Help us improve the Knowledge Tracer! Provide the correct information or note the missing file detail.
              </p>
              <textarea
                value={correctedText}
                onChange={(e) => setCorrectedText(e.target.value)}
                placeholder="Type details or expected correction here..."
              />
              <button 
                className="feedback-form-submit" 
                onClick={() => handleFeedbackSubmit('incorrect')}
                disabled={!correctedText.trim()}
              >
                Submit Correction
              </button>
            </div>
          )}

          {feedbackSuccess && (
            <div className="alert-banner success animate-slide-up" style={{ marginTop: '1rem' }}>
              <span style={{ fontWeight: 'bold' }}>✓ Thank you!</span> Core knowledge gap captured in Audit database. Engineers notified.
            </div>
          )}

          {/* Citations List */}
          {result.citations.length > 0 && (
            <div className="citations-wrapper">
              <h3 className="citations-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                Corpus Evidence Ledger
              </h3>
              <div className="citations-list">
                {result.citations.map((cit, idx) => (
                  <div 
                    key={cit.chunkId} 
                    className={`citation-card ${activeCitation?.chunkId === cit.chunkId ? 'active' : ''}`}
                    onClick={() => setActiveCitation(cit)}
                    style={{ borderLeft: activeCitation?.chunkId === cit.chunkId ? '4px solid var(--accent-cyan)' : undefined }}
                  >
                    <div className="citation-card-header">
                      <span className="citation-card-file">[{idx + 1}] {cit.fileName}</span>
                      <span className="citation-card-author">{cit.author || 'Corporate Attendee'}</span>
                    </div>
                    <p className="citation-card-snippet">
                      "{cit.matchedSnippet.length > 100 ? cit.matchedSnippet.substring(0, 100) + '...' : cit.matchedSnippet}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Citation Drawer Sidebar Modal */}
      {activeCitation && (
        <div className="citation-drawer-overlay" onClick={() => setActiveCitation(null)}>
          <div className="citation-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2 className="drawer-title">Source Document Evidence</h2>
              <button className="drawer-close" onClick={() => setActiveCitation(null)}>&times;</button>
            </div>
            
            <div className="drawer-content">
              <div className="drawer-meta-grid">
                <span className="drawer-meta-label">File Base:</span>
                <span className="drawer-meta-value">{activeCitation.fileName}</span>
                
                <span className="drawer-meta-label">Workspace Path:</span>
                <span className="drawer-meta-value" style={{ wordBreak: 'break-all', fontSize: '0.85rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span>{activeCitation.filePath}</span>
                  {!activeCitation.filePath.startsWith('virtual') && (
                    <button
                      className="download-document-btn"
                      onClick={() => window.open(`http://localhost:5000/api/documents/download/${encodeURIComponent(activeCitation.fileName)}`)}
                      title="Download original document"
                      style={{
                        background: 'rgba(0, 242, 254, 0.1)',
                        border: '1px solid rgba(0, 242, 254, 0.3)',
                        borderRadius: '6px',
                        color: 'var(--accent-cyan)',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.2s ease',
                        fontFamily: 'Outfit',
                        fontWeight: 600,
                        boxShadow: '0 0 10px rgba(0, 242, 254, 0.05)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'var(--accent-cyan)';
                        e.currentTarget.style.color = '#080c14';
                        e.currentTarget.style.boxShadow = 'var(--box-shadow-glow)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 242, 254, 0.1)';
                        e.currentTarget.style.color = 'var(--accent-cyan)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 242, 254, 0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>Download File</span>
                    </button>
                  )}
                </span>

                <span className="drawer-meta-label">Author/Publisher:</span>
                <span className="drawer-meta-value">{activeCitation.author || 'N/A'}</span>

                <span className="drawer-meta-label">Attendees List:</span>
                <span className="drawer-meta-value">{activeCitation.attendees && activeCitation.attendees.length > 0 ? activeCitation.attendees.join(', ') : 'N/A'}</span>

                <span className="drawer-meta-label">Publication Date:</span>
                <span className="drawer-meta-value">{activeCitation.date}</span>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <span className="drawer-meta-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Indexed Ground-Truth Text Segment:</span>
                {renderSnippetContent(activeCitation.matchedSnippet, activeCitation.fileName)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
