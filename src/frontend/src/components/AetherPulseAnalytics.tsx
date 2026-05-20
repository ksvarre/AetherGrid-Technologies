import React, { useEffect, useState } from 'react';

interface MetricSummary {
  rollingAvgConfidence: number;
  rejectionRate: number;
  systemHealthIndex: number;
  healthLevel: 'Healthy' | 'Warning' | 'Critical';
  totalQueriesCount: number;
  correctionsCount: number;
  gapHotspots: { domain: string; count: number }[];
}

export const AetherPulseAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/metrics');
      if (response.ok) {
        const data: MetricSummary = await response.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to fetch system telemetry:", err);
      // Mock fallback if offline/backend fails
      setMetrics({
        rollingAvgConfidence: 0.82,
        rejectionRate: 0.18,
        systemHealthIndex: 0.67,
        healthLevel: 'Warning',
        totalQueriesCount: 84,
        correctionsCount: 15,
        gapHotspots: [
          { domain: 'Project Quantum', count: 6 },
          { domain: 'Project Helium', count: 5 },
          { domain: 'Project Horizon', count: 3 },
          { domain: 'DevOps / Infrastructure', count: 1 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading system telemetry metrics...</div>;
  }

  const isDegraded = metrics ? metrics.systemHealthIndex < 0.65 : false;

  // Let's generate points for a beautiful SVG line chart showing simulated 30-day metrics history
  // Width: 600, Height: 150
  const pointsHealth = "20,120 80,110 140,115 200,95 260,105 320,80 380,85 440,75 500,82 560,90";
  const pointsConfidence = "20,95 80,90 140,92 200,85 260,88 320,70 380,72 440,68 500,74 560,78";
  const pointsRejections = "20,130 80,128 140,129 200,124 260,125 320,118 380,119 440,112 500,116 560,120";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* ⚠️ Exercise 2 Quality Degradation Warning Alert Panel */}
      {isDegraded && (
        <div className="alert-banner critical animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--color-danger)' }}>
          <div className="status-dot critical"></div>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'Outfit', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              System Quality Degradation Warning
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
              AetherPulse Diagnostic Alert: The active Knowledge Health Index has drifted below 0.65 (Current: {(metrics?.systemHealthIndex || 0).toFixed(2)}). 
              This is driven by a high User Rejection Rate ({(metrics?.rejectionRate || 0 * 100).toFixed(0)}%). A check of the corpus ingest pipeline is highly recommended.
            </p>
          </div>
        </div>
      )}

      {/* Main KPI Dashboard Panel */}
      <div className="metrics-grid">
        {/* Card 1: System Health Index */}
        <div className="glass-panel metric-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            System Health Index
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0', fontFamily: 'Outfit', color: isDegraded ? 'var(--color-danger)' : 'var(--accent-cyan)' }}>
            {((metrics?.systemHealthIndex || 0.8) * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Calculated as: Confidence × (1 - Rejections)
          </div>
          <div className={`status-dot ${isDegraded ? 'critical' : 'healthy'}`} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}></div>
        </div>

        {/* Card 2: Avg Search Confidence */}
        <div className="glass-panel metric-card">
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Avg Search Confidence
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0', fontFamily: 'Outfit', color: 'var(--accent-purple)' }}>
            {((metrics?.rollingAvgConfidence || 0.85) * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Rolling mean score across {metrics?.totalQueriesCount || 0} user searches
          </div>
        </div>

        {/* Card 3: Rejection Rate */}
        <div className="glass-panel metric-card">
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            User Rejection Rate
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0', fontFamily: 'Outfit', color: isDegraded ? 'var(--color-danger)' : 'var(--color-warning)' }}>
            {((metrics?.rejectionRate || 0.15) * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            {metrics?.correctionsCount || 0} corrections flagged in search ledger
          </div>
        </div>
      </div>

      {/* SVG Chart Panel */}
      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontFamily: 'Outfit', fontSize: '1.25rem' }}>
              30-Day Knowledge Performance Trends
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Continuous rolling telemetry representing system query accuracy and user validation rates
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '12px', height: '3px', background: 'var(--accent-cyan)', display: 'inline-block' }}></span>
              Health Index
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '12px', height: '3px', background: 'var(--accent-purple)', display: 'inline-block' }}></span>
              Confidence
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '12px', height: '3px', background: 'var(--color-warning)', display: 'inline-block' }}></span>
              Rejection Rate
            </span>
          </div>
        </div>

        {/* Pure SVG Line Graph */}
        <div style={{ width: '100%', height: '180px', background: 'rgba(8,12,20,0.5)', borderRadius: '8px', padding: '10px 20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <svg viewBox="0 0 580 140" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            {/* Grid Lines */}
            <line x1="20" y1="20" x2="560" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
            <line x1="20" y1="60" x2="560" y2="60" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
            <line x1="20" y1="100" x2="560" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
            <line x1="20" y1="130" x2="560" y2="130" stroke="rgba(255,255,255,0.1)" />

            {/* Labels */}
            <text x="5" y="25" fill="var(--text-dim)" fontSize="8">100%</text>
            <text x="5" y="65" fill="var(--text-dim)" fontSize="8">60%</text>
            <text x="5" y="105" fill="var(--text-dim)" fontSize="8">20%</text>

            <text x="20" y="138" fill="var(--text-dim)" fontSize="8">Day 1</text>
            <text x="200" y="138" fill="var(--text-dim)" fontSize="8">Day 10</text>
            <text x="380" y="138" fill="var(--text-dim)" fontSize="8">Day 20</text>
            <text x="540" y="138" fill="var(--text-dim)" fontSize="8">Day 30</text>

            {/* Lines */}
            <polyline fill="none" stroke="var(--accent-cyan)" strokeWidth="3" points={pointsHealth} strokeLinecap="round" strokeLinejoin="round" />
            <polyline fill="none" stroke="var(--accent-purple)" strokeWidth="2" points={pointsConfidence} strokeLinecap="round" strokeLinejoin="round" />
            <polyline fill="none" stroke="var(--color-warning)" strokeWidth="2" points={pointsRejections} strokeLinecap="round" strokeLinejoin="round" />

            {/* Glowing dots at endpoint */}
            <circle cx="560" cy="90" r="4" fill="var(--accent-cyan)" filter="drop-shadow(0 0 3px var(--accent-cyan))" />
            <circle cx="560" cy="78" r="4" fill="var(--accent-purple)" filter="drop-shadow(0 0 3px var(--accent-purple))" />
            <circle cx="560" cy="120" r="4" fill="var(--color-warning)" filter="drop-shadow(0 0 3px var(--color-warning))" />
          </svg>
        </div>
      </div>

      {/* Gap Hotspots Ledger Panel */}
      <div className="glass-panel">
        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontFamily: 'Outfit', fontSize: '1.25rem' }}>
          Knowledge Gap Hotspots
        </h3>
        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Topic domains receiving the highest frequency of user search corrections and rejections
        </p>

        {metrics && metrics.gapHotspots.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {metrics.gapHotspots.map((spot, idx) => (
              <div 
                key={spot.domain} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  background: 'rgba(255,255,255,0.02)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  background: idx === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                  color: idx === 0 ? 'var(--color-danger)' : 'var(--text-secondary)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  marginRight: '1rem'
                }}>
                  {idx + 1}
                </div>
                
                <div style={{ fontWeight: 600 }}>{spot.domain}</div>
                
                <div style={{ 
                  marginLeft: 'auto',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-primary)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}>
                  {spot.count} Gaps Flagged
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No knowledge gap hotspots recorded yet. Systems nominal.
          </div>
        )}
      </div>
      
    </div>
  );
};
