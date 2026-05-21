# WORKFLOW: User Gap Feedback Capture
**Version**: 0.1
**Date**: 2026-05-20
**Author**: Workflow Architect
**Status**: Approved

## Overview
This workflow describes how the AetherGrid system captures user corrections or search rejections when the retrieval engine returns inaccurate or incomplete information. Feedback is processed on the backend, sanitized to prevent stored scripting vulnerabilities, assigned a unique ID, and persisted to `data/db/feedback.json` for subsequent operator audit.

## Actors
| Actor | Role in this workflow |
|---|---|
| Employee (User) | Submits correction or marks answer as incorrect in the Search Console UI |
| Express Server | Receives the feedback request, sanitizes string inputs |
| `DatabaseService` | Commits raw feedback items to the transactional JSON database file |

## Prerequisites
- Feedback directories must exist (`/data/db`).
- Backend server must have write permissions to `/data/db/feedback.json`.

## Trigger
- User clicks "Mark Inaccurate" or types a correction and clicks "Submit Correction" in the `SearchConsole` panel (`POST /api/feedback`).

---

## Workflow Tree

### STEP 1: Input Validation & Hardening Sanitization
**Actor**: Express Server & `DatabaseService`
**Action**: Validates payload parameters. Most importantly, sanitizes HTML tags inside `correctedAnswer` to prevent **Stored XSS** injection (STRIDE security hardening) before saving it.
- **Sanitization Rule**: Replace `<` with `&lt;`, `>` with `&gt;`, `"` with `&quot;`, `'` with `&#x27;`, `/` with `&#x2F;`.
**Timeout**: 1s
**Input**: `{ query, answer, confidenceScore, status, correctedAnswer, domain }`
**Output on SUCCESS**: Sanitized payload -> GO TO STEP 2
**Output on FAILURE**:
  - `FAILURE(validation_error)`: Query or status missing -> [recovery: Return 400 Bad Request, abort workflow]

**Observable states during this step**:
  - **User sees**: Submitting animation / "Saving feedback..."
  - **Database**: Unchanged.
  - **Logs**: `[Server] Sanitizing incoming feedback for query: "What is MAE?"`

---

### STEP 2: Persist Feedback Record
**Actor**: `DatabaseService`
**Action**: Loads the existing feedback array from `data/db/feedback.json`, generates a unique ID (e.g. `fb_1716243884000_123`), sets `resolved` to `false`, appends the new record, and writes the stream back to the file.
**Timeout**: 2s
**Input**: Sanitized payload
**Output on SUCCESS**: `feedbackId` -> GO TO STEP 3
**Output on FAILURE**:
  - `FAILURE(fs_write_error)`: Unable to write to disk -> [recovery: Log critical disk write error, return 500 status to client]

**Observable states during this step**:
  - **User sees**: Submission complete.
  - **Database**: `feedback.json` updated with new unresolved record.
  - **Logs**: `📝 Captured user gap feedback (correction): fb_1716243884000_394`

---

### STEP 3: Return Response & Complete Action
**Actor**: Express Server
**Action**: Sends `success: true` and the newly created `feedbackId` back to the frontend UI to display success feedback.
**Timeout**: 1s
**Input**: `feedbackId`
**Output on SUCCESS**: HTTP 200 payload -> Complete Workflow.
**Output on FAILURE**:
  - `FAILURE(network_closed)`: Client disconnected -> [recovery: Silent completion, transaction already committed on disk]

**Observable states during this step**:
  - **User sees**: Success micro-animation (e.g. green checkmark, auto-collapsing feedback widget).
  - **Database**: `feedback.json` contains unresolved feedback.
  - **Logs**: `[HTTP] POST /api/feedback completed 200 OK`

---

## State Transitions
```
[none] -> (POST /api/feedback success) -> [FeedbackItem: unresolved]
```

---

## Handoff Contracts

### Frontend Client -> Express `/api/feedback`
**Payload**:
```json
{
  "query": "Who is the lead on Project Helium?",
  "answer": "Marcus Vance is VP of Engineering...",
  "confidenceScore": 0.55,
  "status": "correction",
  "correctedAnswer": "<script>alert('XSS')</script>Actually it is Sarah Chen.",
  "domain": "Project Helium"
}
```
**Success Response**:
```json
{
  "success": true,
  "feedbackId": "fb_1716243884000_584"
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
| TC-01: Valid Feedback Submission | Submit correction payload | Return `success: true`, record added to `feedback.json` |
| TC-02: Stored XSS Prevention | Submit `correctedAnswer` with `<script>` tag | The script tag is escaped (`&lt;script&gt;`), saved in file, rendering safely as raw text in UI |
| TC-03: Missing status parameter | Submit payload without `status` | Return 400 Bad Request error |

---

## Assumptions
| # | Assumption | Where Verified | Risk if Wrong |
|---|---|---|---|
| A1 | File system is not concurrent-write restricted | Verified: single instance runs | Concurrency issues if multi-instances write simultaneously |

## Spec vs Reality Audit Log
| Date | Finding | Action taken |
|---|---|---|
| 2026-05-20 | Initial spec created | Escaping rules enforced on raw text entries |
