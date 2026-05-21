# WORKFLOW: Lead Correction & Self-Healing
**Version**: 0.1
**Date**: 2026-05-20
**Author**: Workflow Architect
**Status**: Review

## Overview
This workflow describes how an administrative operator or Team Lead resolves captured user feedback and corrections in the **Audit Queue** control panel. Resolving an item changes its status to `resolved` on disk and automatically triggers **Self-Healing Index Sync**: generating a virtual `DocumentChunk` from the user's corrected answer and instantly injecting it into the server's in-memory `documentIndex` so subsequent queries reflect the correct knowledge without requiring an application restart.

## Actors
| Actor | Role in this workflow |
|---|---|
| Team Lead (Operator) | Reviews corrections in the Audit Queue UI, clicks "Apply Correction" |
| Express Server | Receives the resolution request, triggers in-memory index sync |
| `DatabaseService` | Updates the status of the target `FeedbackItem` to `resolved = true` on disk |
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

**Observable states during this step**:
  - **Team Lead sees**: Pulsing loading circle next to table row.
  - **Database**: Unchanged.
  - **Logs**: `[Server] Processing resolution for feedback ID: fb_1716243884000_123`

---

### STEP 2: Persist Resolved State on Disk
**Actor**: `DatabaseService`
**Action**: Modifies the `resolved` parameter of the feedback record to `true`. Overwrites `feedback.json` with the updated array.
**Timeout**: 2s
**Input**: `targetFeedbackItem`
**Output on SUCCESS**: File updated on disk -> GO TO STEP 3
**Output on FAILURE**:
  - `FAILURE(fs_write_error)`: Unable to write to disk -> [recovery: Log critical error, return 500 status to client]

**Observable states during this step**:
  - **Team Lead sees**: Loading indicator continues.
  - **Database**: `feedback.json` contains `resolved: true` for this item.
  - **Logs**: `[Database] Successfully marked feedback fb_1716243884000_123 as resolved.`

---

### STEP 3: Self-Healing Index Dynamic Sync
**Actor**: Express Server & `documentIndex`
**Action**: Generates a virtual `DocumentChunk` based on the corrected answer:
  - **ID**: `virtual_corr_[feedbackId]`
  - **Content**: `[Corrected Answer Text]`
  - **Domain**: Mapped from feedback item domain
  - **Author**: Mapped from expert directory of that domain
  - **Priority**: Set to `High`
  - **filePath**: `virtual/correction/[feedbackId]`
  - **fileName**: `virtual_correction_[feedbackId]`
  - **fileType**: `transcript`
  Injects this virtual chunk directly into the active in-memory `documentIndex` array.
**Timeout**: 1s
**Input**: `targetFeedbackItem`
**Output on SUCCESS**: Chunk injected -> GO TO STEP 4
**Output on FAILURE**:
  - `FAILURE(sync_error)`: In-memory store read-only or empty -> [recovery: Log warning, continue to Step 4. Index will sync on next manual filesystem re-scan or system restart]

**Observable states during this step**:
  - **Database**: RAM index expanded by +1 virtual chunk.
  - **Logs**: `⚡ Self-healing: Injected virtual correction chunk virtual_corr_fb_1716243884000_123 into search memory.`

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

## State Transitions
```
[FeedbackItem: unresolved] -> (POST /api/feedback/resolve) -> [FeedbackItem: resolved]
[documentIndex: live] -> (Dynamic Feedback Sync) -> [documentIndex: updated]
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
| TC-02: Duplicate Resolution | Double click resolution button | First call resolves successfully. Second call returns 404/400 (already resolved or not found) without crashing |
| TC-03: Index Sync Verification | Resolve correction "MAE is 1.2 MW", then search "What is MAE?" | Search yields High Confidence, referencing the virtual correction chunk |

---

## Assumptions
| # | Assumption | Where Verified | Risk if Wrong |
|---|---|---|---|
| A1 | Re-indexing files doesn't wipe virtual corrections | Not verified | Manual `/api/ingest` wipe out virtual fixes |

## Spec vs Reality Audit Log
| Date | Finding | Action taken |
|---|---|---|
| 2026-05-20 | Initial spec created | Self-healing memory synchronization designed to cure Database Drift |
