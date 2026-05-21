import React, { useState } from 'react';

interface PhaseDetail {
  number: number;
  title: string;
  objective: string;
  status: 'Design Approved' | 'In-Queue' | 'Planned' | 'Under Review';
  badgeColor: string;
  bullets: string[];
  securityFocus: string;
  architectureDetails: string;
}

export const RoadmapView: React.FC = () => {
  const [selectedPhase, setSelectedPhase] = useState<number | null>(1);

  const phases: PhaseDetail[] = [
    {
      number: 1,
      title: 'Secure Identity Gateway (SSO & RBAC)',
      objective: 'Enforce strict organizational boundaries to guard administrative tasks and prevent unauthorized gap approvals.',
      status: 'Design Approved',
      badgeColor: 'var(--accent-cyan)',
      bullets: [
        'OAuth2 / JWT Single-Sign-On (SSO) integration backed by Microsoft Entra ID, Okta, or Auth0.',
        'Granular Role-Based Access Control (RBAC): Admin (Team Lead) vs. Reader (Operator).',
        'Gated Express.js router middleware (e.g. requireRole([\'Admin\'])) securing critical endpoints.',
        'React router guards to dynamically render administrative menus and protect action triggers.'
      ],
      securityFocus: 'STRIDE Remediations: Access Control Hardening, Spoofing and Elevation of Privilege prevention.',
      architectureDetails: 'Will use passport-azure-ad for native Active Directory integration, caching JWT verification tokens with a 15-minute sliding window.'
    },
    {
      number: 2,
      title: 'Self-Service Document Ingestion Gateway',
      objective: 'Allow authorized employees to ingest new files directly from the web dashboard securely.',
      status: 'Design Approved',
      badgeColor: 'var(--accent-cyan)',
      bullets: [
        'Drag-and-drop web portal supporting modern document formats (.md, .docx, .pptx, .xlsx).',
        'Magic-byte structure validation scans zip PK file headers to prevent decompression bomb attacks.',
        'Buffer piping through ClamAV scanner before disk serialization.',
        'Dynamic hot-reindexing to make newly uploaded document chunks searchable instantly.'
      ],
      securityFocus: 'STRIDE Remediations: Input Validation, Denial of Service protection, Tampering prevention.',
      architectureDetails: 'Uses multer for memory-buffered file streams and Mammoth.js/SheetJS for sandboxed extraction of text nodes.'
    },
    {
      number: 3,
      title: 'Centralized Enterprise Key Brokerage',
      objective: 'Remove Bring Your Own Key (BYOK) boundaries, running all LLM calls under corporate billing.',
      status: 'Design Approved',
      badgeColor: 'var(--accent-cyan)',
      bullets: [
        'Secrets locked inside Azure Key Vault or AWS Secrets Manager with zero local dotenv persistence.',
        'Centralized server-side proxy managing API integrations to Google Cloud Vertex AI and Azure OpenAI.',
        'Strict tenant token/request limits and budget quotas to prevent financial exhaustions.',
        'Structured logging tracking token utilization metrics per system tenant.'
      ],
      securityFocus: 'STRIDE Remediations: Information Disclosure protection, Credential Leak mitigation.',
      architectureDetails: 'API keys are dynamically fetched on startup using IAM role credentials, ensuring zero hardcoded credentials exist.'
    },
    {
      number: 4,
      title: 'Hybrid Sparse-Dense Vector DB Migration',
      objective: 'Transition local JSON memory stores to production-grade relational and vector engines.',
      status: 'In-Queue',
      badgeColor: 'var(--accent-blue)',
      bullets: [
        'Migration of active tables (queries log, corrections ledger, corpus files) to Supabase (PostgreSQL).',
        'Semantic dense indexing powered by PostgreSQL pgvector extensions using Cosine distance indices.',
        'Hybrid Sparse-Dense Retrieval (RRF - Reciprocal Rank Fusion) combining lexical BM25 search and embeddings.',
        'High-speed read replicas ensuring search performance scales to thousands of concurrent operations.'
      ],
      securityFocus: 'STRIDE Remediations: Information Disclosure prevention, Database injection hardening.',
      architectureDetails: 'PostgreSQL text search vector will handle lexical queries while pgvector hnsw index handles 768-dimensional text-gecko embeddings.'
    },
    {
      number: 5,
      title: 'Continuous Evaluation & Regression Pipeline',
      objective: 'Ensure newly ingested corporate data or prompt changes do not degrade historical search accuracy.',
      status: 'In-Queue',
      badgeColor: 'var(--accent-blue)',
      bullets: [
        'Compilation of a benchmark Golden Dataset containing critical company query-citation pairs.',
        'RAGAS/TruLens metrics assessment automated directly inside GitHub Actions CI/CD workflows.',
        'Continuous evaluation of Faithfulness, Answer Relevance, and Context Recall scores.',
        'Automated build gating blocking deployments if system scores fall below 90% confidence.'
      ],
      securityFocus: 'STRIDE Remediations: Data Drift, System Integrity failure prevention.',
      architectureDetails: 'A dedicated test runner runs post-commit in GitHub Actions, comparing pipeline outputs to expected ground truths using LLM-as-a-judge.'
    },
    {
      number: 6,
      title: 'Continuous Active Learning Feedback Loops',
      objective: 'Enable the search system to automatically adapt and improve based on approved team corrections.',
      status: 'Planned',
      badgeColor: 'var(--accent-purple)',
      bullets: [
        'Incremental database indexing transforming approved corrections into dynamic few-shot prompt examples.',
        'Monthly fine-tuning datasets packaged from resolved audit logs.',
        'Continuous optimization of a custom-hosted small language model trained on company jargon.',
        'Automated prompt versioning linked to active search metrics performance.'
      ],
      securityFocus: 'STRIDE Remediations: Adversarial Prompt Injection and Model Poisoning prevention.',
      architectureDetails: 'Feedback loops filter outlier inputs, sanitizing corrected entries through a semantic threshold boundary before inclusion.'
    },
    {
      number: 7,
      title: 'Collaborative Microsoft Teams Action Loops',
      objective: 'Move routing triggers into active corporate communications channels for immediate resolution.',
      status: 'Planned',
      badgeColor: 'var(--accent-purple)',
      bullets: [
        'Direct outgoing webhook API routing low-confidence queries directly to Microsoft Teams.',
        'Interactive cards showing query parameters, matched snippets, and expert routing recommendations.',
        'Microsoft Teams interactive message event listener parsing expert replies directly in-channel.',
        'Automated database updates parsing approved responses to live indexes instantly.'
      ],
      securityFocus: 'STRIDE Remediations: Request Forgery prevention, Endpoint validation.',
      architectureDetails: 'We verify Microsoft Teams secure token signatures on all incoming webhook callbacks to prevent spoofed expert approvals.'
    },
    {
      number: 8,
      title: 'Premium UI/UX Polish & Generative Response Tuning',
      objective: 'Optimize system workflows via ingestion/response parameter customizers and high-fidelity front-end design enhancements.',
      status: 'Planned',
      badgeColor: 'var(--accent-purple)',
      bullets: [
        'Generative Response Console enabling administrators to customize model system directives, temperature, top-p, and response creativity.',
        'Ingestion Parameter Customizer to visually configure text-splitting chunk sizes, overlap ratios, and document parsing parameters.',
        'Premium UI/UX Refinements supporting dynamic responsive grids, custom light/dark theme profiles, and configurable operator hotkeys.',
        'Granular Citation Highlight Mapping to automatically highlight exact Excel cells or Word paragraphs when clicking source citations.'
      ],
      securityFocus: 'STRIDE Remediations: Prompt Injection and UI Redressing prevention (X-Frame-Options).',
      architectureDetails: 'Uses an admin-only metadata storage table to save prompt variables, dynamically injected into Vertex AI model configs.'
    }
  ];

  return (
    <div className="glass-panel" style={{ padding: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Page Header */}
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, fontFamily: 'Outfit', fontSize: '1.6rem', color: 'var(--text-primary)' }}>
          🔮 Recommended Future Features
        </h2>
        <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          A strategic blueprint detailing recommended future features to scale and improve the corporate platform.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem' }}>
        
        {/* Left Side: Phase Steps Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Execution Stages
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', position: 'relative', paddingLeft: '0.5rem' }}>
            
            {/* Timeline continuous visual vertical track */}
            <div style={{ 
              position: 'absolute', 
              left: '20px', 
              top: '20px', 
              bottom: '20px', 
              width: '2px', 
              background: 'linear-gradient(to bottom, var(--accent-cyan) 30%, var(--accent-blue) 60%, var(--accent-purple) 100%)',
              zIndex: 1,
              opacity: 0.3
            }}></div>

            {phases.map((phase) => {
              const isActive = selectedPhase === phase.number;
              return (
                <div
                  key={phase.number}
                  onClick={() => setSelectedPhase(phase.number)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: isActive ? 'rgba(0, 242, 254, 0.05)' : 'rgba(255,255,255,0.01)',
                    border: isActive ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.05)',
                    padding: '1rem 1.25rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    zIndex: 2,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isActive ? '0 0 15px rgba(0, 242, 254, 0.08)' : 'none'
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                    }
                  }}
                >
                  {/* Glowing point bubble index */}
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: isActive ? 'var(--accent-cyan)' : 'rgba(14, 22, 38, 0.9)',
                    border: `2px solid ${isActive ? 'var(--accent-cyan)' : phase.badgeColor}`,
                    color: isActive ? '#080c14' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    marginRight: '1rem',
                    boxShadow: isActive ? '0 0 8px var(--accent-cyan)' : 'none',
                    transition: 'all 0.2s ease'
                  }}>
                    {phase.number}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      color: isActive ? 'var(--accent-cyan)' : 'var(--text-primary)', 
                      fontSize: '0.9rem',
                      transition: 'color 0.2s ease' 
                    }}>
                      {phase.title}
                    </div>
                  </div>

                  <span style={{ 
                    color: isActive ? 'var(--accent-cyan)' : 'var(--text-dim)',
                    transform: isActive ? 'translateX(3px)' : 'translateX(0)',
                    transition: 'all 0.2s ease',
                    fontSize: '0.9rem' 
                  }}>
                    →
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Phase Deep-Dive Details */}
        <div style={{ 
          background: 'rgba(10, 16, 28, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          minHeight: '400px'
        }}>
          {selectedPhase !== null ? (() => {
            const phase = phases.find(p => p.number === selectedPhase)!;
            return (
              <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                
                {/* Title Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <span style={{ 
                      display: 'inline-block', 
                      padding: '0.15rem 0.5rem', 
                      borderRadius: '4px', 
                      background: `rgba(${phase.number === 1 || phase.number === 2 || phase.number === 3 ? '0, 242, 254' : phase.number === 4 || phase.number === 5 ? '79, 172, 254' : '124, 58, 237'}, 0.1)`, 
                      color: phase.badgeColor, 
                      fontSize: '0.7rem', 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.4rem',
                      border: `1px solid rgba(${phase.number === 1 || phase.number === 2 || phase.number === 3 ? '0, 242, 254' : phase.number === 4 || phase.number === 5 ? '79, 172, 254' : '124, 58, 237'}, 0.2)`
                    }}>
                      Phase {phase.number}
                    </span>
                    <h4 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', fontFamily: 'Outfit', fontWeight: 700 }}>
                      {phase.title}
                    </h4>
                  </div>
                </div>

                {/* Objective */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Core Objective</div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                    {phase.objective}
                  </p>
                </div>

                {/* Blueprint Implementation Bullets */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Implementation Blueprint</div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {phase.bullets.map((bullet, index) => (
                      <li key={index} style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.9)', lineHeight: '1.45' }}>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Security Remediations STRIDE */}
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.04)', 
                  border: '1px solid rgba(239, 68, 68, 0.15)', 
                  borderRadius: '8px', 
                  padding: '0.85rem 1rem', 
                  marginBottom: '1rem' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Security Threat Controls (STRIDE)
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {phase.securityFocus}
                  </p>
                </div>

                {/* Architecture Details */}
                <div style={{ 
                  background: 'rgba(0, 242, 254, 0.03)', 
                  border: '1px solid rgba(0, 242, 254, 0.12)', 
                  borderRadius: '8px', 
                  padding: '0.85rem 1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                    Technical Integration Specs
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', fontStyle: 'italic' }}>
                    {phase.architectureDetails}
                  </p>
                </div>

              </div>
            );
          })() : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-dim)', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '1rem', opacity: 0.3 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Select an execution stage from the roadmap timeline to view technical integration blueprints, security threat vectors, and architectural dependencies.</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
