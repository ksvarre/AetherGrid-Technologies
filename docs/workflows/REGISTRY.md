# AetherGrid Technologies — Workflow Registry

This registry tracks and documents all operational workflows in the AetherGrid Knowledge Tracer platform. It serves as the authoritative reference mapping user behavior, backend processing, state transitions, and file interactions.

---

## View 1: By Workflow

| Workflow | Spec File | Status | Trigger | Primary Actor | Last Reviewed |
|---|---|---|---|---|---|
| Knowledge Ingestion & Parsing | [WORKFLOW-ingestion.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/workflows/WORKFLOW-ingestion.md) | Approved | POST `/api/ingest` / System Boot | `ParserService` | 2026-05-20 |
| Semantic Search & Retrieval | [WORKFLOW-search-query.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/workflows/WORKFLOW-search-query.md) | Approved | POST `/api/query` | `INLPEngine` / Client | 2026-05-21 |
| User Gap Feedback Capture | [WORKFLOW-feedback.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/workflows/WORKFLOW-feedback.md) | Approved | POST `/api/feedback` | User UI / `DatabaseService` | 2026-05-21 |
| Lead Correction & Self-Healing | [WORKFLOW-resolution.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/workflows/WORKFLOW-resolution.md) | Review | POST `/api/feedback/resolve` | Team Lead UI / Server Index | 2026-05-20 |
| Pre-Execution Reference Review | [WORKFLOW-pre-execution-review.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/workflows/WORKFLOW-pre-execution-review.md) | Approved | Session Start / Request | AI Coding Agent | 2026-05-21 |
| Reformulation Drill-Down & Analytics | — | Missing | GET `/api/reformulations` | `DatabaseService` / AetherPulse UI | — |
| Document Download Bridge | — | Missing | GET `/api/documents/download/:filename` | Express Server | — |
| System Health Check | — | Missing | GET `/api/status` | Express Server | — |

> **⚠️ 3 Missing workflows identified.** These exist in code ([server.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/server.ts)) but have no corresponding spec files. Risk: they may be modified without full understanding of their contracts.

---

## View 2: By Component

| Component | File(s) | Workflows it participates in |
|---|---|---|
| Ingestion & Text Extraction | [parser.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts) | Knowledge Ingestion & Parsing |
| Search Engine Logic | [nlp.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts) | Semantic Search & Retrieval |
| Expert Routing Directory (3-Tier) | [routing.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/routing.ts) | Semantic Search & Retrieval (Tier 1/2/3 Routing) |
| File Database Store | [database.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/database.ts) | User Gap Feedback Capture, Lead Correction & Self-Healing, Query Logging & Reformulation Detection, Telemetry Metrics Aggregation |
| Express Routing Controller | [server.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/server.ts) | All Workflows (Entry points & Orchestration) |
| Custom Agent Skills | [.agents/skills/](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/.agents/skills) | Pre-Execution Reference Review, Post-Approval Documentation Sweeps |
| Search & Citation Portal | [SearchConsole.tsx](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/frontend/src/components/SearchConsole.tsx) | Semantic Search & Retrieval, User Gap Feedback Capture |
| Audit Queue Table Panel | [AuditQueue.tsx](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/frontend/src/components/AuditQueue.tsx) | Lead Correction & Self-Healing |
| Telemetry Dashboard | [AetherPulseAnalytics.tsx](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/frontend/src/components/AetherPulseAnalytics.tsx) | System Telemetry (4 KPI cards, Reformulation Drill-Down, Knowledge Gap Hotspots, 30-Day Trend Chart) |

---

## View 3: By User Journey

### Employee/User Journeys
| What the User Experiences | Underlying Workflow(s) | Entry Point |
|---|---|---|
| Searches for a technical topic | Semantic Search & Retrieval | `SearchConsole` Query Input |
| Receives precise inline citations | Semantic Search & Retrieval | `SearchConsole` Response & Citation Panel |
| Views suggested topic expert (Tier 1/2) | Semantic Search & Retrieval (3-Tier Routing) | `SuggestedRoutingPanel` (if score < 0.40 and domain keywords found) |
| Sees "out of scope" for off-topic queries (Tier 3) | Semantic Search & Retrieval (3-Tier Routing) | `SearchConsole` (if routing returns null) |
| Corrects inaccurate answer | User Gap Feedback Capture | `SearchConsole` Correction Widget |
| Rejects response / marks missing | User Gap Feedback Capture | `SearchConsole` Rejection / Gap Buttons |
| Rephrases a query (implicit dissatisfaction) | Reformulation Detection (automatic) | `SearchConsole` Query Input (within 5-min window) |

### Operator/Team Lead Journeys
| What the Lead Operator Does | Underlying Workflow(s) | Entry Point |
|---|---|---|
| Audits uncorrected system answers | Read-only feedback review | `AuditQueue` Table Loader |
| Resolves and applies correction | Lead Correction & Self-Healing | `AuditQueue` "Apply Correction" Click |
| Triggers a manual corpus refresh | Knowledge Ingestion & Parsing | Navigation bar "Re-scan System Data" |
| Reviews rolling system health index | Telemetry & Performance Aggregation | `AetherPulseAnalytics` Dashboard |
| Drills into reformulation pairs | Reformulation Drill-Down & Analytics | `AetherPulseAnalytics` "View Reformulations" button |
| Reviews knowledge gap hotspots by domain | Telemetry & Performance Aggregation | `AetherPulseAnalytics` Gap Hotspots panel |
| Downloads a cited source document | Document Download Bridge | Citation click → `GET /api/documents/download/:filename` |

### System-to-System Journeys
| What Happens Automatically | Underlying Workflow(s) | Trigger |
|---|---|---|
| Ingests raw data on startup | Knowledge Ingestion & Parsing | Express server boot bootstrap |
| Re-injects resolved corrections on boot | Lead Correction & Self-Healing (Boot variant) | `injectResolvedCorrections()` during bootstrap |
| Logs search metric telemetry | Query Logging & Reformulation Detection | Search response completion via `dbService.logQuery()` |
| Detects implicit query reformulations | Reformulation Detection | Jaccard similarity ≥40% overlap within 5-minute window |

---

## View 4: By State

### FeedbackItem Lifecycle State Map

| State | Entered By | Exited By | Workflows that can trigger exit |
|---|---|---|---|
| **unresolved** | User Gap Feedback Capture (`POST /api/feedback`) | -> `resolved` | Lead Correction & Self-Healing |
| **resolved** | Lead Correction & Self-Healing (`POST /api/feedback/resolve`) | (Terminal State) | — |

### DocumentIndex In-Memory Cache State Map

| State | Entered By | Exited By | Workflows that can trigger exit |
|---|---|---|---|
| **empty** | Server boot init | -> `cached` / `live` | Knowledge Ingestion & Parsing |
| **cached** | Load from persistent cache (`indexed_chunks.json`) | -> `stale` | File modification detection |
| **live** | Complete filesystem parsing (Mammoth, SheetJS) | -> `updated` | Lead Correction & Self-Healing (Virtual sync) |
| **updated** | Dynamic Feedback Injection | -> `empty` | Server process restart |

### QueryLog Entry Lifecycle State Map

| State | Entered By | Exited By | Workflows that can trigger exit |
|---|---|---|---|
| **logged** | `dbService.logQuery()` during search response | (Terminal State — read-only after creation) | — |
| **flagged as reformulation** | Jaccard similarity ≥40% within 5-min window | (Terminal State — `isReformulation: true`, `reformulationOf: "<original>"`) | — |

### Telemetry Health Level State Map

| State | Entered By | Exited By | Workflows that can trigger exit |
|---|---|---|---|
| **Healthy** | `systemHealthIndex >= 0.68` and `rejectionRate <= 0.20` | -> `Warning` / `Critical` | New query logs or feedback submissions |
| **Warning** | `systemHealthIndex < 0.68` OR `rejectionRate > 0.20` | -> `Healthy` / `Critical` | Query log or feedback changes |
| **Critical** | `systemHealthIndex < 0.55` | -> `Warning` / `Healthy` | Query log or feedback changes |
