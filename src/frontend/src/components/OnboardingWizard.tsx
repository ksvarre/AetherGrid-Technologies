import React, { useState, useEffect, useCallback, useRef } from 'react';
import './onboarding.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface OnboardingStep {
  target: string;           // CSS selector for the element to spotlight
  title: string;
  description: string;
  icon: string;             // Emoji icon
  tab?: 'search' | 'audit' | 'analytics' | 'roadmap';  // Auto-switch tab before spotlighting
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'search' | 'audit' | 'analytics' | 'roadmap') => void;
}

// ─────────────────────────────────────────────
// Step Definitions
// ─────────────────────────────────────────────

const STEPS: OnboardingStep[] = [
  {
    target: '.sidebar-menu',
    title: 'Navigate Your Workspace',
    description: 'Use the sidebar to switch between <strong>GridTrace Core</strong> (search), <strong>Audit Queue</strong> (feedback review), and <strong>AetherPulse Metrics</strong> (system analytics).',
    icon: '🧭',
    tab: 'search',
    position: 'right',
  },
  {
    target: '.search-bar-container',
    title: 'Ask a Question',
    description: 'Type a natural language question to search the entire knowledge base — meeting transcripts, Word specs, Excel sheets, and PowerPoint presentations. Try: <strong>"What is Project Quantum?"</strong>',
    icon: '🔍',
    tab: 'search',
    position: 'bottom',
  },
  {
    target: '.answer-box',
    title: 'Trace to Source',
    description: 'Every answer includes clickable citation markers like <strong>[1] [2]</strong> that link back to the exact source file, author, and matched text snippet. Click any marker to open the citation drawer.',
    icon: '🔗',
    tab: 'search',
    position: 'bottom',
  },
  {
    target: '.feedback-actions',
    title: 'Flag Knowledge Gaps',
    description: 'If an answer is wrong or incomplete, click <strong>👎 Inaccurate</strong> to flag it. You can submit a correction with details — the team lead will review it in the Audit Queue.',
    icon: '📝',
    tab: 'search',
    position: 'top',
  },
  {
    target: '.audit-container',
    title: 'Review & Resolve Gaps',
    description: 'Team leads review flagged gaps here. <strong>Approve</strong> a correction to instantly inject it into the live search index (self-healing!), or <strong>Dismiss</strong> false positives.',
    icon: '✅',
    tab: 'audit',
    position: 'auto',
  },
  {
    target: '.analytics-grid',
    title: 'Monitor System Health',
    description: 'Track <strong>rolling confidence</strong>, <strong>rejection rates</strong>, <strong>reformulation patterns</strong>, and <strong>30-day performance trends</strong> in real time. Click the <strong>?</strong> on any card for details.',
    icon: '📊',
    tab: 'analytics',
    position: 'bottom',
  },
  {
    target: '.settings-gear-btn',
    title: 'Configure LLM Engine',
    description: 'Switch between <strong>Offline mode</strong> (zero-key local TF-IDF), <strong>Google Gemini</strong>, or <strong>Azure OpenAI</strong>. Bring your own API key for cloud-powered semantic search.',
    icon: '⚙️',
    tab: 'search',
    position: 'bottom',
  },
  {
    target: '#roadmap-sidebar-btn',
    title: 'Recommended Future Features',
    description: 'Explore our <strong>Future Features & Roadmap</strong>! While not part of the standard exercises, this presents strategic next-step tasks to transition the knowledge tracer into a production-grade enterprise system (SSO, self-service upload portal, hybrid vector DBs, and Teams webhook action loops) if there was more time.',
    icon: '🔮',
    tab: 'roadmap',
    position: 'right',
  },
];

const STORAGE_KEY = 'aethergrid_onboarding_complete';

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome screen
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // ── Calculate spotlight + tooltip position ──
  const updatePositions = useCallback(() => {
    if (currentStep < 0 || currentStep >= STEPS.length) return;

    const step = STEPS[currentStep];
    const el = document.querySelector(step.target);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const padding = 10;
    setSpotlightRect(new DOMRect(
      rect.x - padding,
      rect.y - padding,
      rect.width + padding * 2,
      rect.height + padding * 2
    ));

    // Position the tooltip card relative to the spotlight
    const tooltipWidth = 380;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 260;
    const gap = 16;
    let top = 0;
    let left = 0;

    const pos = step.position === 'auto' ? pickBestPosition(rect, tooltipWidth, tooltipHeight) : (step.position || 'auto');
    const finalPos = pos === 'auto' ? pickBestPosition(rect, tooltipWidth, tooltipHeight) : pos;

    switch (finalPos) {
      case 'bottom':
        top = rect.bottom + gap + padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = rect.top - tooltipHeight - gap - padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap + padding;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap - padding;
        break;
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    setTooltipStyle({ top: `${top}px`, left: `${left}px` });
  }, [currentStep]);

  function pickBestPosition(rect: DOMRect, tw: number, th: number): 'top' | 'bottom' | 'left' | 'right' {
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;

    if (spaceBelow > th + 30) return 'bottom';
    if (spaceAbove > th + 30) return 'top';
    if (spaceRight > tw + 30) return 'right';
    if (spaceLeft > tw + 30) return 'left';
    return 'bottom';
  }

  // ── Navigate to a specific step ──
  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < STEPS.length) {
      const step = STEPS[stepIndex];
      // Auto-switch tab if needed
      if (step.tab) {
        onNavigateTab(step.tab);
      }
    }
    setCurrentStep(stepIndex);
  }, [onNavigateTab]);

  // ── Update positions when step changes ──
  useEffect(() => {
    if (!isOpen || currentStep < 0) return;

    // Small delay to let the tab switch render
    const timer = setTimeout(() => {
      updatePositions();
    }, 150);

    return () => clearTimeout(timer);
  }, [currentStep, isOpen, updatePositions]);

  // ── Recalculate on resize/scroll ──
  useEffect(() => {
    if (!isOpen || currentStep < 0) return;

    const handleResize = () => {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(updatePositions);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, currentStep, updatePositions]);

  // ── Keyboard navigation ──
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleDismiss();
          break;
        case 'ArrowRight':
        case 'Enter':
          if (currentStep < STEPS.length - 1) {
            goToStep(currentStep + 1);
          } else {
            handleComplete();
          }
          break;
        case 'ArrowLeft':
          if (currentStep > 0) {
            goToStep(currentStep - 1);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, goToStep]);

  // ── Actions ──
  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setCurrentStep(-1);
    setSpotlightRect(null);
    onClose();
  }, [onClose]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setCurrentStep(-1);
    setSpotlightRect(null);
    // Navigate back to search tab on completion
    onNavigateTab('search');
    onClose();
  }, [onClose, onNavigateTab]);

  const handleStartTour = useCallback(() => {
    goToStep(0);
  }, [goToStep]);

  // ── Don't render if closed ──
  if (!isOpen) return null;

  // ── Welcome screen (step -1) ──
  if (currentStep === -1) {
    return (
      <>
        <div className="onboarding-overlay" onClick={handleDismiss} />
        <div className="onboarding-welcome">
          <div className="onboarding-welcome-icon">🚀</div>
          <h2>Welcome to AetherGrid</h2>
          <p>
            Take a quick guided tour to learn how to search knowledge, trace citations,
            flag gaps, and monitor system health. It only takes a minute.
          </p>
          <div className="onboarding-welcome-actions">
            <button className="onboarding-btn skip" onClick={handleDismiss}>
              Skip Tour
            </button>
            <button className="onboarding-btn next" onClick={handleStartTour}>
              Start Tour →
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Active tour step ──
  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <>
      {/* Spotlight cutout */}
      {spotlightRect && (
        <div
          className="onboarding-spotlight"
          style={{
            top: `${spotlightRect.y}px`,
            left: `${spotlightRect.x}px`,
            width: `${spotlightRect.width}px`,
            height: `${spotlightRect.height}px`,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="onboarding-tooltip"
        style={tooltipStyle}
        ref={tooltipRef}
        key={currentStep} // Re-mount for animation
      >
        {/* Header */}
        <div className="onboarding-header">
          <span className="onboarding-step-badge">
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <button
            className="onboarding-close-btn"
            onClick={handleDismiss}
            title="Exit tour (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Icon + Content */}
        <div className="onboarding-icon">{step.icon}</div>
        <h3 className="onboarding-title">{step.title}</h3>
        <p
          className="onboarding-description"
          dangerouslySetInnerHTML={{ __html: step.description }}
        />

        {/* Footer */}
        <div className="onboarding-footer">
          {/* Progress dots */}
          <div className="onboarding-dots">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`onboarding-dot ${
                  i === currentStep ? 'active' : i < currentStep ? 'completed' : ''
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="onboarding-nav-buttons">
            <button className="onboarding-btn skip" onClick={handleDismiss}>
              Skip
            </button>
            {currentStep > 0 && (
              <button
                className="onboarding-btn back"
                onClick={() => goToStep(currentStep - 1)}
              >
                ← Back
              </button>
            )}
            {isLastStep ? (
              <button className="onboarding-btn finish" onClick={handleComplete}>
                Finish ✓
              </button>
            ) : (
              <button
                className="onboarding-btn next"
                onClick={() => goToStep(currentStep + 1)}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingWizard;
