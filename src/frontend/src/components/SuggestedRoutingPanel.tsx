import React, { useState } from 'react';
import type { SuggestedRouting } from './SearchConsole';

interface SuggestedRoutingPanelProps {
  routing: SuggestedRouting;
  query: string;
}

export const SuggestedRoutingPanel: React.FC<SuggestedRoutingPanelProps> = ({ routing, query }) => {
  const [copied, setCopied] = useState(false);
  const [draftText, setDraftText] = useState(routing.draftedQuestion);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `To: ${routing.recipientName} (${routing.recipientEmail})\n\n${draftText}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel routing-panel animate-slide-in">
      <div className="routing-header">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <h3 style={{ margin: 0, fontFamily: 'Outfit', fontWeight: 700 }}>Low Search Confidence Routing Drawer</h3>
      </div>

      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        The AetherGrid Knowledge Tracer scored the query <strong style={{ color: 'var(--text-primary)' }}>"{query}"</strong> confidence below 40%. The topic appears under-documented or highly conversational. 
        We have routed a query strategy to the company's designated subject-matter expert:
      </p>

      <div className="routing-body">
        {/* Topic Expert Card */}
        <div className="routing-expert-card">
          <div className="routing-expert-name">{routing.recipientName}</div>
          <div className="routing-expert-email">{routing.recipientEmail}</div>
          <div style={{ borderBottom: '1px solid rgba(245, 158, 11, 0.15)', margin: '0.75rem 0' }}></div>
          <div className="routing-rationale">
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Expertise Routing Rationale:</span><br />
            {routing.rationale}
          </div>
        </div>

        {/* Drafted Question Card — Editable by the user before copying */}
        <div className="routing-draft-card">
          <div className="routing-draft-title">Drafted Microsoft Teams Message:</div>
          <textarea 
            className="routing-draft-text" 
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
          />
          <button 
            className={`routing-copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            style={{
              background: copied ? 'var(--color-success)' : 'var(--grad-quantum)',
              color: copied ? '#080c14' : 'var(--text-primary)'
            }}
          >
            {copied ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy Teams Message</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
