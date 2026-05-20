---
name: Strict Git Workflow
description: Defines the mandatory workflow for all git operations and code modifications.
---

# Strict Git Workflow

## 1. Zero-Assumption Policy
You must operate under a "Zero-Assumption" policy regarding code execution, file modifications, and git operations.

## 2. Mandatory Approval Gates
Before you perform ANY of the following actions, you MUST ask the user and wait for their explicit response:
- Starting to write code for a new feature or fix.
- Running `git add` to stage files.
- Running `git commit` to commit files.
- Running `git push` to push to a remote repository.
- Running `git checkout` or `git switch` to change branches, unless instructed.

## 3. Communication Standard
When a task is complete, or you reach a logical stopping point where a commit *could* happen, you must state:
> "I have completed X. The files are currently uncommitted. Would you like me to stage and commit these changes, or would you like to review them first?"

**Never** auto-run git commit commands on behalf of the user unless explicitly told to do so in the prompt.
