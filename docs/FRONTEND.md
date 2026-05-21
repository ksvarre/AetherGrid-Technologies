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
7.  **`CloudSettingsPanel.tsx` (LLM Gateway Settings Drawer)**:
    *   Sliding settings panel accessed via a premium gear icon in the dashboard header.
    *   Provides user controls for selecting the **LLM Engine Provider** (Local Offline, Google Gemini API, or Azure OpenAI Service).
    *   Implements **Bring-Your-Own-Key (BYOK)** fields with visibility toggles and strict credential scoping.
    *   Includes a "Sync & Re-index Workspace" trigger that calls `POST /api/ingest` with request-scoped credentials to validate active keys.
    *   Renders a detailed success/degradation alert card. If the entered key fails verification (e.g. invalid key or billing limit), it gracefully notifies the user with detailed error reasonings (e.g., `INVALID_KEY`, `CREDITS_EXHAUSTED`) and reports successful fallback to local offline mode.

---


## ✨ Micro-Animations & Dynamic Interactions
To achieve a highly premium visual experience, the interface utilizes pure CSS micro-animations:
*   **Glowing Pulsing Status**: The system health badge pulses softly (`pulse` keyframe altering `box-shadow` depth) to represent active background tracking.
*   **Glassmorphic Border Sliders**: Hovering over cards causes the border-glow to track the mouse coordinates or transition smoothly through a subtle linear shift.
*   **Low-Confidence Slide-In**: The Suggested Routing card slides in from the right edge with a custom cubic-bezier ease-out transition.
*   **Search Typing Indicator**: When waiting for API responses, a neon typing loader generates a glowing wave effect using staggered element delays.
*   **Widescreen Scaled SVG Polylines**: Performance trend charts draw mathematically pre-calibrated lines dynamically across a `1500x140` widescreen viewbox mapping to the screen width without text distortions.

---

## 🎨 Premium Dashboard & UI Enhancements (Phase 3)

We restructured and refined key components of the **System Health Monitor** and **Search Console** interfaces to deliver maximum readability and interactive analysis:

### 1. Unified 4-Column KPI Telemetry Row
The System Health dashboard has been rearranged so that all four key performance indicators appear in a unified, widescreen-friendly row:
*   **Grid Specs**: Responsive 4-column design (`grid-template-columns: repeat(4, 1fr)`) with an elegant fallback for smaller screens (`repeat(2, 1fr)` or single column).
*   **KPI Cards Included**:
    1.  **System Health Index**: Combined metric calculating retrieval stability (`avgConfidence * (1 - rejectionRate)`).
    2.  **Average Search Confidence**: The rolling average confidence score of all searches.
    3.  **User Rejection Rate**: The percentage of queries where users rejected or corrected the system answers.
    4.  **Reformulation Rate**: The percentage of searches where users input consecutive queries of $\ge 40\%$ Jaccard token overlap within 5 minutes (indicating search friction).

### 2. Interactive Click-to-Reveal Metric Overlays
Rather than forcing operators to reference static documentation, each of the four KPI cards now features a stateful, interactive `?` icon.
*   **Behavior**: Clicking the `?` icon slides up a beautiful, glassmorphic overlay containing:
    *   **Description**: Detailed text of what the metric represents.
    *   **Formula / Calculation**: The exact equation or process (e.g. Jaccard token comparison rules, health product equations).
    *   **Example**: Concrete real-world scenarios to help team leads interpret results.
*   **UX Detail**: Includes an immediate, accessible close (`×`) control to collapse the overlay smoothly.

### 3. Interactive Reformulation Drill-Down Panel
To make the 7% Reformulation Rate actionable, the **Reformulation Rate** card is fully interactive. Clicking the card (or the "View Details" button) displays a stateful, slide-out **Reformulation Drill-Down Panel** inside the dashboard:
*   **Content**: Fetches and renders a clean list of anonymous reformulation pairs tracked by the backend (e.g. `Query 1: how to calibrate thermal node` $\rightarrow$ `Query 2: thermal substation calibration steps`).
*   **Usage**: Enables team leads to see exactly what users are struggling to find, identifying clear gaps to add to the knowledge base.

### 4. Excel Tabular Citations & Formatting
When a user queries the Search Console and clicks on a citation that originates from an Excel spreadsheet (`.xlsx` file), the **Citation Drawer** parses the matched spreadsheet row and renders it:
*   **Design**: Displays a beautifully styled, high-contrast HTML table grid layout.
*   **CSS Classes**: Uses `.excel-table` styling featuring clean borders, highlighted headers, zebra row striping, and glowing status tags for row states.

### 5. Repositioned SVG Performance Trends Chart
To allow space for the unified telemetry row and interactive drawers, the 30-day performance trends line chart has been moved to the bottom of the System Health page, serving as a comprehensive history footer.

---

## 🛡️ Frontend Security Hardening

### Content Security Policy (CSP)
A `Content-Security-Policy` meta tag has been added to `index.html` to restrict resource loading origins:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' http://localhost:5000 http://127.0.0.1:5000;
  img-src 'self' data:;
  font-src 'self';
" />
```

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'self'` | Baseline: only load from same origin |
| `script-src` | `'self'` | Only execute scripts from the app bundle |
| `style-src` | `'self' 'unsafe-inline'` | Allows inline styles (required by CSS design system) |
| `connect-src` | `'self'` + API origins | Restricts fetch/XHR to known backend only |
| `img-src` | `'self' data:` | Same origin + data URIs (inline SVGs/icons) |
| `font-src` | `'self'` | Only load fonts from the app bundle |

### Page Title Update
The `<title>` tag has been updated from generic `"frontend"` to the descriptive `"AetherGrid Knowledge Tracer"` for proper SEO and browser tab identification.

---

## 🚀 Interactive Onboarding Walkthrough (Phase 4)

A custom-built, zero-dependency guided tour wizard that introduces new users to every major feature of the application. Built entirely with the existing glassmorphic design system — no third-party libraries like `react-joyride`.

### Architecture

| File | Purpose |
|------|---------|
| `OnboardingWizard.tsx` | Self-contained React component managing wizard state, spotlight positioning, keyboard events, and localStorage persistence |
| `onboarding.css` | Dedicated stylesheet with glassmorphic overlay, spotlight cutout, tooltip cards, progress dots, and animations |

### 7-Step Guided Tour

| Step | Target Element | Tab | Description |
|------|---------------|-----|-------------|
| 1 | `.sidebar-menu` | Search | Navigate between Search, Audit Queue, and Analytics |
| 2 | `.search-bar-container` | Search | Type natural language queries to search the knowledge base |
| 3 | `.answer-box` | Search | Clickable citation markers `[1] [2]` linking to source documents |
| 4 | `.feedback-actions` | Search | Flag knowledge gaps with 👎 and submit corrections |
| 5 | `.audit-container` | Audit | Team lead review panel for approving/dismissing corrections |
| 6 | `.analytics-grid` | Analytics | Rolling confidence, rejection rates, and performance trends |
| 7 | `.settings-gear-btn` | Search | Configure LLM engine (Offline/Gemini/Azure OpenAI) |

### Key Features
*   **Welcome Screen**: Centered glassmorphic modal with "Start Tour" and "Skip Tour" options.
*   **Spotlight Overlay**: CSS `box-shadow: 0 0 0 4000px` technique creates a dark overlay with a glowing cutout around the target element.
*   **Auto-Tab Switching**: Steps 5 and 6 call `onNavigateTab()` to automatically switch the sidebar view before spotlighting the target.
*   **3 Cancel Paths**: Skip button (every step), ✕ close button (tooltip corner), and Escape key — all set `localStorage` to prevent re-launch.
*   **Keyboard Navigation**: Left/Right arrow keys, Enter to advance, Escape to dismiss.
*   **localStorage Persistence**: Sets `aethergrid_onboarding_complete` on completion or skip. Auto-launches on first visit only.
*   **Re-launchable**: "?" help button in the main header (next to settings gear) restarts the tour from the welcome screen.
*   **Responsive**: Tooltip and welcome card adapt to viewport size with media queries.

### Integration Points in App.tsx
*   `isOnboardingOpen` state — controls wizard visibility.
*   `useEffect` on mount checks `localStorage` and auto-opens after 800ms delay.
*   `onNavigateTab={setActiveTab}` — passes the tab switching callback.
*   `settings-gear-btn` className added to the settings gear button for spotlight targeting.
