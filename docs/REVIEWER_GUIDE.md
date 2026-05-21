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

## 🏷️ Enrichment & Dynamic Metadata Extraction (Exercise 1)

The pipeline dynamically extracts and derives structured metadata directly from pure Markdown dialogue transcripts using clean, zero-dependency TS/JS heuristics, with a backward-compatible parser for YAML frontmatter headers if present:

1.  **Date Extraction**: Derived from filename patterns using a regex that extracts `YYYY_MM_DD` structures (e.g., `transcript_2026_03_02_database_scaling_crisis.md` $\rightarrow$ `2026-03-02`).
    *   *Verification Location*: [parser.ts:L139-144](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L139-L144)
2.  **Attendees (Unique Speakers)**: Formulated by scanning the transcript dialogue using regex matching dialogue headers `**Speaker Name**:` or `**Dr. Speaker Name**:` and converting them into a unique trimmed array.
    *   *Verification Location*: [parser.ts:L146-164](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L146-L164)
3.  **Facilitator (Author Binding)**: Deduced dynamically as the first speaker identified in the transcript dialogue. The facilitator is bound to the chunk's primary `author` property.
    *   *Verification Location*: [parser.ts:L214-215](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L214-L215)
4.  **Domain & Priority**: The file contents are evaluated against key-phrase vocabularies to determine the topic `domain` (e.g., "quantum", "MAE" $\rightarrow$ Project Quantum; "sensor", "helium" $\rightarrow$ Project Helium) and `priority` level (classified as High, Medium, or Low based on critical keywords).
    *   *Verification Location*: [parser.ts:L166-212](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L166-L212)
5.  **Backward Compatibility**: The system maintains the frontmatter parser block as a fallback strategy. If a reviewer supplies a custom Markdown transcript that starts with `---`, the system will honor the defined fields.
    *   *Verification Location*: [parser.ts:L217-240](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/parser.ts#L217-L240)

---

## 🔍 Retrieval & Query API (`POST /api/query`)

The Express query API receives user queries, processes them offline via TF-IDF cosine-similarity, and synthesizes natural language answers with granular inline citations.

### 1. Stemming & Suffix Normalization
*   Queries and chunks are split and cleaned of standard noise stop words. Suffixes (`-s`, `-es`, `-ies`, `-ing`, `-ed`) are stemmed using a robust Porter-style grammatical stemmer.
*   *Verification Location*: [nlp.ts:L68-116](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts#L68-L116)

### 2. Semantic Query Scoring & Affinity Boosting
*   **Cosine similarity weights** are calibrated across the RAM corpus to match the stemmed query tokens. Boosts are given for project names (Quantum, Helium, Horizon) and employee first/last names (Vance, Rostova, Patel, Chen, Marcus, Amira, David, Sarah, Elena).
*   **Conversational Filler Downweighting**: Transition words (e.g., `say`, `said`, `says`, `ask`, `asks`) are downweighted by 90% in IDF to avoid transitions crowding out true relevance.
*   **Dialogue-Attribution Extraction**: Active dialogue speakers are extracted via `getChunkSpeaker` parsing speaker prefixes (e.g. `**Marcus Vance**:`) rather than attributing quotes to the facilitator.
*   **Dialogue Speaker-Topic Affinity Boost**: Adds a $+0.5$ baseline for active speaker query matches, plus a $+1.5$ boost per matching technical keyword contained in that active speaker's dialog block.
*   *Verification Location*: [nlp.ts:L117-123](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts#L117-L123) (speaker attribution) and [nlp.ts:L200-269](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts#L200-L269) (boosting and affinity scoring)

### 3. Citations & Synthesized Answers
*   Inline citations return a user-friendly index marker (`[1]`, `[2]`).
*   **Entity-Weighted Snippet Selector**: Snippets are split by newlines as well as traditional punctuation. Matching query tokens are weighted (technical keywords 3.0, speaker names 1.0, fillers 0.1) to select the most relevant sentence for citation. This guarantees technical terms (e.g., `"firmware update bricking"`) are quoted instead of standard speaker names or greetings.
*   The query result contains a detailed citation mapping representing chunk IDs, source file names, virtualized file paths, original authors (facilitators), exact matched quotes, dates, and the attendees array.
*   *Verification Location*: [nlp.ts:L320-344](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts#L320-L344) (weighted sentence selection) and [nlp.ts:L305-319](file:///d:/Antigravity%20Projects/TER%20Take%20Home%20Exercise/src/backend/services/nlp.ts#L305-L319) (citation metadata)

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

*   **Option 1: Run Automated Verification Suite**: Instantly executes Exercise 1 assertions, checking topic matching, dialogue speaker preservation, derived date mapping, and domain classification.
*   **Option 2: Interactive Query Sandbox**: Type free-form queries (e.g. "What did Elena target for MAE?") to see the full synthesized answer, granular metadata, and the **synchronous `executionPipeline` trace logging** showing stemmed query tokens, calculated weights, and scores.
*   **Option 3: Print cURL Commands**: Displays pre-formatted copy-pasteable `cURL` commands to query the Express API.
