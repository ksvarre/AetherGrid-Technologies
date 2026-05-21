# System Architecture — AetherGrid Knowledge Tracer

This document outlines the core architecture, data ingestion flows, and search pipelines that enable intelligent knowledge tracing across AetherGrid Technologies.

---

## 🏗️ Architectural Overview
AetherGrid Knowledge Tracer is built as a highly responsive, modern, self-contained application using a **Node.js Express backend** and a **React single-page frontend**. 

```mermaid
graph TD
    %% Ingestion Pipeline
    subgraph Ingestion ["Secure Multi-Format Ingestion Pipeline"]
        MD_Files["Markdown Transcripts (.md)"] --> MD_P["MD Dynamic Metadata Dialogue Parser"]
        DOCX_Files["Word Specifications (.docx)"] --> Word_P["Mammoth Paragraph Parser"]
        PPTX_Files["PowerPoint Decks (.pptx)"] --> PPTX_P["OfficeParser Slide Extractor"]
        XLSX_Files["Excel Sheets (.xlsx)"] --> XLSX_P["SheetJS Tabular Cell Row Parser"]
        
        MD_P --> MD_SecurityGate["MD Security Gate<br>(50MB File Size Limit)"]
        Word_P & PPTX_P & XLSX_P --> SecurityGate["Office Security Gate<br>(50MB Limit & Magic Byte Header Check)"]
        MD_SecurityGate & SecurityGate --> CacheCheck{"Warm Boot Cache<br>(indexed_chunks.json)"}
        CacheCheck -->|Cache Hit| DocIndex["Local In-Memory Document Store"]
        CacheCheck -->|Cache Miss| RawParse["Execute Fresh Parser & Extract Metadata"]
        RawParse --> DocIndex
    end

    %% Search and Retrieval
    subgraph SearchAPI ["3-Tier Cognitive Routing & Search Scoping Engine"]
        UserQuery["User Natural Language Question"] --> RefCheck["Search Reformulation Tracker<br>(Jaccard Similarity Check in 5m Window)"]
        RefCheck --> QueryParser["Search & Semantic Retrieval"]
        DocIndex --> QueryParser
        
        QueryParser --> NLPEngine["INLPEngine (Strategy Pattern)"]
        
        NLPEngine -->|Offline Mode| LocalNLP["Local TF-IDF, Stemmer, & Entity Boosting"]
        NLPEngine -->|Cloud Mode| CloudNLP["Gemini or Azure OpenAI LLM BYOK Strategy"]
        
        LocalNLP & CloudNLP --> Scorer["Confidence & Trust Scorer"]
        
        Scorer --> RouteDecision{"3-Tier Scoping Route Decision"}
        RouteDecision -->|Tier 1: Confidence >= 0.15| HighConf["Response with Precise Inline Citations"]
        RouteDecision -->|Tier 2: Confidence < 0.15 & Domain Match| LowConf["Domain Fallback Routing: suggested Expert Card + Teams message template"]
        RouteDecision -->|Tier 3: Confidence < 0.15 & Out-of-Scope| NullRoute["Null Route: Off-topic Query Filtered out gracefully"]
    end

    %% Self Healing
    subgraph SelfHealing ["Self-Healing Feedback Loop & Telemetry Hub"]
        UIFeedback["User Corrections / Rejections"] --> FeedbackAPI["POST /api/feedback"]
        FeedbackAPI --> LocalJSONDB[("JSON File DB (feedback.json)")]
        
        LocalJSONDB --> QualityMon["Rolling Health Aggregator<br>(Health, Confidence, Rejection, Reformulation)"]
        QualityMon --> HealthDashboard["System Health Monitor Display"]
        
        FeedbackAPI -->|Approve Correction| RAMSync["Dynamic Memory Injection<br>(Live index sync without reboot)"]
        RAMSync --> DocIndex
    end
```

---

## 🔒 The Strategy Pattern for corporate Deployment
To satisfy the requirement that the application can be seamlessly deployed at a company without using personal credentials, we implement a **Strategy Pattern** for natural language understanding and synthesis.

We declare the typescript interface `INLPEngine`:
```typescript
export interface DocumentChunk {
  id: string;
  filePath: string;
  fileName: string;
  fileType: 'transcript' | 'docx' | 'pptx' | 'xlsx';
  content: string;
  author: string;
  attendees: string[];
  date: string;
  domain: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface Citation {
  chunkId: string;
  fileName: string;
  filePath: string;
  author: string;
  attendees: string[];
  date: string;
  matchedSnippet: string;
}

export interface SuggestedRouting {
  recipientName: string;
  recipientEmail: string;
  rationale: string;
  draftedQuestion: string;
}

export interface QueryResponse {
  answer: string;
  confidenceScore: number;
  citations: Citation[];
  suggestedRouting?: SuggestedRouting;
  domain: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface INLPEngine {
  extractMetadata(fileName: string, content: string): Promise<Partial<DocumentChunk>>;
  queryDocuments(query: string, chunks: DocumentChunk[]): Promise<QueryResponse>;
}
```

The system initializes the engine using an environmental switch or transient request-scoped headers:
- **`OfflineNLPEngine`**: A zero-dependency engine. It tokenizes queries and contents, applies a Porter stemming filter, calculates a local TF-IDF similarity matrix, and applies a **Document Density relevance boost** to structured Office chunks (`+0.8` for xlsx, `+0.6` for pptx, `+0.4` for docx) to prevent short, dense cells and bullet points from being penalized by conversational transcripts. It then compiles the most entity-weighted matching sentences as inline citations and forms answers using dynamic synthesis templates.
- **`GeminiNLPEngine`**: Operates via `@google/genai` (Google's standard SDK). It chunks text, generates embeddings, computes similarity for semantic retrieval, and sends top context nodes to `gemini-2.5-flash` to return a fully realized structured response including inline citation indexes.
- **`AzureOpenAINLPEngine`**: Integrates with enterprise-configured Azure OpenAI deployments using secure HTTPS REST requests, facilitating corporate Bring-Your-Own-Key (BYOK) configurations where all parsing and querying are powered by the company's Azure LLM.

This abstraction allows an IT operations team to easily swap this engine for an internal corporate vector DB (e.g. Pinecone/PgVector) or corporate LLM endpoint (Azure OpenAI/Internal Llama model) by implementing `INLPEngine` in a single file!


---

## 🔎 Traceability and Routing Logic (Exercise 2)

### Citation Mapping
Every claim in a search response must map back to its origin. To do this, the retrieval layer preserves the original `DocumentChunk` object inside a `Citation` array. Clickable reference anchors (e.g., `[1]`, `[2]`) in the synthesized response text correspond exactly to indices in this array. Clicking an anchor highlights the source filename, the primary author/attendees, the date, and the exact text snippet in the UI.

### Low-Confidence Routing Strategy
When the search engine processes a query, it computes a relative relevance score ($C_s \in [0, 1]$). If $C_s < 0.40$:
1.  **Extract Query Entities**: It maps key terms in the query to AetherGrid product domains (e.g., "thermals" $\rightarrow$ Project Helium; "MAE" $\rightarrow$ Project Quantum; "Kubernetes" $\rightarrow$ DevOps).
2.  **Evaluate Expert Directory**: It queries the topic expert directory to locate the employee mapped to the dominant product domain.
3.  **Calculate Rationale**: It scans the index to find how many documents the expert has written or how many meetings they've attended concerning that topic.
4.  **Draft Question**: It builds a professional Slack/Email template inserting the expert's name, their topic domain, and the query terms, presenting it as an editable widget in the UI.

---

## 📊 Instrumentation & Self-Healing Health Score
To track quality degradation (e.g., if garbage text is added or the algorithm begins misinterpreting search intents), the backend calculates rolling system health parameters dynamically at `/api/metrics`:

$$\text{User Rejection Rate} (R) = \frac{\text{Count of Corrections & Rejections in last 30 days}}{\text{Total Queries in last 30 days}}$$

$$\text{Average Search Confidence} (C) = \frac{1}{N} \sum_{i=1}^{N} \text{Confidence Score}_i$$

$$\text{System Health Index} (H) = C \times (1 - R)$$

- **Health Status Evaluation**:
  - $H \ge 0.70$: **System Healthy** (Green glowing status).
  - $0.55 \le H < 0.70$: **Moderate Degradation Warning** (Amber glow). Triggered when rejections increase or index searches are yielding low-confidence results, prompting the team lead to review gaps.
  - $H < 0.55$: **Critical Attention Required** (Red flashing glow). Indicates high user frustration or severely outdated knowledge.

### ⚙️ Telemetry Starting Metric & Calibration Design
To prevent false-positive *System Quality Degradation Warnings* when the application starts or when the logs database has been fully purged (reducing total queries count to exactly zero), the telemetry system is pre-calibrated to a safe, initial state:
*   **Average Search Confidence ($C$)**: Hardcoded to a healthy default of **85%** (`0.85`) when the logs are empty.
*   **User Rejection Rate ($R$)**: Defaults to **0%** (`0.0`) when no user corrections are logged.
*   **System Health Index ($H$)**: Calculated as $0.85 \times (1 - 0) = 85\%$ (`0.85`).

This calibrated starting baseline ensures the console launches in a clean, nominal state (flashing green status) rather than displaying arbitrary null bounds or alarming error states. Once a user begins querying the database, the calculations dynamically switch to actual query logs to reflect live performance metrics.

---

### 🎯 30-Day Success Metric: User Correction Resolution Velocity (UCRV)

The single metric we will track for the first 30 days post-launch is **User Correction Resolution Velocity (UCRV)**, defined as the **median elapsed time between a user-flagged knowledge gap (`feedback.timestamp`) and its team lead resolution and index integration (`feedback.resolvedTimestamp`)**. UCRV is measured by computing `resolvedTimestamp − timestamp` across all resolved feedback items within the rolling 30-day window, and taking the median of those durations. A healthy target is **UCRV ≤ 48 hours** — meaning team leads are reviewing, approving, and integrating corrections into the live knowledge index within two business days. This metric was chosen because it directly captures the **speed of the self-healing feedback loop**, which is the core value proposition of the system: when users flag gaps, how quickly does tribal knowledge flow back into the searchable corpus? If UCRV degrades (e.g., exceeds 72 hours), it signals either that the audit queue is being ignored, that the volume of gaps is overwhelming the review team, or that the routing suggestions are not reaching the right experts — each of which triggers a different operational response.

To complement UCRV (which relies on *explicit* user feedback), the system also tracks a **Query Reformulation Rate** — the percentage of queries where a user rephrases a similar question within a 5-minute session window. Reformulation is detected using Jaccard similarity (≥40% token overlap between consecutive queries). This captures *implicit* dissatisfaction: users who don't bother clicking 👎 but instead rephrase their question, indicating the first answer didn't satisfy them. A reformulation rate exceeding 20% is flagged as a leading indicator that specific knowledge domains need enrichment, even before users explicitly report gaps.

---

## 🔒 Enterprise Security Boundaries (STRIDE Remediations)
The application defines a strict, multi-layered security perimeter around system resources to shield local developer hosts and prevent data disclosure, injection exploits, denial-of-service, and prompt manipulation attacks:

```mermaid
graph TD
    subgraph Frontend ["React Frontend Security Layer"]
        CSP["Content Security Policy<br>(meta tag: script-src, connect-src, style-src)"] --> Input["User Input (Query / Correction)"]
        Input --> QueryVal["Query Length Validation<br>(max 500 chars)"]
    end

    subgraph EdgeGate ["Express Edge Security Middleware"]
        QueryVal --> Helmet["helmet() Security Headers<br>(X-Content-Type-Options, X-Frame-Options,<br>HSTS, Referrer-Policy)"]
        Helmet --> CORS["CORS Origin Whitelist<br>(localhost:5173, localhost:3000)"]
        CORS --> BodyLimit["Body Size Limit<br>(express.json 100kb)"]
        BodyLimit --> RateLimit["3-Tier Rate Limiting<br>(General 60/min, NLP 30/min, Admin 5/min)"]
        RateLimit --> AuthGate{"API Key Auth?"}
        AuthGate -->|API_AUTH_KEY set| KeyCheck["x-api-key Header Validation"]
        AuthGate -->|No key configured| PassThrough["Open Access"]
        KeyCheck & PassThrough --> InputVal["Input Validation<br>(type checks, enum validation)"]
    end

    subgraph AppLogic ["Application Security Layer"]
        InputVal -->|POST /api/feedback| Esc["HTML Escaping (escapeHtml)"]
        InputVal -->|POST /api/query| PromptDef["Prompt Injection Defense<br>(sanitizeForLLM: 11+ pattern strip,<br>XML delimiters, anti-jailbreak rules)"]
        PromptDef --> LLMVal["validateLLMResponse()<br>(Output schema constraint)"]
        Esc -->|Sanitized text| DBWriter["safeWriteJson (Atomic Write)"]
        DBWriter -->|Renamed temp-file| FeedbackDB[("feedback.json<br>(FIFO cap: 1000)")]
        LLMVal --> QueryLog[("queries_log.json<br>(FIFO cap: 2000)")]
    end

    subgraph ErrorGate ["Error Boundary"]
        AppLogic -->|Error thrown| ErrSan["sanitizeError()<br>(strips paths, stacks, internal details)"]
        ErrSan --> SafeErr["Generic client-safe error response"]
    end

    subgraph StorageGate ["Storage Layer Isolation"]
        FS["Absolute Paths (e.g., d:/...)"] -->|virtualizePath| RelPath["Relative Virtual Paths (e.g., data/...)"]
        RelPath -->|Exposed in citations| SearchResponse["Safe Query JSON Payload"]
    end
```

### STRIDE Boundary Remediations:

#### Original Core Protections
*   **Information Disclosure (Path Leaks)**: Absolute local disk pathing (`d:\Antigravity Projects\...`) is fully virtualized into workspace-relative paths (`data/documents/...`). The physical system's drive boundaries are completely invisible across frontend citations, downloads, and network logs.
*   **Tampering & Denial of Service (File Corruption)**: Concurrent write transactions on metrics or feedback files are handled by an atomic file-swapping pipeline (`safeWriteJson`). Updates are serialized to an adjacent temporary file and renamed synchronously, ensuring zero risk of partial or corrupted JSON streams.
*   **Spoofing / Stored Cross-Site Scripting (XSS)**: Team Lead administrative panels rendering user correction feedback are protected via strict server-side HTML entity escaping (`escapeHtml()`) applied before persistence.

#### HTTP Transport Hardening
*   **HTTP Security Headers (Helmet)**: `helmet()` middleware sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Strict-Transport-Security` (HSTS), and additional headers to prevent MIME-sniffing, clickjacking, and referrer leakage.
*   **CORS Origin Restriction**: Cross-origin requests are restricted to an explicit whitelist (`localhost:5173` for Vite dev server, `localhost:3000` for API self-origin). The wildcard `*` origin has been replaced with a strict allowlist to prevent unauthorized cross-origin API access.
*   **Content Security Policy (CSP)**: A `<meta>` CSP tag in the frontend restricts `script-src`, `connect-src`, and `style-src` directives to prevent inline script injection and unauthorized external resource loading.

#### Denial of Service Mitigation
*   **3-Tier Rate Limiting**: `express-rate-limit` enforces graduated throttling — **General endpoints** (60 req/min), **Query NLP endpoints** (30 req/min), and **Admin actions** (5 req/min) — preventing brute-force abuse and NLP resource exhaustion.
*   **Request Body Size Limit**: `express.json({ limit: '100kb' })` rejects oversized payloads at the middleware level before any parsing or business logic executes.
*   **Query Length Validation**: User queries are capped at **500 characters**, preventing NLP tokenization DoS attacks where adversarially long inputs could exhaust CPU during TF-IDF computation or LLM token allocation.
*   **FIFO Log Rotation**: `feedback.json` is capped at **1,000 entries** and `queries_log.json` at **2,000 entries** with FIFO eviction. This prevents unbounded disk growth from sustained usage or automated probing.

#### Prompt Injection & LLM Security
*   **Prompt Injection Defense**: `sanitizeForLLM()` strips **11+ injection patterns** (e.g., `ignore previous instructions`, `system:`, role-switching attempts). XML delimiters (`<context>`, `<user_query>`) structurally isolate user input from system instructions in all LLM prompts. Anti-jailbreak rules are embedded in system prompts. `validateLLMResponse()` constrains LLM output to the expected response schema, rejecting free-form or manipulated outputs.

#### Authentication & Input Validation
*   **Optional API Key Authentication**: When the `API_AUTH_KEY` environment variable is set, all requests require a valid `x-api-key` header. Admin endpoints (`/api/feedback/resolve`) are additionally gated behind `requireAuth` middleware combined with the `adminLimiter` rate tier.
*   **Input Validation**: Feedback `status` fields are validated against an enum set (`pending`, `approved`, `rejected`). `feedbackId` and `query` parameters are type-checked before processing to prevent type-confusion attacks.

#### Error Handling & Observability Safety
*   **Error Message Sanitization**: `sanitizeError()` strips file paths, stack traces, and internal implementation details from all error responses before they reach the client. Production error messages are generic and safe, preventing information disclosure through error channels.

---

## ⚡ High-Speed Ingestion Cache & Dynamic Indexing Flow
To keep searches blisteringly fast and self-healing, the platform orchestrates a multi-tier cache validation and RAM-injection pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor Boot as Server Boot
    participant PS as ParserService
    participant Cache as Ingestion Cache (indexed_chunks.json)
    participant Disk as Local Corpus (/data)

    Boot->>PS: ingestAll()
    PS->>Cache: Read stored cache index
    PS->>Disk: Scan /data/transcripts/ & get stats (mtime, size)
    
    alt Stats Match Cache (Cache Hit)
        PS-->>PS: Bypass Markdown raw parsing (Warm Boot)
        Note over PS: Ingest time drops to <3ms (99% speedup)
    else Stats Differ / New File (Cache Miss)
        PS->>Disk: Execute MD dialogue parser & dynamic metadata extraction
        PS->>Cache: Atomically update cache index & prune legacy office docs (safeWriteJson)
    end
    
    actor Lead as Team Lead Operator
    participant API as /api/feedback/resolve
    participant RAM as In-Memory documentIndex
 
    Lead->>API: Approve corrected answer
    API->>RAM: Inject virtual DocumentChunk
    Note over RAM: Live RAM index sync: new query immediately returns correction!
```

1.  **Fast Path (Warm Cache)**: On boot, the server retrieves filesystem metadata (file sizes and modified timestamps `mtimeMs`) for `.md` transcripts inside `/data/transcripts/`. If the stats match the records in `data/db/indexed_chunks.json`, raw parsing is bypassed, reducing system boot time to under **3ms**. Stale cache entries and legacy office document records are automatically pruned.
2.  **Dynamic RAM Re-Indexing**: On correction approval (`POST /api/feedback/resolve`), the system parses a virtual `DocumentChunk` and dynamically merges it into the in-memory RAM `documentIndex` vector. Search results self-heal immediately without requiring a server reboot, ensuring zero operational downtime.
