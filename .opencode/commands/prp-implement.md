---
description: Execute implementation plan with rigorous validation loops using OpenCode workflow
argument-hint: <path/to/plan.md>
---

# Implement Plan

**Plan**: $ARGUMENTS

---

## Your Mission

Execute the implementation plan end-to-end with rigorous self-validation, following OpenCode's workflow (Analyze→Approve→Execute→Validate→Summarize).

**Core Philosophy**: Validation loops catch mistakes early. Run checks after every change. Fix issues immediately. The goal is a working implementation, not just code that exists.

**Golden Rule**: If a validation fails, fix it before moving on. Never accumulate broken state.

**OpenCode Integration**: Leverage subagents for parallel execution, testing, and code review.

---

## Phase 0: DETECT - Project Environment

### 0.1 Identify Package Manager

Check for these files to determine the project's toolchain:

| File Found | Package Manager | Runner |
|------------|-----------------|--------|
| `bun.lockb` | bun | `bun` / `bun run` |
| `pnpm-lock.yaml` | pnpm | `pnpm` / `pnpm run` |
| `yarn.lock` | yarn | `yarn` / `yarn run` |
| `package-lock.json` | npm | `npm run` |
| `pyproject.toml` | uv/pip | `uv run` / `python` |
| `Cargo.toml` | cargo | `cargo` |
| `go.mod` | go | `go` |

**Store the detected runner** - use it for all subsequent commands.

### 0.2 Identify Validation Scripts

Check `package.json` (or equivalent) for available scripts:
- Type checking: `type-check`, `typecheck`, `tsc`
- Linting: `lint`, `lint:fix`
- Testing: `test`, `test:unit`, `test:integration`
- Building: `build`, `compile`

**Use the plan's "Validation Commands" section** - it should specify exact commands for this project.

### 0.3 Load OpenCode Context

**CRITICAL**: Load required context files before executing:

| Task Type | Context File |
|-----------|--------------|
| Code tasks | `/home/evgeniy/.config/opencode/context/core/standards/code-quality.md` |
| Tests | `/home/evgeniy/.config/opencode/context/core/standards/test-coverage.md` |
| Docs | `/home/evgeniy/.config/opencode/context/core/standards/documentation.md` |
| Review | `/home/evgeniy/.config/opencode/context/core/workflows/code-review.md` |
| Delegation | `/home/evgeniy/.config/opencode/context/core/workflows/task-delegation-basics.md` |

**PHASE_0_CHECKPOINT:**
- [ ] Package manager identified (bun/pnpm/yarn/npm/uv/cargo/go)
- [ ] Validation scripts identified from package.json
- [ ] OpenCode context loaded for task type

---

## Phase 1: LOAD - Read the Plan

### 1.1 Load Plan File

```bash
cat $ARGUMENTS
```

### 1.2 Extract Key Sections

Locate and understand:

- **Summary** - What we're building
- **Patterns to Mirror** - Code to copy from
- **Files to Change** - CREATE/UPDATE list
- **Step-by-Step Tasks** - Implementation order
- **Validation Commands** - How to verify (USE THESE, not hardcoded commands)
- **Acceptance Criteria** - Definition of done

### 1.3 Validate Plan Exists

**If plan not found:**

```
Error: Plan not found at $ARGUMENTS

Create a plan first: /prp-plan "feature description"
```

**PHASE_1_CHECKPOINT:**

- [ ] Plan file loaded
- [ ] Key sections identified
- [ ] Tasks list extracted

---

## Phase 2: PREPARE - Git State

### 2.1 Check Current State

```bash
git branch --show-current
git status --porcelain
git worktree list
```

### 2.2 Branch Decision

| Current State     | Action                                               |
| ----------------- | ---------------------------------------------------- |
| In worktree       | Use it (log: "Using worktree")                       |
| On main, clean    | Create branch: `git checkout -b feature/{plan-slug}` |
| On main, dirty    | STOP: "Stash or commit changes first"                |
| On feature branch | Use it (log: "Using existing branch")                |

### 2.3 Sync with Remote

```bash
git fetch origin
git pull --rebase origin main 2>/dev/null || true
```

**PHASE_2_CHECKPOINT:**

- [ ] On correct branch (not main with uncommitted work)
- [ ] Working directory ready
- [ ] Up to date with remote

---

## Phase 3: ANALYZE & APPROVE - Plan Review

### 3.1 Analyze Delegation Opportunities

Evaluate which tasks can be delegated to OpenCode subagents:

| Condition | Action |
|-----------|--------|
| 4+ files, complex feature | Delegate to `TaskManager` for task breakdown |
| Tests required | Delegate to `TestEngineer` |
| Multi-component review | Delegate to `CodeReviewer` |
| Simple 1-3 file changes | Execute directly |

**Use TaskManager for complex features:**
```
task(
  subagent_type="TaskManager",
  description="Break down feature into subtasks",
  prompt="Load context from .tmp/sessions/{session-id}/context.md
          Execute subtask: .tmp/tasks/{feature}/subtask_XX.json"
)
```

### 3.2 Request User Approval

Present the implementation plan to user for approval:

```markdown
## Proposed Implementation Plan

**Plan**: `$ARGUMENTS`
**Branch**: `{branch-name}`

### Tasks to Execute

| # | Task | File | Type |
|---|------|------|------|
| 1 | {task desc} | {file} | CREATE |
| 2 | {task desc} | {file} | UPDATE |

### Validation Commands (from plan)

- **Type check**: `{command from plan}`
- **Lint**: `{command from plan}`
- **Tests**: `{command from plan}`
- **Build**: `{command from plan}`

### Delegation Strategy

- Tasks {X-Y} → Execute directly
- Tests → Delegate to `TestEngineer`
- Review → Delegate to `CodeReviewer`

**Approval needed before proceeding.**
```

**PHASE_3_CHECKPOINT:**

- [ ] Delegation opportunities identified
- [ ] User approval received
- [ ] Execution strategy defined

---

## Phase 4: EXECUTE - Implement Tasks

### 4.1 Prepare Context Bundle

For delegation, create context bundle:

```bash
mkdir -p .tmp/context/{session-id}
```

Create `.tmp/context/{session-id}/bundle.md` with:
- Task description and objectives
- Loaded context files (code-quality.md, test-coverage.md, etc.)
- Constraints and requirements
- Expected output format

### 4.2 Execute Tasks

**For each task in the plan's Step-by-Step Tasks section:**

#### Option A: Direct Execution

1. **Read Context**: Read the MIRROR file reference from the task
2. **Implement**: Make the change exactly as specified
3. **Validate**: Run type-check immediately after change

```bash
# After every file change
{runner} run type-check || {type-check-cmd}
```

#### Option B: Delegate to Subagent

For parallel/isolated tasks, delegate to `CoderAgent`:

```javascript
task(
  subagent_type="CoderAgent",
  description="Task {N}: {description}",
  prompt="Load context from .tmp/context/{session-id}/bundle.md
          Execute subtask: .tmp/tasks/{feature}/subtask_{NN}.json
          Mark as complete when done."
)
```

### 4.3 Validate Immediately

**After EVERY file change, run the type-check command from the plan's Validation Commands section.**

Common patterns:
- `{runner} run type-check` (JS/TS projects)
- `mypy .` (Python)
- `cargo check` (Rust)
- `go build ./...` (Go)

**If types fail:**

1. Read the error
2. Fix the issue
3. Re-run type-check
4. Only proceed when passing

### 4.4 Track Progress

Log each task as you complete it:

```
Task 1: CREATE src/features/x/models.ts ✅
Task 2: CREATE src/features/x/service.ts ✅
Task 3: UPDATE src/routes/index.ts ✅
```

**Deviation Handling:**
If you must deviate from the plan:

- Note WHAT changed
- Note WHY it changed
- Continue with the deviation documented

**PHASE_4_CHECKPOINT:**

- [ ] All tasks executed in order
- [ ] Each task passed type-check
- [ ] Deviations documented

---

## Phase 5: VALIDATE - Full Verification

### 5.1 Static Analysis

**Run the type-check and lint commands from the plan's Validation Commands section.**

Common patterns:
- JS/TS: `{runner} run type-check && {runner} run lint`
- Python: `ruff check . && mypy .`
- Rust: `cargo check && cargo clippy`
- Go: `go vet ./...`

**Must pass with zero errors.**

If lint errors:

1. Run the lint fix command (e.g., `{runner} run lint:fix`, `ruff check --fix .`)
2. Re-check
3. Manual fix remaining issues

### 5.2 Unit Tests

**Delegate to TestEngineer for comprehensive test coverage:**

Use Task tool with `subagent_type="TestEngineer":

```
Context to load:
- /home/evgeniy/.config/opencode/context/core/standards/test-coverage.md

Task: Write comprehensive tests for implemented feature

Requirements (from context):
- Positive and negative test cases
- Arrange-Act-Assert pattern
- Mock external dependencies
- Test coverage for edge cases

Files to test:
- {file1} - {purpose}
- {file2} - {purpose}

Expected behavior:
- {behavior 1}
- {behavior 2}
```

**Then run test command from the plan:**

Common patterns:
- JS/TS: `{runner} test` or `{runner} run test`
- Python: `pytest` or `uv run pytest`
- Rust: `cargo test`
- Go: `go test ./...`

**If tests fail:**

1. Read failure output
2. Determine: bug in implementation or bug in test?
3. Fix the actual issue
4. Re-run tests
5. Repeat until green

### 5.3 Build Check

**Run the build command from the plan's Validation Commands section.**

Common patterns:
- JS/TS: `{runner} run build`
- Python: N/A (interpreted) or `uv build`
- Rust: `cargo build --release`
- Go: `go build ./...`

**Must complete without errors.**

### 5.4 Code Review

**Delegate to CodeReviewer for final quality check:**

Use Task tool with `subagent_type="CodeReviewer":

```
Context to load:
- /home/evgeniy/.config/opencode/context/core/workflows/code-review.md
- /home/evgeniy/.config/opencode/context/core/standards/code-quality.md

Task: Review implemented feature for quality and security

Focus areas:
- Code quality and patterns
- Security vulnerabilities
- Performance issues
- Maintainability

Files to review:
- {file1}
- {file2}
```

### 5.5 Integration Testing (if applicable)

**If the plan involves API/server changes, use the integration test commands from the plan.**

Example pattern:
```bash
# Start server in background (command varies by project)
{runner} run dev &
SERVER_PID=$!
sleep 3

# Test endpoints (adjust URL/port per project config)
curl -s http://localhost:{port}/health | jq

# Stop server
kill $SERVER_PID
```

### 5.6 Edge Case Testing

Run any edge case tests specified in the plan.

**PHASE_5_CHECKPOINT:**

- [ ] Type-check passes (command from plan)
- [ ] Lint passes (0 errors)
- [ ] Tests pass (all green)
- [ ] Build succeeds
- [ ] Code review approved
- [ ] Integration tests pass (if applicable)

---

## Phase 6: SUMMARIZE - Create Implementation Report

### 6.1 Create Report Directory

```bash
mkdir -p .opencode/PRPs/reports
```

### 6.2 Generate Report

**Path**: `.opencode/PRPs/reports/{plan-name}-report.md`

```markdown
# Implementation Report

**Plan**: `$ARGUMENTS`
**Source Issue**: #{number} (if applicable)
**Branch**: `{branch-name}`
**Date**: {YYYY-MM-DD}
**Status**: {COMPLETE | PARTIAL}

---

## Summary

{Brief description of what was implemented}

---

## Assessment vs Reality

Compare the original investigation's assessment with what actually happened:

| Metric     | Predicted   | Actual   | Reasoning                                                                      |
| ---------- | ----------- | -------- | ------------------------------------------------------------------------------ |
| Complexity | {from plan} | {actual} | {Why it matched or differed - e.g., "discovered additional integration point"} |
| Confidence | {from plan} | {actual} | {e.g., "root cause was correct" or "had to pivot because X"}                   |

**If implementation deviated from the plan, explain why:**

- {What changed and why - based on what you discovered during implementation}

---

## Tasks Completed

| #   | Task               | File       | Status |
| --- | ------------------ | ---------- | ------ |
| 1   | {task description} | `src/x.ts` | ✅     |
| 2   | {task description} | `src/y.ts` | ✅     |

---

## Validation Results

| Check       | Result | Details               |
| ----------- | ------ | --------------------- |
| Type check  | ✅     | No errors             |
| Lint        | ✅     | 0 errors, N warnings  |
| Unit tests  | ✅     | X passed, 0 failed    |
| Build       | ✅     | Compiled successfully |
| Code review | ✅     | Approved              |
| Integration | ✅/⏭️  | {result or "N/A"}     |

---

## Files Changed

| File       | Action | Lines     |
| ---------- | ------ | --------- |
| `src/x.ts` | CREATE | +{N}      |
| `src/y.ts` | UPDATE | +{N}/-{M} |

---

## Deviations from Plan

{List any deviations with rationale, or "None"}

---

## Issues Encountered

{List any issues and how they were resolved, or "None"}

---

## Tests Written

| Test File       | Test Cases               |
| --------------- | ------------------------ |
| `src/x.test.ts` | {list of test functions} |

---

## Next Steps

- [ ] Review implementation
- [ ] Create PR: `gh pr create` (if applicable)
- [ ] Merge when approved
```

### 6.3 Update Source PRD (if applicable)

**Check if plan was generated from a PRD:**
- Look in the plan file for `Source PRD:` reference
- Or check if plan filename matches a phase pattern

**If PRD source exists:**

1. Read the PRD file
2. Find the phase row in the Implementation Phases table
3. Update the phase:
   - Change Status from `in-progress` to `complete`
4. Save the PRD

### 6.4 Archive Plan

```bash
mkdir -p .opencode/PRPs/plans/completed
mv $ARGUMENTS .opencode/PRPs/plans/completed/
```

**PHASE_6_CHECKPOINT:**

- [ ] Report created at `.opencode/PRPs/reports/`
- [ ] PRD updated (if applicable) - phase marked complete
- [ ] Plan moved to completed folder

---

## Phase 7: OUTPUT - Report to User

```markdown
## Implementation Complete

**Plan**: `$ARGUMENTS`
**Source Issue**: #{number} (if applicable)
**Branch**: `{branch-name}`
**Status**: ✅ Complete

### Validation Summary

| Check      | Result          |
| ---------- | --------------- |
| Type check | ✅              |
| Lint       | ✅              |
| Tests      | ✅ ({N} passed) |
| Build      | ✅              |
| Code review| ✅              |

### Files Changed

- {N} files created
- {M} files updated
- {K} tests written

### Deviations

{If none: "Implementation matched the plan."}
{If any: Brief summary of what changed and why}

### Artifacts

- Report: `.opencode/PRPs/reports/{name}-report.md`
- Plan archived to: `.opencode/PRPs/plans/completed/`

{If from PRD:}
### PRD Progress

**PRD**: `{prd-file-path}`
**Phase Completed**: #{number} - {phase name}

| # | Phase | Status |
|---|-------|--------|
{Updated phases table showing progress}

**Next Phase**: {next pending phase, or "All phases complete!"}
{If next phase can parallel: "Note: Phase {X} can also start now (parallel)"}

To continue: `/prp-plan {prd-path}`

### Next Steps

1. Review the report (especially if deviations noted)
2. Create PR: `gh pr create` or `/prp-pr`
3. Merge when approved
{If more phases: "4. Continue with next phase: `/prp-plan {prd-path}`"}
```

---

## Handling Failures

### Type Check Fails

1. Read error message carefully
2. Fix the type issue
3. Re-run the type-check command
4. Don't proceed until passing

### Tests Fail

1. Identify which test failed
2. Determine: implementation bug or test bug?
3. Fix the root cause (usually implementation)
4. Re-run tests
5. Repeat until green

### Lint Fails

1. Run the lint fix command for auto-fixable issues
2. Manually fix remaining issues
3. Re-run lint
4. Proceed when clean

### Build Fails

1. Usually a type or import issue
2. Check the error output
3. Fix and re-run

### Integration Test Fails

1. Check if server started correctly
2. Verify endpoint exists
3. Check request format
4. Fix implementation and retry

### Code Review Fails

1. Review feedback from CodeReviewer
2. Fix identified issues
3. Re-run validation commands
4. Re-submit for review if needed

---

## Success Criteria

- **TASKS_COMPLETE**: All plan tasks executed
- **TYPES_PASS**: Type-check command exits 0
- **LINT_PASS**: Lint command exits 0 (warnings OK)
- **TESTS_PASS**: Test command all green
- **BUILD_PASS**: Build command succeeds
- **REVIEW_PASS**: Code review approved
- **REPORT_CREATED**: Implementation report exists
- **PLAN_ARCHIVED**: Original plan moved to completed

---

## OpenCode Subagents Reference

| Subagent | Use When | Command |
|----------|----------|---------|
| `TaskManager` | Complex feature needing task breakdown | Break down into JSON subtasks |
| `TestEngineer` | Writing comprehensive tests | Generate test coverage |
| `CodeReviewer` | Quality and security review | Final quality gate |
| `ContextScout` | Finding patterns in codebase | Discovery phase |
| `ExternalScout` | External library documentation | Research phase |
| `DocWriter` | Documentation generation | Generate/update docs |

---

## Related Commands

- `/prp-plan` - Create implementation plan
- `/prp-prd` - Create or manage PRDs
