# WORKFLOW: Lead Correction & Self-Healing
**Version**: 0.2
**Date**: 2026-05-21
**Author**: Workflow Architect
**Status**: Approved

## Overview
This workflow describes how an administrative operator or Team Lead resolves captured user feedback and corrections in the **Audit Queue** control panel. Resolving an item changes its status to `resolved` on disk and automatically triggers **Self-Healing Index Sync**: generating a virtual `DocumentChunk` from the user's corrected answer and instantly injecting it into the server's in-memory `documentIndex` so subsequent queries reflect the correct knowledge without requiring an application restart.

Additionally, resolved corrections are **re-injected on every server boot** via `injectResolvedCorrections()`, ensuring that virtual correction chunks persist across application restarts.

## Actors
| Actor | Role in this workflow |
|---|---|
| Team Lead (Operator) | Reviews corrections in the Audit Queue UI, clicks "Apply Correction" |
| Express Server | Receives the resolution request, triggers in-memory index sync |
| `DatabaseService` | Updates the status of the target `FeedbackItem` to `resolved = true` on disk via `safeWriteJson` |
| `documentIndex` (RAM) | Receives the dynamic correction chunk injection for real-time search self-healing |

## Prerequisites
- Target `FeedbackItem` must exist in `data/db/feedback.json` with status `resolved = false`.
- Server must be running and connected to UI console.

## Trigger
- Team Lead clicks "Apply Correction" or "Dismiss" button next to a feedback item in the `AuditQueue` dashboard (`POST /api/feedback/resolve`).

---

## Workflow Tree

### STEP 1: Load & Verify Feedback Item
**Actor**: `DatabaseService`
**Action**: Reads `/data/db/feedback.json`, locates the record with matching `feedbackId`, and verifies it is currently `resolved: false`.
**Timeout**: 2s
**Input**: `{ feedbackId: string }`
**Output on SUCCESS**: `targetFeedbackItem` -> GO TO STEP 2
**Output on FAILURE**:
  - `FAILURE(not_found)`: No feedback item matched the ID -> [recovery: Return 404 Not Found error status, terminate workflow]
  - `FAILURE(missing_feedbackId)`: No `feedbackId` in request body -> [recovery: Return 400 Bad Request, terminate workflow]

**Observable states during this step**:
  - **Team Lead sees**: Pulsing loading circle next to table row.
  - **Database**: Unchanged.
  - **Logs**: `[Server] Processing resolution for feedback ID: fb_1716243884000_123`

---

### STEP 2: Persist Resolved State on Disk
**Actor**: `DatabaseService`
**Action**: Modifies the `resolved` parameter of the feedback record to `true`. Sets `resolvedTimestamp` to current ISO timestamp. Overwrites `feedback.json` with the updated array via `safeWriteJson()` (atomic temp-file write pattern).
**Timeout**: 2s
**Input**: `targetFeedbackItem`
**Output on SUCCESS**: File updated on disk -> GO TO STEP 3
**Output on FAILURE**:
  - `FAILURE(fs_write_error)`: Unable to write to disk -> [recovery: Log critical error, return 500 status to client]

**Observable states during this step**:
  - **Team Lead sees**: Loading indicator continues.
  - **Database**: `feedback.json` contains `resolved: true` and `resolvedTimestamp` for this item.
  - **Logs**: `[Database] Successfully marked feedback fb_1716243884000_123 as resolved.`

---

### STEP 3: Self-Healing Index Dynamic Sync
**Actor**: Express Server & `documentIndex`
**Action**: Checks if the resolved feedback item has a non-empty `correctedAnswer`. If yes, generates a virtual `DocumentChunk`:
  - **ID**: `virtual_fb_[feedbackId]`
  - **Content**: `[Query Correlation: "[original query]"] - Resolved Answer: [corrected answer text]`
  - **Domain**: Mapped from feedback item `domain` field (fallback: `"General"`)
  - **Author**: `"System Operator (Approved)"`
  - **Priority**: Set to `High`
  - **filePath**: `virtual/correction/[feedbackId]`
  - **fileName**: `virtual_correction_[feedbackId]`
  - **fileType**: `transcript`
  - **queryCorrelation**: Original query text (used for exact-match boosting in search)

  Checks if a chunk with the same ID already exists in `documentIndex`:
  - If yes: **replaces** the existing chunk (idempotent update).
  - If no: **pushes** new chunk to the end of the array.

  If the feedback item has no `correctedAnswer` (e.g. a rejection without correction), skip injection — proceed directly to Step 4.
**Timeout**: 1s
**Input**: `targetFeedbackItem`
**Output on SUCCESS**: Chunk injected (or skipped if no correctedAnswer) -> GO TO STEP 4
**Output on FAILURE**:
  - `FAILURE(sync_error)`: In-memory store read-only or empty -> [recovery: Log warning, continue to Step 4. Index will sync on next manual filesystem re-scan or system restart]

**Observable states during this step**:
  - **Database**: RAM index expanded by +1 virtual chunk.
  - **Logs**: `⚡ Self-healing Sync: Injected virtual correction chunk virtual_fb_fb_1716243884000_123 into search index.`

---

### STEP 4: Return Response & Refresh Frontend View
**Actor**: Express Server
**Action**: Returns HTTP 200 `success: true` to the Audit Queue interface. The frontend table refreshes, removing the resolved item from the active table with a slide-out transition.
**Timeout**: 1s
**Input**: Success signal
**Output on SUCCESS**: HTTP 200 payload -> Terminate Workflow.
**Output on FAILURE**:
  - `FAILURE(network_closed)`: Client lost connection -> [recovery: Silent completion, system state already synchronized]

**Observable states during this step**:
  - **Team Lead sees**: Row disappears from Audit Queue. System Health Index in Analytics increases.
  - **Logs**: `[HTTP] POST /api/feedback/resolve completed 200 OK`

---

## Boot-Time Re-Injection (Companion Flow)

On every server start, `bootstrapIndex()` calls `injectResolvedCorrections()` after loading the filesystem index. This function:
1. Reads all feedback from `feedback.json`.
2. Filters for resolved items with non-empty `correctedAnswer`.
3. Generates the same virtual `DocumentChunk` format as Step 3.
4. Injects each into `documentIndex` (upsert by chunk ID).
5. Logs: `⚡ Self-healing: Re-injected N resolved corrections into memory index.`

This ensures corrections survive application restarts and re-ingestion cycles.

---

## State Transitions
```
[FeedbackItem: unresolved] -> (POST /api/feedback/resolve) -> [FeedbackItem: resolved]
[documentIndex: live] -> (Dynamic Feedback Sync) -> [documentIndex: updated]
[documentIndex: empty] -> (Boot-time re-injection) -> [documentIndex: updated]
```

---

## Handoff Contracts

### Audit Queue Client -> Express `/api/feedback/resolve`
**Payload**:
```json
{
  "feedbackId": "fb_1716243884000_584"
}
```
**Success Response**:
```json
{
  "success": true
}
```
**Timeout**: 5s

---

## Cleanup Inventory
None.

---

## Test Cases

| Test | Trigger | Expected behavior |
|---|---|---|
| TC-01: Apply Valid Correction | Click "Apply Correction" in Audit Queue | Row is removed, resolved: true on disk, virtual chunk matches searches immediately |
| TC-02: Duplicate Resolution | Double click resolution button | First call resolves successfully. Second call returns 404 (item already resolved or not found) without crashing |
| TC-03: Index Sync Verification | Resolve correction "MAE is 1.2 MW", then search "What is MAE?" | Search yields High Confidence, referencing the virtual correction chunk |
| TC-04: Boot Persistence | Resolve a correction, restart the server, search for the corrected topic | Virtual chunk is re-injected from `feedback.json` at boot, search still returns corrected answer |
| TC-05: Rejection Without Correction | Resolve a "rejected" item with no correctedAnswer | Item is resolved on disk, NO virtual chunk is injected (no content to inject) |
| TC-06: Missing feedbackId | Send empty body `{}` | Returns 400 Bad Request with error message |

---

## Assumptions
| # | Assumption | Where Verified | Risk if Wrong |
|---|---|---|---|
| A1 | Re-indexing files doesn't wipe virtual corrections | Verified: `injectResolvedCorrections()` is called AFTER `parserService.ingestAll()` in both bootstrap and manual re-ingest | Low risk — order is enforced in code |
| A2 | `resolvedTimestamp` is set accurately from server time | Not verified against NTP | Minor risk if server clock is wrong |

## Spec vs Reality Audit Log
| Date | Finding | Action taken |
|---|---|---|
| 2026-05-20 | Initial spec created | Self-healing memory synchronization designed to cure Database Drift |
| 2026-05-21 | Code uses `safeWriteJson()` for atomic writes — spec didn't mention | Updated Step 2 to document atomic write pattern |
| 2026-05-21 | Code sets `resolvedTimestamp` on resolution — spec didn't mention | Added to Step 2 observable states |
| 2026-05-21 | Code re-injects corrections at boot via `injectResolvedCorrections()` — spec didn't cover | Added Boot-Time Re-Injection section, updated Assumption A1, added TC-04 |
| 2026-05-21 | Code checks for empty `correctedAnswer` before injection — spec implied always inject | Updated Step 3 to document the no-correction skip path, added TC-05 |
| 2026-05-21 | Status changed from "Review" to "Approved" after verifying code alignment | — |
