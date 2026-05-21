# Backend Architecture & Reference — AetherGrid Knowledge Tracer

This document describes the structure, endpoints, parsing modules, and database structures that power the backend API service.

---

## 🛠️ Technology Stack & Dependencies
*   **Runtime Environment**: Node.js (v18.0+)
*   **API Framework**: Express with TypeScript (`ts-node` for local execution).
*   **Key Parsing Libraries**:
    *   `mammoth`: Parses Word files (`.docx`) cleanly, extracting text elements.
    *   `xlsx` (SheetJS): Parses Excel spreadsheets (`.xlsx`) sheet-by-sheet, returning tabular strings.
    *   `officeparser`: Lightweight pure-JS zip-extractor that parses slide layouts from PowerPoint (`.pptx`).
*   **Local Storage**: Standard file-based JSON streams (acting as the lightweight transactional DB).

---

## 🔌 API Endpoints Reference

### 1. Ingestion Endpoint
*   **`POST /api/ingest`**
*   **Description**: Triggers a deep scan of `/data/transcripts` and `/data/documents`. It extracts text, derives structural metadata, builds semantic text chunks, and commits them to the in-memory document store.
*   **Payload**: None (scans workspace filesystem).
*   **Response**:
    ```json
    {
      "success": true,
      "message": "Ingested 24 documents successfully.",
      "count": 24,
      "chunksCount": 112
    }
    ```

### 2. Search & Query Endpoint
*   **`POST /api/query`**
*   **Description**: Receives a natural language question, processes semantic matching using the current `INLPEngine` strategy, scores confidence, compiles source citations, and appends Suggested Routing if confidence is $< 0.40$.
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
      "systemHealthIndex": 0.67,
      "healthLevel": "Warning",
      "totalQueriesCount": 84,
      "correctionsCount": 10,
      "gapHotspots": [
        { "domain": "Project Quantum", "count": 6 },
        { "domain": "Project Helium", "count": 4 }
      ]
    }
    ```

---

## 🔍 Offline Search Retrieval Logic (The Local Engine)
When executing in local **Offline Mode**, the backend processes queries through a custom-built, lightweight retrieval engine:
1.  **Tokenization, Suffix Stemming & Lowercasing**: Queries and document chunks are split into words, stripped of punctuation, and filtered to remove common English stop words ("the", "is", "at", "which", etc.). A Porter-style stemming filter is then applied to normalize common trailing suffix endings (`"s"`, `"es"`, `"ing"`, `"ed"`), ensuring robust singular/plural query matches.
2.  **TF-IDF Weighting**: 
    *   **Term Frequency (TF)**: Frequency of terms in a chunk divided by total words in that chunk.
    *   **Inverse Document Frequency (IDF)**: $\log(1 + N / (1 + n_t))$, where $N$ is total chunks, and $n_t$ is count of chunks containing term $t$.
3.  **BM25 Term Match**: Chunk scores are calculated using a traditional search matching matrix.
4.  **Keyword Matching Boost**: Chunks containing exact phrases or specialized names matching query tokens receive a score boost (e.g. "Rostova", "Helium", "MAE").
5.  **Answer Synthesis**:
    *   If matching scores are high, the system compiles the text content of the top-ranking chunks.
    *   It extracts matching sentences containing the query keywords.
    *   It pieces them together into a readable response paragraph using structured text-connectors.
    *   It places inline numeric citation markers corresponding to the chunk indices.
    *   If no matching chunks score above the threshold, it sets confidence to `< 0.35` and triggers the suggested routing fallback.

---

## 🛡️ STRIDE Security Hardening & Data Robustness
To transition AetherGrid to an enterprise-ready posture, we implemented three key security and reliability barriers:
1.  **Absolute Path Virtualization**: Absolute local file system directories (e.g., `d:\Antigravity Projects\...`) are stripped inside `parser.ts` using `virtualizePath`. These are replaced by unified, forward-slash, workspace-relative virtual paths (e.g., `data/documents/helium_hardware_thermal_tests.xlsx`). This ensures no physical paths leak through the search API or citation markers.
2.  **Stored XSS Prevention Gate**: Incoming query logs and operator correction feedback are sanitized at the database/write layer in `database.ts` via `escapeHtml()`. Characters like `<`, `>`, `&`, `"`, `'`, and `/` are fully encoded to prevent HTML injection and malicious script execution in lead dashboards.
3.  **Atomic File Transactions**: Database and cache updates are written atomically using `safeWriteJson()`. Files are written to a temporary file (`.tmp`) first, and then renamed synchronously. This prevents partial writes and database corruption under high concurrent operations.

---

## 🚀 High-Speed Ingestion Caching (Warm Boots in <3ms)
Parsing massive PowerPoint decks, multi-tab Excel files, and Word documents via SheetJS and Mammoth is highly intensive. To optimize server boots, the ingestion pipeline utilizes a structured caching engine:
1.  **Cache Schema**: Search chunks are serialized to `data/db/indexed_chunks.json` under an `IngestionCache` type containing file paths, file sizes, modification timestamps (`mtimeMs`), and their parsed `DocumentChunk` arrays.
2.  **Warm-Cache Checking**: On server boot, `ParserService.ingestAll()` retrieves filesystem metadata for transcripts and documents. It compares `mtimeMs` and `size` against the cache.
    *   **Cache Hit**: If unchanged, parser execution is bypassed, loading chunks directly from the cached JSON index in **3ms** (a 99.2% speedup from the standard 387ms cold crawl).
    *   **Cache Miss**: If modified, only that file is parsed and its cache entry is updated.
3.  **Self-Healing Pruning**: Files deleted from `/data` are automatically pruned from the cache records on server boot, ensuring stale or orphaned search references never persist.
