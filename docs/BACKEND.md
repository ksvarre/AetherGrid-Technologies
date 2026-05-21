# Backend Architecture & Reference — AetherGrid Knowledge Tracer

This document describes the structure, endpoints, parsing modules, and database structures that power the backend API service.

---

## 🛠️ Technology Stack & Dependencies
*   **Runtime Environment**: Node.js (v18.0+)
*   **API Framework**: Express with TypeScript (`ts-node` for local execution).
*   **Security Middleware**:
    *   `helmet` — Sets secure HTTP response headers (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, etc.).
    *   `express-rate-limit` — Request throttling with configurable windows per route tier (general, query, admin).
*   **Key Parsing Heuristics**:
    *   `dialogue/dynamic-metadata` (internal): Programmatically parses raw conversational Markdown transcripts to extract dates from filename structures, scans dialogues for unique speaker signatures to construct the attendees array, classifies domains using vocabulary rules, and identifies authors from the first dialogue speakers. Maintains fallback compatibility for manual YAML frontmatter blocks.
    *   `office-parsers` (Mammoth, OfficeParser, SheetJS): Actively parses Word (`.docx/.doc`), PowerPoint (`.pptx/.ppt`), and Excel (`.xlsx/.xls`) files, applying strict magic-byte validation and 50MB security gates. Tabular Excel data is formatted into clean high-contrast Markdown tables.
*   **Local Storage**: Standard file-based JSON streams (acting as the lightweight transactional DB).

---

## 🔌 API Endpoints Reference

### 1. Ingestion Endpoint
*   **`POST /api/ingest`**
*   **Description**: Triggers a deep scan of the `/data/transcripts/` directory. It parses raw Markdown (`.md`) files exclusively, dynamically derives structural metadata from meeting dialogue markers and filenames (with frontmatter fallback support), builds semantic text chunks, and commits them to the in-memory document store.
*   **Middleware Chain**: `requireAuth` → `adminLimiter` (5 req/min)
    *   `requireAuth`: Optional API key authentication — validates the `x-api-key` header against the `API_AUTH_KEY` environment variable when set.
    *   `adminLimiter`: Strict rate limit of 5 requests per minute to protect expensive ingestion operations.
*   **Error Handling**: All `500` responses are passed through `sanitizeError()` to strip internal file paths and stack traces.
*   **Payload**: None (scans workspace filesystem).
*   **Response**:
    ```json
    {
      "success": true,
      "message": "Ingested 66 chunks successfully from transcripts.",
      "count": 66,
      "chunksCount": 66
    }
    ```

### 2. Search & Query Endpoint
*   **`POST /api/query`**
*   **Description**: Receives a natural language question, logs it to detect consecutive Jaccard query reformulations, processes semantic matching using the current `INLPEngine` strategy, and applies a **3-Tier Cognitive Routing engine**. It returns precise source citations, or falls back to domain-based expert routing if confidence is low (< 0.15) and a domain matches. If confidence is low (< 0.15) and the query is out of scope (off-topic), it gracefully null-routes the request.
*   **Middleware Chain**: `requireAuth` → `queryLimiter` (30 req/min)
    *   `requireAuth`: Optional API key authentication via `x-api-key` header.
    *   `queryLimiter`: Rate limit of 30 requests per minute for query operations.
*   **Input Validation**: Query length is capped at **500 characters**. Requests exceeding this limit receive a `400 Bad Request` response.
*   **Error Handling**: All `500` responses are passed through `sanitizeError()` to strip internal file paths and stack traces.
*   **Payload**:
    ```json
    {
      "query": "What are the core thermal testing results for Project Helium edge nodes?"
    }
    ```
*   **Response**:
    ```json
    {
      "answer": "Project Helium edge nodes were tested for thermal resilience. Under heavy CPU load (100%), the core temperature reached 82°C with active fans, while passive thermal cooling led to throttling at 91°C [1]. Amira Patel noted that safety guidelines limit operating temps to 85°C [2].",
      "confidenceScore": 0.88,
      "domain": "Project Helium",
      "priority": "High",
      "citations": [
        {
          "chunkId": "helium_tests_c1",
          "fileName": "helium_hardware_thermal_tests.xlsx",
          "filePath": "/data/documents/helium_hardware_thermal_tests.xlsx",
          "author": "Marcus Vance",
          "attendees": [],
          "date": "2026-04-12",
          "matchedSnippet": "Test ID 04: Heavy CPU Load (100%), Core Temperature: 82°C, Cooling: Active Fan, Status: Pass; Test ID 05: Heavy CPU Load (100%), Core Temperature: 91°C, Cooling: Passive, Status: Throttling."
        },
        {
          "chunkId": "sop_safety_c3",
          "fileName": "substation_operations_compliance_sop.docx",
          "filePath": "/data/documents/substation_operations_compliance_sop.docx",
          "author": "Amira Patel",
          "attendees": [],
          "date": "2026-03-10",
          "matchedSnippet": "Section 4.2 Thermal Compliance: Substations operating temperature must remain below 85°C. Any node exceeding this must trigger automated system throttling."
        }
      ]
    }
    ```

### 3. Feedback Loop Endpoint
*   **`POST /api/feedback`**
*   **Description**: Records user corrections or rejections of query responses, saving them to `data/db/feedback.json` for review by team leads.
*   **Middleware Chain**: `requireAuth`
    *   `requireAuth`: Optional API key authentication via `x-api-key` header.
*   **Input Validation**:
    *   `status` field is validated against a strict enum: `correct`, `incorrect`, `correction`, `rejection`. Invalid values return `400 Bad Request`.
    *   `query` field is type-checked (must be a string) and length-capped.
*   **Error Handling**: All `500` responses are passed through `sanitizeError()` to strip internal file paths and stack traces.
*   **Payload**:
    ```json
    {
      "query": "What is the MAE threshold for Project Quantum forecasting?",
      "answer": "The MAE threshold is 1.5 MW according to general specifications.",
      "confidenceScore": 0.55,
      "status": "correction", 
      "correctedAnswer": "Actually, Dr. Rostova updated the MAE threshold to 1.2 MW in the May model benchmark Excel spreadsheet."
    }
    ```
*   **Response**:
    ```json
    {
      "success": true,
      "feedbackId": "fb_1716243884000"
    }
    ```

*   **`GET /api/feedback`**
*   **Description**: Retrieves the list of user corrections, rejections, and gaps. Used to populate the Lead Review Audit Queue.
*   **Response**:
    ```json
    [
      {
        "id": "fb_1716243884000",
        "query": "What is the MAE threshold...",
        "answer": "The MAE threshold is 1.5 MW...",
        "confidenceScore": 0.55,
        "status": "correction",
        "correctedAnswer": "Actually, Dr. Rostova updated the MAE threshold to 1.2 MW...",
        "timestamp": "2026-05-20T22:24:44.000Z",
        "resolved": false
      }
    ]
    ```

*   **`POST /api/feedback/resolve`**
*   **Description**: Marks a feedback correction as resolved/applied and triggers **Dynamic Self-Healing Search Sync**.
*   **Middleware Chain**: `requireAuth` → `adminLimiter` (5 req/min)
    *   `requireAuth`: Optional API key authentication via `x-api-key` header.
    *   `adminLimiter`: Strict rate limit of 5 requests per minute to protect administrative operations.
*   **Input Validation**: `feedbackId` must be a string (type validation enforced; non-string values return `400 Bad Request`).
*   **Error Handling**: All `500` responses are passed through `sanitizeError()` to strip internal file paths and stack traces.
*   **Payload**: `{"feedbackId": "fb_1716243884000_123"}`
*   **Behavior**: When resolved, the system dynamically generates a virtual `DocumentChunk` containing the user's approved `correctedAnswer`, inherits attributes like date and domain, and merges/injects it directly into the active in-memory retrieval index (`documentIndex`). This immediately updates search results without server downtime.
*   **Response**:
    ```json
    {
      "success": true,
      "message": "Feedback resolved and dynamically synchronized into the active search index."
    }
    ```

### 4. Secure Document Download Bridge
*   **`GET /api/documents/download/:filename`**
*   **Description**: Securely downloads a physical source document or transcript from the database by its filename.
*   **Parameters**:
    *   `:filename` (string, path parameter): The filename of the physical asset (e.g. `helium_hardware_thermal_tests.xlsx`).
*   **Security Controls**:
    *   Neutralizes directory traversal inputs via `path.basename`.
    *   Asserts that the resolved absolute path starts with the absolute workspace root (`process.cwd()`), rejecting illegal access attempts with a `403 Forbidden` status.
*   **Response**: Binary file stream of the requested document, or JSON error details.

### 5. Instrumentation Metrics Endpoint
*   **`GET /api/metrics`**
*   **Description**: Calculates the running system diagnostics, aggregated health levels, and query logs over the past 30 days to check for performance degradation.
*   **Response**:
    ```json
    {
      "rollingAvgConfidence": 0.76,
      "rejectionRate": 0.12,
      "reformulationRate": 0.07,
      "systemHealthIndex": 0.71,
      "healthLevel": "Healthy",
      "totalQueriesCount": 84,
      "correctionsCount": 10,
      "gapHotspots": [
        { "domain": "Project Quantum", "count": 6 },
        { "domain": "Project Helium", "count": 4 }
      ]
    }
    ```

### 6. Reformulations List Endpoint
*   **`GET /api/reformulations`**
*   **Description**: Retrieves the list of consecutive query reformulations tracked by the sliding-window Jaccard algorithm (word similarity >= 40% within 5 minutes) to feed the admin drill-down panels.
*   **Response**:
    ```json
    [
      {
        "previousQuery": "how to calibrate thermal sub",
        "currentQuery": "thermal substation calibration steps",
        "similarity": 0.57,
        "timestamp": "2026-05-21T04:26:42.000Z"
      }
    ]
    ```

---

## 🔍 Offline Search Retrieval Logic (The Local Engine)
When executing in local **Offline Mode**, the backend processes queries through a custom-built, lightweight retrieval engine:
1.  **Tokenization, Suffix Stemming & Lowercasing**: Queries and document chunks are split into words, stripped of punctuation, and filtered to remove common English stop words ("the", "is", "at", "which", etc.). A grammatical suffix stemming filter is then applied to normalize common trailing suffix endings (`"s"`, `"es"`, `"ies"`, `"ing"`, `"ed"`), ensuring robust singular/plural query matches.
2.  **Conversational Filler Word Downweighting**: Conversational transition terms (e.g., `says`, `said`, `asks`, `talk`, `spoke`) are downweighted by 90% in the IDF scoring loop to prevent filler words from inflating document scores.
3.  **Specialized Entity & Name Boosting**: Query terms matching key project names (Quantum, Helium, Horizon) or employee first/last names (e.g. `marcus`, `vance`, `amira`, `patel`, `david`, `kross`, `sarah`, `chen`, `elena`, `rostova`) receive a double TF-IDF scoring boost.
4.  **Dialogue Speaker & Topic Affinity Boosts**:
    *   **Speaker Attribution**: Extracted via `getChunkSpeaker` which parses raw dialogue headers (e.g. `**Marcus Vance**: ...`) to identify the true dialogue speaker instead of falling back to the meeting facilitator.
    *   **Baseline Speaker Match**: $+0.5$ added to the chunk's score if the query keywords match the active dialogue speaker's name.
    *   **Technical Topic Affinity**: $+1.5$ per query keyword matching terms in the dialogue text (excluding filler words and speaker names), ensuring highly targeted speaker-to-topic correlation.
    *   **Attendee Presence Match**: $+0.1$ added if a query speaker name is listed in the chunk's attendees array.
5.  **Document Density & File Type Calibration**:
    *   **Excel (`.xlsx`)**: $+0.8$ baseline boost (highest density per row, e.g. grids/pricing/testing logs).
    *   **PowerPoint (`.pptx`)**: $+0.6$ baseline boost (synthesized slide bullet points).
    *   **Word (`.docx`)**: $+0.4$ baseline boost (specification paragraphs).
    This calibration levels the playing field against long conversational meeting transcripts (which receive multiple speaker/dialogue keyword boosts), ensuring natural, generic terms successfully bubble high-priority Office specs to the top without needing overly unique or specific IDs.
6.  **Refined Answer Synthesis**:
    *   If matching scores are high, the system compiles the text content of the top-ranking chunks.
    *   **Entity-Weighted Snippet Selector**: Extracts matching sentences/lines (split by `.`, `!`, `?`, and `\n`). The matching tokens are weighted (technical terms weight 3.0, speaker names 1.0, fillers 0.1), and the highest weighted sentence is chosen. This guarantees that technical context (like *"bricking the node"*) is quoted instead of dialogue headers like *"Marcus Vance: Good point"*.
    *   It pieces them together into a readable response paragraph using structured text-connectors and inline numeric citations (`[1]`, `[2]`), and uses double-asterisk template wrappers (`**Based on ...:**`) around document attribution headers to enable clean downstream visual partitioning.
    *   If no matching chunks score above the threshold, it sets confidence to `< 0.35` and triggers the suggested routing fallback.


---

## 🛡️ STRIDE Security Hardening, API Protection & Data Robustness
To transition AetherGrid to an enterprise-ready posture, we implemented a comprehensive, layered security and reliability architecture:
1.  **Absolute Path Virtualization**: Absolute local file system directories (e.g., `d:\Antigravity Projects\...`) are stripped inside `parser.ts` using `virtualizePath`. These are replaced by unified, forward-slash, workspace-relative virtual paths (e.g., `data/documents/helium_hardware_thermal_tests.xlsx`). This ensures no physical paths leak through the search API or citation markers.
2.  **Stored XSS Prevention Gate**: Incoming query logs and operator correction feedback are sanitized at the database/write layer in `database.ts` via `escapeHtml()`. Characters like `<`, `>`, `&`, `"`, `'`, and `/` are fully encoded to prevent HTML injection and malicious script execution in lead dashboards.
3.  **Atomic File Transactions**: Database and cache updates are written atomically using `safeWriteJson()`. Files are written to a temporary file (`.tmp`) first, and then renamed synchronously. This prevents partial writes and database corruption under high concurrent operations.
4.  **HTTP Security Headers**: `helmet()` middleware sets secure response headers including `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security` (HSTS), and `Referrer-Policy: no-referrer`, hardening the server against MIME sniffing, clickjacking, and referrer leakage.
5.  **CORS Origin Restriction**: A strict whitelist of localhost origins (`http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:5173`) replaces the wildcard `*` CORS policy, preventing unauthorized cross-origin requests from unknown domains.
6.  **3-Tier Rate Limiting**: Request throttling via `express-rate-limit` enforces three escalating tiers — General: 60 req/min (all routes), Query: 30 req/min (`/api/query`), Admin: 5 req/min (`/api/ingest`, `/api/feedback/resolve`) — preventing abuse and protecting expensive operations.
7.  **Request Size Gate**: `express.json({ limit: '100kb' })` rejects oversized request payloads with an HTTP `413 Payload Too Large` response before any processing occurs, mitigating memory exhaustion attacks.
8.  **Query Length Cap**: Natural language queries are capped at **500 characters**. Requests exceeding this limit are rejected with a `400 Bad Request`, preventing NLP tokenization denial-of-service from excessively long input strings.
9.  **Prompt Injection Defense**: `sanitizeForLLM()` strips known injection patterns (e.g., `ignore previous instructions`, `system:`) from user queries before they reach the LLM. XML delimiters (`<user_query>`) isolate user input within the prompt template. `validateLLMResponse()` constrains LLM output length and format, rejecting responses that deviate from expected structure.
10. **Error Sanitization**: `sanitizeError()` intercepts all `500 Internal Server Error` responses and strips file paths, stack traces, and internal module names before returning a generic error message to the client, preventing information disclosure.
11. **Optional API Key Auth**: When the `API_AUTH_KEY` environment variable is set, the `requireAuth` middleware validates the `x-api-key` request header on all protected endpoints. When unset, authentication is bypassed for local development convenience.
12. **Input Validation**: Feedback `status` is validated against a strict enum (`correct`, `incorrect`, `correction`, `rejection`). `feedbackId` undergoes type checking (must be string). Query `query` fields are type-checked and length-capped. Invalid inputs return `400 Bad Request` with descriptive error messages.
13. **FIFO Log Rotation**: `feedback.json` is capped at **1,000 entries** and `queries_log.json` at **2,000 entries**. Oldest records are evicted in FIFO order on write, preventing unbounded storage growth and ensuring predictable memory usage.
14. **Frontend CSP**: A `Content-Security-Policy` meta tag in the frontend restricts `script-src`, `style-src`, and `connect-src` to known safe origins, mitigating cross-site scripting and unauthorized API connections from injected scripts.

---

## 🚀 High-Speed Ingestion Caching (Warm Boots in <3ms)
To optimize server boots and avoid scanning files repeatedly, the ingestion pipeline utilizes a structured caching engine:
1.  **Cache Schema**: Search chunks are serialized to `data/db/indexed_chunks.json` under an `IngestionCache` type containing file paths, file sizes, modification timestamps (`mtimeMs`), and their parsed `DocumentChunk` arrays.
2.  **Warm-Cache Checking**: On server boot, `ParserService.ingestAll()` retrieves filesystem metadata for Markdown transcripts inside `data/transcripts/`. It compares `mtimeMs` and `size` against the cache.
    *   **Cache Hit**: If unchanged, parser execution is bypassed, loading chunks directly from the cached JSON index in **2-3ms** (a 99% speedup).
    *   **Cache Miss**: If modified, only that file is parsed and its cache entry is updated.
3.  **Self-Healing & Office Pruning**: Files deleted from `/data` are automatically pruned on server boot. Additionally, any legacy office documents (e.g. Word, Excel) previously cached are automatically identified as out of scope and pruned from `indexed_chunks.json` to keep the RAM index 100% transcript-focused.
