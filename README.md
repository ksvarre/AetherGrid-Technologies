# AetherGrid Technologies: AI-Powered Knowledge Tracer

This repository contains the complete implementation of the Teradyne AI Enablement Forward Deployed Engineer (FDE) take-home exercises. 

It implements a self-healing corporate knowledge engine for **AetherGrid Technologies**—a high-tech energy grid optimization startup—enabling conversational querying across natural language meeting transcripts and structural Microsoft Office formats (`.docx`, `.pptx`, `.xlsx`), backed by advanced traceability, expert routing, feedback collection, and quality metrics instrumentation.

---

## 🤖 Primary AI Tool Disclosure
In strict compliance with the **AI Tool Requirements** of the exercise specification:
*   **Primary AI Assistant**: **Antigravity by Google DeepMind** (operating via the agentic developer environment).
*   **Role**: Assisted in full-stack architecture design, document ingestion services, natural language query algorithms, responsive premium UX layout, and rigorous decision logging.
*   **External Web Chats**: No web-based chat interfaces (e.g. ChatGPT, Claude.ai, Gemini Chat) were used as primary tools, ensuring that the entire generation history is auditable via the workspace environment.

---

## ⚡ Corporate Deployment & "Zero-Key" Design
To ensure this application can be immediately evaluated by any reviewer and successfully deployed inside a secure corporate network, it is built with a **Dual-Mode Search & Ingestion Pipeline** under a clean TypeScript `INLPEngine` strategy:
1.  **Offline Mode (Default)**: Out of the box, the system runs **100% locally** with **zero external network requests or API keys**. It uses a high-performance local TF-IDF & BM25 text-retrieval matrix, regex-based attendee matching, and rule-based response synthesis.
2.  **Enterprise Cloud Mode**: By simply adding a `GEMINI_API_KEY` to the `.env` file, the system automatically elevates to industry-grade RAG, using semantic embedding-based search and Google's Gemini LLM for metadata enrichment and fluid generative question-answering with inline citations.

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

### 1. Ingest Synthetic Data
Run the python data generation script to construct the synthetic AetherGrid corporate corpus:
```bash
python scripts/generate_data.py
```
This generates 12 meeting transcripts (`.md`), 4 design specs (`.docx`), 4 roadmaps (`.pptx`), and 4 metric files (`.xlsx`) directly under `/data`.

### 2. Configure Environment (Optional)
Create a `.env` file in the root directory if you wish to run in Cloud Mode:
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
```
*If left blank, the application gracefully defaults to high-performance local Offline Mode.*

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
   * **Option 1**: Run automated Exercise 1 assertions.
   * **Option 2**: Open a Natural Language Sandbox to type questions (e.g., *"What is Elena's MAE target?"*) and view the synthesized answers, citations, and synchronous execution trace logs.
   * **Option 3**: Print ready-to-copy cURL commands.

---

## 🔬 Core Exercise Deliverables

### [Exercise 1: Ingestion, Enrichment, & Query API]
*   **Ingestion**: Deep scans the `/data/transcripts` directory.
*   **Enrichment**: Extracts metadata like *Topic Domain*, *Priority Rating*, and *Attendees* from free-form meeting conversations.
*   **Query API**: Serves `POST /api/query` accepting natural language questions, retrieving relevant meetings with their enriched structural metadata.

### [Exercise 2: Office Documents, Traceability, & Suggested Routing]
*   **Office Parsing**: Extends the ingestion layer to index Word (`.docx`), PowerPoint (`.pptx`), and Excel (`.xlsx`) files.
*   **Strict Traceability**: Traces every claim back to its exact origin, including source filename, author/attendees, date, and matched snippet.
*   **Suggested Routing**: When query confidence drops below a threshold, the system provides a routing plan: *Who to contact* (primary domain expert), *Why* (matched expertise history), and a *drafted question*.
*   **Gap & Correction Capture**: Endpoints `POST /api/feedback` and `GET /api/feedback` to record rejections/corrections and expose them in a lead review queue.
*   **Instrumentation**: Aggregates system metrics (rolling confidence, user corrections, health levels) to detect quality degradation before users report it.

### [Exercise 3: User-Facing React Application & Metric]
*   **Dashboard**: A premium, futuristic single-page workspace styled in Vanilla CSS featuring an **AI Search Console**, an **Audit Queue** for team leads, and the **System Health Monitor**.
*   **Measurement Approach**: Explains the tracking of **Knowledge Gap Resolution Velocity (KGRV)** and **Search Reformulation Frequency** to keep the corporate index accurate and self-healing.

---

## 🔮 Future Features & Development Roadmap

To scale AetherGrid Knowledge Tracer into an enterprise-grade corporate portal, we have established a 7-point future feature backlog:

### 1. Admin Resolution Workflow for Reformulation Issues
*   **Objective**: Transition search query friction from passive detection to active resolution by operators.
*   **Proposed Solution**: Integrate a "Resolve Reformulation" action directly next to each pair in the Reformulation list in the Operator Portal. This opens a modal where a Team Lead can submit a custom "Golden Answer" for the reformulation pair. The backend will persist this to a new `data/db/reformulations_resolved.json` database, which compiles as a high-priority virtual chunk in the search index, self-healing that specific question immediately.

### 2. User-Facilitated Document Upload Gateway
*   **Objective**: Democratize knowledge ingestion by enabling operators and administrators to upload new documents directly from the UI.
*   **Proposed Solution**: Build a drag-and-drop file upload zone in the admin portal. A secure `POST /api/documents/upload` endpoint will enforce a 50MB file size limit, validate magic bytes (ZIP/OLE2 headers for DOCX, XLSX, PPTX, or standard headers for MD), and trigger an active hot-reindex to update search results instantly without server restarts.

### 3. Microsoft Teams Collaborative Integration
*   **Objective**: Turn suggested expert routing into active, collaborative corporate communication loops.
*   **Proposed Solution**: Connect a Microsoft Teams incoming webhook or bot. When a low-confidence routing card is triggered, the user can click "Escalate to Teams", posting a rich interactive card in the expert's channel. The expert's reply will feed back into the feedback API to resolve the gap.

### 4. Interactive Onboarding Guide & User How-To Suite
*   **Objective**: Guide new operators and recruiters through the platform's advanced workflows with high-fidelity, interactive training prompts.
*   **Proposed Solution**: Integrate a stateful step-by-step onboarding wizard (e.g. `react-joyride`) that walks new users through executing their first query, auditing citations, triggering suggested expert routing, and self-healing the knowledge base.

### 5. Repository Publication Hardening & GitHub Cleanup
*   **Objective**: Clean and standardize the repository for public or corporate distribution.
*   **Proposed Solution**: Establish pre-configured `.gitignore` structures to exclude local development assets (e.g. active staging session database files, local keys), perform dependency security checks, run automated code formatting (Prettier), and supply clean empty JSON database templates under `data/db/` so the repository boots up instantly in a pristine state out-of-the-box.

### 6. Institutional Database Migration & Cloud Hosting (e.g., Azure or Supabase)
*   **Objective**: Transition from local file-based JSON storage and in-memory indexing to a production-ready, distributed relational database and semantic vector store, offloading compute heavy-lifting from the local server and frontend.
*   **Proposed Solution**: Evaluate and establish an enterprise cloud-hosted data layer:
    *   **Option A (Azure SQL + Azure AI Search)**: Deploy within an Azure subscription to align with enterprise corporate IT, using Azure SQL for relational metadata (feedback loops, metrics history) and Azure AI Search for highly scalable hybrid vector retrieval.
    *   **Option B (Supabase / PostgreSQL with pgvector)**: Utilize Supabase's open-source Postgres cluster for unified structured tables and high-speed semantic embeddings matching.
    *   Offload TF-IDF/Vector similarity computation, rolling diagnostics aggregation, and document indexing workloads from RAM to database views, remote trigger pipelines, and cloud-native background indexing engines. This ensures high availability and fast query execution across millions of organizational documents.

### 7. Configurable Analytics Time-Frames & Reviewer Metrics Sandbox
*   **Objective**: Adapt the performance trends visualization to support shorter, highly responsive time-frames (e.g., 7 days, 24 hours, or active session-based logs) and transition to a permanent, continuous instrumentation tracker rather than a fixed 30-day window, ensuring evaluators can immediately witness live changes to the health and confidence indexes.
*   **Proposed Solution**:
    *   **Configurable Time-Frames**: Add a time-period selector toggle (e.g., `24h`, `7d`, `30d`, `All Time`) on the System Health dashboard to filter metrics aggregates and trend lines dynamically.
    *   **Reviewer Sandbox Simulation**: Introduce a "Simulator Mode" that allows reviewers to generate mock user search spikes, gaps, and lead resolution workflows compressed into a 5-minute interactive timeline. This enables instant visualization of system recovery metrics and proves the responsive telemetry tracking system works in real time under simulated evaluation scenarios.



