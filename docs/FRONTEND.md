# Frontend Architecture & Styling Reference — AetherGrid Knowledge Tracer

This document describes the React structure, application states, and the premium Vanilla CSS design system that builds our user-facing console.

---

## 🎨 Design System & Custom Vanilla CSS Tokens
To satisfy the strict styling requirements, the frontend uses **Vanilla CSS** instead of utility frameworks. We construct a premium, futuristic dark-theme visual design system using custom CSS properties (variables) defined at `:root` in `index.css`:

```css
:root {
  /* Colors */
  --bg-primary: #0b0f19;       /* Deep slate/charcoal blue */
  --bg-secondary: #131b2e;     /* Dark navy container card bg */
  --bg-tertiary: #1b2641;      /* Glassmorphic border hover */
  
  --accent-cyan: #00f2fe;      /* Neon Cyan primary details */
  --accent-purple: #8a2be2;    /* Electric Violet secondary details */
  --accent-blue: #4facfe;      /* Vibrant Sky Blue accent */
  
  --text-primary: #f3f4f6;     /* Off-white readable paragraph */
  --text-secondary: #9ca3af;   /* Muted gray info labels */
  --text-cyan: #00f2fe;        /* Cyan highlight text */
  
  --accent-green: #10b981;     /* Success healthy light */
  --accent-amber: #f59e0b;     /* Warning caution light */
  --accent-red: #ef4444;       /* Critical error alert light */
  
  /* Gradients */
  --grad-cyan-blue: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-blue) 100%);
  --grad-purple-blue: linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-blue) 100%);
  --grad-dark-glass: linear-gradient(135deg, rgba(19, 27, 46, 0.7) 0%, rgba(11, 15, 25, 0.8) 100%);
  
  /* Layout Metrics */
  --border-radius-sm: 6px;
  --border-radius-md: 12px;
  --border-radius-lg: 24px;
  --box-shadow-glow: 0 0 20px rgba(0, 242, 254, 0.15);
  --box-shadow-alert-glow: 0 0 25px rgba(239, 68, 68, 0.35);
  
  /* Animations */
  --transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-smooth: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 🏗️ React Component Architecture
The frontend is a single-page application split into modular, focused components:

1.  **`App.tsx` (Main Layout & State Coordinator)**:
    *   Coordinates the active sidebar view (Search Console, Audit Queue, System Analytics).
    *   Maintains the global workspace states (e.g. current query, search result payload, feedback collection status).
2.  **`Sidebar.tsx`**:
    *   Provides the primary application navigation with modern visual hover indicators and glowing status emblems.
3.  **`SearchConsole.tsx` (GridTrace Core)**:
    *   The natural language input portal.
    *   Displays natural language responses with highlighted inline superscript numbers (e.g., `[1]`).
    *   Features a sliding panel that exposes source file metadata and matching text blocks when an inline citation or source list item is clicked.
4.  **`SuggestedRoutingPanel.tsx`**:
    *   Pops out with a glowing border when search confidence drops below `0.40`.
    *   Displays the **Primary Expert**, a detailed **Rationale** (Why they are the expert), and a fully editable **Drafted Question**.
    *   Features a "Copy Slack Code" button with a copy-confirmation micro-animation.
5.  **`AuditQueue.tsx` (Team Lead Panel)**:
    *   Displays user corrections, query rejections, and knowledge gaps in an administrative audit table.
    *   Allows the team lead to "Apply Correction" (updating the search index behavior) or "Dismiss" with single-click actions.
6.  **`AetherPulseAnalytics.tsx` (Instrumentation Panel)**:
    *   Renders system telemetry using pure-CSS layout cards and embedded SVGs:
        *   **Health Status Banner**: Shows "SYSTEM HEALTHY" or triggers a flashing "DEGRADATION ALERT" if the health index drops below 0.65.
        *   **KPI Cards**: Rolling search confidence, rejection percentages, and query velocities.
        *   **SVG Line Graphs**: Displays simulated 30-day performance trends.
        *   **Gap Hotspots**: List of topics generating the most corrections.

---

## ✨ Micro-Animations & Dynamic Interactions
To achieve a highly premium visual experience, the interface utilizes pure CSS micro-animations:
*   **Glowing Pulsing Status**: The system health badge pulses softly (`pulse` keyframe altering `box-shadow` depth) to represent active background tracking.
*   **Glassmorphic Border Sliders**: Hovering over cards causes the border-glow to track the mouse coordinates or transition smoothly through a subtle linear shift.
*   **Low-Confidence Slide-In**: The Suggested Routing card slides in from the right edge with a custom cubic-bezier ease-out transition.
*   **Search Typing Indicator**: When waiting for API responses, a neon typing loader generates a glowing wave effect using staggered element delays.
