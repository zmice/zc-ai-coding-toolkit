<#
.SYNOPSIS
    AI Coding Toolkit installer - SDD+TDD workflow for Qoder, Cursor & Codex.

.DESCRIPTION
    Installs all agent skills to Qoder (.qoder/skills/) and Cursor (.cursor/rules/).
    Qoder is the primary target: each skill is installed as a proper Qoder skill directory.
    Global install (-Global) also installs Codex globally to ~/.codex/ (AGENTS.md + skills).
    Codex project-level install copies AGENTS.md and skills to the target project.
    For Qwen Code, use the extension approach: qwen extensions install https://codeup.aliyun.com/6892c510e5ba87aaf500637d/basic/ai-coding.git

.PARAMETER Global
    Install skills globally (~/.qoder/skills/, ~/.cursor/rules/, and ~/.codex/).

.PARAMETER Project
    Install skills into a specific project directory.

.PARAMETER CodexProject
    Codex project-level install: copy AGENTS.md and skills to the specified project path.

.PARAMETER Force
    Skip overwrite confirmation prompts.

.PARAMETER QoderOnly
    Only install Qoder skills (skip Cursor rules and Codex global).

.EXAMPLE
    ./install.ps1 -Global
    ./install.ps1 -Global -QoderOnly
    ./install.ps1 -Project "D:\my-project"
    ./install.ps1 -CodexProject "D:\my-project"
    ./install.ps1 -Global -CodexProject "D:\my-project"
    ./install.ps1 -Global -Force
#>

param(
    [switch]$Global,
    [string]$Project,
    [string]$CodexProject,
    [switch]$Force,
    [switch]$QoderOnly
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillsDir = Join-Path $ScriptDir "skills"
$AgentsDir = Join-Path $ScriptDir "agents"
$CommandsDir = Join-Path $ScriptDir "commands"
$InstructionsFile = Join-Path $ScriptDir "instructions.md"
$AgentsMdFile = Join-Path $ScriptDir "AGENTS.md"

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

    # --- Qoder Hooks: Install continuous-learning hooks ---
    $hooksSourceDir = Join-Path $SkillsDir 'continuous-learning' 'hooks'
    if (Test-Path $hooksSourceDir) {
        Write-Header "Installing Continuous-Learning Hooks"
        $targetHooksDir = Join-Path $qoderBaseDir 'hooks' 'continuous-learning'
        New-Item -ItemType Directory -Path $targetHooksDir -Force | Out-Null

        # Copy hook scripts (ps1 + sh)
        $hookFiles = @('observe.ps1', 'session-end.ps1', 'observe.sh', 'session-end.sh')
        foreach ($hf in $hookFiles) {
            $src = Join-Path $hooksSourceDir $hf
            if (Test-Path $src) {
                Copy-Item $src (Join-Path $targetHooksDir $hf) -Force
                Write-Ok $hf
            }
        }

        # Create homunculus directory structure
        $homunculusDir = Join-Path $qoderBaseDir 'homunculus'
        @(
            (Join-Path $homunculusDir 'instincts' 'personal'),
            (Join-Path $homunculusDir 'instincts' 'inherited'),
            (Join-Path $homunculusDir 'projects')
        ) | ForEach-Object { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
        $projFile = Join-Path $homunculusDir 'projects.json'
        if (-not (Test-Path $projFile)) { '{}' | Set-Content $projFile -Encoding UTF8 }
        Write-Ok "homunculus directory structure"

        # Update settings.json with hook configuration
        $settingsFile = Join-Path $qoderBaseDir 'settings.json'
        if (-not (Test-Path $settingsFile)) { '{}' | Set-Content $settingsFile -Encoding UTF8 }
        try {
            $settings = Get-Content $settingsFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if (-not ($settings.PSObject.Properties.Name -contains 'hooks')) {
                $settings | Add-Member -NotePropertyName 'hooks' -NotePropertyValue ([PSCustomObject]@{})
            }
            $obsCmd  = "pwsh -NoProfile -File `"$(Join-Path $targetHooksDir 'observe.ps1')`""
            $endCmd  = "pwsh -NoProfile -File `"$(Join-Path $targetHooksDir 'session-end.ps1')`""
            $hookMap = @{
                PostToolUse        = @{ matcher = '*'; hooks = @(@{ type = 'command'; command = $obsCmd }) }
                UserPromptSubmit   = @{ hooks = @(@{ type = 'command'; command = $obsCmd }) }
                PostToolUseFailure = @{ matcher = '*'; hooks = @(@{ type = 'command'; command = $obsCmd }) }
                Stop               = @{ hooks = @(@{ type = 'command'; command = $endCmd }) }
            }
            foreach ($evt in $hookMap.Keys) {
                if (-not ($settings.hooks.PSObject.Properties.Name -contains $evt)) {
                    $settings.hooks | Add-Member -NotePropertyName $evt -NotePropertyValue @()
                }
                $existing = @($settings.hooks.$evt | Where-Object { $_.hooks[0].command -match 'continuous-learning' })
                if ($existing.Count -eq 0) {
                    $settings.hooks.$evt = @($settings.hooks.$evt) + @([PSCustomObject]$hookMap[$evt])
                }
            }
            $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsFile -Encoding UTF8
            Write-Ok "settings.json hooks configuration"
        } catch {
            Write-Skip "settings.json update failed: $_ (configure hooks manually)"
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

    return @{ Qoder = $installedQoder; Cursor = $installedCursor; Agents = $installedAgents; Commands = $installedCommands; Hooks = (Test-Path $hooksSourceDir) }
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

    # --- Codex Global Install ---
    if (-not $QoderOnly) {
        $codexGlobalDir = Join-Path $userHome ".codex"
        $codexGlobalSkillsDir = Join-Path $codexGlobalDir "skills"
        $codexGlobalAgentsMd = Join-Path $codexGlobalDir "AGENTS.md"

        Write-Header "Installing Codex Global"
        Write-Host "  Target (Codex):  $codexGlobalDir"

        $codexGlobalInstalledSkills = 0
        $codexGlobalInstalledAgentsMd = $false

        # 1. Install AGENTS.md -> ~/.codex/AGENTS.md
        if (Test-Path $AgentsMdFile) {
            New-Item -ItemType Directory -Path $codexGlobalDir -Force | Out-Null
            if (Confirm-Overwrite $codexGlobalAgentsMd) {
                Copy-Item $AgentsMdFile $codexGlobalAgentsMd -Force
                Write-Ok "AGENTS.md"
                $codexGlobalInstalledAgentsMd = $true
            } else {
                Write-Skip "AGENTS.md (skipped)"
            }
        } else {
            Write-Skip "AGENTS.md (source not found)"
        }

        # 2. Install Skills -> ~/.codex/skills/<name>/SKILL.md
        Write-Header "Installing Codex Global Skills"
        $skillDirsCodex = Get-ChildItem -Path $SkillsDir -Directory
        foreach ($dir in $skillDirsCodex) {
            $srcFile = Join-Path $dir.FullName "SKILL.md"
            if (-not (Test-Path $srcFile)) { continue }

            $destDir = Join-Path $codexGlobalSkillsDir $dir.Name
            $destFile = Join-Path $destDir "SKILL.md"

            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            if (Confirm-Overwrite $destFile) {
                Copy-Item $srcFile $destFile -Force
                Write-Ok "$($dir.Name)/SKILL.md"
                $codexGlobalInstalledSkills++
            } else {
                Write-Skip "$($dir.Name) (skipped)"
            }
        }

        $codexGlobalResult = @{ Skills = $codexGlobalInstalledSkills; AgentsMd = $codexGlobalInstalledAgentsMd }
    }

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

} elseif (-not $CodexProject) {
    Write-Host @"

AI Coding Toolkit - SDD+TDD Workflow Installer

Usage:
  ./install.ps1 -Global                              Install globally (Qoder + Cursor + Codex)
  ./install.ps1 -Global -QoderOnly                   Install Qoder skills only (skip Cursor & Codex)
  ./install.ps1 -Project "D:\my-project"             Install to a specific project
  ./install.ps1 -CodexProject "D:\my-project"        Install Codex context to a project
  ./install.ps1 -Global -CodexProject "D:\my-project" Install both globally and Codex project
  ./install.ps1 -Global -Force                        Skip overwrite prompts

Options:
  -Global        Install to ~/.qoder/skills/, ~/.cursor/rules/, and ~/.codex/
  -Project       Install to <project>/.qoder/skills/ and <project>/.cursor/rules/
  -CodexProject  Install AGENTS.md and skills to <project>/ for Codex CLI
  -QoderOnly     Skip Cursor rules and Codex global installation (Qoder-first)
  -Force         Skip confirmation prompts

Note: For Qwen Code, use the extension approach:
  qwen extensions install https://codeup.aliyun.com/6892c510e5ba87aaf500637d/basic/ai-coding.git

"@
    exit 0
}

# --- Codex Project Install ---

$codexResult = $null
if ($CodexProject) {
    Write-Header "Codex Project Install: $CodexProject"

    if (-not (Test-Path $CodexProject)) {
        Write-Err "Codex project directory not found: $CodexProject"
        exit 1
    }

    $codexInstalledSkills = 0
    $codexInstalledAgentsMd = $false

    # --- Codex: Copy AGENTS.md -> <project>/AGENTS.md ---
    if (Test-Path $AgentsMdFile) {
        $destAgentsMd = Join-Path $CodexProject "AGENTS.md"
        if (Confirm-Overwrite $destAgentsMd) {
            Copy-Item $AgentsMdFile $destAgentsMd -Force
            Write-Ok "AGENTS.md"
            $codexInstalledAgentsMd = $true
        } else {
            Write-Skip "AGENTS.md (skipped)"
        }
    } else {
        Write-Skip "AGENTS.md (source not found)"
    }

    # --- Codex: Copy skills/<name>/SKILL.md -> <project>/.codex/skills/<name>/SKILL.md ---
    Write-Header "Installing Codex Skills"
    $skillDirs = Get-ChildItem -Path $SkillsDir -Directory
    foreach ($dir in $skillDirs) {
        $srcFile = Join-Path $dir.FullName "SKILL.md"
        if (-not (Test-Path $srcFile)) { continue }

        $destDir = Join-Path (Join-Path (Join-Path $CodexProject ".codex") "skills") $dir.Name
        $destFile = Join-Path $destDir "SKILL.md"

        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        if (Confirm-Overwrite $destFile) {
            Copy-Item $srcFile $destFile -Force
            Write-Ok "$($dir.Name)/SKILL.md"
            $codexInstalledSkills++
        } else {
            Write-Skip "$($dir.Name) (skipped)"
        }
    }

    $codexResult = @{ Skills = $codexInstalledSkills; AgentsMd = $codexInstalledAgentsMd }
}

# --- zc CLI Install (optional) ---

Write-Header "zc CLI Installation"
$zcDir = Join-Path $ScriptDir "zc"
if (-not (Test-Path $zcDir)) {
    Write-Skip "zc/ directory not found — skipping zc CLI installation"
} else {
    $nodeExe = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeExe) {
        Write-Skip "Node.js not found — skipping zc CLI (install Node.js >= 20 and re-run)"
    } else {
        $nodeVersionRaw = & node --version 2>&1
        $nodeMajor = 0
        if ($nodeVersionRaw -match '^v(\d+)') { $nodeMajor = [int]$Matches[1] }
        if ($nodeMajor -lt 20) {
            Write-Skip "Node.js $nodeVersionRaw found but >= 20 required — skipping zc CLI"
        } else {
            Write-Ok "Node.js $nodeVersionRaw detected"
            try {
                Push-Location $zcDir

                Write-Host "  Installing npm dependencies..." -ForegroundColor Cyan
                & npm install --no-fund --no-audit 2>&1 | Out-Null
                if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit code $LASTEXITCODE)" }
                Write-Ok "npm install"

                Write-Host "  Building zc CLI..." -ForegroundColor Cyan
                & npm run build 2>&1 | Out-Null
                if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit code $LASTEXITCODE)" }
                Write-Ok "npm run build"

                # Create shim script in a directory on PATH (or next to install.ps1)
                $shimDir = Join-Path $ScriptDir ".bin"
                New-Item -ItemType Directory -Path $shimDir -Force | Out-Null
                $cliEntry = Join-Path $zcDir "dist" "cli" "index.js"
                $shimPs1 = Join-Path $shimDir "zc.ps1"
                $shimCmd = Join-Path $shimDir "zc.cmd"
                # PowerShell shim
                $shimContent = "#!/usr/bin/env pwsh" + "`n" + "node `"$cliEntry`" @args"
                $shimContent | Set-Content $shimPs1 -Encoding UTF8
                # CMD shim for Windows terminals
                $cmdContent = "@echo off" + "`n" + "node `"$cliEntry`" %*"
                $cmdContent | Set-Content $shimCmd -Encoding UTF8
                Write-Ok "Shims created in $shimDir"

                # Hint: add to PATH
                if ($env:PATH -notlike "*$shimDir*") {
                    Write-Host "  [INFO] Add this to your PATH to use 'zc' globally:" -ForegroundColor Yellow
                    Write-Host "         $shimDir" -ForegroundColor Yellow
                }
            } catch {
                Write-Err "zc CLI installation failed: $_"
            } finally {
                Pop-Location
            }

            # WSL tmux hint
            if ($env:WSL_DISTRO_NAME -or (Test-Path "/proc/version" -ErrorAction SilentlyContinue)) {
                Write-Host "  [INFO] WSL detected — zc team mode requires tmux." -ForegroundColor Yellow
                Write-Host "         Install with: sudo apt install tmux" -ForegroundColor Yellow
            }
        }
    }
}

# --- Summary ---

Write-Header "Installation Complete"
if ($result) {
    Write-Host "  Qoder skills:   $($result.Qoder) installed"
    Write-Host "  Qoder agents:   $($result.Agents) installed"
    Write-Host "  Qoder commands:  $($result.Commands) installed"
    if ($result.Hooks) { Write-Host "  Hooks:           continuous-learning (auto-observation)" }
    if (-not $QoderOnly) { Write-Host "  Cursor rules:   $($result.Cursor) installed" }
}
if ($codexGlobalResult) {
    Write-Host "  Codex AGENTS.md: $(if ($codexGlobalResult.AgentsMd) { 'installed' } else { 'skipped' })"
    Write-Host "  Codex global skills: $($codexGlobalResult.Skills) installed"
}
if ($codexResult) {
    Write-Host "  Codex AGENTS.md: $(if ($codexResult.AgentsMd) { 'installed' } else { 'skipped' })"
    Write-Host "  Codex skills:   $($codexResult.Skills) installed"
}
Write-Host ""
Write-Host "  Commands: /sdd-tdd /spec /task-plan /build /quality-review /debug /ctx-health" -ForegroundColor Green
Write-Host "           /simplify /perf /secure /api /doc /ship /ci /commit /migrate /ui /idea /learn" -ForegroundColor Green
Write-Host "  Agents:  product-owner, architect, code-reviewer, security-auditor" -ForegroundColor Green
Write-Host "           test-engineer, backend-specialist, frontend-specialist, performance-engineer" -ForegroundColor Green
Write-Host ""
