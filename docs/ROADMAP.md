# Recommended Future Features

This document outlines the recommended future features and tasks to scale the **AetherGrid Technologies Knowledge Tracer** from a high-fidelity local prototype to a secure, resilient, and enterprise-grade corporate platform.

---

## 🔮 Recommended Future Features & Staging Roadmap

To prepare this application for high-scale enterprise deployment across AetherGrid Technologies' engineering, sales, and operations departments, we have mapped out an 8-phase production engineering roadmap.

```mermaid
graph TD
    A[Phase 1: SSO & RBAC Gate] --> B[Phase 2: Self-Service Ingest]
    B --> C[Phase 3: Centralized Key Broker]
    C --> D[Phase 4: Hybrid Vector DB]
    D --> E[Phase 5: Continuous Evaluation]
    E --> F[Phase 6: Active Learning Loops]
    F --> G[Phase 7: Teams Action Loops]
    G --> H[Phase 8: UI/UX & Generative Tuning]

    style A fill:#1a365d,stroke:#00f0ff,stroke-width:2px,color:#fff
    style B fill:#1a365d,stroke:#00f0ff,stroke-width:2px,color:#fff
    style C fill:#1a365d,stroke:#00f0ff,stroke-width:2px,color:#fff
    style D fill:#113030,stroke:#00e5ff,stroke-width:2px,color:#fff
    style E fill:#113030,stroke:#00e5ff,stroke-width:2px,color:#fff
    style F fill:#113030,stroke:#00e5ff,stroke-width:2px,color:#fff
    style G fill:#113030,stroke:#00e5ff,stroke-width:2px,color:#fff
    style H fill:#3a1a5d,stroke:#b800ff,stroke-width:2px,color:#fff
```

### Phase 1: Secure Identity Gateway (SSO & RBAC)
*   **Objective**: Guard administrative configurations and prevent unauthorized gap approvals by enforcing strict corporate identity boundaries.
*   **Proposed Implementation**:
    *   **Authentication**: Integrate standard OAuth2 / JWT-based single-sign-on (SSO) backed by corporate identity providers like **Microsoft Entra ID (Azure AD)**, **Okta**, or **Auth0**.
    *   **Role-Based Access Control (RBAC)**: Define granular roles:
        *   `Operator (Reader)`: Can search, read citations, download files, rate answers, submit gap corrections, and copy expert routing drafts.
        *   `Team Lead (Admin)`: Can access the **Audit Queue**, approve/dismiss corrections, view AetherPulse telemetry analytics, and customize models.
    *   **Gated Middleware**: Enforce backend Express middleware (`requireRole(['Admin'])`) to secure state-changing endpoints (`POST /api/feedback/resolve`, `GET /api/feedback`, `GET /api/metrics`).
    *   **Frontend UI Hiding**: Enforce React-based router guards to hide administrative tabs and disable unauthorized state changes for Operator logins.

### Phase 2: Self-Service Document Ingestion Gateway
*   **Objective**: Democratize corporate knowledge base curation by letting authorized employees ingest files directly from the web client.
*   **Proposed Implementation**:
    *   **Frontend File Zone**: Construct a drag-and-drop file upload interface (supporting `.md`, `.docx`, `.pptx`, and `.xlsx`).
    *   **Sandboxed Ingestion Gate**: Write a secure `POST /api/documents/upload` endpoint enforcing strict security controls:
        1.  **File Size Limits**: Cap uploads at 50MB to prevent memory exhaustion (DoS).
        2.  **Magic-Byte Verification**: Scan file headers (ZIP PK signature validation) before executing heavy Office parsing libraries (Mammoth, SheetJS).
        3.  **Antivirus Scanning**: Pipe incoming buffers through a ClamAV or cloud-native file scanner before storage.
    *   **Dynamic Hot-Reindexing**: Process and parse the uploaded file on-the-fly and immediately merge new chunks into the active in-memory search index, making the knowledge searchable instantly without server downtime.

### Phase 3: Centralized Enterprise API Key Brokerage (No BYOK)
*   **Objective**: Transition away from Bring Your Own Key (BYOK) for developers and operators, securing corporate AI usage under enterprise billing boundaries.
*   **Proposed Implementation**:
    *   **Central Key Store**: Deploy backend API keys within a secure, dedicated secrets manager (e.g. **AWS Secrets Manager**, **Azure Key Vault**, or **Google Cloud Secret Manager**).
    *   **Enterprise API Broker**: The Node.js backend handles all LLM API requests using the centralized, corporate-managed key (e.g. Google Cloud Vertex AI API or Azure OpenAI Service).
    *   **Rate & Budget Caps**: Implement server-side request throttles, tenant quotas, and prompt size limits to prevent runaway cloud usage costs, protecting corporate accounts from financial exhaustion.

### Phase 4: Hybrid Sparse-Dense Search & Vector Database Migration
*   **Objective**: Transition from local memory-based JSON storage to an enterprise-grade relational database and high-availability vector store.
*   **Proposed Implementation**:
    *   **Relational Storage**: Migrate user feedback logs, telemetry metrics, and document metadata from `data/db/` JSON files to **Supabase (PostgreSQL)** or **Azure SQL**.
    *   **Semantic Vector Index**: Use a high-performance vector store (e.g. **pgvector** in PostgreSQL, **Qdrant**, or **Pinecone**).
    *   **Hybrid Retrieval Engine**: Combine traditional lexical search (BM25 keyword matching with grammatical stemming) and dense neural embeddings (e.g., Google Text Embeddings) using **Reciprocal Rank Fusion (RRF)**. This preserves high-precision keyword lookups (like serial numbers or specific acronyms) while enabling broad semantic reasoning.

### Phase 5: Continuous Evaluation & Automated Regression Pipeline
*   **Objective**: Guarantee that ingesting new documents or adjusting LLM prompts does not degrade overall search quality or break historical correct answers.
*   **Proposed Implementation**:
    *   **Golden Dataset**: Compile an evolving test suite of critical query-answer pairs (e.g., benchmark technical questions matched with expected source citations).
    *   **Automated Evaluation (RAGAS / TruLens)**: Integrate an automated evaluation runner in the CI/CD pipeline (GitHub Actions). When new data is committed or uploaded:
        1.  Run the evaluation runner to execute the benchmark suite.
        2.  Compute performance scores: *Faithfulness*, *Answer Relevance*, and *Context Recall*.
        3.  Block the deployment if scores fall below a calibrated threshold (e.g. 90% confidence), preventing system regressions.

### Phase 6: Continuous Active Learning & Feedback Alignment Loops
*   **Objective**: Establish a self-healing cycle where the system automatically learns from operator corrections to improve future responses.
*   **Proposed Implementation**:
    *   **Correction Auto-Alignment**: Periodically aggregate approved feedback corrections. Use these historical correct answers as dynamically injected *few-shot* examples in the LLM's context window.
    *   **Incremental Fine-Tuning**: Set up a monthly background cron job to package approved corrections into a fine-tuning dataset, incrementally training a lightweight corporate-hosted LLM on custom business terminology, project acronyms, and organizational jargon.

### Phase 7: Collaborative Microsoft Teams Action Loops
*   **Objective**: Move suggested expert routing out of passive clipboard copy-pasting and into active corporate communication channels.
*   **Proposed Implementation**:
    *   **Microsoft Teams Integration**: Connect a Microsoft Teams Incoming Webhook or Custom Teams Bot.
    *   **One-Click Escalation**: When a query triggers suggested expert routing (confidence < 40%), replace the copy button with a secure "Escalate to Teams" button.
    *   **Interactive Cards**: Automatically post an interactive card into the expert's Teams channel showing the user's query, the matched low-confidence snippet, and the routing rationale.
    *   **Chatbot Resolution**: The expert can reply directly to the Microsoft Teams thread with the correct answer. A background listener captures their response, updates the feedback database, and auto-resolves the knowledge gap, updating the searchable index in real time.

### Phase 8: Premium UI/UX Polish & Generative Response Tuning
*   **Objective**: Maximize operator productivity via front-end layout enhancements and provide tools to actively tune the search ingestion parameters and generative LLM response characteristics.
*   **Proposed Implementation**:
    *   **Generative Response & Prompt Quality Console**: Build a dashboard interface enabling administrators to view, edit, and save LLM system directives and instructions. Include controls to dynamically adjust model parameters like temperature (for response creativity), top-p, token limits, and safety filters.
    *   **Ingestion Parameter Customizer**: Construct visual sliders to define text-splitting rules, chunk sizes, token thresholds, and chunk overlap percentages (e.g. 15% overlap) to tweak matching accuracy for specialized file schemas.
    *   **Premium UI/UX Refinements**: Refactor layout grids for flawless responsive behavior across mobile, tablet, and widescreen monitors. Introduce configurable aesthetic profiles (e.g. system light/dark theme toggle), drag-and-drop workspace layout customization, and customizable keyboard hotkeys for power users.
    *   **Granular Citation Highlight Mapping**: Click on a citation marker in a synthesized response to open the document viewer with the exact corresponding Excel cell, PDF text range, or Word section automatically highlighted.
