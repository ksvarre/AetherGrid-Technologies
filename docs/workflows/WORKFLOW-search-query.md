# WORKFLOW: Semantic Search & Retrieval
**Version**: 0.2
**Date**: 2026-05-21
**Author**: Workflow Architect
**Status**: Approved

## Overview
This workflow describes how a natural language question submitted by an employee is processed by the search API. It runs the query against the memory index using either the cloud-based **Google Gemini RAG strategy**, **Azure OpenAI strategy**, or the local **Offline TF-IDF strategy**. It compiles precise inline citation indexes, scores confidence, applies **3-tier intelligent routing** for low-confidence results, persists the query event with **reformulation detection**, and returns the response to the frontend.

## Actors
| Actor | Role in this workflow |
|---|---|
| Employee (User) | Submits natural language question from the UI search console |
| Express Server | Intercepts HTTP request, coordinates NLP engines, loggers, and routing |
| `OfflineNLPEngine` | Alternative strategy: executes local TF-IDF, boosts exact entities, synthesizes static answer |
| `GeminiNLPEngine` | Primary strategy: selects top chunks, calls `gemini-2.5-flash` API to return a structured JSON |
| `AzureOpenAINLPEngine` | Optional strategy: calls Azure OpenAI API for cloud-hosted RAG |
| `RoutingService` (3-Tier) | Generates a custom expert profile, rationale, and drafted Microsoft Teams message for low-confidence queries — or returns `null` for off-topic queries |
| `DatabaseService` | Logs query event with reformulation detection to `queries_log.json` |

## Prerequisites
- In-memory `documentIndex` must not be empty.
- For Cloud Strategy: `GEMINI_API_KEY` or Azure headers must be configured and valid.

## Trigger
- User clicks "Search" button or presses Enter inside the `SearchConsole` input field (`POST /api/query`).

---

## Workflow Tree

### STEP 1: Query Validation
**Actor**: Express Server
**Action**: Validates that query is present, is a non-empty string, and is of type `string`.
**Timeout**: 1s
**Input**: `{ query: string }`
**Output on SUCCESS**: Valid query -> GO TO STEP 2
**Output on FAILURE**:
  - `FAILURE(invalid_query)`: Empty query, wrong type, or whitespace-only -> [recovery: Return 400 Bad Request status + error JSON, no further execution]

**Observable states during this step**:
  - **Operator/User sees**: Loading typing state indicator.
  - **Database**: Unchanged.
  - **Logs**: `[Server] Query received: "What is MAE?"`

---

### STEP 2: NLP Engine Resolution & Strategic Retrieval
**Actor**: `INLPEngine` (resolved per-request from headers or server default)
**Action**: Resolves the active NLP engine from request headers (`x-cloud-provider`, `x-gemini-api-key`, `x-azure-api-key`, `x-azure-endpoint`, `x-azure-deployment`) or falls back to the server-wide default:
  - **Cloud Mode (`GeminiNLPEngine`)**: Dense keyword ranking -> extracts top 6 context chunks -> compiles prompt -> executes API call -> returns structured JSON.
  - **Cloud Mode (`AzureOpenAINLPEngine`)**: Same flow through Azure OpenAI endpoint.
  - **Offline Mode (`OfflineNLPEngine`)**: Porter-style tokenizer -> computes Term Frequency (TF) and Inverse Document Frequency (IDF) -> matches top 3 chunks -> extracts matching sentences -> synthesizes paragraph with static tags.
**Timeout**: 15s (Cloud), 1s (Offline)
**Input**: `(query, documentIndex)`
**Output on SUCCESS**: `QueryResponse` (answer, confidenceScore, citations, domain) -> GO TO STEP 3
**Output on FAILURE**:
  - `FAILURE(api_key_expired)`: Cloud mode fails due to API authorization error -> [recovery: Log warning, automatically fall back to `OfflineNLPEngine`, execute local TF-IDF, GO TO STEP 3]
  - `FAILURE(network_timeout)`: Cloud API takes > timeout -> [recovery: Log timeout warning, fallback to `OfflineNLPEngine`, execute local TF-IDF, GO TO STEP 3]

**Observable states during this step**:
  - **User sees**: Pulsing glow on search bar / typing text effect.
  - **Logs**: `[NLP] Running Offline TF-IDF search for: "thermals"`

---

### STEP 3: Three-Tier Confidence Routing
**Actor**: `RoutingService` & Express Server
**Action**: Checks the returned `confidenceScore` ($C_s$):
  - **High-Confidence Path ($C_s \ge 0.40$)**: Proceed directly to return response. No routing generated.
  - **Low-Confidence Path ($C_s < 0.40$)**: Invokes `routingService.generateRouting()` which applies three-tier intelligence:

    **Tier 1 — Domain Match + Content Snippet Found**:
    A content snippet was found in the corpus and a domain expert was matched. Rationale includes the matched file, author, and snippet text. Expert routing panel is shown.

    **Tier 2 — Domain Keywords Detected, No Content Match**:
    The query contains domain-related keywords (from `DOMAIN_KEYWORDS` map) but no corpus content was found. Rationale honestly discloses "No matching content was found" and routes to the domain expert for guidance. Expert routing panel is shown.

    **Tier 3 — Completely Off-Topic**:
    No domain keywords detected AND no content overlap. Returns `null`. The UI shows an "out of scope" message instead of a forced expert routing. No expert is routed.

**Timeout**: 1s
**Input**: `QueryResponse`, `topMatchedChunks` (from citation -> documentIndex lookup)
**Output on SUCCESS**: `FinalQueryResponse` (with optional `suggestedRouting` or `undefined` for Tier 3) -> GO TO STEP 4
**Output on FAILURE**:
  - `FAILURE(routing_error)`: Internal error in routing service -> [recovery: Treat as Tier 3, proceed without routing to Step 4]

**Observable states during this step**:
  - **User sees (Tier 1/2)**: Expert routing panel slides in with rationale, recipient, and draft Teams message.
  - **User sees (Tier 3)**: "Out of scope" message or generic low-confidence fallback text.
  - **Logs (Tier 1)**: `⚠️ Low confidence search result (0.24). Invoking routing generator.`
  - **Logs (Tier 3)**: No additional log — null returned silently.

---

### STEP 4: Persist Query Event with Reformulation Detection & Respond
**Actor**: `DatabaseService` & Express Server
**Action**: Logs query parameters, calculated confidence, domain, and timestamp into `data/db/queries_log.json`. Before persisting, the service performs **reformulation detection**:

  1. Tokenizes the current query (stripping stop words, lowercasing).
  2. Scans the last 20 query log entries in reverse chronological order.
  3. For each recent query within a **5-minute window**:
     - Computes Jaccard token similarity.
     - If similarity ≥ **40%** and the query text differs → flags `isReformulation: true` and stores `reformulationOf: "<original query>"`.
  4. Persists the enriched log entry via atomic temp-file write (`safeWriteJson`).

Sends final JSON payload to user frontend.

**Timeout**: 1s
**Input**: `FinalQueryResponse`
**Output on SUCCESS**: HTTP 200 JSON -> Terminate Workflow.
**Output on FAILURE**:
  - `FAILURE(log_write_error)`: Unable to write to `queries_log.json` -> [recovery: Log warning to console, do not fail query, return HTTP 200 payload to user successfully]

**Observable states during this step**:
  - **User sees**: Response paragraph displayed with clickable citation anchors `[1]`, `[2]`. If Tier 1/2 routing triggered, the suggested expert routing panel slides in from the right. If Tier 3, no routing panel appears.
  - **Database**: New query log record appended to `queries_log.json` with fields: `query`, `confidenceScore`, `domain`, `timestamp`, `isReformulation`, `reformulationOf`.
  - **Logs**: `[Metrics] Logged query event. Confidence: 0.88, Domain: Project Helium`
  - **Logs (if reformulation)**: `🔄 Reformulation detected: "firmware bricking" is a rephrasing of "firmware fix" (67% overlap)`

---

## State Transitions
No state transitions occur on indexed documents or feedback items (this is a read-only retrieval workflow).
Query log entries are immutable after creation — they persist `isReformulation` and `reformulationOf` at write time.

---

## Handoff Contracts

### Frontend Client -> Express `/api/query`
**Payload**:
```json
{
  "query": "What is the MAE limit?"
}
```
**Success Response (Tier 1 — High Confidence)**:
```json
{
  "answer": "Project Quantum forecasting spec defines an MAE limit of 1.2 MW [1].",
  "confidenceScore": 0.82,
  "domain": "Project Quantum",
  "priority": "High",
  "citations": [
    {
      "chunkId": "quantum_spec_chunk_2",
      "fileName": "quantum_model_benchmarks.xlsx",
      "filePath": "data/documents/quantum_model_benchmarks.xlsx",
      "author": "Dr. Elena Rostova",
      "attendees": [],
      "date": "2026-05-02",
      "matchedSnippet": "Forecast Model Validation Benchmark: Target MAE <= 1.2 MW, Achieved: 1.15 MW."
    }
  ]
}
```
**Success Response (Tier 2 — Domain Detected, No Content)**:
```json
{
  "answer": "I couldn't find any relevant documents...",
  "confidenceScore": 0.08,
  "domain": "Project Helium",
  "suggestedRouting": {
    "recipientName": "Marcus Vance",
    "recipientEmail": "marcus@aethergrid.com",
    "rationale": "No matching content was found in the knowledge base for this query. However, the query contains keywords associated with the \"Project Helium\" domain...",
    "draftedQuestion": "Hi Marcus,\n\nI was trying to find information regarding..."
  }
}
```
**Success Response (Tier 3 — Off-Topic)**:
```json
{
  "answer": "I couldn't find any relevant documents...",
  "confidenceScore": 0.05,
  "domain": "General"
}
```
Note: `suggestedRouting` is absent (undefined) for Tier 3 — the UI handles this by NOT showing the routing panel.

**Timeout**: 20s

---

## Cleanup Inventory
None.

---

## Test Cases

| Test | Trigger | Expected behavior |
|---|---|---|
| TC-01: Valid query (High Confidence) | Send query "MAE forecasting Rostova" | Returns answer, confidence > 0.60, no routing panel |
| TC-02: Valid query (Tier 1 Low Confidence) | Send query about firmware with matches | Returns confidence < 0.35, returns SuggestedRouting with matched snippet in rationale |
| TC-03: Valid query (Tier 2 Domain Only) | Send query "quantum training" with no corpus match | Returns confidence < 0.35, routing rationale says "No matching content was found" but routes to Elena Rostova |
| TC-04: Off-topic query (Tier 3) | Send query "How do you bake a chocolate chip cookie?" | Returns confidence < 0.10, `suggestedRouting` is `undefined`, no routing panel |
| TC-05: Empty query | Send `{ query: "" }` | Returns 400 Bad Request, error message |
| TC-06: API key fallback | Expire Gemini API key, search | Automatically fails over to Offline TF-IDF engine, returns local matching with `cloudError` in response |
| TC-07: Reformulation detection | Send "firmware fix" then "firmware bricking" within 5 min | Second query logged with `isReformulation: true`, `reformulationOf: "firmware fix"` |
| TC-08: Draft message platform | Trigger any routing | Draft message references "sync on Teams" (not Slack) |

---

## Assumptions
| # | Assumption | Where Verified | Risk if Wrong |
|---|---|---|---|
| A1 | Gemini API key in env represents a valid billing account | Not verified | Searches crash/hang if key gets rejected |
| A2 | User query length doesn't overflow memory bounds | Verified: non-empty check applied | Memory exhaust if user sends massive text |
| A3 | 5-minute reformulation window is sufficient to capture rephrased queries | Not verified | Too narrow → misses real reformulations. Too wide → false positives |
| A4 | 40% Jaccard similarity threshold correctly identifies rephrasing vs. new queries | Manually calibrated | Threshold too low → false positives. Too high → misses legitimate reformulations |

## Spec vs Reality Audit Log
| Date | Finding | Action taken |
|---|---|---|
| 2026-05-20 | Initial spec created | Search supports dual-strategy routing |
| 2026-05-21 | Code implements 3-tier routing (Tier 1/2/3) — spec only documented 2-tier | Updated Step 3 to document all three tiers, added Tier 3 test case |
| 2026-05-21 | Code implements reformulation detection in `logQuery()` — spec had no mention | Added reformulation detection to Step 4, added TC-07 |
| 2026-05-21 | Code uses "sync on Teams" not "sync on Slack" — spec didn't specify | Updated draft message reference, added TC-08 |
| 2026-05-21 | Code supports Azure OpenAI engine via headers — spec only mentioned Gemini | Added Azure to actors table and Step 2 |
| 2026-05-21 | `escapeHtml()` no longer encodes single quotes/slashes — spec referenced old behavior | Updated to reflect current sanitization rules |
