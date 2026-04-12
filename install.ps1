<#
.SYNOPSIS
    AI Coding Toolkit installer - SDD+TDD workflow for Qoder & Cursor.

.DESCRIPTION
    Installs all agent skills to Qoder (.qoder/skills/) and Cursor (.cursor/rules/).
    Qoder is the primary target: each skill is installed as a proper Qoder skill directory.
    For Qwen Code, use the extension approach: qwen extensions install <github-url>

.PARAMETER Global
    Install skills globally (~/.qoder/skills/ and ~/.cursor/rules/).

.PARAMETER Project
    Install skills into a specific project directory.

.PARAMETER Force
    Skip overwrite confirmation prompts.

.PARAMETER Update
    Pull latest changes from upstream agent-skills-repo before installing.

.PARAMETER QoderOnly
    Only install Qoder skills (skip Cursor rules).

.EXAMPLE
    ./install.ps1 -Global
    ./install.ps1 -Global -QoderOnly
    ./install.ps1 -Project "D:\my-project"
    ./install.ps1 -Global -Force -Update
#>

param(
    [switch]$Global,
    [string]$Project,
    [switch]$Force,
    [switch]$Update,
    [switch]$QoderOnly
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillsDir = Join-Path $ScriptDir "skills"
$AgentsDir = Join-Path $ScriptDir "agents"
$CommandsDir = Join-Path $ScriptDir "commands"
$InstructionsFile = Join-Path $ScriptDir "instructions.md"

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

function Install-Skills($targetQoderSkillsDir, $targetCursorRulesDir) {
    $skillDirs = Get-ChildItem -Path $SkillsDir -Directory
    $installedQoder = 0
    $installedCursor = 0
    $installedAgents = 0
    $installedCommands = 0

    # --- Qoder: Copy each skill/<name>/SKILL.md -> target/.qoder/skills/<name>/SKILL.md ---
    Write-Header "Installing Qoder Skills"
    foreach ($dir in $skillDirs) {
        $srcFile = Join-Path $dir.FullName "SKILL.md"
        if (-not (Test-Path $srcFile)) { continue }

        $destDir = Join-Path $targetQoderSkillsDir $dir.Name
        $destFile = Join-Path $destDir "SKILL.md"

        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        if (Confirm-Overwrite $destFile) {
            Copy-Item $srcFile $destFile -Force
            Write-Ok "$($dir.Name)/SKILL.md"
            $installedQoder++
        } else {
            Write-Skip "$($dir.Name) (skipped)"
        }
    }

    # --- Qoder Agents: Copy agents/*.md -> target/.qoder/agents/*.md ---
    $qoderBaseDir = Split-Path $targetQoderSkillsDir -Parent
    $targetAgentsDir = Join-Path $qoderBaseDir "agents"
    if (Test-Path $AgentsDir) {
        Write-Header "Installing Qoder Agents"
        New-Item -ItemType Directory -Path $targetAgentsDir -Force | Out-Null
        foreach ($agentFile in (Get-ChildItem -Path $AgentsDir -Filter "*.md")) {
            $destFile = Join-Path $targetAgentsDir $agentFile.Name
            if (Confirm-Overwrite $destFile) {
                Copy-Item $agentFile.FullName $destFile -Force
                Write-Ok $agentFile.Name
                $installedAgents++
            } else {
                Write-Skip "$($agentFile.Name) (skipped)"
            }
        }
    }

    # --- Qoder Commands: Copy commands/*.md -> target/.qoder/commands/*.md ---
    $targetCommandsDir = Join-Path $qoderBaseDir "commands"
    if (Test-Path $CommandsDir) {
        Write-Header "Installing Qoder Commands"
        New-Item -ItemType Directory -Path $targetCommandsDir -Force | Out-Null
        foreach ($cmdFile in (Get-ChildItem -Path $CommandsDir -Filter "*.md")) {
            $destFile = Join-Path $targetCommandsDir $cmdFile.Name
            if (Confirm-Overwrite $destFile) {
                Copy-Item $cmdFile.FullName $destFile -Force
                Write-Ok $cmdFile.Name
                $installedCommands++
            } else {
                Write-Skip "$($cmdFile.Name) (skipped)"
            }
        }
    }

    # --- Qoder Instructions: Copy instructions.md -> target/.qoder/instructions.md ---
    if (Test-Path $InstructionsFile) {
        Write-Header "Installing Global Instructions"
        $destInstructions = Join-Path $qoderBaseDir "instructions.md"
        if (Confirm-Overwrite $destInstructions) {
            Copy-Item $InstructionsFile $destInstructions -Force
            Write-Ok "instructions.md"
        } else {
            Write-Skip "instructions.md (skipped)"
        }
    }

    # --- Cursor: Copy each skill/<name>/SKILL.md -> target/.cursor/rules/<name>.md ---
    if (-not $QoderOnly -and $targetCursorRulesDir) {
        Write-Header "Installing Cursor Rules"
        New-Item -ItemType Directory -Path $targetCursorRulesDir -Force | Out-Null

        foreach ($dir in $skillDirs) {
            $srcFile = Join-Path $dir.FullName "SKILL.md"
            if (-not (Test-Path $srcFile)) { continue }

            $destFile = Join-Path $targetCursorRulesDir "$($dir.Name).md"
            if (Confirm-Overwrite $destFile) {
                Copy-Item $srcFile $destFile -Force
                Write-Ok "$($dir.Name).md"
                $installedCursor++
            } else {
                Write-Skip "$($dir.Name).md (skipped)"
            }
        }
    }

    return @{ Qoder = $installedQoder; Cursor = $installedCursor; Agents = $installedAgents; Commands = $installedCommands }
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

        Write-Header "Syncing updated skills"
        $skillNames = @(
            "spec-driven-development", "test-driven-development",
            "planning-and-task-breakdown", "incremental-implementation",
            "code-review-and-quality", "context-engineering",
            "debugging-and-error-recovery", "git-workflow-and-versioning",
            "using-agent-skills"
        )
        foreach ($name in $skillNames) {
            $src = Join-Path $repoDir "skills" $name "SKILL.md"
            $dst = Join-Path $SkillsDir $name "SKILL.md"
            if (Test-Path $src) {
                New-Item -ItemType Directory -Path (Join-Path $SkillsDir $name) -Force | Out-Null
                Copy-Item $src $dst -Force
                Write-Ok "Synced $name"
            }
        }
    } else {
        Write-Err "No .agent-skills-repo found. Clone it first."
    }
}

# --- Install ---

if ($Global) {
    Write-Header "Global Install"

    $userHome = [Environment]::GetFolderPath("UserProfile")
    $qoderSkillsDir = Join-Path (Join-Path $userHome ".qoder") "skills"
    $cursorRulesDir = Join-Path (Join-Path $userHome ".cursor") "rules"

    Write-Host "  Target (Qoder):  $qoderSkillsDir"
    if (-not $QoderOnly) { Write-Host "  Target (Cursor): $cursorRulesDir" }

    $result = Install-Skills $qoderSkillsDir $cursorRulesDir

} elseif ($Project) {
    Write-Header "Project Install: $Project"

    if (-not (Test-Path $Project)) {
        Write-Err "Project directory not found: $Project"
        exit 1
    }

    $qoderSkillsDir = Join-Path (Join-Path $Project ".qoder") "skills"
    $cursorRulesDir = Join-Path (Join-Path $Project ".cursor") "rules"

    Write-Host "  Target (Qoder):  $qoderSkillsDir"
    if (-not $QoderOnly) { Write-Host "  Target (Cursor): $cursorRulesDir" }

    $result = Install-Skills $qoderSkillsDir $cursorRulesDir

} else {
    Write-Host @"

AI Coding Toolkit - SDD+TDD Workflow Installer

Usage:
  ./install.ps1 -Global                   Install globally (all projects)
  ./install.ps1 -Global -QoderOnly        Install Qoder skills only (skip Cursor)
  ./install.ps1 -Project "D:\my-project"  Install to a specific project
  ./install.ps1 -Global -Force            Skip overwrite prompts
  ./install.ps1 -Global -Update           Update from upstream first

Options:
  -Global     Install to ~/.qoder/skills/ and ~/.cursor/rules/
  -Project    Install to <project>/.qoder/skills/ and <project>/.cursor/rules/
  -QoderOnly  Skip Cursor rules installation (Qoder-first)
  -Force      Skip confirmation prompts
  -Update     Pull upstream agent-skills-repo updates before installing

Note: For Qwen Code, use the extension approach:
  qwen extensions install <github-url>

"@
    exit 0
}

# --- Summary ---

Write-Header "Installation Complete"
Write-Host "  Qoder skills:   $($result.Qoder) installed"
Write-Host "  Qoder agents:   $($result.Agents) installed"
Write-Host "  Qoder commands:  $($result.Commands) installed"
if (-not $QoderOnly) { Write-Host "  Cursor rules:   $($result.Cursor) installed" }
Write-Host ""
Write-Host "  Commands: /sdd-tdd /spec /task-plan /build /quality-review /debug /ctx-health" -ForegroundColor Green
Write-Host "           /simplify /perf /secure /api /doc /ship /migrate /ui /idea" -ForegroundColor Green
Write-Host "  Agents:  code-reviewer, test-engineer, security-auditor" -ForegroundColor Green
Write-Host "           architect, performance-engineer, refactoring-expert" -ForegroundColor Green
Write-Host "           database-architect, frontend-specialist" -ForegroundColor Green
Write-Host "           product-manager, requirements-engineer" -ForegroundColor Green
Write-Host ""
