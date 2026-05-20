---
description: Post-approval checklist — update docs, tests, and lifecycle scenarios after approving new chain logic
---

# Post-Approval Documentation & Sync Workflow

> **Trigger:** This workflow is activated every time the user **approves** a fix, feature, or change.
> If the conversation moves to a new topic without the user explicitly confirming approval, **you MUST ask**: _"Before we move on — was the previous change approved? If so, I'll update the docs and task list."_

---

## When to Run This Workflow

This workflow runs **after every approved change**, not just chain logic. The specific docs to update depend on **what category** the change falls into. Follow the decision tree below.

---

## Step 1 — Classify the Change

Determine which categories apply (multiple can apply to a single change):

| Category | Description | Examples |
|----------|-------------|----------|
| **UI / Visual** | Any change to what the user sees | New component, layout change, tooltip update, color/style fix |
| **Logic / Calculation** | Changes to formulas, parsing, classification, or data flow | Parser fix, new strategy formula, tax calculation update, premium capture |
| **Architecture / Backend** | Changes to system design, API, database, infra | New migration, API endpoint, RLS policy, Railway/Vercel config, provider restructuring |
| **Chain Lifecycle** | Changes to how chains are grouped, rolled, closed, or classified | New scenario, FIFO change, co-open matching, spread linking |

---

## Step 2 — Update Documentation (based on category)

### ALL changes (always do these):

#### 2a. Update `docs/TASKS.md`
// turbo
- Mark completed items as `[x]`
- If the work was part of a phased plan, update the phase status (add ✅ if all items complete)
- Add any new follow-up items discovered during implementation
- Update the "Last updated" date at the top of the file

#### 2b. Update the conversation's `task.md` artifact
// turbo
- Mark completed items as `[x]` in the conversation-local task list

---

### If **UI / Visual** changes:

#### 2c. Update the User Guide (`src/app/guide/page.tsx`)
- Add or update the section describing the changed feature
- If a new component/panel was added, document it with a description of what it shows and how to use it
- If tooltips or labels changed, update the guide text to match
- If filter behavior changed, update the filter reference table
- **Always include screenshots** when the change affects anything the user can see (new UI, changed layout, new toggle, renamed section, etc.)

#### 2c-screenshots. Adding Screenshots to the User Guide

> [!IMPORTANT]
> Screenshots are **mandatory** for all UI/visual changes in the user guide. Do NOT defer screenshots — capture them as part of the post-approval flow.

**How to add screenshots:**

1. **Capture** the screenshot using the browser subagent (`capture_browser_screenshot`)
2. **Copy** the screenshot to `public/guide/` with a descriptive snake_case name:
   ```
   cmd /c copy "<source_path>" "d:\Antigravity Projects\ChainTrace\public\guide\<descriptive_name>.png"
   ```
3. **Embed** in the guide using this exact JSX pattern (matches all existing guide screenshots):
   ```jsx
   {/* Screenshot: <description> */}
   <div className="my-4 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
       <img src="/guide/<filename>.png" alt="<descriptive alt text>" className="w-full" />
       <p className="text-xs text-slate-500 bg-slate-100 px-3 py-2 italic">
           <caption text describing what the user is seeing, with <strong>bold</strong> for key UI elements>
       </p>
   </div>
   ```

**Naming convention for files:** `<feature>_<state>.png`
- Examples: `settings_cloud_sync.png`, `settings_local_device.png`, `outlook_detail_panel.png`, `broker_selector.png`

**Placement:** Screenshots go immediately after the bullet list or description text they illustrate, inside the same `<section>` or `<div>`.

---

### If **Logic / Calculation** changes:

#### 2d. Update the relevant `docs/MASTER_*.md` volumes

| What changed | Update this file |
|-------------|-----------------|
| Backend, API, cron jobs, DB schema | `docs/MASTER_ENGINEERING.md` |
| Strategy math, tie-breaking, P&L rules | `docs/MASTER_LOGIC.md` |
| Security, RLS, auth, privacy, compliance | `docs/MASTER_SECURITY.md` |
| Product limits, UI rules, subscription logic | `docs/MASTER_PRODUCT.md` |
| New pending features, known defects | `docs/MASTER_ROADMAP.md` |
| Business goals, platform strategy | `docs/MASTER_VISION.md` |
| Major concepts overview/directory | `docs/MASTER_INDEX.md` |

#### 2e. Update the User Guide (`src/app/guide/page.tsx`)
- If the calculation change affects what the user sees (cards, tooltips, descriptions), update the guide
- Document the metric definition, formula explanation, or interpretation guidance
- **Include screenshots** if the change is visible in the UI (see §2c-screenshots for the exact pattern)

---

### If **Architecture / Backend** changes:

#### 2f. Update `docs/MASTER_ENGINEERING.md`
- Add or update the relevant section for compute, schema, or integration
- Document any new tables, API endpoints, or infrastructure changes

#### 2g. Update `docs/MASTER_PRODUCT.md` (if limits or features changed)
- If the change adds, removes, or modifies a **paid service** or changes premium limits
- If tax center rules or Vault behavior is altered

#### 2h. Update `docs/MASTER_SECURITY.md` (if security, auth, or data-handling changed)
- If the change affects **encryption** (new fields, algorithm changes)
- If the change affects **auth/middleware** (new endpoints, RLS policies)
- If the change affects **third-party integrations** (new services, data sharing)
- Record rationale for security decisions in the Master Volume.
- If the change affects **data collection or storage** update the **Privacy Policy page** (`src/app/privacy/page.tsx`)

#### 2i. GDPR Data Export Compliance (if new user-scoped data table created)
> [!IMPORTANT]
> **GDPR/CCPA Legal Requirement:** When a new user-scoped data table is created (any table with a `user_id` column containing personal or user-generated data), the data **MUST** be added to the export endpoint:
> - **File:** `api-server/src/index.ts` → `GET /api/account/export`
> - **Add** a new `user_client.from('<table>').select(...)` query to the parallel fetch
> - **Add** the result to the `export_data` object
> - **Redact** any encrypted secrets (use `[REDACTED]` placeholder)
> - **Update** `docs/MASTER_SECURITY.md` → §3 Data Privacy & GDPR
>
> Examples of tables that would require this: `watchlists`, `alerts`, `journal_entries`, `broker_connections`, `trade_notes`, `user_portfolios`

---

### If **Chain Lifecycle** changes:

#### 2j. Update `docs/MASTER_LOGIC.md`
// turbo
- Add or update the relevant scenario or parsing rule
- Use real ticker data from `Test Data.csv` when possible

#### 2k. Add Unit Tests (`src/lib/csv_parser_v2.test.ts`)
- Add a `describe` block matching the scenario name
- Use the `createTransaction()` helper for test data
- Validate: chain count, status, node count, strikes, spread/roll links
- Run tests:
```bash
npx vitest run src/lib/csv_parser_v2.test.ts
```

#### 2l. Update Test Data (if applicable)
- If new transaction patterns were added, ensure they are in `Test Data.csv`
- Regenerate `src/data/demo_csv.ts` to match

#### 2m. Sync `MASTER_LOGIC.md` with Current Logic
> [!IMPORTANT]
> `docs/MASTER_LOGIC.md` is the **single source of truth** for how chains behave. Whenever **any logic change** affects behavior — chain grouping, roll detection, sort order, close matching, strategy classification, display rules, status transitions, or parser steps — you **MUST** update the affected sections to match the new behavior.
>
> Similarly, verify that test assertions in `src/lib/csv_parser_v2.test.ts` still match. If tests fail on **name/type/behavioral assertions** after a logic change, update the assertions and docs to reflect the current correct behavior — don't revert the logic.

---

## Step 3 — Final Cross-Reference Checklist

Before marking the work as fully complete, verify all applicable items:

- [ ] `docs/TASKS.md` updated (items marked done, dates current)
- [ ] User guide updated (if UI or user-facing logic changed)
- [ ] Relevant `docs/MASTER_*.md` files updated
- [ ] Privacy Policy page updated (if data collection, storage, or sharing practices changed) — `src/app/privacy/page.tsx`
- [ ] **GDPR data export updated** (if new user-scoped data table created) — `api-server/src/index.ts` → `GET /api/account/export`
- [ ] Unit tests added/updated and passing (if chain logic changed)
- [ ] Demo data matches `Test Data.csv` (if test data changed)
- [ ] **Git commit message provided in the chat** (always — never in an artifact)

---

## Step 4 — Provide a Git Commit Message

> [!IMPORTANT]
> **Always finish the post-approval workflow by providing a ready-to-use Git commit message directly in the chat response.** Do NOT put the commit message in an artifact — it must be visible inline so the user can copy-paste it immediately.

**Format:** Use [Conventional Commits](https://www.conventionalcommits.org/) with scope. Include a summary line and bullet points for each discrete change:

```
<type>(<scope>): <short summary>

- <type>(<sub-scope>): <detail>
- <type>(<sub-scope>): <detail>
...

Verified with production build; clean TypeScript compilation.
```

**Type reference:** `feat` (new feature), `fix` (bug fix), `refactor` (restructuring), `docs` (documentation only), `style` (formatting), `perf` (performance), `chore` (maintenance).

---

## Critical Rule: Approval Gate

> [!IMPORTANT]
> **Never assume approval.** If the conversation shifts topics and you haven't received explicit confirmation that the previous change was approved, you **must** ask:
>
> _"Before we move on — was the previous change approved? If so, I'll run the post-approval doc updates."_
>
> Only run this workflow after receiving a clear "yes" or equivalent confirmation.
