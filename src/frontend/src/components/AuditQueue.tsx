import React, { useEffect, useState } from 'react';

interface FeedbackItem {
  id: string;
  query: string;
  answer: string;
  confidenceScore: number;
  status: 'correct' | 'incorrect';
  correctedAnswer?: string;
  domain: string;
  resolved: boolean;
  timestamp: string;
  resolvedTimestamp?: string;
}

export const AuditQueue: React.FC = () => {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDomain, setFilterDomain] = useState<string>('All');
  const [showResolved, setShowResolved] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fetchFeedback = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/feedback');
      if (response.ok) {
        const data = await response.json();
        setFeedback(data);
      }
    } catch (err) {
      console.error("Failed to fetch feedback logs:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();

    // Silent periodic background polling every 10 seconds to auto-refresh the ledger
    const interval = setInterval(() => {
      fetchFeedback(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (feedbackId: string, action: 'approved' | 'dismissed') => {
    try {
      const response = await fetch('http://localhost:5000/api/feedback/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId }),
      });

      if (response.ok) {
        setSuccessMsg(`Feedback item successfully ${action}! Ingestion sync scheduled.`);
        fetchFeedback(); // Refresh checklist
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error("Failed to resolve feedback chunk:", err);
    }
  };

  const domains = ['All', ...Array.from(new Set(feedback.map(item => item.domain)))];

  const filteredFeedback = feedback.filter(item => {
    const matchesDomain = filterDomain === 'All' || item.domain === filterDomain;
    const matchesResolved = showResolved ? true : !item.resolved;
    return matchesDomain && matchesResolved;
  });

  // Calculate UCRV (User Correction Resolution Velocity)
  const resolvedItems = feedback.filter(item => item.resolved && item.resolvedTimestamp && item.timestamp);
  let ucrvText = "No resolutions yet";
  let ucrvStatusColor = "var(--text-secondary)";

  if (resolvedItems.length > 0) {
    const durations = resolvedItems.map(item => {
      const start = new Date(item.timestamp).getTime();
      const end = new Date(item.resolvedTimestamp!).getTime();
      return Math.max(0, end - start);
    });

    durations.sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    const medianMs = durations.length % 2 !== 0 
      ? durations[mid] 
      : (durations[mid - 1] + durations[mid]) / 2;

    const medianHours = medianMs / (1000 * 60 * 60);

    if (medianHours < 1) {
      const medianSeconds = Math.round(medianMs / 1000);
      if (medianSeconds < 60) {
        ucrvText = `${medianSeconds} second${medianSeconds === 1 ? '' : 's'}`;
      } else {
        const medianMinutes = Math.round(medianMs / (1000 * 60));
        ucrvText = `${medianMinutes} minute${medianMinutes === 1 ? '' : 's'}`;
      }
    } else {
      ucrvText = `${medianHours.toFixed(1)} hour${medianHours.toFixed(1) === '1.0' ? '' : 's'}`;
    }

    if (medianHours <= 48) {
      ucrvStatusColor = "var(--color-success)";
    } else {
      ucrvStatusColor = "var(--color-danger)";
    }
  }

  return (
    <div className="audit-container">
      <div className="glass-panel">
        <h2 style={{ color: 'var(--accent-cyan)', fontFamily: 'Outfit', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          Knowledge Gap Audit Queue
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          This control ledger captures queries where users reported low confidence, inaccuracies, or provided active corrections. 
          Team Leads use this portal to review knowledge gaps and approve training inputs.
        </p>

        {/* 📊 Exercise 3: User Correction Resolution Velocity (UCRV) Metric Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '220px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', fontWeight: 700 }}>
              Exercise 3 Operational Success Metric:
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              User Correction Resolution Velocity (UCRV)
            </span>
          </div>
          
          <div style={{ height: '30px', width: '1px', background: 'rgba(255, 255, 255, 0.1)', display: 'none' }} className="hide-mobile"></div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '150px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Measured Median Speed:</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: ucrvStatusColor, fontFamily: 'Outfit' }}>
              {ucrvText}
            </span>
          </div>

          <div style={{ height: '30px', width: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxWidth: '380px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Operational Target:</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <strong>UCRV ≤ 48 Hours</strong> (median speed to approve user corrections and update the search library).
            </span>
          </div>
        </div>

        {successMsg && (
          <div className="alert-banner success animate-slide-up" style={{ marginBottom: '1.5rem' }}>
            <span style={{ fontWeight: 'bold' }}>✓ Action Complete:</span> {successMsg}
          </div>
        )}

        {/* Filters Panel */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter by Topic Area:</label>
            <select 
              value={filterDomain} 
              onChange={(e) => setFilterDomain(e.target.value)}
              style={{
                background: 'rgba(8, 12, 20, 0.8)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-primary)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            >
              {domains.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.2rem' }}>
            <input 
              type="checkbox" 
              id="show-resolved" 
              checked={showResolved} 
              onChange={() => setShowResolved(!showResolved)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="show-resolved" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              Show Resolved Items
            </label>
          </div>

          <button 
            onClick={() => fetchFeedback()}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.05)',
              border: 'var(--border-glass)',
              color: 'var(--text-primary)',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            🔄 Refresh Ledger
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading ledger audit queue records...
          </div>
        ) : filteredFeedback.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '1rem', opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M8 12h8"></path>
            </svg>
            <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No outstanding knowledge gaps in this view.</p>
            <p style={{ fontSize: '0.85rem' }}>All query corrections have been fully integrated into the index.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="audit-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Query & Returned Answer</th>
                  <th style={{ width: '30%' }}>Flagged User Correction</th>
                  <th style={{ width: '15%' }}>Topic Area</th>
                  <th style={{ width: '15%' }}>Confidence & Date</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeedback.map((item) => (
                  <tr key={item.id} className="audit-row" style={{ opacity: item.resolved ? 0.6 : 1 }}>
                    <td>
                      <div className="audit-query">{item.query}</div>
                      <div className="audit-original" style={{ 
                        fontSize: '0.8rem', 
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '300px'
                      }}>
                        Returned: "{item.answer}"
                      </div>
                    </td>
                    <td>
                      {item.status === 'correct' ? (
                        <span style={{ color: 'var(--color-success)', fontSize: '0.85rem', fontWeight: 600 }}>
                          ✓ User confirmed: High Quality Match
                        </span>
                      ) : (
                        <div className="audit-correction">
                          <span style={{ fontWeight: 700, fontSize: '0.75rem', display: 'block', color: '#10b981', textTransform: 'uppercase' }}>
                            Correction Input:
                          </span>
                          "{item.correctedAnswer || 'No details provided'}"
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="answer-domain" style={{ fontSize: '0.75rem' }}>{item.domain}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{(item.confidenceScore * 100).toFixed(0)}% Match</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {new Date(item.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {item.resolved ? (
                        <span style={{ 
                          background: 'rgba(16, 185, 129, 0.1)', 
                          color: 'var(--color-success)',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          Resolved
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            className="action-btn approve"
                            onClick={() => handleResolve(item.id, 'approved')}
                            style={{
                              background: 'var(--color-success)',
                              color: '#080c14',
                              border: 'none',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.8rem'
                            }}
                            title="Approve input and integrate into corporate index"
                          >
                            Approve
                          </button>
                          <button 
                            className="action-btn dismiss"
                            onClick={() => handleResolve(item.id, 'dismissed')}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: 'var(--border-glass)',
                              color: 'var(--text-secondary)',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.8rem'
                            }}
                            title="Dismiss gap alert"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
