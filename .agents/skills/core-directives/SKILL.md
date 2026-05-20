---
name: Core Directives
description: Foundational rules for AI agent behavior. Contains critical instructions on permissions, coding, and git operations. MUST BE ADHERED TO AT ALL TIMES.
---

# Core Directives

## 1. EXPLICIT PERMISSION REQUIRED FOR CODING AND COMMITTING
You are strictly prohibited from taking the following actions without **explicit, unambiguous permission** from the user:
- You must **NEVER** start writing or modifying code without the user telling you to proceed.
- You must **NEVER** run git commands that stage (`git add`), commit (`git commit`), or push (`git push`) code.

If a task seems complete or a logical next step is to commit/push, you must **ASK** the user for permission first.

## 2. DO NOT MAKE ASSUMPTIONS
- Do not assume that because a file is modified, the user wants it committed.
- Do not assume that because a plan is discussed, you should immediately begin executing it without an explicit "go ahead".

## 3. WINDOWS POWERSHELL & AUTOMATION COMMAND GUIDELINES
When executing terminal commands or running automation scripts on a Windows-based system, adhere to these rules:

### A. PowerShell Script Execution Bypass (UnauthorizedAccess Preventative)
- **Problem:** Windows PowerShell disables the loading of `.ps1` script wrappers (like `npm.ps1` or `npx.ps1`) under default execution policies.
- **Rule:** **NEVER** invoke bare `npm` or `npx` commands. Always use the command script equivalent (`npm.cmd`, `npx.cmd`) or execute them via the standard Command Prompt command wrapper (`cmd.exe /c "<command>"`).
- **Correct Examples:**
  - `npm.cmd run dev` or `cmd.exe /c npm run dev`
  - `npm.cmd run test` or `cmd.exe /c npm run test`
  - `npx.cmd playwright install` or `cmd.exe /c npx playwright install`

### B. Local Automation Dependency Verification (MODULE_NOT_FOUND Preventative)
- **Problem:** Custom headless validation scripts (like Playwright, Puppeteer, or Selenium) fail if the library or their required browser binaries are not present locally.
- **Rule:** Before executing any automation or web scraping scripts:
  1. Inspect `package.json` to verify dependencies.
  2. If an automation library is missing, safely install it in the local workspace without modifying the project's permanent repository dependencies by using:
     `cmd.exe /c npm install --no-save <package-name>` (e.g., `playwright`).
  3. Ensure that browser binaries are downloaded and registered by running:
     `npx.cmd playwright install chromium` (or the equivalent CLI utility setup).

