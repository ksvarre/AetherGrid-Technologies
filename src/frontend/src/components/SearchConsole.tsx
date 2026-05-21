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
}

interface SearchConsoleProps {
  onSearchResult: (result: QueryResponse | null, query: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

export const SearchConsole: React.FC<SearchConsoleProps> = ({ onSearchResult, onLoadingChange }) => {
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

    try {
      const response = await fetch('http://localhost:5000/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Turn [1], [2] annotations into beautiful clickable interactive elements
  const renderFormattedAnswer = (text: string) => {
    if (!result || result.citations.length === 0) return <p className="answer-text">{text}</p>;

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
        parts.push(text.substring(currentIdx, matchIndex));
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
      parts.push(text.substring(currentIdx));
    }

    return (
      <div className="answer-text" style={{ whiteSpace: 'pre-wrap' }}>
        {parts.length > 0 ? parts : text}
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
        <div className="glass-panel answer-box animate-slide-up">
          <div className="answer-header">
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
                <div className="drawer-snippet-box">
                  "{activeCitation.matchedSnippet}"
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
