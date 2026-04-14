#!/bin/bash
# continuous-learning/hooks/observe.sh
# Hook 观察脚本 — PostToolUse / UserPromptSubmit 触发
# 记录工具调用和用户输入模式到 observations.jsonl
#
# 协议：stdin JSON 输入 → exit 0 放行（不阻塞 Agent）
# 兼容：Qoder + Qwen Code

set -euo pipefail

# ─── 配置 ──────────────────────────────────────────────
HOMUNCULUS_DIR="${HOME}/.qoder/homunculus"
MAX_SUMMARY_LENGTH=500

# ─── 读取 stdin ────────────────────────────────────────
input=$(cat)

# ─── 检查 jq 可用性 ───────────────────────────────────
if ! command -v jq &>/dev/null; then
  exit 0  # 静默放行，不阻塞 Agent
fi

# ─── 提取通用字段 ──────────────────────────────────────
hook_event=$(echo "$input" | jq -r '.hook_event_name // empty')
session_id=$(echo "$input" | jq -r '.session_id // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")

# ─── 项目检测 ──────────────────────────────────────────
project_id=""
project_name=""

if [ -n "$cwd" ] && [ -d "$cwd" ]; then
  # 尝试 git remote URL hash
  remote_url=$(cd "$cwd" && git remote get-url origin 2>/dev/null || true)
  if [ -n "$remote_url" ]; then
    # 12 字符 hash 作为项目 ID
    if command -v md5sum &>/dev/null; then
      project_id=$(echo -n "$remote_url" | md5sum | cut -c1-12)
    elif command -v md5 &>/dev/null; then
      project_id=$(echo -n "$remote_url" | md5 | cut -c1-12)
    fi
  fi

  # 备选：repo 根路径
  if [ -z "$project_id" ]; then
    repo_root=$(cd "$cwd" && git rev-parse --show-toplevel 2>/dev/null || true)
    if [ -n "$repo_root" ]; then
      if command -v md5sum &>/dev/null; then
        project_id=$(echo -n "$repo_root" | md5sum | cut -c1-12)
      elif command -v md5 &>/dev/null; then
        project_id=$(echo -n "$repo_root" | md5 | cut -c1-12)
      fi
      project_name=$(basename "$repo_root")
    fi
  else
    repo_root=$(cd "$cwd" && git rev-parse --show-toplevel 2>/dev/null || true)
    project_name=$(basename "${repo_root:-$cwd}")
  fi
fi

# ─── 确定存储路径 ──────────────────────────────────────
if [ -n "$project_id" ]; then
  obs_dir="${HOMUNCULUS_DIR}/projects/${project_id}"
else
  obs_dir="${HOMUNCULUS_DIR}"
fi
mkdir -p "$obs_dir"

# ─── 更新项目注册表 ────────────────────────────────────
if [ -n "$project_id" ]; then
  projects_file="${HOMUNCULUS_DIR}/projects.json"
  if [ ! -f "$projects_file" ]; then
    echo '{}' > "$projects_file"
  fi

  # 写入项目元数据
  project_meta="${obs_dir}/project.json"
  if [ ! -f "$project_meta" ]; then
    jq -n \
      --arg id "$project_id" \
      --arg name "$project_name" \
      --arg root "${repo_root:-$cwd}" \
      --arg remote "${remote_url:-}" \
      --arg created "$timestamp" \
      '{id: $id, name: $name, root: $root, remote: $remote, created: $created}' \
      > "$project_meta"
  fi
fi

# ─── 构建观察记录 ──────────────────────────────────────
observation=""

case "$hook_event" in
  PostToolUse)
    tool_name=$(echo "$input" | jq -r '.tool_name // empty')
    # 提取工具输入摘要（限制长度）
    tool_input_summary=$(echo "$input" | jq -r '
      .tool_input |
      if type == "object" then
        (to_entries | map(.key + "=" + (.value | tostring | .[0:80])) | join("; ") | .[0:'"$MAX_SUMMARY_LENGTH"'])
      elif type == "string" then
        .[0:'"$MAX_SUMMARY_LENGTH"']
      else
        "N/A"
      end
    ' 2>/dev/null || echo "N/A")

    observation=$(jq -n \
      --arg ts "$timestamp" \
      --arg sid "$session_id" \
      --arg evt "$hook_event" \
      --arg pid "$project_id" \
      --arg tn "$tool_name" \
      --arg tis "$tool_input_summary" \
      '{timestamp: $ts, session_id: $sid, event: $evt, project_id: $pid, tool_name: $tn, tool_input_summary: $tis, tool_outcome: "success"}')
    ;;

  PostToolUseFailure)
    tool_name=$(echo "$input" | jq -r '.tool_name // empty')
    error_msg=$(echo "$input" | jq -r '.error // empty' | head -c "$MAX_SUMMARY_LENGTH")

    observation=$(jq -n \
      --arg ts "$timestamp" \
      --arg sid "$session_id" \
      --arg evt "$hook_event" \
      --arg pid "$project_id" \
      --arg tn "$tool_name" \
      --arg err "$error_msg" \
      '{timestamp: $ts, session_id: $sid, event: $evt, project_id: $pid, tool_name: $tn, tool_outcome: "failure", error_summary: $err}')
    ;;

  UserPromptSubmit)
    prompt_text=$(echo "$input" | jq -r '.prompt // empty' | head -c "$MAX_SUMMARY_LENGTH")

    # 检测是否包含纠正性关键词
    is_correction="false"
    if echo "$prompt_text" | grep -qiE '不要|不对|改用|换成|错了|应该是|don'\''t|instead|wrong|should be|change to|use .* instead'; then
      is_correction="true"
    fi

    observation=$(jq -n \
      --arg ts "$timestamp" \
      --arg sid "$session_id" \
      --arg evt "$hook_event" \
      --arg pid "$project_id" \
      --arg pt "$prompt_text" \
      --argjson ic "$is_correction" \
      '{timestamp: $ts, session_id: $sid, event: $evt, project_id: $pid, prompt_summary: $pt, is_correction: $ic}')
    ;;

  *)
    # 未知事件，静默放行
    exit 0
    ;;
esac

# ─── 写入观察文件 ──────────────────────────────────────
if [ -n "$observation" ]; then
  echo "$observation" >> "${obs_dir}/observations.jsonl"
fi

# ─── 放行，不阻塞 Agent ───────────────────────────────
exit 0
