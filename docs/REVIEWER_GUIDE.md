# AetherGrid Technologies — Exercise 1 Reviewer Guide

This manual serves as a definitive guide for evaluating and auditing the **Exercise 1 (Meeting Transcripts: Ingestion, Enrichment, & Query API)** deliverable in this repository.

To align with modern software engineering best practices, this standalone system was planned, secured, implemented, and verified using the structured **Kris Test Architecture** workflow.

---

## 🏛️ Ingestion & Core Architecture

The system operates as an **in-memory semantic query indexer** backed by a **pruning-aware high-performance filesystem scanner** and an **Express.js API server**. 

### 1. File Scope Restrictive Ingestion
*   **Active Directory**: Ingestion is restricted **exclusively** to the `data/transcripts/` folder containing synthetic Markdown (`.md`) files.
*   **Defunct Office Parsers**: Mammoth (Word), SheetJS (Excel), and OfficeParser (PowerPoint) ingestion paths have been completely bypassed for this pure Exercise 1 deliverable, keeping startup, memory usage, and build times exceptionally light and secure.
*   **Verification Location**: [parser.ts:L75-103](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L75-L103) shows the restricted folder traversal loop.

### 2. Warm Boot Cache & Self-Cleaning Pruning
*   **Index Database Cache**: Semantic text chunks and metadata calculations are written to `data/db/indexed_chunks.json` mapped to modified timestamps (`mtimeMs`).
*   **Pruning Mechanism**: Any previously cached office documents (e.g., Excel/Word) are automatically identified as "out of scope" and pruned from the ledger upon booting. This keeps the active RAM index 100% transcript-focused.
*   **Verification Location**: [parser.ts:L105-115](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L105-L115) shows the prune & save block.

---

## 🏷️ Enrichment & Structured Metadata Preservation

Transcripts contain YAML frontmatter blocks defining `date`, `attendees`, `facilitator`, `domain`, and `priority`. The parser isolates and preserves these attributes with complete fidelity:

1.  **Attendees Array**: Preservation of commas-separated attendees as an array (not a string).
    *   *Verification Location*: [parser.ts:L157](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L157)
2.  **Facilitator-to-Author Binding**: The facilitator is parsed from the YAML block and assigned to the chunk's primary `author` property, falling back to the first attendee if missing.
    *   *Verification Location*: [parser.ts:L166](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L166)
3.  **Domain & Priority**: Domain and priority attributes are mapped to each paragraph chunk to enable citation-level topic filtering.
    *   *Verification Location*: [parser.ts:L151-155](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L151-L155)

---

## 🔍 Retrieval & Query API (`POST /api/query`)

The Express query API receives user queries, processes them offline via TF-IDF cosine-similarity, and synthesizes natural language answers with granular inline citations.

### 1. Stemming & Suffix Normalization
*   Queries and chunks are split and cleaned of standard noise stop words. Suffixes (`-s`, `-es`, `-ies`, `-ing`, `-ed`) are stemmed using a robust Porter-style grammatical stemmer.
*   *Verification Location*: [nlp.ts:L68-116](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts#L68-L116)

### 2. Semantic Query Scoring
*   Cosine similarity weights are calibrated across the RAM corpus to match the stemmed query tokens. Boosts are given for project names (Quantum, Helium, Horizon) and employee names (Rostova, Vance, Patel, Chen).
*   *Verification Location*: [nlp.ts:L172-210](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts#L172-L210)

### 3. Citations & Synthesized Answers
*   Inline citations return a user-friendly index marker (`[1]`, `[2]`).
*   The query result contains an detailed citation mapping representing chunk IDs, source file names, virtualized file paths, original authors (facilitators), exact matched quotes, dates, and the attendees array.
*   *Verification Location*: [nlp.ts:L243-279](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts#L243-L279)

---

## 🛡️ Security Sandboxing & Hardening

Adhering to the zero-trust STRIDE threat model, three critical security gates are enforced:

1.  **Path Traversal Prevention (Virtualized Relative Routes)**: Physical absolute server directories are stripped into relative workspace virtualized paths (e.g. `data/transcripts/filename.md`) inside JSON citations.
    *   *Verification Location*: [parser.ts:L21-23](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L21-L23)
2.  **HTML Input Neutralization (Stored XSS Prevention)**: Query inputs, feedback items, and corrections are processed via HTML entity encoding (`escapeHtml`) before being written to metrics ledgers.
    *   *Verification Location*: [database.ts:L41-50](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/database.ts#L41-L50)
3.  **Buffer Bloat Hardening (Express limits)**: Express routing has rigid content type and body parser limits.

---

## 🚀 Playbooks & Verification Commands

Three npm-bound terminal scripts are registered to facilitate direct, frictionless verification of the codebase:

### 1. Compile Backend TypeScript
```bash
npm run build:backend
```

### 2. Start the Express API Service (Port 5000)
```bash
npm run dev
```
*(Leave this running in one console pane).*

### 3. Launch the Interactive Review Console
```bash
npm run review
```
*(Runs in another console pane. High-fidelity ANSI menus will guide you through testing).*

*   **Option 1: Run Automated Verification Suite**: Instantly executes Exercise 1 assertions, checking topic matching, frontmatter parsed array preservation, and date mapping.
*   **Option 2: Interactive Query Sandbox**: Type free-form queries (e.g. "What did Elena target for MAE?") to see the full synthesized answer, granular metadata, and the **synchronous `executionPipeline` trace logging** showing stemmed query tokens, calculated weights, and scores.
*   **Option 3: Print cURL Commands**: Displays pre-formatted copy-pasteable `cURL` commands to query the Express API.
