# AetherGrid Technologies: AI-Powered Knowledge Tracer

This repository contains the complete implementation of the Teradyne AI Enablement Forward Deployed Engineer (FDE) take-home exercises. 

It implements a self-healing corporate knowledge engine for **AetherGrid Technologies**—a high-tech energy grid optimization startup—enabling conversational querying across natural language meeting transcripts and structural Microsoft Office formats (`.docx`, `.pptx`, `.xlsx`), backed by advanced traceability, expert routing, feedback collection, and quality metrics instrumentation.

---

## ⚡ Corporate Deployment & "Zero-Key" Design
To ensure this application can be immediately evaluated by any reviewer and successfully deployed inside a secure corporate network, it is built with a **Dual-Mode Search & Ingestion Pipeline** under a clean TypeScript `INLPEngine` strategy:
1.  **Offline Mode (Default)**: Out of the box, the system runs **100% locally** with **zero external network requests or API keys**. It uses a high-performance local TF-IDF & BM25 text-retrieval matrix, regex-based attendee matching, and rule-based response synthesis.
2.  **Enterprise Cloud Mode**: Elevates the search engine to industry-grade RAG, using semantic embedding-based search and Google's Gemini LLM for metadata enrichment and fluid generative question-answering with inline citations. This can be activated via two distinct pathways:
    *   **Pathway A: Server-Wide Configuration (process.env)**: Adding a `GEMINI_API_KEY` to the server's `.env` file. This automatically defaults the entire server instance to Cloud Mode for all connecting users.
    *   **Pathway B: Client-Scoped Transient Configuration (Secure UI BYOK)**: Entering your `GEMINI_API_KEY` directly into the web interface's **Settings Panel** (top-right gear icon). The key is stored securely in your browser's `localStorage` and sent over HTTPS on a request-by-request basis via custom headers (`x-gemini-api-key`). The backend processes this in-memory dynamically *without* writing the key to the server's `.env` file or disk, preserving absolute credential isolation.

---

## 📂 Repository Structure
```
TER Take Home Exercise/
├── data/                         # Generated Corpus
│   ├── transcripts/              # Exercise 1: Markdown meeting transcripts (12 files)
│   ├── documents/                # Exercise 2: Office documents (.docx, .pptx, .xlsx) (12 files)
│   └── db/                       # Local JSON database (gaps, corrections, metrics)
├── docs/                         # Decision Log & Engineering Reference Suite
│   ├── DECISIONS.md              # Chronological engineering decisions
│   ├── ARCHITECTURE.md           # Overall system architecture and data flows
│   ├── BACKEND.md                # API endpoints, ingestion, and search strategy
│   ├── FRONTEND.md               # React layouts, components, and Vanilla CSS tokens
│   └── SYNTHETIC_DATA.md         # AetherGrid organization context & corpus catalog
├── src/
│   ├── backend/                  # Node.js + Express + TypeScript API Server
│   └── frontend/                 # React + Vite + TypeScript (Exercise 3 UI)
├── scripts/
│   └── generate_data.py          # Automated Python script to generate office files & transcripts
├── package.json                  # Top-level dependencies, concurrently script runner
└── README.md                     # This file
```

---

## 🚀 Quick Start (Local Run)

### Prerequisites
*   **Node.js**: v18.0+ (Tested on v25.2)
*   **npm**: v9.0+ (Tested on v11.6)
*   **Python**: 3.8+ (Required only for the synthetic data generation script)

### 1. Ingest Synthetic Data (Optional)

> [!NOTE]
> **The entire synthetic AetherGrid corporate corpus (12 meeting transcripts, 4 DOCX, 4 PPTX, and 4 XLSX files) is already pre-generated and checked into this repository!**
> Reviewers do not need to install Python or run this script to evaluate the application. You can immediately skip this step and proceed to step 3.
>
> If you wish to clean or regenerate the corpus dynamically, run:
> ```bash
> python scripts/generate_data.py
> ```

### 2. Configure Environment (Optional)
If you wish to evaluate or run the system in **Enterprise Cloud Mode**, you can provide a Gemini API key via either of the following methods:

*   **Option A: Server-Wide Configuration (`.env`)**
    Create a `.env` file in the root directory:
    ```env
    PORT=5000
    GEMINI_API_KEY=your_gemini_api_key_here
    ```
    *If this variable is absent or left as the placeholder, the server defaults to high-performance local Offline Mode.*

*   **Option B: Client-Scoped Transient Configuration (Web UI Settings)**
    Leave the server's `.env` blank (or running offline). Once the application starts, click the **Settings Gear Icon** in the top-right corner of the React Web App. Paste your `GEMINI_API_KEY` there and click **Save Settings** or **Re-Index Workspace**. This stores the key securely in your browser's local storage and forwards it via headers over HTTPS on each request. The key is processed strictly in-memory by the backend and is **never** written to the server's `.env` file or disk.

### 3. Install & Run
Install root dependencies and start both backend and frontend concurrently:
```bash
npm install
npm run dev
```

---

## 🔬 Reviewer Verification Suite (Terminal-Based)

To provide an elite, frictionless review experience, AetherGrid incorporates two terminal-based verification utilities that run completely offline without external network or API dependencies.

> [!NOTE]
> If Windows or PowerShell blocks execution of scripts on your machine with a script execution policy warning, use the standard `cmd.exe /c` wrapper commands documented below to run testing suites directly.

### A. The Automated Ingestion & In-Memory Assertions Playbook
This runs the entire system through an automated validation suite—checking that transcripts scan correctly, domains parse from frontmatter, attendees parse as formal arrays, search matching is stems-aware, and low-confidence triggers suggested expert routing:
```bash
# Bypass PowerShell blocking and run automated assertions
cmd.exe /c "npx ts-node src/backend/scripts/verify_system.ts"
```

### B. The Interactive Review Portal & Natural Language Sandbox
This starts a colorful, interactive ANSI-styled terminal application where you can trigger manual ingestions, type custom search queries, inspect inline citations, and review derived metadata:
1. Ensure the Express API is running in the background (via `npm run dev`).
2. Run the interactive console portal:
   ```bash
   # Start the Interactive CLI Reviewer Portal
   cmd.exe /c "node scripts/review.js"
   ```
3. Use the menu options to:
   * **Option 1**: Run Exercise 1 (Transcript Ingestion & Local Query Engine Playbook).
   * **Option 2**: Run Exercise 2 (Office Documents, Citations & Fallback Routing Playbook).
   * **Option 3**: Run Exercise 3 (Lead Review Queue & Self-Healing Gateway Playbook).
   * **Option 4**: Launch Interactive Natural Language Query Sandbox.
   * **Option 5**: View 30-Day Success Metric & copy-paste cURL Reference Guides.
   * **Option 6**: Exit the CLI Reviewer Portal.


---

## 🔬 Core Exercise Deliverables & Reviewer Validation Playbooks

### [Exercise 1: Ingestion, Enrichment, & Query API]
*   **Ingestion**: Deep scans the `/data/transcripts` directory on boot, registers new text nodes, and maintains an optimized in-memory search index.
*   **Enrichment**: Extracts metadata like *Topic Domain*, *Priority Rating*, *Attendees*, and *Facilitator* from free-form conversations using zero-dependency TypeScript regex/heuristics, falling back to frontmatter headers when present.
*   **Query API**: Serves `POST /api/query` accepting natural language questions, retrieving relevant meetings with their enriched structural metadata.
*   👉 **How to Test & Validate**:
    1.  **Automated Ingestion Test**: Run `cmd.exe /c "npm run verify"` to execute automated assertions for Exercise 1 ingestion and metadata extraction, confirming a sub-10ms cached boot time.
    2.  **CLI Sandbox Validation**: Open the **Interactive CLI Reviewer Portal** via `cmd.exe /c "npm run review"` and select **Option 4** (Natural Language Sandbox). Ask *"What is Elena's MAE target?"* or *"database scaling issue attendees"*. Observe how the system tokenizes, normalizes, stems plural/gerund terms, and returns a compiled answer with inline citations (`[1]`, `[2]`) and exact date/attendee arrays.
    3.  **JSON API Check**: Send a raw cURL command to see the structured API response:
        ```bash
        curl -X POST http://localhost:5000/api/query -H "Content-Type: application/json" -d "{\"query\":\"database scaling crisis attendees\"}"
        ```

### [Exercise 2: Office Documents, Traceability, & Suggested Routing]
*   **Office Parsing**: Extends the ingestion layer to securely index Word (`.docx`), PowerPoint (`.pptx`), and Excel (`.xlsx`) files.
*   **Strict Traceability**: Traces every claim back to its exact origin, including source filename, author/attendees, date, and matched snippet.
*   **Suggested Routing**: When query confidence drops below a threshold, the system provides a routing plan: *Who to contact* (primary domain expert), *Why* (matched expertise history), and a *drafted question*.
*   **Gap & Correction Capture**: Endpoints `POST /api/feedback` and `GET /api/feedback` to record rejections/corrections and expose them in a lead review queue.
*   **Instrumentation**: Aggregates system metrics (rolling confidence, user corrections, health levels) to detect quality degradation before users report it.
*   👉 **How to Test & Validate**:
    1.  **Dedicated Exercise 2 Test Suite**: Run `cmd.exe /c "node scripts/validate_ex2.js"` to run the dedicated Exercise 2 test suite. It registers user corrections, updates in-memory weights, and validates correct routing behaviors.
    2.  **Verify Off-Topic Null Routing (Tier 3)**: Search for *"how to bake a chocolate chip cookie"* in the React Web App or CLI Sandbox. Because it is off-topic, observe that the system scores under `40%` confidence and gracefully triggers **3-Tier Routing**, identifying the query as completely out of scope without forcing a mismatch.
    3.  **Verify Domain Routing (Tier 2)**: Search *"Project Helium solar hardware targets"*. See it trigger a high-fidelity routing block pointing to *Jack Ryder* with a pre-drafted message.
    4.  **Verify Feedback Capture**: Search any query (e.g., *"Helium solar specs"*), click the 👎 button on the result card in the Web App, type a correction (e.g. *"Actually, solar edge nodes operate on 48V DC"*), and submit. Go to the **Audit Queue** tab to see your correction logged.

### [Exercise 3: User-Facing React Application & Metric]
*   **Dashboard**: A premium, futuristic single-page workspace styled in Vanilla CSS featuring an **AI Search Console**, an **Audit Queue** for team leads, and the **System Health Monitor**.
*   **Measurement Approach**: Explains the tracking of **Knowledge Gap Resolution Velocity (KGRV)** and **Search Reformulation Frequency** to keep the corporate index accurate and self-healing.
*   👉 **How to Test & Validate**:
    1.  **Browser Dashboard**: Open your browser to `http://localhost:5173`.
    2.  **Onboarding Tour**: If it's your first time, the guided tour auto-launches after 800ms. Follow it through the search console, the audit queue, and the analytics telemetry dashboard. To restart it anytime, click the `?` icon in the main header.
    3.  **Audit Queue Action**: In GridTrace Core, flag a search result as inaccurate using the 👎 button, enter a correction, and submit. Navigate to the **Audit Queue** tab, filter by domain, and click **Approve**.
    4.  **Telemetry Verification**: Go to **AetherPulse Metrics**. Observe the live **System Health Index** and see the **User Correction Resolution Velocity (UCRV)** gauge calibrate. The SLA threshold (48h Limit) is clearly marked.
    5.  **Jaccard Reformulation Test**: Search *"Project Helium thermal targets"* in GridTrace Core, then immediately search *"Helium project thermal objectives"* within 5 minutes. Go to the **AetherPulse Metrics** tab and click the **Reformulation Rate** card; it will list the consecutive search pair as a reformulation!
    6.  **Excel Tabular Rendering**: Search *"Project Quantum model benchmarks MAE"* and click on the citation drawer for `quantum_model_benchmarks_v1.xlsx`. The matched data cell values are rendered as a beautiful, high-contrast HTML table grid layout inside the citation drawer rather than a raw text blob.

---

## 🔮 Future Features & Development Roadmap

To scale AetherGrid Knowledge Tracer into an enterprise-grade corporate portal, we have established a comprehensive 8-phase production engineering roadmap.

Please refer to the complete **[Recommended Future Features](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/ROADMAP.md)** document for deep-dive technical plans covering:

1.  **Phase 1: Secure Identity Gateway (SSO & RBAC)**: Gating the **Audit Queue** and analytics behind secure SSO (Microsoft Entra ID, Okta, or Auth0) and Role-Based Access Control to prevent unauthorized approvals.
2.  **Phase 2: Self-Service Document Ingestion Gateway**: Drag-and-drop file uploader in the React UI with ZIP PK header validations and dynamic hot-reindexing.
3.  **Phase 3: Centralized Enterprise API Key Brokerage (No BYOK)**: Transitioning from client-managed keys to server-side enterprise secrets manager storage (Azure Key Vault, GCP Secret Manager) to control corporate billing and rate boundaries.
4.  **Phase 4: Hybrid Sparse-Dense Search & Vector Database Migration**: Transitioning local files to PostgreSQL (Supabase with `pgvector`) and implementing hybrid search models (BM25 + Dense Vectors) with Reciprocal Rank Fusion.
5.  **Phase 5: Continuous Evaluation & Automated Regression Pipeline**: Establishing automated CI/CD checks against a "golden dataset" using metrics like *Faithfulness* and *Context Recall* to prevent quality regressions on new uploads.
6.  **Phase 6: Continuous Active Learning & Feedback Alignment Loops**: Periodically feeding approved corrections back into the LLM context as few-shot prompt alignments or incremental fine-tuning datasets.
7.  **Phase 7: Collaborative Microsoft Teams Action Loops**: Connecting low-confidence routing directly to interactive Teams messages so experts can resolve knowledge gaps with a single click.
8.  **Phase 8: Premium UI/UX Polish & Generative Response Tuning**: Creating administrative consoles to customize model temperature/system prompts, configure split parameters, optimize grid layouts, and implement citation-to-coordinate maps.
