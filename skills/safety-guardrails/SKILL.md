---
name: safety-guardrails
description: Enforces safety guardrails when AI performs potentially destructive operations. Use when working near production systems, critical infrastructure, or sensitive files. Provides three protection modes — Careful (warn before danger), Freeze (lock files/directories), and Guard (full protection) — to prevent accidental data loss, destructive commands, and unauthorized changes.
---

# Safety Guardrails

## Overview

AI coding agents can execute destructive operations at machine speed. A misplaced `rm -rf`, an accidental `DROP TABLE`, or a force-push to main can cause damage in seconds that takes hours to recover from — if recovery is possible at all.

Safety guardrails exist to put friction in the right places. Not everywhere — that would make the agent useless. Just at the points where mistakes are irreversible or high-impact. The goal is **operational safety**: preventing the AI from doing things the human didn't intend, especially when working near production systems, sensitive data, or critical infrastructure.

**The principle:** Make dangerous operations harder to do by accident and impossible to do without acknowledgment. Safe operations should remain frictionless.

## Three Protection Modes

### Careful Mode (Pre-Execution Warning)

**Purpose:** Detect dangerous commands before execution, warn the user, and require explicit confirmation.

**How it works:**
1. Before executing any command or file operation, scan it against the dangerous command registry
2. If a match is found, display a risk warning with impact analysis
3. Suggest a safer alternative when one exists
4. Wait for explicit user confirmation before proceeding
5. Log the confirmed action for audit trail

**Warning format:**
```
⚠️  DANGEROUS OPERATION DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Command:    rm -rf ./src/core/
Risk Level: CRITICAL
Impact:     Permanently deletes 47 files (12,340 lines of code)
Reversible: NO (unless backed up or in version control)

Safer alternative:
  → Move to trash: mv ./src/core/ ~/.trash/core-backup-$(date +%s)/
  → Or delete with confirmation: rm -ri ./src/core/

Proceed? [y/N]
```

**What Careful mode catches:**

| Category | Examples |
|----------|----------|
| File destruction | `rm -rf`, `del /s /q`, `Remove-Item -Recurse -Force` |
| Git destruction | `git push --force`, `git reset --hard`, `git clean -fd`, `git branch -D` |
| Database destruction | `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` without WHERE |
| Environment mutation | Modifying `.env`, overwriting config files, changing connection strings |
| Permission escalation | `chmod 777`, `sudo` operations, changing file ownership |
| Network exposure | Binding to `0.0.0.0`, opening firewall ports, disabling TLS |
| Package risks | `npm install` from untrusted sources, running arbitrary `npx` packages |

### Freeze Mode (File/Directory Locking)

**Purpose:** Prevent any modifications to specified files or directories, regardless of intent.

**How it works:**
1. User specifies paths or glob patterns to freeze
2. Any attempt to read-and-modify, create, delete, or rename within frozen paths is blocked
3. The agent receives a clear rejection message explaining why the operation was blocked
4. Frozen paths remain locked until explicitly unfrozen

**Freeze configuration:**
```
FROZEN PATHS:
- src/core/**              # Core business logic — no changes without explicit unfreeze
- *.env                    # Environment files — never modify automatically
- *.env.*                  # All environment variants
- migrations/**            # Database migrations — immutable once created
- docker-compose.prod.yml  # Production compose — changes require manual review
- .github/workflows/**     # CI/CD pipelines — changes must be manually reviewed
- package-lock.json        # Lock file — only change via npm install
- yarn.lock                # Lock file — only change via yarn
```

**Rejection format:**
```
🔒 OPERATION BLOCKED — FROZEN PATH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Attempted:  Edit src/core/auth/jwt-validator.ts
Matched by: src/core/** (frozen)
Reason:     Core authentication module is frozen during this session

To modify this file:
  1. Unfreeze the path: /unfreeze src/core/**
  2. Make your changes
  3. Re-freeze when done: /freeze src/core/**

Or specify a more targeted unfreeze:
  /unfreeze src/core/auth/jwt-validator.ts
```

**Glob pattern support:**
```
*.env           → All .env files in any directory
src/core/**     → Everything under src/core/ recursively
migrations/*.sql → All SQL files directly in migrations/
**/*.secret     → Any file ending in .secret anywhere
config/prod.*   → All prod config files in config/
!src/core/test/** → Exclude test files from a broader freeze
```

**Freeze persistence:** Freeze state persists for the current session. When starting a new session, previously frozen paths must be re-frozen unless configured in a persistent guardrails config file.

### Guard Mode (Full Protection)

**Purpose:** Maximum protection combining Careful + Freeze with additional restrictions. Use when operating near production systems or critical infrastructure.

**Guard mode activates:**
1. All Careful mode warnings and confirmations
2. All Freeze mode path protections
3. Additional restrictions:

**Extra restrictions in Guard mode:**
```
GUARD MODE — ADDITIONAL RESTRICTIONS:
- No new database connections (use existing connections only)
- No environment variable modifications (read-only access to env)
- No network requests to production endpoints
- No file creation outside of explicitly allowed directories
- No package installations or dependency changes
- All file writes logged with before/after diffs
- Maximum single-operation scope: 10 files (prevents mass changes)
- Mandatory dry-run for any script execution
```

**Guard mode banner:**
```
🛡️  GUARD MODE ACTIVE
━━━━━━━━━━━━━━━━━━━
Protection level: MAXIMUM
Careful mode:     ON (all commands screened)
Frozen paths:     [list of frozen patterns]
Extra limits:     No new DB connections | No env changes | No prod network calls
Scope limit:      Max 10 files per operation
Audit log:        Active

To deactivate: /unguard (requires explicit confirmation)
```

## Dangerous Command Registry

Commands classified by risk level. This is not exhaustive — treat any unfamiliar command with caution.

### Critical Risk (Irreversible or Catastrophic)

| Command | Risk | Safer Alternative |
|---------|------|-------------------|
| `rm -rf <path>` | Permanent recursive deletion | `mv <path> ~/.trash/` or use version control |
| `git push --force` | Overwrites remote history | `git push --force-with-lease` |
| `git reset --hard` | Discards all uncommitted changes | `git stash` first, then reset |
| `DROP TABLE` / `DROP DATABASE` | Permanent data loss | Rename table first; backup before drop |
| `TRUNCATE TABLE` | Deletes all rows instantly | `DELETE FROM` with WHERE clause + LIMIT |
| `DELETE FROM <table>` (no WHERE) | Deletes all rows | Always include WHERE clause |
| `chmod 777` | Opens all permissions | Use minimal needed permissions: `chmod 644` or `chmod 755` |
| `git clean -fdx` | Removes all untracked files including ignored | `git clean -n` (dry-run) first |
| `npx <unknown-package>` | Executes arbitrary remote code | Verify package first, pin version |

### High Risk (Potentially Destructive)

| Command | Risk | Safer Alternative |
|---------|------|-------------------|
| `git branch -D` | Force-deletes branch regardless of merge status | `git branch -d` (safe delete, checks merge status) |
| `git checkout -- .` | Discards all unstaged changes | `git stash` to preserve changes |
| `npm install <pkg>` (unvetted) | Introduces unknown dependency | Check package on npm, review source |
| `sed -i` / in-place file edits | Modifies files without backup | `sed -i.bak` to create backups |
| Overwriting config files | Loses existing configuration | Read existing config first, merge changes |
| `docker system prune -a` | Removes all unused containers, images, volumes | `docker system prune` (without `-a`) |

### Medium Risk (Requires Awareness)

| Command | Risk | Mitigation |
|---------|------|------------|
| `git rebase` | Rewrites commit history | Only on local, unpushed branches |
| `ALTER TABLE` | Schema change on live data | Test on staging first; backup table |
| `npm update` | May introduce breaking changes | Use `npm outdated` first, update selectively |
| `git merge` (large) | May create complex conflicts | Review diff before merging |
| Writing to shared directories | May affect other projects/services | Verify path scope |

## When to Activate Each Mode

### Activate Careful Mode When:
- Starting any new coding session (minimal overhead, maximum safety)
- Working with unfamiliar codebases
- Running scripts you didn't write or haven't reviewed
- Executing terminal commands suggested by AI
- Working with databases (even development databases)

### Activate Freeze Mode When:
- You've stabilized core modules and don't want accidental changes
- Working on a feature branch and want to protect unrelated code
- Multiple agents are working in the same codebase
- Preparing for a release (freeze everything except release-specific files)
- Protecting migration files that have already been applied
- Protecting configuration files from accidental modification

### Activate Guard Mode When:
- Performing any operation on or near production systems
- Working with production database connections
- Modifying deployment configurations
- Handling sensitive data (PII, credentials, financial data)
- During incident response (prevent making things worse)
- When onboarding a new AI agent to an unfamiliar codebase

## Relationship with Security and Hardening

This skill and `security-and-hardening` are complementary:

| Aspect | security-and-hardening | safety-guardrails |
|--------|----------------------|-------------------|
| **Focus** | Code security (vulnerabilities in what you build) | Operational safety (preventing destructive actions) |
| **Protects against** | Attackers exploiting your code | Agents/users accidentally breaking things |
| **When** | During development and review | During execution and operation |
| **Examples** | SQL injection, XSS, auth bypass | `rm -rf`, force push, DROP TABLE |
| **Output** | Secure code, hardened configurations | Warnings, blocks, audit logs |

**Use both together.** Security ensures the code you write is safe. Guardrails ensure the operations you perform are safe. Neither replaces the other.

## Red Flags — Activate Guardrails Immediately

If you observe any of these, stop and activate the appropriate protection:

- **Agent suggests running a command you don't fully understand** → Careful mode
- **Agent is about to modify files outside the current task scope** → Freeze mode
- **Working with any production connection string or endpoint** → Guard mode
- **Agent suggests `sudo` or elevated privilege operations** → Guard mode
- **Agent wants to "fix" something by deleting and recreating it** → Careful mode
- **Multiple agents editing the same files simultaneously** → Freeze mode on shared paths
- **Agent proposes bulk file operations (rename all, delete pattern)** → Careful mode
- **You're unsure what a command does** → Careful mode (always err on the side of caution)
- **Agent suggests disabling security features "temporarily"** → Guard mode
- **Env files or secrets are being read or referenced** → Freeze mode on secret files

## Guardrails Configuration File

For persistent guardrails across sessions, define a `.guardrails` config:

```yaml
# .guardrails — project-level safety configuration

default_mode: careful  # careful | none

freeze:
  paths:
    - "*.env"
    - "*.env.*"
    - "migrations/**"
    - "src/core/**"
    - ".github/workflows/**"
    - "docker-compose.prod.yml"
  exceptions:
    - "src/core/test/**"       # Allow test changes even when core is frozen

dangerous_commands:
  block:                        # Always block, no confirmation bypass
    - "rm -rf /"
    - "rm -rf ~"
    - "git push --force origin main"
    - "git push --force origin master"
  warn:                         # Require confirmation
    - "rm -rf"
    - "git push --force"
    - "git reset --hard"
    - "DROP TABLE"
    - "DROP DATABASE"
    - "TRUNCATE"

audit:
  enabled: true
  log_path: ".guardrails.log"   # Log all dangerous operations
```

## Audit Trail

When guardrails are active, maintain a log of all flagged operations:

```
AUDIT LOG ENTRY:
- Timestamp:  2024-03-15 14:23:07
- Mode:       Careful
- Operation:  git push --force origin feature/auth
- Risk Level: CRITICAL
- Action:     CONFIRMED by user
- Alternative offered: git push --force-with-lease origin feature/auth
- Context:    Rebased feature branch, needed to update remote
```

This log is valuable for retrospectives (see `sprint-retrospective`) and for understanding patterns in dangerous operations.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know what I'm doing, guardrails slow me down" | Guardrails cost seconds. Recovery from mistakes costs hours or days. |
| "It's just a dev environment, nothing can go wrong" | Dev environments have real data, real configs, and shared resources. |
| "I'll be careful this one time" | Every incident ever started with "just this once." |
| "The AI wouldn't suggest something dangerous" | AI agents optimize for task completion, not safety. They'll `rm -rf` if it solves the problem. |
| "Force push is fine on feature branches" | Until someone else has based work on that branch. Use `--force-with-lease`. |
| "We can always restore from backup" | When did you last verify your backups actually work? |

## See Also

- For code-level security practices, see `security-and-hardening`
- For code review before merging, see `code-review-and-quality`
- For incident reflection, see `sprint-retrospective`
- For safe git workflow practices, see `git-workflow-and-versioning`

## Verification

After setting up guardrails:

- [ ] Appropriate protection mode activated for current task context
- [ ] Critical paths frozen (env files, migrations, core modules if applicable)
- [ ] Dangerous command list reviewed and understood
- [ ] Safer alternatives known for common destructive operations
- [ ] Audit logging enabled for production or sensitive work
- [ ] Team/agents aware of frozen paths and active restrictions
- [ ] Unfreeze process understood (targeted unfreeze, not blanket disable)
- [ ] Guardrails config file committed to project if using persistent configuration
