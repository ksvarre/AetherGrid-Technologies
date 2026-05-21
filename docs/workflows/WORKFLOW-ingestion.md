# WORKFLOW: Knowledge Ingestion & Parsing
**Version**: 0.2
**Date**: 2026-05-21
**Author**: Workflow Architect
**Status**: Approved

## Overview
This workflow describes how the AetherGrid backend scans the local filesystem for Markdown transcripts (`data/transcripts/`) and Office documents (`data/documents/`), applies security validation (file size limits, magic-byte verification), parses their textual contents using format-specific extractors (Mammoth for Word, SheetJS for Excel, OfficeParser for PowerPoint), extracts structured metadata, chunks the text into paragraph units, and populates the in-memory retrieval index. A persistent file-system cache (`indexed_chunks.json`) accelerates re-ingestion for unchanged files.

## Actors
| Actor | Role in this workflow |
|---|---|
| System Operator | Triggers manual ingestion via the UI console |
| Server Bootstrapper | Triggers automated ingestion during application boot |
| `ParserService` | Orchestrates file discovery, security validation, format-specific parsing, metadata extraction, caching, and chunk generation |
| Mammoth (`.docx`/`.doc`) | Extracts raw text from Word documents |
| SheetJS (`.xlsx`/`.xls`) | Extracts tabular data from Excel spreadsheets |
| OfficeParser (`.pptx`/`.ppt`) | Extracts text from PowerPoint slides |
| In-Memory Cache | Holds the compiled index array (`DocumentChunk[]`) for semantic search |
| Persistent Cache (`indexed_chunks.json`) | Stores parsed chunks keyed by file path, mtime, and size for fast re-ingestion |

## Prerequisites
- Files to ingest must exist in `data/transcripts/` and/or `data/documents/`.
- Server must have read access to both directories.
- Parser service must be initialized.

## Trigger
- System Boot: Automatically runs `bootstrapIndex()` on start (followed by `injectResolvedCorrections()`).
- Manual API: HTTP `POST /api/ingest` triggered by operator or test runners.

---

## Workflow Tree

### STEP 1: Scan Data Directories
**Actor**: `ParserService`
**Action**: Scans two directories:
  - `/data/transcripts/` — Markdown files (`.md`)
  - `/data/documents/` — Office documents (`.docx`, `.doc`, `.pptx`, `.ppt`, `.xlsx`, `.xls`)

Loads the persistent ingestion cache from `data/db/indexed_chunks.json` if it exists.
**Timeout**: 5s
**Input**: Directory paths
**Output on SUCCESS**: `filesList` + cache state -> GO TO STEP 2
**Output on FAILURE**:
  - `FAILURE(dir_missing)`: Directory does not exist -> [recovery: Create directory recursively, return empty results, log error, GO TO STEP 5]
  - `FAILURE(fs_read_error)`: Disk read/access permission error -> [recovery: Log critical permission issue, abort with 500 error status, notify operator]

**Observable states during this step**:
  - **Logs**: `[Parser] Scanning directory /data/transcripts`

---

### STEP 2: Security Validation Gate
**Actor**: `ParserService`
**Action**: For each discovered Office document (`.docx`, `.xlsx`, `.pptx`, etc.):
  1. **File Size Check**: Rejects files exceeding **50MB** (`MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024`) to prevent memory exhaustion or DoS.
  2. **Magic-Byte Validation**: Reads the first 8 bytes and verifies against known Office format signatures:
     - ZIP header (`PK` / `50 4B`) for modern Office XML formats (`.docx`, `.xlsx`, `.pptx`)
     - OLE2 header (`D0 CF 11 E0`) for legacy binary formats (`.doc`, `.xls`, `.ppt`)
  3. **Cache Hit Check**: Compares file `mtime` and `size` against the persistent cache. If unchanged, loads cached chunks directly (skipping parse).
**Timeout**: 2s per file
**Input**: File path, stat metadata
**Output on SUCCESS**: Validated file -> GO TO STEP 3, or Cache Hit -> GO TO STEP 5 (skip parsing)
**Output on FAILURE**:
  - `FAILURE(oversized)`: File exceeds 50MB -> [recovery: Log warning `🛡️ Security: Skipping oversized file`, skip file, continue with remaining files]
  - `FAILURE(invalid_magic_bytes)`: Unrecognized file header -> [recovery: Log warning `🛡️ Security: Skipping file with invalid magic bytes`, skip file, continue with remaining files]

**Observable states during this step**:
  - **Logs (oversized)**: `🛡️ Security: Skipping oversized file "massive_data.xlsx" (65.2MB exceeds 50MB limit).`
  - **Logs (invalid bytes)**: `🛡️ Security: Skipping file "suspicious.docx" — unrecognized magic bytes.`
  - **Logs (cache hit)**: `[Cache HIT]`

---

### STEP 3: Parse File Formats & Extract Metadata
**Actor**: `ParserService` & format-specific parsers
**Action**: Iterates through each validated file and applies the appropriate parser:
  - **Markdown (`.md`)**: Programmatically extracts the meeting date from the filename (`YYYY_MM_DD` format), captures speaker markers (`**Name**:`) to compile a unique attendees array, maps topic domains using key-phrase vocabularies, classifies priority levels using urgency keywords, identifies the facilitator from the first dialogue speaker, and splits body by paragraphs. (Maintains a fallback parser to support standard YAML frontmatter blocks for backward compatibility).
  - **Word (`.docx`/`.doc`)**: Uses Mammoth for `.docx` (raw text extraction), falls back to OfficeParser for legacy `.doc` binary format.
  - **Excel (`.xlsx`/`.xls`)**: Uses SheetJS to iterate sheets, converts each sheet to JSON rows, and formats them as `Sheet: "Name" | Tabular Data: ...` with a metadata block.
  - **PowerPoint (`.pptx`/`.ppt`)**: Uses OfficeParser to extract slide text content.
**Timeout**: 30s
**Input**: `validatedFilesList` (array of file paths)
**Output on SUCCESS**: `rawChunksList` -> GO TO STEP 4
**Output on FAILURE**:
  - `FAILURE(parse_error)`: Specific document unreadable or malformed -> [recovery: Log warning, skip document, proceed with rest of the files]

**Observable states during this step**:
  - **Operator sees**: Loading indicator.
  - **Database**: Index remains in previous state.
  - **Logs**: `[Parser] Parsing file: quantum_model_benchmarks_v1.xlsx ...`

---

### STEP 4: Semantic Chunking & Virtual Path Construction
**Actor**: `ParserService`
**Action**: Breaks raw extracted text into semantic blocks (paragraphs or slides). Assigns a unique chunk ID. Performs virtual path normalization using `path.relative()` to hide absolute directory layouts. Updates the persistent cache with new chunks.
**Timeout**: 2s
**Input**: `rawChunksList`
**Output on SUCCESS**: `documentChunks` -> GO TO STEP 5
**Output on FAILURE**:
  - `FAILURE(out_of_memory)`: Corpus too large for V8 Heap -> [recovery: Heap overflow. Process restarts. Log error. Fall back to reading first N chunks only.]

**Observable states during this step**:
  - **Logs**: `[Parser] Normalized absolute paths to workspace virtual roots for 142 chunks.`

---

### STEP 5: Commit to Memory Store & Inject Corrections (Index Sync)
**Actor**: `ParserService` & `server.ts`
**Action**: Overwrites the in-memory array `documentIndex` with `documentChunks`. Then calls `injectResolvedCorrections()` to scan `feedback.json` for all resolved corrections with non-empty `correctedAnswer` fields, generating virtual `DocumentChunk` entries and injecting them into the memory index for self-healing search.

Prunes stale entries from the persistent cache (files that no longer exist on disk). Saves updated cache to `indexed_chunks.json` via `safeWriteJson`.
**Timeout**: 1s
**Input**: `documentChunks` (array of `DocumentChunk`)
**Output on SUCCESS**: Returns `IngestResponse` with chunk counts.
**Output on FAILURE**:
  - `FAILURE(concurrency_lock)`: Memory index locked by concurrent search query -> [recovery: Await lock release, retry within 100ms]

**Observable states during this step**:
  - **Operator sees**: Status turns "Online" with updated chunk count.
  - **Database**: `documentIndex` array is updated in active RAM. `indexed_chunks.json` cache is updated on disk.
  - **Logs**: `✅ Ingestion complete. Indexed X semantic text chunks across all transcripts and office documents.`
  - **Logs (corrections)**: `⚡ Self-healing: Re-injected 5 resolved corrections into memory index.`

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
**Method**: `parserService.ingestAll(nlpEngine?, errorContainer?)`
**Payload**: Optional NLP engine for cloud-assisted metadata enrichment, optional error container for cloud errors.
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
No external database connections or cloud files are created. Temporary file streams are closed automatically by native node processes. Cache temp files (`.tmp`) are atomically renamed via `safeWriteJson`.

---

## Test Cases

| Test | Trigger | Expected behavior |
|---|---|---|
| TC-01: System boot bootstrap | Server starts | Scans `data/`, indexes files, logs total chunks without crashing |
| TC-02: Missing Directory | Delete `data/documents` and start | Creates empty directories, boot completes, reports 0 chunks |
| TC-03: Corrupt Office document | Invalid zip file named `test.docx` inside data | Skips `test.docx`, logs error, indexes all other files |
| TC-04: Manual trigger scan | Send `POST /api/ingest` | Re-indexes filesystem, returns 200 JSON with new chunk counts |
| TC-05: Oversized file rejection | Place a 60MB `.xlsx` file in data | File is skipped with `🛡️ Security` log warning, other files still indexed |
| TC-06: Invalid magic bytes | Rename a `.txt` file to `.docx` | File is skipped with magic-byte warning, not crash |
| TC-07: Cache hit efficiency | Run ingest twice without file changes | Second run reports cache hits, completes in <10ms |
| TC-08: Resolved corrections injection | Resolve feedback, then re-ingest | Virtual correction chunks appear in memory index alongside file-based chunks |

---

## Assumptions
| # | Assumption | Where Verified | Risk if Wrong |
|---|---|---|---|
| A1 | File encoding is UTF-8 or standard ASCII | Not verified | Special characters may show up corrupted |
| A2 | Mammoth/SheetJS/OfficeParser do not leak memory during large parses | Verified: manual runs + 50MB size limit | Node process runs out of memory on huge datasets |
| A3 | Cache mtime comparison is sufficient to detect file changes | Verified: fs.stat mtime resolution | Content changes that don't update mtime would be missed |
| A4 | Magic-byte validation covers all valid Office format variants | Partially verified: ZIP + OLE2 | Extremely rare format variants may be false-negative rejected |

## Spec vs Reality Audit Log
| Date | Finding | Action taken |
|---|---|---|
| 2026-05-20 | Initial spec created | Documents are parsed sequentially from filesystem |
| 2026-05-21 | Code now parses .docx, .doc, .xlsx, .xls, .pptx, .ppt — spec said Office docs were "bypassed" | Completely rewrote Step 2 and Step 3 to reflect actual parser implementation |
| 2026-05-21 | Code implements security guards (50MB size limit, magic-byte validation) — spec had no mention | Added Step 2 (Security Validation Gate) with details |
| 2026-05-21 | Code implements persistent cache for ingestion performance — spec had no mention | Added cache mechanics to Steps 1, 2, 4, 5 |
| 2026-05-21 | Code re-injects resolved corrections during bootstrap — spec didn't cover this | Added to Step 5 and TC-08 |
