# continuous-learning/hooks/setup.ps1
# 一键安装持续学习 hooks 到 Qoder / Qwen Code (Windows)
#
# 用法:
#   .\setup.ps1                        # 自动检测平台
#   .\setup.ps1 -Platform qoder        # 指定平台
#   .\setup.ps1 -Platform qwen-code
#   .\setup.ps1 -Uninstall             # 卸载 hooks

param(
    [ValidateSet('', 'qoder', 'qwen-code')]
    [string]$Platform = '',
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

# ─── 辅助函数 ────────────────────────────────────────────
function Write-Info  { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# ─── 平台检测 ────────────────────────────────────────────
function Detect-Platform {
    if ($Platform) { return $Platform }

    # 检测 Qoder
    $qoderDir = Join-Path $HOME '.qoder'
    if (Test-Path $qoderDir) { return 'qoder' }

    # 检测 Qwen Code
    $qwenDir1 = Join-Path $HOME '.qwen-code'
    $qwenDir2 = Join-Path $env:APPDATA 'qwen-code'
    if ((Test-Path $qwenDir1) -or (Test-Path $qwenDir2)) { return 'qwen-code' }

    # 默认 Qoder
    return 'qoder'
}

$Platform = Detect-Platform
Write-Info "检测到平台: $Platform"

# ─── 路径配置 ────────────────────────────────────────────
switch ($Platform) {
    'qoder' {
        $SettingsDir  = Join-Path $HOME '.qoder'
        $SettingsFile = Join-Path $SettingsDir 'settings.json'
        $HooksDir     = Join-Path $HOME '.qoder' 'hooks' 'continuous-learning'
    }
    'qwen-code' {
        $SettingsDir  = Join-Path $HOME '.qwen-code'
        $SettingsFile = Join-Path $SettingsDir 'settings.json'
        $HooksDir     = Join-Path $HOME '.qwen-code' 'hooks' 'continuous-learning'
    }
    default {
        Write-Err "不支持的平台: $Platform"
        exit 1
    }
}

$ScriptDir = $PSScriptRoot

# ─── 卸载模式 ────────────────────────────────────────────
if ($Uninstall) {
    Write-Info '卸载持续学习 hooks...'

    if (Test-Path $SettingsFile) {
        try {
            $settings = Get-Content $SettingsFile -Raw -Encoding UTF8 | ConvertFrom-Json
            $hookEvents = @('PostToolUse', 'UserPromptSubmit', 'PostToolUseFailure', 'Stop')

            foreach ($evt in $hookEvents) {
                if ($settings.hooks.PSObject.Properties.Name -contains $evt) {
                    $filtered = @($settings.hooks.$evt | Where-Object {
                        $cmd = $_.hooks[0].command
                        $cmd -notmatch 'continuous-learning'
                    })
                    if ($filtered.Count -eq 0) {
                        $settings.hooks.PSObject.Properties.Remove($evt)
                    } else {
                        $settings.hooks.$evt = $filtered
                    }
                }
            }

            # 如果 hooks 为空则移除
            if (($settings.hooks.PSObject.Properties | Measure-Object).Count -eq 0) {
                $settings.PSObject.Properties.Remove('hooks')
            }

            $settings | ConvertTo-Json -Depth 10 | Set-Content $SettingsFile -Encoding UTF8
            Write-Ok "已从 $SettingsFile 移除 hooks 配置"
        } catch {
            Write-Warn "清理配置时出错: $_"
        }
    }

    if (Test-Path $HooksDir) {
        Remove-Item $HooksDir -Recurse -Force
        Write-Ok "已删除 hooks 脚本目录: $HooksDir"
    }

    Write-Ok '卸载完成'
    exit 0
}

# ─── 安装 hooks 脚本 ─────────────────────────────────────
Write-Info '安装 hooks 脚本...'

if (-not (Test-Path $HooksDir)) {
    New-Item -ItemType Directory -Path $HooksDir -Force | Out-Null
}

Copy-Item (Join-Path $ScriptDir 'observe.ps1')     (Join-Path $HooksDir 'observe.ps1')     -Force
Copy-Item (Join-Path $ScriptDir 'session-end.ps1') (Join-Path $HooksDir 'session-end.ps1') -Force

# 同时复制 sh 版本（WSL/Git Bash 兼容）
if (Test-Path (Join-Path $ScriptDir 'observe.sh')) {
    Copy-Item (Join-Path $ScriptDir 'observe.sh')     (Join-Path $HooksDir 'observe.sh')     -Force
    Copy-Item (Join-Path $ScriptDir 'session-end.sh') (Join-Path $HooksDir 'session-end.sh') -Force
}

Write-Ok "脚本已复制到 $HooksDir"

# ─── 创建 homunculus 目录结构 ────────────────────────────
$HomunculusDir = Join-Path $HOME '.qoder' 'homunculus'
$dirsToCreate = @(
    (Join-Path $HomunculusDir 'instincts' 'personal'),
    (Join-Path $HomunculusDir 'instincts' 'inherited'),
    (Join-Path $HomunculusDir 'projects')
)

foreach ($d in $dirsToCreate) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

$projectsFile = Join-Path $HomunculusDir 'projects.json'
if (-not (Test-Path $projectsFile)) {
    '{}' | Set-Content $projectsFile -Encoding UTF8
}
Write-Ok "目录结构已创建: $HomunculusDir"

# ─── 更新 settings.json ─────────────────────────────────
Write-Info "更新 $SettingsFile..."

if (-not (Test-Path $SettingsDir)) {
    New-Item -ItemType Directory -Path $SettingsDir -Force | Out-Null
}

if (-not (Test-Path $SettingsFile)) {
    '{}' | Set-Content $SettingsFile -Encoding UTF8
}

$ObserveCmd    = Join-Path $HooksDir 'observe.ps1'
$SessionEndCmd = Join-Path $HooksDir 'session-end.ps1'

try {
    $settings = Get-Content $SettingsFile -Raw -Encoding UTF8 | ConvertFrom-Json

    # 确保 hooks 对象存在
    if (-not ($settings.PSObject.Properties.Name -contains 'hooks')) {
        $settings | Add-Member -NotePropertyName 'hooks' -NotePropertyValue ([PSCustomObject]@{})
    }

    # hook 配置模板
    $hookConfigs = @{
        PostToolUse        = @{ matcher = '*'; hooks = @(@{ type = 'command'; command = "pwsh -NoProfile -File `"$ObserveCmd`"" }) }
        UserPromptSubmit   = @{ hooks = @(@{ type = 'command'; command = "pwsh -NoProfile -File `"$ObserveCmd`"" }) }
        PostToolUseFailure = @{ matcher = '*'; hooks = @(@{ type = 'command'; command = "pwsh -NoProfile -File `"$ObserveCmd`"" }) }
        Stop               = @{ hooks = @(@{ type = 'command'; command = "pwsh -NoProfile -File `"$SessionEndCmd`"" }) }
    }

    foreach ($evt in $hookConfigs.Keys) {
        $config = $hookConfigs[$evt]

        if (-not ($settings.hooks.PSObject.Properties.Name -contains $evt)) {
            $settings.hooks | Add-Member -NotePropertyName $evt -NotePropertyValue @()
        }

        # 检查是否已有 continuous-learning 的配置
        $existing = @($settings.hooks.$evt | Where-Object {
            $_.hooks[0].command -match 'continuous-learning'
        })

        if ($existing.Count -eq 0) {
            $settings.hooks.$evt = @($settings.hooks.$evt) + @([PSCustomObject]$config)
        }
    }

    $settings | ConvertTo-Json -Depth 10 | Set-Content $SettingsFile -Encoding UTF8
    Write-Ok "hooks 配置已写入 $SettingsFile"
} catch {
    Write-Err "写入配置失败: $_"
    Write-Host ''
    Write-Host "请手动在 $SettingsFile 中添加以下内容："
    Write-Host @"
{
  "hooks": {
    "PostToolUse": [{"matcher": "*", "hooks": [{"type": "command", "command": "pwsh -NoProfile -File \"$ObserveCmd\""}]}],
    "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "pwsh -NoProfile -File \"$ObserveCmd\""}]}],
    "PostToolUseFailure": [{"matcher": "*", "hooks": [{"type": "command", "command": "pwsh -NoProfile -File \"$ObserveCmd\""}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "pwsh -NoProfile -File \"$SessionEndCmd\""}]}]
  }
}
"@
    exit 1
}

# ─── 完成 ─────────────────────────────────────────────
Write-Host ''
Write-Ok '持续学习 hooks 安装完成！'
Write-Host ''
Write-Info '已配置的 hooks：'
Write-Host "  PostToolUse        → observe.ps1（记录工具调用）"
Write-Host "  UserPromptSubmit   → observe.ps1（捕获用户纠正）"
Write-Host "  PostToolUseFailure → observe.ps1（记录工具失败）"
Write-Host "  Stop               → session-end.ps1（会话结束分析）"
Write-Host ''
Write-Info "数据存储位置: $HomunculusDir"
Write-Host ''
Write-Info '使用 /learn 命令手动触发模式提取'
Write-Info '使用 -Uninstall 参数卸载 hooks'
Write-Host ''
Write-Warn '修改配置后需要重启 IDE 才能生效'
