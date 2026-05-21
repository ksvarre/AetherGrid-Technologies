# Architectural Decision Log (ADL) — AetherGrid Knowledge Tracer

This document records the key architectural decisions, rationale, trade-offs, and technology evaluations made during the development of the Teradyne AI Enablement take-home exercises.

---

## Decision 1: Primary AI Tool Disclosure
*   **Status**: Accepted
*   **Context**: The exercise specification requires declaring a primary AI coding assistant and limits web-based chat interfaces (ChatGPT, Claude.ai, Gemini Chat, etc.) to supporting roles only.
*   **Decision**: **Antigravity by Google DeepMind** (operating via the agentic developer environment) is declared as the primary AI assistant. 
*   **Rationale**: The agentic environment integrates directly into the terminal, filesystem, and development lifecycle, ensuring that all operations are transparent, fully automated, and traceably committed to the project.
*   **Trade-offs**: None. Using a terminal-integrated agentic workflow guarantees a clean, auditable development trail.

---

## Decision 2: Self-Contained Dual-Mode search (Offline-First Strategy)
*   **Status**: Accepted
*   **Context**: The application must be runnable locally without exposing private credentials, but also corporate-ready for live production deployment at a company where advanced LLM capabilities would be expected.
*   **Decision**: Implement a **Strategy Pattern** via the `INLPEngine` interface. 
    *   **Offline Mode**: Uses a pure JavaScript-based BM25 / TF-IDF text matcher, keyword analyzers, and regex-based entity extractors.
    *   **Cloud Mode**: Triggered automatically when a `GEMINI_API_KEY` is present in the environmental config, utilizing semantic vectors and Google's Gemini LLM for high-fidelity generative syntheses.
*   **Rationale**: Ensures 100% out-of-the-box local operation for recruiters and interview evaluators with zero setup friction, while proving enterprise viability and direct modular upgradeability for production teams.
*   **Trade-offs**: Implementing a high-quality local text search engine and response compiler in pure TypeScript adds implementation complexity, but it completely removes dependency on third-party SaaS accounts or network connections during local evaluation.

---

## Decision 3: Language & Runtime Stack (Unified TypeScript & Node.js)
*   **Status**: Accepted
*   **Context**: We need to parse multiple Office documents (`.docx`, `.pptx`, `.xlsx`), ingest Markdown transcripts, build a REST API, and code a React application.
*   **Decision**: Use **TypeScript and Node.js** across the entire stack.
    *   **Backend**: Express + TypeScript.
    *   **Frontend**: React + Vite + TypeScript.
    *   **Data Generation**: Python (standard libraries + standard docx/pptx/openpyxl packages) for constructing the synthetic corpus cleanly.
*   **Rationale**: Using TypeScript provides shared types between the frontend and backend, lowering development friction and increasing database representation safety (e.g., matching citation models, feedback data structures, and metrics payloads). Node has excellent local parsing libraries with zero external system requirements.
*   **Trade-offs**: Python is traditionally preferred for simple NLP, but a Node-based backend makes the final application completely unified, meaning the frontend and backend can be run simultaneously using a single `npm run dev` script with zero dependency pathing errors on the evaluator's system.

---

## Decision 4: Local Office Ingestion Libraries (Mammoth & SheetJS)
*   **Status**: Accepted
*   **Context**: The system must extract clean searchable text and structure from Word, Excel, and PowerPoint files in Node.js on Windows without requiring a Microsoft Office installation.
*   **Decision**: Standardize on:
    *   `mammoth`: To convert `.docx` documents into structured text (by extracting paragraphs and layout).
    *   `xlsx` (SheetJS): To read `.xlsx` files and convert tabular rows into readable structured text strings.
    *   `officeparser`: A lightweight, pure-JS package to parse slides from `.pptx` presentations.
*   **Rationale**: These libraries are pure JavaScript, do not rely on Python sub-processes at runtime, do not compile C++ native modules, and run perfectly on Windows, macOS, and Linux out-of-the-box.
*   **Trade-offs**: Pure-text extraction loses complex cell styling in Excel or image assets in Word/PowerPoint, but for search indexing and natural language querying, text content extraction is the primary asset needed.

---

## Decision 5: Premium Vanilla CSS Design System (No TailwindCSS)
*   **Status**: Accepted
*   **Context**: Web application guidelines dictate: "Use Vanilla CSS for maximum flexibility and control. Avoid using TailwindCSS unless the USER explicitly requests it."
*   **Decision**: Build a custom CSS Design System from scratch in `/src/frontend/src/index.css` using modern CSS variables (custom properties), HSL color definitions, glassmorphism filters, glowing utility classes, and custom keyframe micro-animations.
*   **Rationale**: Fits the strict formatting guidelines of the web application developer. Vanilla CSS allows us to write elegant, clean layouts without polluting the JSX code with long utility strings, making the components highly readable, modular, and maintainable.
*   **Trade-offs**: Writing vanilla CSS takes slightly more planning to structure responsive grids, flex-boxes, and animations, but the visual outcome feels exceptionally bespoke, premium, and state-of-the-art.

---

## Decision 6: Local File-Based JSON Database for Feedback & Metrics
*   **Status**: Accepted
*   **Context**: Capturing user corrections, rejections, and rolling system metrics requires structured storage, but a full SQL or MongoDB instance introduces local runtime dependencies.
*   **Decision**: Build a transactional JSON file database in `data/db/` (e.g. `feedback.json`, `metrics.json`).
*   **Rationale**: Completely self-contained within the workspace folder, easily inspectable, easily backable, and runs with zero configuration on any system.
*   **Trade-offs**: Not suitable for millions of simultaneous writes, but ideal for a local multi-user team dashboard prototype where writes occur when a user actively edits or rejects a search result.

---

## Decision 7: STRIDE Security Hardening and Path Virtualization
*   **Status**: Accepted
*   **Context**: Deploying retrieval systems containing sensitive technical documents poses data disclosure risks. Absolute physical server paths (e.g. `d:\Antigravity Projects\...`) could leak directory structure, and unsanitized feedback inputs could lead to Stored Cross-Site Scripting (XSS) in operator dashboards.
*   **Decision**: Implement absolute path virtualization and robust sanitization:
    *   **Path Virtualization**: Strip local base directories in the parsing layer (`parser.ts`) using a relative path generator (`virtualizePath`) that projects paths relative to the current workspace root as unified forward-slash strings (e.g., `data/documents/...`).
    *   **Stored XSS Prevention**: Integrate an HTML escaping function (`escapeHtml` in `database.ts`) that sanitizes incoming query inputs, database records, and operator corrections before disk persistence.
    *   **Atomic Write Protection**: Implement `safeWriteJson` in both `database.ts` and `parser.ts` to write data to a temporary file (`.tmp`) before renaming it to prevent data corruption.
*   **Rationale**: Blocks file traversal and directory structure leaks, protects administrative users from scripting attacks, and ensures database reliability under concurrent operations.
*   **Trade-offs**: HTML escaping changes how strings are stored on disk (stored as HTML entities). Since we render standard text in the frontend, standard rendering is safe.

---

## Decision 8: High-Speed Ingestion Caching and Dynamic RAM Search Sync
*   **Status**: Accepted
*   **Context**: Re-parsing a large corpus of Word, PowerPoint, and Excel files via libraries like Mammoth and SheetJS on every server boot is extremely slow and resource-heavy. Additionally, waiting for a restart to index newly approved operator corrections degrades usability.
*   **Decision**: Implement static serialization and runtime memory injection:
    *   **Warm-Cache Booting**: Save compiled search chunks alongside file stats (`mtimeMs`, `size`) to a cached JSON index (`data/db/indexed_chunks.json`). On startup, check if files are modified; if not, bypass expensive office parsers entirely.
    *   **Pruning & Self-Healing Cache**: Automatically delete entries for files removed from the filesystem, ensuring the cache is always in sync.
    *   **Dynamic RAM Sync**: Inside `POST /api/feedback/resolve`, automatically construct a virtual `DocumentChunk` from approved corrections and inject/merge it directly into the active in-memory `documentIndex` search array.
*   **Rationale**: Boot latency drops from 387ms to under 3ms (a 99.2% speedup) for unchanged files. Approved corrections immediately update search query results without downtime or restarts.
*   **Trade-offs**: In-memory updates are volatile and will be lost on server crash or restart unless also recorded in a persistent feedback database (which we do in `feedback.json`). The system re-ingests these on boot, maintaining long-term integrity.

---

## Decision 9: Grammatical Stemming for Query Matching
*   **Status**: Accepted
*   **Context**: Users searching the knowledge tracer frequently query words in singular or plural forms (e.g. "nodes" vs "node", "forecasting" vs "forecast"), which caused traditional exact token matching to miss highly relevant context segments.
*   **Decision**: Implement a **Porter-style suffix stemming filter** within `nlp.ts` and integrate it into the `tokenize()` function. The filter strips common grammatical suffixes like `"s"`, `"es"`, `"ing"`, and `"ed"`, while using heuristic rule exceptions to preserve proper abbreviations (like `"us"` or `"as"`) and regular bases.
*   **Rationale**: Normalized tokens allow search vectors (TF-IDF/BM25) to map different morphological inflections of the same root word onto a single token index, dramatically increasing search recall in offline execution.
*   **Trade-offs**: A custom stemming filter is simpler than full library-based lemmatization (like natural or compromise) but keeps the codebase extremely lightweight, high-performance, and has zero external npm dependencies or native binaries.

---

## Decision 10: Secure Path-Traversal-Guarded Document Download Bridge
*   **Status**: Accepted
*   **Context**: Operators reviewing corpus citations in the Search Console citation drawer need to access and download the original raw source document or transcript files, but exposing arbitrary file paths creates high risk of directory traversal attacks.
*   **Decision**: Implement a secure backend endpoint `GET /api/documents/download/:filename` paired with a premium glassmorphic download button in the React UI drawer. The backend:
    1. Neutralizes directory prefixes using `path.basename()`.
    2. Validates that the resolved absolute target path starts with the absolute workspace root (`process.cwd()`), rejecting any traversal breaches with a `403 Forbidden` response.
*   **Rationale**: Fully mitigates STRIDE Information Disclosure and Security Misconfiguration threats, while providing a seamless, visual, and highly integrated UX for operators.
*   **Trade-offs**: Only physical assets matching files in standard transcripts or document directories can be downloaded, which is appropriate for operational compliance.

---

## Decision 11: Document Density Calibration for Structured Office Retrieval (Office-to-Dialogue Relevance Equalizer)
*   **Status**: Accepted
*   **Context**: Conversational transcripts inherently gain heavy term frequency boosts due to speaker names, facilitator markers (e.g. `**Marcus Vance**:`), and redundant conversational phrases (e.g., repeated technical keywords over a 15-minute dialogue). Conversely, structured Office documents (like Excel pricing grids, Word SOP sections, and PowerPoint slides) present extremely dense, high-fidelity facts in single lines without speaker dialogue anchors. Consequently, pure BM25 or TF-IDF matching severely penalizes these short office snippets, ranking long transcripts higher even for query terms specifically referencing cell tables or presentation slides.
*   **Decision**: Implement a type-specific baseline boost to match weights within `OfflineNLPEngine.queryDocuments` when scoring non-zero matches:
    *   **Excel (`.xlsx`)**: $+0.8$ baseline boost (highest density per row, e.g., thermal logs, pricing matrices).
    *   **PowerPoint (`.pptx`)**: $+0.6$ baseline boost (synthesized summary bullet points).
    *   **Word (`.docx`)**: $+0.4$ baseline boost (explicit specification paragraphs).
*   **Rationale**: Rather than forcing operators to input overly hyper-specific, unique IDs (e.g., thermal test load serial numbers or battery material properties) to make these documents rank at the top, a baseline boost levels the retrieval playing field. It enables natural, generic, human queries (like `"pricing matrix licensing standard tier"` or `"helium substation deployment thermal antenna bracket"`) to naturally bubbles up the high-priority Excel cells and slide references to the top of the citation drawer.
*   **Trade-offs**: If a transcript mentions a phrase once in a highly casual manner, an office document focusing entirely on that specification will cleanly override it. This aligns with corporate operational needs where verified spreadsheets/specs are higher authority than casual conversation.

---

## Decision 12: True Keyless Validation and Environment-Aware Falling Back
*   **Status**: Accepted
*   **Context**: During development or early staging cycles, config templates or `.env` files frequently contain default placeholder keys (like `GEMINI_API_KEY="your_gemini_api_key_here"`). Under naive code patterns that merely verify the existence of the environment variable (e.g. `if (process.env.GEMINI_API_KEY)`), the application is fooled into asserting it is running in "Enterprise Cloud" mode, resulting in uncaught HTTP 403 API authorization failures when indexing or searching.
*   **Decision**: Hard-code placeholder exclusions at both server startup and status query points. The server explicitly checks `if (apiKey && apiKey !== 'your_gemini_api_key_here')` to classify the mode. If it matches the placeholder, the server sets `mode` to `"Offline Fallback"` and utilizes local text-matching engines automatically.
*   **Rationale**: This ensures a zero-configuration, seamless experience for evaluators or new team members. They can check out the repository, run the services immediately keyless, and get clean local results, without having to strip down or modify environmental configs.
*   **Trade-offs**: System administrators must make sure they set actual active keys instead of placeholder patterns in staging or production. The server console clearly prints the active startup mode to ensure operators have visual confirmation.

---

## Decision 13: Widescreen Responsive SVG Telemetry Charting & Click-to-Reveal KPIs
*   **Status**: Accepted
*   **Context**: The team lead system analytics dashboard includes a 30-day performance trends graph showing Health Index, Confidence, and Rejection Rate, as well as KPI summary cards. Naive SVG rendering causes charts to display blank margins or font distortion on 1080p+ widescreen monitors. Furthermore, clean-state boots initialized to pre-calibrated default baselines (85% System Health and Average Search Confidence) risk confusing users unless they can read immediate context without leaving the dashboard tab.
*   **Decision**: 
    1. **Widescreen SVG Layout**: Re-scale the SVG viewBox from `940x140` to a widescreen aspect ratio of `1500x140` (a `10.7:1` ratio), allowing the SVG canvas to scale dynamically to match responsive containers perfectly without font stretching. Horizontal coordinates for data polylines are mapped mathematically with a constant spacing interval of `160px` (ranging from x=`20` to x=`1460`).
    2. **Click-to-Reveal Metric Overlays**: Embed stateful, glassmorphic click-to-reveal overlay explanation panels directly inside the System Health Index and Avg Search Confidence metrics cards, toggled via custom interactive `?` icons with immediate close (`×`) controls.
*   **Rationale**: Provides high visual fidelity on modern widescreen developer monitors. Keeping explanation panels self-contained inside the KPI cards keeps the dashboard interactive, context-aware, and avoids page clutter or disruptive off-screen jumps.
*   **Trade-offs**: Fixed width spacing limits chart plots to 10 points (covering the 30-day window at 3-day steps), which is highly appropriate and visually clean for the operational telemetry dashboard.

---

## Decision 14: HTML Entity Sanitization Fix (Excluding `'` and `/` from escapeHtml)
*   **Status**: Accepted
*   **Context**: In our Stored XSS mitigation, we implemented `escapeHtml()` in `database.ts` which escaped `'` to `&#x27;` and `/` to `&#x2f;`. When user gap feedback containing words like "couldn't" or sentences with backslashes/slashes was saved, it got stored with `&#x27;` and `&#x2f;`. When retrieved, standard DOM rendering of text or raw rendering in standard HTML inputs (or tooltips) led to double-encoding bugs, displaying `"couldn&#x27;t"`.
*   **Decision**: Update `escapeHtml` to only escape `<` (to `&lt;`), `>` (to `&gt;`), `&` (to `&amp;`), and `"` (to `&quot;`), while keeping `'` and `/` raw.
*   **Rationale**: Escaping `<` and `>` prevents HTML script tags (`<script>`) from being parsed as actual DOM elements, which successfully mitigates Stored XSS. Keeping `'` and `/` raw prevents double-encoding bugs in React forms and standard text rendering, ensuring perfect grammatical visual rendering while preserving strong security.
*   **Trade-offs**: Raw quotes and slashes do not pose an XSS threat in modern standard React DOM rendering because React automatically sanitizes strings set via `{variable}` rather than `dangerouslySetInnerHTML`.

---

## Decision 15: Jaccard Similarity Formulation for Query Reformulation Detection
*   **Status**: Accepted
*   **Context**: Track user search query behavior to identify when users are not finding what they want. When they don't get the desired answer, they tend to input multiple permutations of the same question (reformulations) within a short window. We need a way to detect this.
*   **Decision**: Implement a sliding-window Jaccard Similarity reformulation algorithm in `database.ts`. It compares consecutive search queries within a 5-minute time window. If the Jaccard similarity coefficient (calculated on word tokens, ignoring casing and stemming) is $\ge 40\%$ (0.4) and the queries are not identical, it flags the pair as a "reformulation".
*   **Rationale**: If a user submits queries that share 40% or more of their stemmed tokens within 5 minutes, it strongly implies they are refining their search to get a better answer. Tracking this rate provides a direct indicator of search dissatisfaction (Knowledge Tracer performance bottleneck).
*   **Trade-offs**: High similarity might occasionally catch natural sequential questions, but a 40% threshold with a 5-minute time limit provides high precision for identifying user search struggles.

---

## Decision 16: Three-Tier Cognitive Search Query Routing Flow
*   **Status**: Accepted
*   **Context**: The search routing logic must elegantly handle multiple query types: (a) explicit matches against the indexed knowledge base, (b) queries referencing specific business domains, and (c) off-topic or out-of-scope queries.
*   **Decision**: Design a 3-Tier Cognitive Routing engine in `routing.ts`:
    *   **Tier 1 (Exact / Content Match)**: If the local offline TF-IDF engine or cloud Gemini/Azure OpenAI engine returns a high-confidence match ($\ge 0.15$ score), route it directly.
    *   **Tier 2 (Domain Keyword Fallback)**: If content match confidence is low, run a keyword-based domain classifier (mapping words like "pricing", "thermal", "nodes", "license", "substation" to specific domain files/directories) to locate the relevant document and route to the respective expert/team lead (e.g. Marcus Vance for substation thermal issues, Sarah Jenkins for licenses).
    *   **Tier 3 (Off-Topic Null Route)**: If a query has low confidence and shares no relevant keywords with corporate domains, classify it as "Off-Topic" and return a friendly null response indicating it's out-of-scope, rather than generating a confusing expert routing card for random queries (like "what is the weather today").
*   **Rationale**: This tiered architecture dramatically improves the signal-to-noise ratio of low-confidence alerts, routing actual corporate knowledge gaps to the appropriate team leads while filtering out unrelated noise.
*   **Trade-offs**: Domain keyword matching is rule-based, but is highly effective for a specialized take-home corpus and can be easily extended.

---

## Decision 17: Interactive Reformulation Drill-Down and Telemetry Card UI Alignment
*   **Status**: Accepted
*   **Context**: Knowing there is a 7% reformulation rate is helpful, but operators need a way to see what the queries are to improve the knowledge base. Also, the team lead dashboard layout had the reformulation card wrapped onto a separate row, creating an uneven dashboard grid, and the performance charts were cluttered.
*   **Decision**:
    *   **Dashboard Layout**: Redesign the telemetry card grid in CSS to display all 4 KPI cards (Health Index, Search Confidence, Rejection Rate, Reformulation Rate) on a single row (4-column layout `grid-template-columns: repeat(4, 1fr)`) with responsive wrap behavior. Move the 30-day performance trends chart to the bottom.
    *   **Interactive Reformulation Drill-Down**: Implement a stateful modal/panel in the admin interface (`AuditQueue.tsx` or `AetherPulseAnalytics.tsx`) that fetches all detected reformulation query pairs from a new `/api/reformulations` endpoint. When a user clicks on the "Reformulation Rate" card (or a "View Details" button), it reveals a detailed list of anonymous query pairs (e.g. "how to calibrate thermal sub" $\rightarrow$ "thermal substation calibration steps"), showing exactly what users tried to find.
*   **Rationale**: Unifies the visual language, improves screen space utilization on widescreen displays, and turns an abstract percentage into concrete, actionable insight for the team lead.
*   **Trade-offs**: Exposing reformulation pairs requires standard logging and telemetry APIs, which have been built cleanly in `server.ts`.

---

## Decision 18: Advanced Multi-Format File Ingestion and Parser Security Validation Gate
*   **Status**: Accepted
*   **Context**: The user commented that we should make sure we can ingest the files (Excel, Word, PowerPoint) and we need some security to prevent bad files from damaging the host system/platform.
*   **Decision**: Update `parser.ts` to implement a multi-layered file validation and secure parsing architecture:
    *   **Security Gate**: Validate uploaded or processed files by enforcing a 50MB file size limit and validating "magic bytes" (file headers) to verify they are legitimate ZIP/OLE2 formats before passing them to mammoth, xlsx, or officeparser. This prevents Zip Slip, XML External Entity (XXE) attacks, and system corruption.
    *   **Excel Row Formatting**: Format extracted tabular Excel cells as clean Markdown tables or formatted strings before search indexing to preserve structured relationship context in search results.
    *   **Warm-Cache Verification**: Re-validate the index integrity on boot using file size and last-modified time (`mtimeMs`).
*   **Rationale**: Prevents malicious actors from uploading corrupt or exploit-laden files, protecting the host backend server while maximizing index retrieval quality for tabular spreadsheet data.
*   **Trade-offs**: Performs additional sync FS stat checks during ingestion, but is completely covered by the sub-3ms warm boot cache.

---

## Decision 19: Full-Stack Security Hardening (OWASP/STRIDE Audit Remediation)
*   **Status**: Accepted
*   **Context**: A comprehensive security audit using STRIDE threat modeling and OWASP Top 10 analysis identified 29 findings across 5 severity levels. The application had zero authentication, zero rate limiting, unrestricted CORS (`*`), no HTTP security headers, direct user input interpolation into LLM prompts (prompt injection risk), raw `err.message` leaking in API responses, and unbounded log file growth.
*   **Decision**: Implement a 5-phase remediation across all backend services and the frontend:
    1. **Phase 1 — Stop the Bleeding**: Added `helmet()` for secure HTTP headers, restricted CORS to localhost origins, added `express-rate-limit` with 3 tiers (general 60/min, query 30/min, admin 5/min), set explicit `express.json({ limit: '100kb' })` body size cap, added 500-character query length validation, and replaced all raw `err.message` responses with `sanitizeError()` to strip file paths and stack traces.
    2. **Phase 2 — Prompt Injection Hardening**: Implemented `sanitizeForLLM()` to strip 11+ injection pattern families ("ignore all instructions", "reveal system prompt", "DAN", "jailbreak", etc.). Wrapped all user queries in XML delimiters (`<user_query>`, `<context>`) to structurally separate user input from system instructions. Added anti-jailbreak rules to both Gemini and Azure OpenAI system prompts. Added `validateLLMResponse()` to constrain LLM output to expected schema (answer length cap, confidence clamped 0-1, priority enum enforced, citations capped at 10).
    3. **Phase 3 — Authentication & Access Control**: Added optional API key authentication middleware (`API_AUTH_KEY` env var, `x-api-key` header). Gated admin endpoints (`/api/ingest`, `/api/feedback/resolve`) behind `requireAuth` + `adminLimiter`. Added runtime feedback `status` enum validation and `feedbackId` type checking.
    4. **Phase 4 — File Processing Hardening**: Extended 50MB file size limit to Markdown transcripts (previously only Office files). Strengthened magic byte validation from 2-byte PK prefix to full 4-byte ZIP local file header (`PK\x03\x04`) to prevent bypass with crafted files.
    5. **Phase 5 — Frontend & Operational**: Added Content-Security-Policy meta tag restricting script-src, connect-src, style-src, and img-src. Capped feedback.json at 1000 entries and queries_log.json at 2000 entries with FIFO rotation to prevent unbounded disk growth.
*   **Rationale**: Security must be addressed proactively before deployment. The 5-phase approach prioritizes critical exposure (network-level) first and works inward to application-level defenses. All changes maintain backward compatibility — the app works identically in dev mode when `API_AUTH_KEY` is unset.
*   **Trade-offs**: Rate limiting may need tuning for production load. `sanitizeForLLM()` is a blocklist approach (can be bypassed by novel injection patterns) — a more robust defense would use a separate classifier model, but the current approach handles known attack vectors. CSP `'unsafe-inline'` for styles is required by the current CSS architecture.
*   **Verification**: All 13 security integration tests pass (normal query, length cap, empty query, invalid feedback status, valid feedback, feedbackId type check, helmet headers, body size limit, CORS restriction, CORS allowed, metrics, feedback list, rate limiter).

---

## Decision 20: Automated Live Application Screenshot Capture & Programmatic Verification
*   **Status**: Accepted
*   **Context**: The user required a comprehensive User Guide featuring actual screenshots of the running React application (port 5173/5174) rather than synthetic mockups, placeholders, or static designs.
*   **Decision**: Configure and run Playwright in a headless environment via a dedicated Node.js automation script (`scripts/take_screenshots.js`). The script connects to the active frontend development server, automatically handles state (bypassing onboarding welcome tours, typing custom natural language searches, opening citation drawers, closing drawer overlays, and navigating across sidebar workspace panels), and captures high-fidelity screenshots.
*   **Rationale**: Using a programmatic screenshot tool ensures that the images are exact, real representations of the active React client. This completely eliminates manual screenshot fatigue, ensures consistency in resolution/layout (1440x900 viewport), and provides a repeatable mechanism to re-generate the screenshots if UI styles or data schemas change in the future.
*   **Trade-offs**: Requires the local frontend/backend server to be active when running the script, which is already handled by our concurrent `npm run dev` workspace setup.

---

## Decision 21: Custom-Built Onboarding Walkthrough (Zero Dependencies)
*   **Status**: Accepted
*   **Context**: The application needed an interactive guided tour to onboard new users (operators and reviewers) to the key features: search, citations, feedback submission, audit queue, analytics dashboard, and LLM settings. The TASK.md roadmap listed this as backlog item #4. Two approaches were evaluated: (1) using `react-joyride`, the most popular React tour library, or (2) building a custom wizard from scratch.
*   **Decision**: Build a fully custom onboarding wizard (`OnboardingWizard.tsx` + `onboarding.css`) with zero external dependencies. The wizard features a 7-step guided tour with spotlight overlay, glassmorphic tooltip cards, auto-tab switching, keyboard navigation, `localStorage` persistence, and multiple exit paths (Skip button, ✕ close, Escape key). A "?" help button in the header allows re-launching anytime.
*   **Rationale**: `react-joyride` was rejected because its default styling conflicts with the premium glassmorphic dark-theme design system. Extensive CSS overrides would be needed to match the app's aesthetic, and the result would still feel "bolted-on" rather than native. A custom implementation uses the existing CSS design tokens (`--accent-cyan`, `--grad-cyan-blue`, `backdrop-filter: blur()`, `glass-panel` patterns) directly, resulting in a seamless, premium feel. The spotlight technique (`box-shadow: 0 0 0 4000px rgba(0,0,0,0.72)`) is lightweight and doesn't require portal manipulation. Auto-tab switching via the `onNavigateTab` callback enables spotlighting elements that exist on different sidebar views.
*   **Trade-offs**: A custom wizard requires maintenance when component class names change (the spotlight targets CSS selectors). `react-joyride` handles DOM changes more gracefully via its `disableScrolling` and `spotlightPadding` props. However, the custom approach gives complete control over animations, positioning, and the cancellation UX. The 7-step configuration is declarative and easy to extend.
*   **Verification**: TypeScript compiles clean (`tsc --noEmit`). Vite production build succeeds (23 modules, 0 errors). Manual testing confirms all 7 steps spotlight correctly, auto-tab switching works, all 3 cancel paths function, and `localStorage` persistence prevents re-launch after completion.

