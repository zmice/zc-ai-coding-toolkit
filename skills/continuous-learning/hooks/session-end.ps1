# continuous-learning/hooks/session-end.ps1
# Stop hook — Agent 完成响应时触发
# 统计本次会话的观察数据，提醒 Agent 执行 /learn
#
# 协议：stdin JSON 输入 → stdout JSON 输出（additionalContext）
# 兼容：Qoder + Qwen Code (Windows)

$ErrorActionPreference = 'SilentlyContinue'

# ─── 配置 ──────────────────────────────────────────────
$HomunculusDir = Join-Path $HOME '.qoder' 'homunculus'
$MinObservations = 5

# ─── 读取 stdin ────────────────────────────────────────
try {
    $rawInput = $input | Out-String
    if ([string]::IsNullOrWhiteSpace($rawInput)) { exit 0 }
    $hookData = $rawInput | ConvertFrom-Json
} catch {
    exit 0
}

# ─── 提取字段 ──────────────────────────────────────────
$sessionId = if ($hookData.session_id) { $hookData.session_id } else { '' }
$cwd       = if ($hookData.cwd) { $hookData.cwd } else { '' }

# ─── 项目检测 ──────────────────────────────────────────
$projectId = ''

if ($cwd -and (Test-Path $cwd -PathType Container)) {
    Push-Location $cwd
    try {
        $remoteUrl = git remote get-url origin 2>$null
        if ($remoteUrl) {
            $md5 = [System.Security.Cryptography.MD5]::Create()
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($remoteUrl)
            $hash = $md5.ComputeHash($bytes)
            $projectId = ($hash | ForEach-Object { $_.ToString('x2') }) -join '' | ForEach-Object { $_.Substring(0, 12) }
        }

        if (-not $projectId) {
            $repoRoot = git rev-parse --show-toplevel 2>$null
            if ($repoRoot) {
                $repoRoot = $repoRoot.Trim()
                $md5 = [System.Security.Cryptography.MD5]::Create()
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($repoRoot)
                $hash = $md5.ComputeHash($bytes)
                $projectId = ($hash | ForEach-Object { $_.ToString('x2') }) -join '' | ForEach-Object { $_.Substring(0, 12) }
            }
        }
    } finally {
        Pop-Location
    }
}

# ─── 确定观察文件路径 ──────────────────────────────────
if ($projectId) {
    $obsFile = Join-Path $HomunculusDir 'projects' $projectId 'observations.jsonl'
} else {
    $obsFile = Join-Path $HomunculusDir 'observations.jsonl'
}

# ─── 统计本次会话的观察 ────────────────────────────────
if (-not (Test-Path $obsFile)) { exit 0 }

$lines = @(Get-Content $obsFile -Encoding UTF8)

$sessionObsCount = 0
$correctionCount = 0
$failureCount    = 0

if ($sessionId) {
    foreach ($line in $lines) {
        if ($line -match "`"session_id`":`"$sessionId`"") {
            $sessionObsCount++
            if ($line -match '"is_correction":true') { $correctionCount++ }
            if ($line -match '"tool_outcome":"failure"') { $failureCount++ }
        }
    }
} else {
    $sessionObsCount = $lines.Count
}

# ─── 决定是否提醒 ─────────────────────────────────────
if ($sessionObsCount -lt $MinObservations) { exit 0 }

# ─── 构建提醒消息 ──────────────────────────────────────
$hint = ''

if ($correctionCount -gt 0) {
    $hint = "本次会话检测到 ${correctionCount} 次用户纠正和 ${sessionObsCount} 条工具观察。建议运行 /learn 提取可复用模式。"
} elseif ($failureCount -gt 2) {
    $hint = "本次会话有 ${failureCount} 次工具失败和 ${sessionObsCount} 条观察。建议运行 /learn 分析错误修复模式。"
} elseif ($sessionObsCount -gt 20) {
    $hint = "本次会话积累了 ${sessionObsCount} 条观察。建议运行 /learn 提取可复用模式。"
}

if ($hint) {
    # 输出 JSON，通过 additionalContext 注入对话
    @{
        hookSpecificOutput = @{
            additionalContext = $hint
        }
    } | ConvertTo-Json -Compress
}

exit 0
