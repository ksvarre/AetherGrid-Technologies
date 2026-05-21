# WORKFLOW: Knowledge Ingestion & Parsing
**Version**: 0.1
**Date**: 2026-05-20
**Author**: Workflow Architect
**Status**: Approved

## Overview
This workflow describes how the AetherGrid backend scans the local filesystem for Markdown transcripts and Office documents, parses their textual contents, extracts metadata (author, date, attendees, topic domain, priority level), chunks the text into semantic units, and populates the in-memory retrieval index.

## Actors
| Actor | Role in this workflow |
|---|---|
| System Operator | Triggers manual ingestion via the UI console |
| Server Bootstrapper | Triggers automated ingestion during application boot |
| `ParserService` | Orchestrates file discovery, parsing strategy, and chunk generation |
| Extractor Libraries | Mammoth (.docx), SheetJS (.xlsx), Officeparser (.pptx) extract raw text |
| In-Memory Cache | Holds the compiled index array (`DocumentChunk[]`) for semantic search |

## Prerequisites
- Files to ingest must exist in `data/transcripts/` or `data/documents/` (or default mock directory structures).
- Server must have read access to the data directories.
- Parser service must be initialized.

## Trigger
- System Boot: Automatically runs `bootstrapIndex()` on start.
- Manual API: HTTP `POST /api/ingest` triggered by operator clicking "Re-scan System Data" in the UI.

---

## Workflow Tree

### STEP 1: Scan Data Directories
**Actor**: `ParserService`
**Action**: Scans and reads files under `/data/transcripts` (Markdown) and `/data/documents` (Office documents).
**Timeout**: 5s
**Input**: Directory paths
**Output on SUCCESS**: `filesList` -> GO TO STEP 2
**Output on FAILURE**:
  - `FAILURE(dir_missing)`: `/data` or subfolders do not exist -> [recovery: Create directory paths recursively, return empty results, log error, GO TO STEP 4]
  - `FAILURE(fs_read_error)`: Disk read/access permission error -> [recovery: Log critical permission issue, abort with 500 error status, notify operator]

**Observable states during this step**:
  - **Operator sees**: "Re-scanning..." status badge on navbar / spinning loader.
  - **Database**: In-memory `documentIndex` remains unchanged.
  - **Logs**: `[Parser] Scanning directories /data/transcripts and /data/documents`

---

### STEP 2: Parse File Formats & Extract Metadata
**Actor**: `ParserService` & Extractor libraries
**Action**: Iterates through each discovered file and applies specific parser:
  - **Markdown (`.md`)**: Parses frontmatter (YAML block) for metadata and splits body by paragraphs.
  - **Word (`.docx`)**: Runs `mammoth` text extraction, searches text layout for author/date indicators.
  - **Excel (`.xlsx`)**: Runs `SheetJS` to read sheets, parses customized metadata block, builds grid strings.
  - **PowerPoint (`.pptx`)**: Runs `officeparser` to extract slide texts.
**Timeout**: 30s
**Input**: `filesList` (array of file paths)
**Output on SUCCESS**: `rawChunksList` -> GO TO STEP 3
**Output on FAILURE**:
  - `FAILURE(mammoth_error)`: Specific Word document corrupt or unreadable -> [recovery: Log warning, skip document, proceed with rest of the files]
  - `FAILURE(sheetjs_error)`: Excel sheet corrupt or format invalid -> [recovery: Log warning, skip document, proceed with rest of the files]
  - `FAILURE(officeparser_error)`: PowerPoint extraction crash -> [recovery: Log warning, skip document, proceed with rest of the files]

**Observable states during this step**:
  - **Operator sees**: Typing-loader waves or spinning progress bars.
  - **Database**: Index remains in previous state.
  - **Logs**: `[Parser] Parsing file: client_onboarding.docx ...`

---

### STEP 3: Semantic Chunking & Virtual Path Construction
**Actor**: `ParserService`
**Action**: Breaks raw extracted text into semantic blocks (paragraphs or slide slides). Assigns a unique chunk ID. Performs virtual path normalization to hide absolute directory layouts.
**Timeout**: 2s
**Input**: `rawChunksList`
**Output on SUCCESS**: `documentChunks` -> GO TO STEP 4
**Output on FAILURE**:
  - `FAILURE(out_of_memory)`: Corpus too large for V8 Heap -> [recovery: Heap overflow. Process restarts. Log error. Fall back to reading first N chunks only.]

**Observable states during this step**:
  - **Operator sees**: Page transition loading indicator.
  - **Logs**: `[Parser] Normalized absolute paths to workspace virtual roots for 142 chunks.`

---

### STEP 4: Commit to Memory Store (Index Sync)
**Actor**: `ParserService` & `server.ts`
**Action**: Overwrites the in-memory array `documentIndex` with `documentChunks`.
**Timeout**: 1s
**Input**: `documentChunks` (array of `DocumentChunk`)
**Output on SUCCESS**: Returns `IngestResponse` with chunk counts.
**Output on FAILURE**:
  - `FAILURE(concurrency_lock)`: Memory index locked by concurrent search query -> [recovery: Await lock release, retry within 100ms]

**Observable states during this step**:
  - **Operator sees**: Status turns "Online" with updated chunk count.
  - **Database**: `documentIndex` array is updated in active RAM.
  - **Logs**: `✅ Ingestion complete. Indexed X semantic text chunks across all transcripts and office documents.`

---

## State Transitions
```
[empty] -> (bootstrapIndex success) -> [live]
[live] -> (POST /api/ingest trigger) -> [live]
[live] -> (POST /api/ingest failure) -> [live] (preserves previous index)
```

---

## Handoff Contracts

### Express Controller -> ParserService
**Method**: `parserService.ingestAll()`
**Payload**: None (scans workspace directories)
**Success response**:
```json
[
  {
    "id": "transcripts_sop.md_chunk_0",
    "filePath": "data/transcripts/transcripts_sop.md",
    "fileName": "transcripts_sop.md",
    "fileType": "transcript",
    "content": "Detailed text chunk content here...",
    "author": "Marcus Vance",
    "attendees": ["David Kross", "Amira Patel"],
    "date": "2026-05-12",
    "domain": "Safety & Compliance",
    "priority": "High"
  }
]
```
**Timeout**: 35s

---

## Cleanup Inventory
No external database connections or cloud files are created. Temporary file streams are closed automatically by native node processes.

---

## Test Cases

| Test | Trigger | Expected behavior |
|---|---|---|
| TC-01: System boot bootstrap | Server starts | Scans `data/`, indexes files, logs total chunks without crashing |
| TC-02: Missing Directory | Delete `data/documents` and start | Creates empty directories, boot completes, reports 0 chunks |
| TC-03: Corrupt Office document | Invalid zip file named `test.docx` inside data | Skips `test.docx`, logs error, indexes all other files |
| TC-04: Manual trigger scan | Send `POST /api/ingest` | Re-indexes filesystem, returns 200 JSON with new chunk counts |

---

## Assumptions
| # | Assumption | Where Verified | Risk if Wrong |
|---|---|---|---|
| A1 | File encoding is UTF-8 or standard ASCII | Not verified | Special characters may show up corrupted |
| A2 | Mammoth/SheetJS do not leak memory during large parses | Verified: manual runs | Node process runs out of memory on huge datasets |

## Spec vs Reality Audit Log
| Date | Finding | Action taken |
|---|---|---|
| 2026-05-20 | Initial spec created | Documents are parsed sequentially from filesystem |
