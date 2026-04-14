# continuous-learning/hooks/observe.ps1
# Hook 观察脚本 — PostToolUse / UserPromptSubmit 触发
# 记录工具调用和用户输入模式到 observations.jsonl
#
# 协议：stdin JSON 输入 → exit 0 放行（不阻塞 Agent）
# 兼容：Qoder + Qwen Code (Windows)

$ErrorActionPreference = 'SilentlyContinue'

# ─── 配置 ──────────────────────────────────────────────
$HomunculusDir = Join-Path $HOME '.qoder' 'homunculus'
$MaxSummaryLength = 500

# ─── 读取 stdin ────────────────────────────────────────
try {
    $rawInput = $input | Out-String
    if ([string]::IsNullOrWhiteSpace($rawInput)) { exit 0 }
    $hookData = $rawInput | ConvertFrom-Json
} catch {
    exit 0  # 解析失败，静默放行
}

# ─── 提取通用字段 ──────────────────────────────────────
$hookEvent  = if ($hookData.hook_event_name) { $hookData.hook_event_name } else { '' }
$sessionId  = if ($hookData.session_id) { $hookData.session_id } else { '' }
$cwd        = if ($hookData.cwd) { $hookData.cwd } else { '' }
$timestamp  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

# ─── 项目检测 ──────────────────────────────────────────
$projectId   = ''
$projectName = ''
$remoteUrl   = ''
$repoRoot    = ''

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

        $repoRoot = git rev-parse --show-toplevel 2>$null
        if ($repoRoot) {
            $repoRoot = $repoRoot.Trim()
            $projectName = Split-Path $repoRoot -Leaf
            if (-not $projectId) {
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

# ─── 确定存储路径 ──────────────────────────────────────
if ($projectId) {
    $obsDir = Join-Path $HomunculusDir 'projects' $projectId
} else {
    $obsDir = $HomunculusDir
}
if (-not (Test-Path $obsDir)) {
    New-Item -ItemType Directory -Path $obsDir -Force | Out-Null
}

# ─── 更新项目元数据 ────────────────────────────────────
if ($projectId) {
    $projectMeta = Join-Path $obsDir 'project.json'
    if (-not (Test-Path $projectMeta)) {
        @{
            id      = $projectId
            name    = $projectName
            root    = if ($repoRoot) { $repoRoot } else { $cwd }
            remote  = if ($remoteUrl) { $remoteUrl } else { '' }
            created = $timestamp
        } | ConvertTo-Json -Compress | Set-Content $projectMeta -Encoding UTF8
    }
}

# ─── 构建观察记录 ──────────────────────────────────────
$observation = $null

switch ($hookEvent) {
    'PostToolUse' {
        $toolName = if ($hookData.tool_name) { $hookData.tool_name } else { '' }
        $toolInputSummary = 'N/A'
        if ($hookData.tool_input) {
            try {
                $ti = $hookData.tool_input
                if ($ti -is [string]) {
                    $toolInputSummary = $ti.Substring(0, [Math]::Min($ti.Length, $MaxSummaryLength))
                } else {
                    $parts = @()
                    $ti.PSObject.Properties | ForEach-Object {
                        $val = "$($_.Value)".Substring(0, [Math]::Min("$($_.Value)".Length, 80))
                        $parts += "$($_.Name)=$val"
                    }
                    $toolInputSummary = ($parts -join '; ').Substring(0, [Math]::Min(($parts -join '; ').Length, $MaxSummaryLength))
                }
            } catch { $toolInputSummary = 'N/A' }
        }

        $observation = @{
            timestamp          = $timestamp
            session_id         = $sessionId
            event              = $hookEvent
            project_id         = $projectId
            tool_name          = $toolName
            tool_input_summary = $toolInputSummary
            tool_outcome       = 'success'
        }
    }
    'PostToolUseFailure' {
        $toolName = if ($hookData.tool_name) { $hookData.tool_name } else { '' }
        $errorMsg = if ($hookData.error) { "$($hookData.error)".Substring(0, [Math]::Min("$($hookData.error)".Length, $MaxSummaryLength)) } else { '' }

        $observation = @{
            timestamp     = $timestamp
            session_id    = $sessionId
            event         = $hookEvent
            project_id    = $projectId
            tool_name     = $toolName
            tool_outcome  = 'failure'
            error_summary = $errorMsg
        }
    }
    'UserPromptSubmit' {
        $promptText = if ($hookData.prompt) { "$($hookData.prompt)".Substring(0, [Math]::Min("$($hookData.prompt)".Length, $MaxSummaryLength)) } else { '' }

        # 检测纠正性关键词
        $isCorrection = $false
        if ($promptText -match '不要|不对|改用|换成|错了|应该是|don''t|instead|wrong|should be|change to|use .* instead') {
            $isCorrection = $true
        }

        $observation = @{
            timestamp      = $timestamp
            session_id     = $sessionId
            event          = $hookEvent
            project_id     = $projectId
            prompt_summary = $promptText
            is_correction  = $isCorrection
        }
    }
    default {
        exit 0  # 未知事件，静默放行
    }
}

# ─── 写入观察文件 ──────────────────────────────────────
if ($observation) {
    $obsFile = Join-Path $obsDir 'observations.jsonl'
    $observation | ConvertTo-Json -Compress | Add-Content $obsFile -Encoding UTF8
}

# ─── 放行，不阻塞 Agent ───────────────────────────────
exit 0
