# AetherGrid Technologies — Workflow Registry

This registry tracks and documents all operational workflows in the AetherGrid Knowledge Tracer platform. It serves as the authoritative reference mapping user behavior, backend processing, state transitions, and file interactions.

---

## View 1: By Workflow

| Workflow | Spec File | Status | Trigger | Primary Actor | Last Reviewed |
|---|---|---|---|---|---|
| Knowledge Ingestion & Parsing | [WORKFLOW-ingestion.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/workflows/WORKFLOW-ingestion.md) | Approved | POST `/api/ingest` / System Boot | `ParserService` | 2026-05-20 |
| Semantic Search & Retrieval | [WORKFLOW-search-query.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/workflows/WORKFLOW-search-query.md) | Approved | POST `/api/query` | `INLPEngine` / Client | 2026-05-20 |
| User Gap Feedback Capture | [WORKFLOW-feedback.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/workflows/WORKFLOW-feedback.md) | Approved | POST `/api/feedback` | User UI / `DatabaseService` | 2026-05-20 |
| Lead Correction & Self-Healing | [WORKFLOW-resolution.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/workflows/WORKFLOW-resolution.md) | Review | POST `/api/feedback/resolve` | Team Lead UI / Server Index | 2026-05-20 |
| Pre-Execution Reference Review | [WORKFLOW-pre-execution-review.md](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/workflows/WORKFLOW-pre-execution-review.md) | Approved | Session Start / Request | AI Coding Agent | 2026-05-21 |


---

## View 2: By Component

| Component | File(s) | Workflows it participates in |
|---|---|---|
| Ingestion & Text Extraction | [parser.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts) | Knowledge Ingestion & Parsing |
| Search Engine Logic | [nlp.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts) | Semantic Search & Retrieval |
| Expert Routing Directory | [routing.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/routing.ts) | Semantic Search & Retrieval (Fallback) |
| File Database Store | [database.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/database.ts) | User Gap Feedback Capture, Lead Correction & Self-Healing |
| Express Routing Controller | [server.ts](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/server.ts) | All Workflows (Entry points & Orchestration) |
| Custom Agent Skills | [.agents/Skills/](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/.agents/Skills) | Pre-Execution Reference Review, Post-Approval Documentation Sweeps |
| Search & Citation Portal | [SearchConsole.tsx](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/frontend/src/components/SearchConsole.tsx) | Semantic Search & Retrieval, User Gap Feedback Capture |
| Audit Queue Table Panel | [AuditQueue.tsx](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/frontend/src/components/AuditQueue.tsx) | Lead Correction & Self-Healing |
| Telemetry Dashboard | [AetherPulseAnalytics.tsx](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/frontend/src/components/AetherPulseAnalytics.tsx) | System Instrumentation & Telemetry (Read-only view) |

---

## View 3: By User Journey

### Employee/User Journeys
| What the User Experiences | Underlying Workflow(s) | Entry Point |
|---|---|---|
| Searches for a technical topic | Semantic Search & Retrieval | `SearchConsole` Query Input |
| Receives precise inline citations | Semantic Search & Retrieval | `SearchConsole` Response & Citation Panel |
| Views suggested topic expert | Semantic Search & Retrieval (Fallback) | `SuggestedRoutingPanel` (if score < 0.40) |
| Corrects inaccurate answer | User Gap Feedback Capture | `SearchConsole` Correction Widget |
| Rejects response / marks missing | User Gap Feedback Capture | `SearchConsole` Rejection / Gap Buttons |

### Operator/Team Lead Journeys
| What the Lead Operator Does | Underlying Workflow(s) | Entry Point |
|---|---|---|
| Audits uncorrected system answers | Read-only feedback review | `AuditQueue` Table Loader |
| Resolves and applies correction | Lead Correction & Self-Healing | `AuditQueue` "Apply Correction" Click |
| Triggers a manual corpus refresh | Knowledge Ingestion & Parsing | Navigation bar "Re-scan System Data" |
| Reviews rolling system health index | Telemetry & Performance Aggregation | `AetherPulseAnalytics` Dashboard |

### System-to-System Journeys
| What Happens Automatically | Underlying Workflow(s) | Trigger |
|---|---|---|
| Ingests raw data on startup | Knowledge Ingestion & Parsing | Express server boot bootstrap |
| Logs search metric telemetry | User Gap Feedback Capture | Search response completion |

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
