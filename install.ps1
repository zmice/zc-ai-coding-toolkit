<#
.SYNOPSIS
    AI Coding Toolkit installer - SDD+TDD workflow for Qoder & Cursor.

.DESCRIPTION
    Installs agent skills (SDD+TDD workflow, context-engineering, debugging, etc.)
    to Qoder and Cursor in either global or project-scoped mode.

.PARAMETER Global
    Install skills globally (~/.qoder/skills/ and ~/.cursor/rules/).

.PARAMETER Project
    Install skills into a specific project directory.

.PARAMETER Force
    Skip overwrite confirmation prompts.

.PARAMETER Update
    Pull latest changes from upstream agent-skills-repo before installing.

.EXAMPLE
    ./install.ps1 -Global
    ./install.ps1 -Project "D:\my-project"
    ./install.ps1 -Global -Force -Update
#>

param(
    [switch]$Global,
    [string]$Project,
    [switch]$Force,
    [switch]$Update
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillsDir = Join-Path $ScriptDir "skills"

# --- Helpers ---

function Write-Header($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok($msg)     { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Skip($msg)   { Write-Host "  [SKIP] $msg" -ForegroundColor Yellow }
function Write-Err($msg)    { Write-Host "  [ERR] $msg" -ForegroundColor Red }

function Confirm-Overwrite($path) {
    if ($Force) { return $true }
    if (Test-Path $path) {
        $answer = Read-Host "  '$path' already exists. Overwrite? [y/N]"
        return ($answer -eq 'y' -or $answer -eq 'Y')
    }
    return $true
}

function Copy-SkillFiles($targetRulesDir, $targetQoderSkillsDir) {
    # --- Copy .md rule files to target rules dir ---
    if ($targetRulesDir) {
        New-Item -ItemType Directory -Path $targetRulesDir -Force | Out-Null

        $ruleFiles = Get-ChildItem -Path $SkillsDir -Filter "*.md" -File
        foreach ($file in $ruleFiles) {
            $dest = Join-Path $targetRulesDir $file.Name
            if (Confirm-Overwrite $dest) {
                Copy-Item $file.FullName $dest -Force
                Write-Ok "$($file.Name) -> $targetRulesDir"
            } else {
                Write-Skip "$($file.Name) (skipped)"
            }
        }
    }

    # --- Copy sdd-tdd-workflow skill to Qoder skills dir ---
    if ($targetQoderSkillsDir) {
        $skillSrc = Join-Path $SkillsDir "sdd-tdd-workflow"
        $skillDest = Join-Path $targetQoderSkillsDir "sdd-tdd-workflow"

        New-Item -ItemType Directory -Path $skillDest -Force | Out-Null

        $dest = Join-Path $skillDest "SKILL.md"
        if (Confirm-Overwrite $dest) {
            Copy-Item (Join-Path $skillSrc "SKILL.md") $dest -Force
            Write-Ok "sdd-tdd-workflow/SKILL.md -> $skillDest"
        } else {
            Write-Skip "sdd-tdd-workflow/SKILL.md (skipped)"
        }
    }
}

# --- Update upstream ---

if ($Update) {
    Write-Header "Updating upstream agent-skills-repo"
    $repoDir = Join-Path $ScriptDir ".agent-skills-repo"
    if (Test-Path $repoDir) {
        Push-Location $repoDir
        git pull origin main 2>&1 | Out-Null
        Pop-Location
        Write-Ok "Upstream updated"

        # Re-copy updated skill files to skills/
        Write-Header "Syncing updated skills"
        $skillMap = @{
            "spec-driven-development"       = "spec-driven-development.md"
            "test-driven-development"        = "test-driven-development.md"
            "planning-and-task-breakdown"    = "planning-and-task-breakdown.md"
            "incremental-implementation"     = "incremental-implementation.md"
            "code-review-and-quality"        = "code-review-and-quality.md"
            "context-engineering"            = "context-engineering.md"
            "debugging-and-error-recovery"   = "debugging-and-error-recovery.md"
            "git-workflow-and-versioning"    = "git-workflow-and-versioning.md"
            "using-agent-skills"             = "using-agent-skills.md"
        }
        foreach ($entry in $skillMap.GetEnumerator()) {
            $src = Join-Path $repoDir "skills" $entry.Key "SKILL.md"
            $dst = Join-Path $SkillsDir $entry.Value
            if (Test-Path $src) {
                Copy-Item $src $dst -Force
                Write-Ok "Synced $($entry.Value)"
            }
        }
    } else {
        Write-Err "No .agent-skills-repo found. Clone it first."
    }
}

# --- Install ---

if ($Global) {
    Write-Header "Global Install"

    $home = [Environment]::GetFolderPath("UserProfile")
    $cursorRulesDir = Join-Path $home ".cursor" "rules"
    $qoderSkillsDir = Join-Path $home ".qoder" "skills"

    Write-Host "  Target (Cursor): $cursorRulesDir"
    Write-Host "  Target (Qoder):  $qoderSkillsDir"

    Copy-SkillFiles $cursorRulesDir $qoderSkillsDir

} elseif ($Project) {
    Write-Header "Project Install: $Project"

    if (-not (Test-Path $Project)) {
        Write-Err "Project directory not found: $Project"
        exit 1
    }

    $cursorRulesDir = Join-Path $Project ".cursor" "rules"
    $qoderSkillsDir = Join-Path $Project ".qoder" "skills"

    Write-Host "  Target (Cursor): $cursorRulesDir"
    Write-Host "  Target (Qoder):  $qoderSkillsDir"

    Copy-SkillFiles $cursorRulesDir $qoderSkillsDir

} else {
    Write-Host @"

AI Coding Toolkit - SDD+TDD Workflow Installer

Usage:
  ./install.ps1 -Global                   Install globally (all projects)
  ./install.ps1 -Project "D:\my-project"  Install to a specific project
  ./install.ps1 -Global -Force            Skip overwrite prompts
  ./install.ps1 -Global -Update           Update from upstream first

Options:
  -Global     Install to ~/.cursor/rules/ and ~/.qoder/skills/
  -Project    Install to <project>/.cursor/rules/ and <project>/.qoder/skills/
  -Force      Skip confirmation prompts
  -Update     Pull upstream agent-skills-repo updates before installing

"@
    exit 0
}

# --- Summary ---

Write-Header "Installation Complete"
$ruleCount = (Get-ChildItem -Path $SkillsDir -Filter "*.md" -File).Count
Write-Host "  Rules installed:  $ruleCount skill files"
Write-Host "  Qoder skill:     sdd-tdd-workflow"
Write-Host ""
Write-Host "  Commands available: /sdd-tdd /spec /plan /build /review /debug /context" -ForegroundColor Green
Write-Host ""
