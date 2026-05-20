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
*   **Description**: Marks a feedback correction as resolved/applied.
*   **Payload**: `{"feedbackId": "fb_1716243884000"}`

### 4. Instrumentation Metrics Endpoint
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
1.  **Tokenization & Lowercasing**: Queries and document chunks are split into words and stripped of punctuation. Common English stop words ("the", "is", "at", "which", etc.) are removed.
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
