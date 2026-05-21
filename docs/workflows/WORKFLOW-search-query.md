# WORKFLOW: Semantic Search & Retrieval
**Version**: 0.1
**Date**: 2026-05-20
**Author**: Workflow Architect
**Status**: Approved

## Overview
This workflow describes how a natural language question submitted by an employee is processed by the search API. It runs the query against the memory index using either the cloud-based **Google Gemini RAG strategy** or the local **Offline TF-IDF strategy**. It compiles precise inline citation indexes, scores confidence, and appends dynamic expert routing templates if confidence is low.

## Actors
| Actor | Role in this workflow |
|---|---|
| Employee (User) | Submits natural language question from the UI search console |
| Express Server | Intercepts HTTP request, coordinates NLP engines and loggers |
| `OfflineNLPEngine` | Alternative strategy: executes local TF-IDF, boosts exact entities, synthesizes static answer |
| `GeminiNLPEngine` | Primary strategy: selects top chunks, calls `gemini-2.5-flash` API to return a structured JSON |
| `RoutingService` | Generates a custom expert profile, rationale, and drafted Slack message for low-confidence queries |

## Prerequisites
- In-memory `documentIndex` must not be empty.
- For Cloud Strategy: `GEMINI_API_KEY` must be configured and valid in `.env`.

## Trigger
- User clicks "Search" button or presses Enter inside the `SearchConsole` input field (`POST /api/query`).

---

## Workflow Tree

### STEP 1: Query Validation
**Actor**: Express Server
**Action**: Validates that query is present, is a non-empty string, and doesn't exceed 500 characters.
**Timeout**: 1s
**Input**: `{ query: string }`
**Output on SUCCESS**: Valid query -> GO TO STEP 2
**Output on FAILURE**:
  - `FAILURE(invalid_query)`: Empty query or wrong type -> [recovery: Return 400 Bad Request status + error JSON, no further execution]

**Observable states during this step**:
  - **Operator/User sees**: Loading typing state indicator.
  - **Database**: Unchanged.
  - **Logs**: `[Server] Query received: "What is MAE?"`

---

### STEP 2: Strategic Retrieval Execution
**Actor**: `INLPEngine` (Gemini or Offline strategy depending on environment configuration)
**Action**: Scans `documentIndex` and matches query terms:
  - **Cloud Mode (`GeminiNLPEngine`)**: Dense keyword ranking -> extracts top 6 context chunks -> compiles prompt -> executes API call -> returns structured JSON.
  - **Offline Mode (`OfflineNLPEngine`)**: Porter-style tokenizer -> computes Term Frequency (TF) and Inverse Document Frequency (IDF) -> matches top 3 chunks -> extracts matching sentences -> synthesizes paragraph with static tags.
**Timeout**: 15s (Cloud), 1s (Offline)
**Input**: `(query, documentIndex)`
**Output on SUCCESS**: `QueryResponse` (answer, confidenceScore, citations) -> GO TO STEP 3
**Output on FAILURE**:
  - `FAILURE(api_key_expired)`: Cloud mode fails due to Gemini API authorization error -> [recovery: Log warning, automatically fall back to `OfflineNLPEngine`, execute local TF-IDF, GO TO STEP 3]
  - `FAILURE(network_timeout)`: Cloud API takes > 10s -> [recovery: Log timeout warning, fallback to `OfflineNLPEngine`, execute local TF-IDF, GO TO STEP 3]

**Observable states during this step**:
  - **User sees**: Pulsing glow on search bar / typing text effect.
  - **Logs**: `[NLP] Running Offline TF-IDF search for: "thermals"`

---

### STEP 3: Confidence Threshold Routing
**Actor**: `RoutingService` & Express Server
**Action**: Checks the returned `confidenceScore` ($C_s$):
  - **High-Confidence Path ($C_s \ge 0.40$)**: Proceed directly to return response.
  - **Low-Confidence Path ($C_s < 0.40$)**: Invokes `routingService.generateRouting()` to map keywords to dominant expert domain, compile custom rationale, and draft Slack message template.
**Timeout**: 1s
**Input**: `QueryResponse`
**Output on SUCCESS**: `FinalQueryResponse` -> GO TO STEP 4
**Output on FAILURE**:
  - `FAILURE(routing_error)`: Failed to identify domain or map expert -> [recovery: Apply absolute fallback expert (Marcus Vance, VP of Engineering), build general draft, GO TO STEP 4]

**Observable states during this step**:
  - **User sees**: Typing indicator finishes.
  - **Logs**: `⚠️ Low confidence search result (0.24). Invoking routing generator.`

---

### STEP 4: Persist Query Event & Respond
**Actor**: `DatabaseService` & Express Server
**Action**: Logs query parameters, calculated confidence, domain, and timestamp into `data/db/queries_log.json` for rolling telemetry calculation. Sends final JSON payload to user frontend.
**Timeout**: 1s
**Input**: `FinalQueryResponse`
**Output on SUCCESS**: HTTP 200 JSON -> Terminate Workflow.
**Output on FAILURE**:
  - `FAILURE(log_write_error)`: Unable to write to `queries_log.json` -> [recovery: Log warning to console, do not fail query, return HTTP 200 payload to user successfully]

**Observable states during this step**:
  - **User sees**: Response paragraph displayed with clickable citation anchors `[1]`, `[2]`. If low-confidence, the suggested expert routing panel slides in from the right.
  - **Database**: New query log record appended to `queries_log.json`.
  - **Logs**: `[Metrics] Logged query event. Confidence: 0.88, Domain: Project Helium`

---

## State Transitions
No state transitions occur on indexed documents or feedback items (this is a read-only retrieval workflow).

---

## Handoff Contracts

### Frontend Client -> Express `/api/query`
**Payload**:
```json
{
  "query": "What is the MAE limit?"
}
```
**Success Response**:
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
**Timeout**: 20s

---

## Cleanup Inventory
None.

---

## Test Cases

| Test | Trigger | Expected behavior |
|---|---|---|
| TC-01: Valid query (High Confidence) | Send query "MAE forecasting Rostova" | Returns answer, confidence > 0.60, no routing panel |
| TC-02: Valid query (Low Confidence) | Send query "random garbage text" | Returns confidence < 0.35, returns SuggestedRouting panel |
| TC-03: Empty query | Send `{ query: "" }` | Returns 400 Bad Request, error message |
| TC-04: API key fallback | Expire Gemini API key, search | Automatically fails over to Offline TF-IDF engine, returns local matching |

---

## Assumptions
| # | Assumption | Where Verified | Risk if Wrong |
|---|---|---|---|
| A1 | Gemini API key in env represents a valid billing account | Not verified | Searches crash/hang if key gets rejected |
| A2 | User query length doesn't overflow memory bounds | Verified: limit applied | Memory exhaust if user sends massive text |

## Spec vs Reality Audit Log
| Date | Finding | Action taken |
|---|---|---|
| 2026-05-20 | Initial spec created | Search supports dual-strategy routing |
