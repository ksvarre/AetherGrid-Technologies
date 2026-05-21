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

To scale AetherGrid Knowledge Tracer into an enterprise-grade corporate portal, we have established a comprehensive 7-phase production engineering roadmap and AI development disclosure ledger.

Please refer to the complete **[Enterprise Staging Roadmap & AI Development Disclosures](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/docs/ROADMAP.md)** document for deep-dive technical plans covering:

1.  **AI Co-Pilot & Development Disclosures**: Explicit breakdown of collaborative tooling including Antigravity, Gemini 3.5 Flash, Claude 3.6 Opus, GPT, and Copilot Chat.
2.  **Phase 1: Secure Identity Gateway (SSO & RBAC)**: Gating the **Audit Queue** and analytics behind secure SSO (Microsoft Entra ID, Auth0) and Role-Based Access Control to prevent unauthorized approvals.
3.  **Phase 2: Self-Service Document Ingestion Gateway**: Drag-and-drop file uploader in the React UI with ZIP PK header validations and dynamic hot-reindexing.
4.  **Phase 3: Centralized Enterprise API Key Brokerage (No BYOK)**: Transitioning from client-managed keys to server-side enterprise secrets manager storage (Azure Key Vault, GCP Secret Manager) to control corporate billing and rate boundaries.
5.  **Phase 4: Hybrid Sparse-Dense Search & Vector Database Migration**: Transitioning local files to PostgreSQL (Supabase with `pgvector`) and implementing hybrid search models (BM25 + Dense Vectors) with Reciprocal Rank Fusion.
6.  **Phase 5: Continuous Evaluation & Automated Regression Pipeline**: Establishing automated CI/CD checks against a "golden dataset" using metrics like *Faithfulness* and *Context Recall* to prevent quality regressions on new uploads.
7.  **Phase 6: Continuous Active Learning & Feedback Alignment Loops**: Periodically feeding approved corrections back into the LLM context as few-shot prompt alignments or incremental fine-tuning datasets.
8.  **Phase 7: Collaborative Teams & Slack Action Loops**: Connecting low-confidence routing directly to interactive Teams/Slack messages so experts can resolve knowledge gaps with a single click.




