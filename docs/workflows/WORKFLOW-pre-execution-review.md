# WORKFLOW: Pre-Execution Reference Document Review
**Version**: 0.1
**Date**: 2026-05-21
**Author**: Workflow Architect
**Status**: Approved

## Overview
This workflow describes how an autonomous agent must perform a rapid discovery and reading audit of relevant reference documents in the `/docs` folder *before* any implementation plan or code modifications are made. This process ensures the agent operates with complete, real-time context on the project's architectural decisions, REST API structures, frontend styles, and active task lists, preventing codebase-documentation drift, duplicate work, and design deviations.

---

## Actors
| Actor | Role in this workflow |
|---|---|
| AI Coding Agent | Performs active discovery, reads reference files, and incorporates constraints into plans |

---

## Prerequisites
- The `/docs` folder must be populated with active system references (e.g. `BACKEND.md`, `ARCHITECTURE.md`, `FRONTEND.md`, `DECISIONS.md`, `TASK.md`).
- The agent must be in Planning Mode or initiating a new session block.

---

## Trigger
- A new user request is received requiring an implementation plan, architectural refactoring, or source code modifications.

---

## Workflow Tree

### STEP 1: Reference Directory Discovery
**Actor**: AI Coding Agent
**Action**: Scans the `/docs` directory to catalog all active reference materials, checking for updated decisions, architecture layouts, or task list changes.
**Timeout**: 2s
**Input**: Workspace root
**Output on SUCCESS**: Reference file list -> GO TO STEP 2
**Output on FAILURE**:
  - `FAILURE(docs_missing)`: `/docs` folder not found -> [recovery: Propose creation of standard `/docs` folder, initialize `TASK.md`, and report gap to user]

**Observable states during this step**:
  - **User sees**: Turn started, agent scanning workspace workspace.
  - **Logs**: `🔍 Initiating pre-execution discovery of reference documents in /docs.`

---

### STEP 2: Document Context Mapping
**Actor**: AI Coding Agent
**Action**: Maps the user's specific request scope to the relevant reference documents:
*   **Database, API Endpoints, parsing logic** $\rightarrow$ Map to `docs/BACKEND.md` and `docs/DECISIONS.md`.
*   **Data flows, system dependencies, STRIDE perimeters** $\rightarrow$ Map to `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`.
*   **React components, styles, visual transitions** $\rightarrow$ Map to `docs/FRONTEND.md` and `docs/DECISIONS.md`.
*   **Task checklist alignment, current phase progress** $\rightarrow$ Map to `docs/TASK.md`.
**Timeout**: 1s
**Input**: Reference file list & request scope
**Output on SUCCESS**: Mapped document paths -> GO TO STEP 3
**Output on FAILURE**:
  - `FAILURE(unknown_scope)`: Scope does not map to existing references -> [recovery: Select `docs/DECISIONS.md` and `docs/TASK.md` as standard fallbacks]

---

### STEP 3: Mapped Document Audit
**Actor**: AI Coding Agent
**Action**: Executes `view_file` on each of the mapped document paths. Reads the contents to extract technical constraints (e.g., active endpoint payloads, CSS class conventions, or path virtualization rules).
**Timeout**: 5s
**Input**: Mapped document paths
**Output on SUCCESS**: Active context loaded in memory -> GO TO STEP 4
**Output on FAILURE**:
  - `FAILURE(read_error)`: Unable to read file -> [recovery: Alert user of file lock or permission issue, check `list_permissions`]

**Observable states during this step**:
  - **User sees**: Agent reading reference files (e.g. `BACKEND.md`).
  - **Logs**: `📖 Reviewing reference document: docs/BACKEND.md to align with existing schemas.`

---

### STEP 4: Incorporate Constraints into Plan
**Actor**: AI Coding Agent
**Action**: Synthesizes the extracted reference rules directly into the new `implementation_plan.md` or task checklist. Ensures no Tailwind configs are introduced if vanilla CSS is mandated, no physical directories are exposed if virtualization is active, and no duplicate endpoints are designed.
**Timeout**: 2s
**Input**: Loaded active context
**Output on SUCCESS**: Reference-aligned implementation plan -> Complete Workflow.

---

## State Transitions
```
[none] -> (Trigger: User request) -> [docs_mapped] -> (view_file complete) -> [docs_aligned]
```

---

## Handoff Contracts
This workflow is entirely executed within the agent's pre-planning loop.
- **Output Artifact**: An `implementation_plan.md` containing explicit references to the audited documents in its design choices.

---

## Test Cases

| Test | Trigger | Expected behavior |
|---|---|---|
| TC-01: Standard Planning Run | User asks to add feedback API | Agent reads `BACKEND.md` first, identifies `escapeHtml` and `safeWriteJson` patterns, and incorporates them into the new API plan |
| TC-02: Styling Refactoring Run | User asks to style search console | Agent reads `FRONTEND.md` and `DECISIONS.md`, identifies vanilla CSS styling constraints, and refrains from suggesting Tailwind packages |
| TC-03: Corpus Update Run | User asks to adjust data generators | Agent reads `SYNTHETIC_DATA.md` and `TASK.md` to ensure data bounds are honored and status is updated |

---

## Assumptions
| # | Assumption | Where Verified | Risk if Wrong |
|---|---|---|---|
| A1 | Documents in `/docs` represent the authoritative truth | Checked via git status & source cross-check | If outdated, agent designs against stale patterns |

---

## Spec vs Reality Audit Log
| Date | Finding | Action taken |
|---|---|---|
| 2026-05-21 | Initial pre-execution workflow spec created | Enforced pre-plan reading constraints |
