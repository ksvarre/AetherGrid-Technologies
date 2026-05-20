# Architectural Decision Log (ADL) — AetherGrid Knowledge Tracer

This document records the key architectural decisions, rationale, trade-offs, and technology evaluations made during the development of the Teradyne AI Enablement take-home exercises.

---

## Decision 1: Primary AI Tool Disclosure
*   **Status**: Accepted
*   **Context**: The exercise specification requires declaring a primary AI coding assistant and limits web-based chat interfaces (ChatGPT, Claude.ai, Gemini Chat, etc.) to supporting roles only.
*   **Decision**: **Antigravity by Google DeepMind** (operating via the agentic developer environment) is declared as the primary AI assistant. 
*   **Rationale**: The agentic environment integrates directly into the terminal, filesystem, and development lifecycle, ensuring that all operations are transparent, fully automated, and traceably committed to the project.
*   **Trade-offs**: None. Using a terminal-integrated agentic workflow guarantees a clean, auditable development trail.

---

## Decision 2: Self-Contained Dual-Mode search (Offline-First Strategy)
*   **Status**: Accepted
*   **Context**: The application must be runnable locally without exposing private credentials, but also corporate-ready for live production deployment at a company where advanced LLM capabilities would be expected.
*   **Decision**: Implement a **Strategy Pattern** via the `INLPEngine` interface. 
    *   **Offline Mode**: Uses a pure JavaScript-based BM25 / TF-IDF text matcher, keyword analyzers, and regex-based entity extractors.
    *   **Cloud Mode**: Triggered automatically when a `GEMINI_API_KEY` is present in the environmental config, utilizing semantic vectors and Google's Gemini LLM for high-fidelity generative syntheses.
*   **Rationale**: Ensures 100% out-of-the-box local operation for recruiters and interview evaluators with zero setup friction, while proving enterprise viability and direct modular upgradeability for production teams.
*   **Trade-offs**: Implementing a high-quality local text search engine and response compiler in pure TypeScript adds implementation complexity, but it completely removes dependency on third-party SaaS accounts or network connections during local evaluation.

---

## Decision 3: Language & Runtime Stack (Unified TypeScript & Node.js)
*   **Status**: Accepted
*   **Context**: We need to parse multiple Office documents (`.docx`, `.pptx`, `.xlsx`), ingest Markdown transcripts, build a REST API, and code a React application.
*   **Decision**: Use **TypeScript and Node.js** across the entire stack.
    *   **Backend**: Express + TypeScript.
    *   **Frontend**: React + Vite + TypeScript.
    *   **Data Generation**: Python (standard libraries + standard docx/pptx/openpyxl packages) for constructing the synthetic corpus cleanly.
*   **Rationale**: Using TypeScript provides shared types between the frontend and backend, lowering development friction and increasing database representation safety (e.g., matching citation models, feedback data structures, and metrics payloads). Node has excellent local parsing libraries with zero external system requirements.
*   **Trade-offs**: Python is traditionally preferred for simple NLP, but a Node-based backend makes the final application completely unified, meaning the frontend and backend can be run simultaneously using a single `npm run dev` script with zero dependency pathing errors on the evaluator's system.

---

## Decision 4: Local Office Ingestion Libraries (Mammoth & SheetJS)
*   **Status**: Accepted
*   **Context**: The system must extract clean searchable text and structure from Word, Excel, and PowerPoint files in Node.js on Windows without requiring a Microsoft Office installation.
*   **Decision**: Standardize on:
    *   `mammoth`: To convert `.docx` documents into structured text (by extracting paragraphs and layout).
    *   `xlsx` (SheetJS): To read `.xlsx` files and convert tabular rows into readable structured text strings.
    *   `officeparser`: A lightweight, pure-JS package to parse slides from `.pptx` presentations.
*   **Rationale**: These libraries are pure JavaScript, do not rely on Python sub-processes at runtime, do not compile C++ native modules, and run perfectly on Windows, macOS, and Linux out-of-the-box.
*   **Trade-offs**: Pure-text extraction loses complex cell styling in Excel or image assets in Word/PowerPoint, but for search indexing and natural language querying, text content extraction is the primary asset needed.

---

## Decision 5: Premium Vanilla CSS Design System (No TailwindCSS)
*   **Status**: Accepted
*   **Context**: Web application guidelines dictate: "Use Vanilla CSS for maximum flexibility and control. Avoid using TailwindCSS unless the USER explicitly requests it."
*   **Decision**: Build a custom CSS Design System from scratch in `/src/frontend/src/index.css` using modern CSS variables (custom properties), HSL color definitions, glassmorphism filters, glowing utility classes, and custom keyframe micro-animations.
*   **Rationale**: Fits the strict formatting guidelines of the web application developer. Vanilla CSS allows us to write elegant, clean layouts without polluting the JSX code with long utility strings, making the components highly readable, modular, and maintainable.
*   **Trade-offs**: Writing vanilla CSS takes slightly more planning to structure responsive grids, flex-boxes, and animations, but the visual outcome feels exceptionally bespoke, premium, and state-of-the-art.

---

## Decision 6: Local File-Based JSON Database for Feedback & Metrics
*   **Status**: Accepted
*   **Context**: Capturing user corrections, rejections, and rolling system metrics requires structured storage, but a full SQL or MongoDB instance introduces local runtime dependencies.
*   **Decision**: Build a transactional JSON file database in `data/db/` (e.g. `feedback.json`, `metrics.json`).
*   **Rationale**: Completely self-contained within the workspace folder, easily inspectable, easily backable, and runs with zero configuration on any system.
*   **Trade-offs**: Not suitable for millions of simultaneous writes, but ideal for a local multi-user team dashboard prototype where writes occur when a user actively edits or rejects a search result.
