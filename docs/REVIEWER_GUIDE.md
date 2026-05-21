# AetherGrid Technologies — Exercises 1, 2, & 3 Reviewer Guide

This manual serves as a definitive guide for evaluating and auditing all three exercises in this repository:
*   **Exercise 1**: Meeting Transcripts — Ingestion, Enrichment, & Query API
*   **Exercise 2**: Office Documents — Multi-Format Traceability, Expert Routing, & Gap Capture
*   **Exercise 3**: User-Facing Application — React Dashboard, Metrics, & Success Measurement

> [!IMPORTANT]
> ### ⚠️ Enterprise Cloud Mode & Gemini API Validation Disclaimer
> Please be advised that **only the Google Gemini API (`GEMINI_API_KEY`) has been fully tested and validated to work** in the Enterprise Cloud Mode. Due to the lack of access to active corporate Azure API keys during development, Azure-based OpenAI integrations have not been calibrated or verified.
> 
> *   **To evaluate Enterprise Cloud Mode (Two Options)**:
>     *   **Option A: Server-Wide Configuration (`.env`)**: Supply a standard Google Gemini API key in the root `.env` file (`GEMINI_API_KEY=your_key`). This configures the entire server instance to run in Cloud Mode by default for all users.
>     *   **Option B: Client-Scoped Configuration (UI Settings)**: Leave the root `.env` file empty. Start the server (which boots into local Offline Mode), open `http://localhost:5173`, click the **Settings Gear Icon** in the top-right, paste your key under the Gemini Provider settings, and click **Save Settings** or **Re-Index**. This stores the key in your browser's local storage and dynamically injects it via transient headers (`x-gemini-api-key`) on a request-by-request basis. The backend handles this dynamically in-memory and **never** writes it to the server's `.env` or disk.
> *   **To evaluate Offline Mode (Default)**: If no key is provided (either in `.env` or the UI), the application gracefully defaults to high-performance local Offline Mode, which runs **100% locally with zero external network requests or keys**, using our TF-IDF text matrix and rule-based NLP algorithms. Both modes are fully functional and ready for evaluation.


To align with modern software engineering best practices, this standalone system was planned, secured, implemented, and verified using a highly structured, multi-persona development workflow.

### 🎭 Multi-Persona Engineering & Specialized Skills
Rather than writing ad-hoc code, the development process sequentially adopted six specialized professional engineering personas/skills to guarantee an enterprise-grade result:
1.  **Backend Architect (`agency-backend-architect`)**: Architected the offline-first strategic retrieval model (`INLPEngine`), local caching schemas, dynamic RAM index sync hooks, and REST API route designs.
2.  **Security Engineer (`agency-security-engineer`)**: Adversarially analyzed the system using STRIDE threat modeling, establishing strict ingestion gates (magic-byte scanning, file size checks, absolute virtualized path structures, and rate limits).
3.  **Senior Developer (`agency-senior-developer`)**: Crafted premium, type-safe Node.js code, robust filesystem warm-caching operations, scoring boosts (speaker affinity and file density weightings), and tabular parser layers.
4.  **Frontend Developer (`agency-frontend-developer`)**: Built the visual React + Vite client dashboard, styling variables, confidence score animations, and tabular grid drawers.
5.  **UX Architect (`agency-ux-architect`)**: Mapped user paths to construct the custom zero-dependency step-by-step interactive Walkthrough Tour, designed the AetherPulse metrics tooltip cards, and customized layout responsiveness.
6.  **Code Reviewer & QA (`agency-code-reviewer`)**: Tested code validity, authored automated integration verification suites (`npm run verify`), conducted type checks, and ensured zero documentation drift.

---

## 🧠 Core Engineering Principles & RAG Deployment Safeguards

When deploying a production Retrieval-Augmented Generation (RAG) platform into an enterprise environment, raw LLM capabilities are only a fraction of the challenge. The primary engineering philosophy guiding the design of this repository centers on six critical enterprise deployment safeguards:

### 1. Zero-Key Out-Of-The-Box Reliability (Dual-Mode Design)
A corporate application must be robust and operable immediately upon launch without requiring immediate external cloud credentials. The **Strategy Pattern (`INLPEngine`)** enables standard local offline execution by default (using BM25/TF-IDF text scoring and rule-based NLP) with a seamless, zero-config upgrade to high-fidelity cloud mode (Google Gemini) the moment an API key is supplied in the environmental configuration.

### 2. Strict Parser Security Gates (STRIDE Threat Prevention)
Document ingestion represents a major attack surface. Before executing complex and resource-heavy third-party parsing libraries, the system enforces:
*   **Magic-byte header checks** (validating raw byte signatures such as `PK\x03\x04` for OpenXML zip archives and OLE2 signatures for legacy binary formats) to prevent disguised extension renaming attacks.
*   **Strict size constraints (50MB cap)** to neutralize zip bomb and decompression Denial of Service (DoS) exploits.
*   **Sandbox piping** to scan for nested XML External Entity (XXE) vectors before physical disk serialization.

### 3. Centralized Secrets Brokerage (No BYOK Boundaries)
Security audits consistently fail when individual developers or operators are asked to supply their own API keys (Bring Your Own Key - BYOK). To prevent credential leakage and guarantee strict corporate billing boundaries:
*   All API keys are centralized server-side, locked within secure secret providers (e.g. AWS Secrets Manager, Azure Key Vault) with zero local `.env` persistence in production.
*   The API server brokers all interactions using the corporate key, applying granular tenant rate limits and request budget quotas to block financial exhaustion exploits.

### 4. Enterprise Identity & SSO/RBAC Gateway
Administrative operations—specifically resolving knowledge gaps, approving corrections, and altering model parameters—must be strictly secured. Implementing standard SSO integration (e.g., Microsoft Entra ID, Okta, Auth0) coupled with granular **Role-Based Access Control (RBAC)** ensures that:
*   `Operators` (Readers) can search, flag gaps, and submit feedback.
*   `Team Leads` (Admins) are authenticated via secure Express middleware guards (`requireRole(['Admin'])`) to approve corrections, view live metrics, and manage prompt templates.

### 5. Document Density Weight Equalization (Structured Boosting)
In a corporate search index, conversational meeting transcripts are inherently high-word-count and dense, whereas formal Word specs, PowerPoint decks, and Excel models are highly structured but sparse in natural dialogue. Left uncalibrated, standard similarity scoring favors conversational chatter over core engineering documents. The indexer applies structured multipliers at retrieval to equalize density weights:
*   **Word Specifications** (`.docx`): `+0.4` boost multiplier
*   **PowerPoint Presentation Decks** (`.pptx`): `+0.6` boost multiplier
*   **Excel Models & Cells** (`.xlsx`): `+0.8` boost multiplier

### 6. Automated CI/CD Regression Evaluation (Golden Dataset & RAGAS)
As corporate knowledge bases evolve and prompts are refined, ensuring the system does not degrade in overall answer quality or context alignment is vital. We establish a **Golden Dataset** (benchmark query-citation ground truths) run automatically inside CI/CD test actions. Metrics evaluating **Faithfulness**, **Answer Relevance**, and **Context Recall** are scored programmatically; builds are automatically blocked if scores fall below 90%, eliminating prompt regression.

---

## 🏛️ Exercise 1: Ingestion & Core Architecture

The system operates as an **in-memory semantic query indexer** backed by a **pruning-aware high-performance filesystem scanner** and an **Express.js API server**. 

### 1. File Scope & Multi-Format Ingestion
*   **Transcript Directory**: Ingestion scans `data/transcripts/` for synthetic Markdown (`.md`) meeting transcripts.
*   **Office Document Directory**: Ingestion also scans `data/documents/` for `.docx/.doc`, `.pptx/.ppt`, and `.xlsx/.xls` files (both modern XML-based and legacy binary Office formats).
*   **Security Guards**: Office files undergo magic-byte validation (ZIP/PK header for modern formats, OLE2/CFB for legacy) and a 50MB size limit before parsing. Disguised or oversized files are rejected with clear console warnings.
*   **Verification Location**: [parser.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts) — `ingestAll()` method handles both directories with cache-aware hot paths.

### 2. Warm Boot Cache & Self-Cleaning Pruning
*   **Index Database Cache**: Semantic text chunks and metadata calculations are written to `data/db/indexed_chunks.json` mapped to modified timestamps (`mtimeMs`).
*   **Pruning Mechanism**: Deleted files are automatically pruned from the cache ledger on each boot. This keeps the active RAM index synchronized with the filesystem.

---

## 🏷️ Exercise 1: Enrichment & Dynamic Metadata Extraction

The pipeline dynamically extracts and derives structured metadata directly from pure Markdown dialogue transcripts using clean, zero-dependency TS/JS heuristics, with a backward-compatible parser for YAML frontmatter headers if present:

1.  **Date Extraction**: Derived from filename patterns using a regex that extracts `YYYY_MM_DD` structures (e.g., `transcript_2026_03_02_database_scaling_crisis.md` → `2026-03-02`).
2.  **Attendees (Unique Speakers)**: Formulated by scanning the transcript dialogue using regex matching dialogue headers `**Speaker Name**:` or `**Dr. Speaker Name**:` and converting them into a unique trimmed array.
3.  **Facilitator (Author Binding)**: Deduced dynamically as the first speaker identified in the transcript dialogue. The facilitator is bound to the chunk's primary `author` property.
4.  **Domain & Priority**: The file contents are evaluated against key-phrase vocabularies to determine the topic `domain` (e.g., "quantum", "MAE" → Project Quantum; "sensor", "helium" → Project Helium) and `priority` level.
5.  **Backward Compatibility**: The system maintains the frontmatter parser block as a fallback strategy. If a reviewer supplies a custom Markdown transcript that starts with `---`, the system will honor the defined fields.

---

## 🔍 Exercise 1: Retrieval & Query API (`POST /api/query`)

The Express query API receives user queries, processes them offline via TF-IDF cosine-similarity, and synthesizes natural language answers with granular inline citations.

### 1. Stemming & Suffix Normalization
*   Queries and chunks are split and cleaned of standard noise stop words. Suffixes (`-s`, `-es`, `-ies`, `-ing`, `-ed`) are stemmed using a robust grammatical suffix stemmer with special preservation rules (e.g., `firmware` → `firmware`, not `firmwar`).
*   *Verification Location*: [nlp.ts:L68-116](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts#L68-L116)

### 2. Semantic Query Scoring & Affinity Boosting
*   **Cosine similarity weights** are calibrated across the RAM corpus to match the stemmed query tokens with project name and employee name boosts.
*   **Conversational Filler Downweighting**: Transition words (e.g., `say`, `said`) are downweighted by 90%.
*   **Dialogue Speaker-Topic Affinity Boost**: Active speaker match + technical keyword cross-reference.
*   **Query Correlation Boosts**: Approved corrections are linked to their originating query. When the same or similar query is asked again, the approved correction chunk receives a massive score boost, ensuring the self-healing feedback loop works.

### 3. Citations & Synthesized Answers
*   Inline citations return a user-friendly index marker (`[1]`, `[2]`).
*   **Entity-Weighted Snippet Selector**: Technical keywords receive 3.0x weight, speaker names 1.0x, fillers 0.1x.
*   Full citation metadata: chunk IDs, source file names, virtualized paths, authors, attendees, dates, matched snippets.

---

## 📄 Exercise 2: Multi-Format Office Document Ingestion

### Supported Formats
| Format | Parser | Notes |
|--------|--------|-------|
| `.docx` / `.doc` | Mammoth | Modern XML and legacy binary Word documents |
| `.pptx` / `.ppt` | OfficeParser | PowerPoint slide decks |
| `.xlsx` / `.xls` | SheetJS (xlsx) | Excel spreadsheets — row-by-row tabular extraction |

### Security Hardening for Untrusted Files
*   **File Size Limit**: Files exceeding 50MB are rejected before parsing to prevent memory exhaustion.
*   **Magic-Byte Validation**: Every file's header bytes are checked against known Office signatures (ZIP/PK for Open XML formats, OLE2/D0CF11E0 for legacy binary formats). Files with unrecognized headers are skipped.
*   **Path Virtualization**: All absolute disk paths are stripped and replaced with relative workspace paths in API responses to prevent information disclosure.

---

## 🔗 Exercise 2: Multi-Hop Traceability

Every search result provides **full citation chains** from the answer text back to the source document:

```
User Query → NLP Engine → Scored Chunks → Inline [1] [2] Markers → Citation Object
                                                                        ↳ fileName, filePath, author, attendees, date, matchedSnippet
```

Clicking a citation marker in the UI opens a slide-out drawer showing the complete provenance: source file, workspace path (with download button), author/publisher, attendees list, publication date, and the exact indexed text segment. Excel data is rendered as a formatted table.

---

## 🧭 Exercise 2: Expert Routing & Gap Capture

### Low-Confidence Routing
When a query scores below **40% confidence**, the system automatically:
1.  **Identifies the relevant expert** from a 5-person expert directory mapped by domain.
2.  **Explains why**: The rationale now includes the closest matched content snippet (even if low-scoring), referencing the source file and author, plus the expert's domain role.
3.  **Drafts a Microsoft Teams message**: A personalized, editable message template ready for the user to review, modify, and send directly to the expert.

*   *Verification Location*: [routing.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/routing.ts) — `generateRouting()` accepts optional `topMatchedChunks` for snippet-aware rationale.

### Feedback & Gap Capture Ledger
*   Users can mark answers as **👍 Correct** or **👎 Inaccurate** and submit correction text.
*   All feedback is persisted to `data/db/feedback.json` with full metadata (query, original answer, confidence score, correction text, domain, timestamp).
*   Team leads review gaps in the **Audit Queue** and can **Approve** (injects correction into live RAM index) or **Dismiss** (marks as reviewed).
*   Approved corrections include a `resolvedTimestamp` for UCRV metric tracking.

---

## 🖥️ Exercise 3: React User-Facing Application

### Application Architecture
*   **Framework**: React 18 + Vite + TypeScript
*   **Styling**: Custom CSS design system with glassmorphism, dark theme, and micro-animations
*   **Layout**: Sidebar navigation with three tabs: GridTrace Core (search), Audit Queue, AetherPulse Metrics

### Search & Cite UI (GridTrace Core)
*   Natural language search bar → synthesized answers with clickable `[1]` `[2]` citation markers.
*   Citation drawer with full provenance metadata and document download.
*   **Smart Table Rendering**: Excel-sourced citations are detected by file extension and rendered as proper HTML tables with column headers, instead of raw text.
*   Inline confidence bar with color-coded scoring.

### Low-Confidence Routing Panel
*   Automatically appears below search results when confidence < 40%.
*   Shows the matched expert, their domain rationale (with content snippet context), and an **editable** Microsoft Teams message draft.
*   "Copy Teams Message" button copies the customized draft to clipboard.

### Audit Queue (Team Lead Portal)
*   Filterable, sortable table of all user-flagged gaps and corrections.
*   Domain filter dropdown + resolved/unresolved toggle.
*   Approve/Dismiss actions with background auto-refresh polling (10s interval).
*   Knowledge Gap Hotspot panels showing anonymized query patterns by domain.

### AetherPulse Metrics Dashboard
*   **System Health Index** gauge with color-coded LED indicator.
*   **Rolling Average Confidence** and **User Rejection Rate** metrics.
*   **Knowledge Gap Hotspots** with expandable domain ledgers showing anonymized queries.
*   Interactive tooltip explaining the 85% starting baseline calibration.

---

## 🎯 Exercise 3: 30-Day Success Metric (UCRV)

The single metric tracked for the first 30 days post-launch is **User Correction Resolution Velocity (UCRV)**: the median elapsed time between a user-flagged knowledge gap (`feedback.timestamp`) and its team lead resolution (`feedback.resolvedTimestamp`).

*   **Measurement**: Compute `resolvedTimestamp − timestamp` for all resolved feedback items in the 30-day window; take the median.
*   **Target**: UCRV ≤ 48 hours.
*   **Why this metric**: It directly measures the speed of the self-healing feedback loop — how quickly tribal knowledge flows back into the searchable corpus after users flag gaps.
*   **Verification Location**: `resolvedTimestamp` is set in [database.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/database.ts) `resolveFeedback()`. The metric definition lives in [ARCHITECTURE.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/ARCHITECTURE.md).

---

## 📊 Telemetry Metrics & Safe 85% Starting Baseline

### Mathematical Formulas
*   **User Rejection Rate ($R$)**: Ratio of corrections and rejections to total queries.
*   **Average Search Confidence ($C$)**: Rolling average of matching scores.
*   **System Health Index ($H$)**: $C \times (1 - R)$.

### Pre-Calibrated Safe Starting State (85%)
When no queries are logged, the system defaults to $C = 0.85$, $R = 0$, $H = 85\%$ to prevent false-positive degradation warnings on fresh boot.

---

## 🛡️ Security Sandboxing & Hardening

1.  **Path Traversal Prevention**: Physical absolute directories → virtualized relative workspace paths.
2.  **HTML Input Neutralization (XSS Prevention)**: All user inputs processed via `escapeHtml()` before persistence.
3.  **Atomic File Writes**: `safeWriteJson()` writes to temp file then renames, preventing corruption.
4.  **Office File Validation**: Magic-byte header checks (full 4-byte ZIP PK\x03\x04 and OLE2 signatures) + 50MB size limits on all ingested documents including Markdown transcripts.
5.  **HTTP Security Headers**: `helmet()` middleware sets X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, and more.
6.  **CORS Restriction**: Origin whitelist (`localhost:5173`, `localhost:3000`) replaces wildcard `*`.
7.  **3-Tier Rate Limiting**: General API (60/min), Query NLP (30/min), Admin actions (5/min).
8.  **Request Body Size Limit**: `express.json({ limit: '100kb' })` prevents oversized payloads (HTTP 413).
9.  **Query Length Validation**: Max 500 characters to prevent NLP tokenization DoS.
10. **Prompt Injection Defense**: `sanitizeForLLM()` strips injection patterns. XML delimiters isolate user input. Anti-jailbreak system prompt rules. `validateLLMResponse()` constrains LLM output schema.
11. **Error Message Sanitization**: `sanitizeError()` strips file paths and stack traces from all error responses.
12. **Optional API Key Authentication**: Set `API_AUTH_KEY` in `.env` to enable `x-api-key` header validation on all state-changing endpoints.
13. **Input Validation**: Feedback `status` enum validation, `feedbackId` type checking, query type/length checks.
14. **FIFO Log Rotation**: `feedback.json` capped at 1000 entries, `queries_log.json` at 2000 entries.
15. **Frontend CSP**: Content-Security-Policy meta tag restricts script-src, connect-src, style-src, img-src.

---

## 🔵 Advanced Feature Verification (Phase 3)

The AetherGrid Knowledge Tracer is enhanced with Phase 3 diagnostics that can be actively audited by the reviewer:

### 1. Verification of Jaccard Reformulation Rate
*   **How it works**: When a user inputs consecutive queries within 5 minutes that share $\ge 40\%$ word tokens (stem-normalized), the system flags a "reformulation".
*   **Reviewer Test**: 
    1. In the React Search Console, search for `"how to calibrate thermal edge nodes"`.
    2. Within 5 minutes, search for `"thermal edge node calibration steps"`.
    3. Navigate to the **System Analytics** tab. You will see the **Reformulation Rate** rise from $0\%$ to a positive value.
    4. Click the **Reformulation Rate** card (or the "View Details" button). A detailed panel will reveal the anonymous tracked pair: `"how to calibrate thermal edge nodes" → "thermal edge node calibration steps"`.

### 2. Verification of 3-Tier Cognitive Routing & Search Scoping
*   **Tier 1 (High Confidence content match)**: Search `"Dr. Elena Rostova neural network forecasting"` $\rightarrow$ Returns exact specs from `quantum_ml_forecasting_spec.docx` with inline citations.
*   **Tier 3 (Graceful Off-Topic Null Routing)**: Search `"what is the weather today"` or `"who is the president"` $\rightarrow$ Returns a friendly prompt indicating that the query is out of scope and cannot be routed to any corporate domain, preventing false alarms.

### 3. Verification of Excel Tabular Layouts
*   **Reviewer Test**: Search `"Project Quantum model benchmarks MAE"` and click on the citation drawer for `quantum_model_benchmarks_v1.xlsx` $\rightarrow$ The matched data cell values are rendered as a beautiful, high-contrast HTML table grid layout inside the citation drawer rather than a raw text blob.

### 4. Verification of HTML Entity Sanitization Fix
*   **Reviewer Test**: Submit a feedback correction containing the word `"couldn't"` or `"doesn't"`. In previous versions, Stored XSS mitigation escaped single quotes, causing it to display as `"couldn&#x27;t"`. The sanitization rules are now adjusted to preserve quotes safely, displaying correct text formatting across all inputs, tooltips, and lists.

### 5. Verification of Security Hardening
*   **Rate Limiting Test**: Send 31+ rapid POST requests to `/api/query`. After ~30 requests, the server responds with HTTP 429 `Query rate limit exceeded`.
*   **Query Length Cap**: POST to `/api/query` with a query longer than 500 characters → HTTP 400 `Query exceeds maximum length`.
*   **Invalid Feedback Status**: POST to `/api/feedback` with `status: "hacked"` → HTTP 400 `Invalid status`.
*   **CORS Restriction**: Fetch `/api/metrics` with `Origin: http://evil-site.com` → No `Access-Control-Allow-Origin` header returned.
*   **Helmet Headers**: Any API response includes `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN`.
*   **Body Size Limit**: POST >100KB JSON body → HTTP 413 `Payload Too Large`.
*   **Automated Security Test Suite**: Run `npx ts-node test_security.ts` from `src/backend/` to execute all 13 security integration tests.

### 6. Verification of Interactive Onboarding Walkthrough
*   **First-Visit Auto-Launch**: Open the app in an incognito window or clear `localStorage` → the welcome screen appears automatically after ~800ms.
*   **Welcome Screen Options**: The centered glassmorphic card offers "Start Tour" and "Skip Tour" buttons.
*   **Skip Tour**: Click "Skip Tour" on the welcome screen → wizard closes, `localStorage` is set, wizard does NOT auto-launch on next visit.
*   **7-Step Tour**: Click "Start Tour" and walk through all 7 steps:
    1.  Sidebar navigation is spotlighted
    2.  Search bar is spotlighted
    3.  Answer/results card is spotlighted (requires a search result to be present)
    4.  Feedback buttons are spotlighted
    5.  Tab auto-switches to Audit Queue, audit table is spotlighted
    6.  Tab auto-switches to Analytics, KPI grid is spotlighted
    7.  Settings gear button is spotlighted
*   **Cancel Paths**: At any step, the tour can be exited via: (1) "Skip" button, (2) ✕ close button in the tooltip corner, (3) pressing the Escape key.
*   **Keyboard Navigation**: Use ← → arrow keys to go back/forward, Enter to advance, Escape to dismiss.
*   **Persistence**: After completing or skipping, refresh the page → wizard does NOT auto-launch again.
*   **Re-Launch**: Click the "?" button in the main header (next to the settings gear) → wizard re-launches from the welcome screen.

---

## 🚀 Playbooks & Verification Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Full Application (Backend + Frontend)
```bash
npm run dev
```
*(Launches Express API on port 5000 and React Vite dev server on port 5173).*

### 3. Launch the Interactive Review Console
```bash
npm run review
```
*(High-fidelity ANSI menus guiding through testing of all three exercises).*

### 4. Run Automated Verification Suite
```bash
npm run verify
```
*(Executes programmatic assertions for Exercise 1 ingestion, Exercise 2 routing and feedback, and Exercise 3 metrics).*

---

## 🔮 Recommended Future Features

For a comprehensive technical blueprint of the 8-phase architecture plan to scale and deploy AetherGrid Knowledge Tracer into corporate production:
*   **See**: **[Recommended Future Features](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/ROADMAP.md)**
