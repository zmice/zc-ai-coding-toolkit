#!/usr/bin/env bash
#
# AI Coding Toolkit - SDD+TDD Workflow Installer (Linux/Mac)
#
# Qoder-first: installs all skills as proper Qoder skill directories.
# Also supports Cursor rules installation.
# For Qwen Code, use the extension approach: qwen extensions install https://codeup.aliyun.com/6892c510e5ba87aaf500637d/basic/ai-coding.git
#
# Usage:
#   ./install.sh --global                    Install globally (all projects)
#   ./install.sh --global --qoder-only       Install Qoder skills only
#   ./install.sh --project /path/to/project  Install to a specific project
#   ./install.sh --global --force            Skip overwrite prompts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$SCRIPT_DIR/skills"
AGENTS_DIR="$SCRIPT_DIR/agents"
COMMANDS_DIR="$SCRIPT_DIR/commands"
INSTRUCTIONS_FILE="$SCRIPT_DIR/instructions.md"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

header()  { echo -e "\n${CYAN}=== $1 ===${NC}"; }
ok()      { echo -e "  ${GREEN}[OK]${NC} $1"; }
skip()    { echo -e "  ${YELLOW}[SKIP]${NC} $1"; }
err()     { echo -e "  ${RED}[ERR]${NC} $1"; }

# --- Defaults ---
MODE=""
PROJECT_DIR=""
FORCE=false
QODER_ONLY=false
INSTALLED_QODER=0
INSTALLED_CURSOR=0
INSTALLED_AGENTS=0
INSTALLED_COMMANDS=0

INSTALLED_HOOKS=false

# --- Parse args ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --global)      MODE="global"; shift ;;
        --project)     MODE="project"; PROJECT_DIR="$2"; shift 2 ;;
        --force)       FORCE=true; shift ;;
        --qoder-only)  QODER_ONLY=true; shift ;;
        -h|--help)     MODE="help"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# --- Helpers ---

confirm_overwrite() {
    local path="$1"
    if $FORCE; then return 0; fi
    if [[ -e "$path" ]]; then
        read -r -p "  '$path' already exists. Overwrite? [y/N] " answer
        [[ "$answer" =~ ^[Yy]$ ]]
        return $?
    fi
    return 0
}

install_skills() {
    local target_qoder="$1"
    local target_cursor="$2"

    # --- Qoder: Copy skill/<name>/SKILL.md -> .qoder/skills/<name>/SKILL.md ---
    header "Installing Qoder Skills"
    for skill_dir in "$SKILLS_DIR"/*/; do
        [[ -d "$skill_dir" ]] || continue
        local name
        name="$(basename "$skill_dir")"
        local src="$skill_dir/SKILL.md"
        [[ -f "$src" ]] || continue

        local dest_dir="$target_qoder/$name"
        local dest="$dest_dir/SKILL.md"
        mkdir -p "$dest_dir"

        if confirm_overwrite "$dest"; then
            cp "$src" "$dest"
            ok "$name/SKILL.md"
            INSTALLED_QODER=$((INSTALLED_QODER + 1))
        else
            skip "$name (skipped)"
        fi
    done

    # --- Qoder Agents: Copy agents/*.md -> .qoder/agents/*.md ---
    local qoder_base
    qoder_base="$(dirname "$target_qoder")"
    local target_agents="$qoder_base/agents"
    if [[ -d "$AGENTS_DIR" ]]; then
        header "Installing Qoder Agents"
        mkdir -p "$target_agents"
        for agent_file in "$AGENTS_DIR"/*.md; do
            [[ -f "$agent_file" ]] || continue
            local agent_name
            agent_name="$(basename "$agent_file")"
            local dest="$target_agents/$agent_name"
            if confirm_overwrite "$dest"; then
                cp "$agent_file" "$dest"
                ok "$agent_name"
                INSTALLED_AGENTS=$((INSTALLED_AGENTS + 1))
            else
                skip "$agent_name (skipped)"
            fi
        done
    fi

    # --- Qoder Commands: Copy commands/*.md -> .qoder/commands/*.md ---
    local target_commands="$qoder_base/commands"
    if [[ -d "$COMMANDS_DIR" ]]; then
        header "Installing Qoder Commands"
        mkdir -p "$target_commands"
        for cmd_file in "$COMMANDS_DIR"/*.md; do
            [[ -f "$cmd_file" ]] || continue
            local cmd_name
            cmd_name="$(basename "$cmd_file")"
            local dest="$target_commands/$cmd_name"
            if confirm_overwrite "$dest"; then
                cp "$cmd_file" "$dest"
                ok "$cmd_name"
                INSTALLED_COMMANDS=$((INSTALLED_COMMANDS + 1))
            else
                skip "$cmd_name (skipped)"
            fi
        done
    fi

    # --- Qoder Instructions: Copy instructions.md -> .qoder/instructions.md ---
    if [[ -f "$INSTRUCTIONS_FILE" ]]; then
        header "Installing Global Instructions"
        local dest_instructions="$qoder_base/instructions.md"
        if confirm_overwrite "$dest_instructions"; then
            cp "$INSTRUCTIONS_FILE" "$dest_instructions"
            ok "instructions.md"
        else
            skip "instructions.md (skipped)"
        fi
    fi

    # --- Qoder Hooks: Install continuous-learning hooks ---
    local hooks_source="$SKILLS_DIR/continuous-learning/hooks"
    if [[ -d "$hooks_source" ]]; then
        header "Installing Continuous-Learning Hooks"
        local target_hooks="$qoder_base/hooks/continuous-learning"
        mkdir -p "$target_hooks"

        # Copy hook scripts (sh + ps1)
        for hf in observe.sh session-end.sh observe.ps1 session-end.ps1; do
            if [[ -f "$hooks_source/$hf" ]]; then
                cp "$hooks_source/$hf" "$target_hooks/$hf"
                chmod +x "$target_hooks/$hf" 2>/dev/null || true
                ok "$hf"
            fi
        done

        # Create homunculus directory structure
        local homunculus_dir="$qoder_base/homunculus"
        mkdir -p "$homunculus_dir/instincts/personal"
        mkdir -p "$homunculus_dir/instincts/inherited"
        mkdir -p "$homunculus_dir/projects"
        if [[ ! -f "$homunculus_dir/projects.json" ]]; then
            echo '{}' > "$homunculus_dir/projects.json"
        fi
        ok "homunculus directory structure"

        # Update settings.json with hook configuration
        local settings_file="$qoder_base/settings.json"
        if [[ ! -f "$settings_file" ]]; then
            echo '{}' > "$settings_file"
        fi
        local obs_cmd="$target_hooks/observe.sh"
        local end_cmd="$target_hooks/session-end.sh"
        if command -v jq &>/dev/null; then
            local tmp_settings
            tmp_settings=$(mktemp)
            jq --arg obs "$obs_cmd" --arg end "$end_cmd" '
                .hooks //= {} |
                .hooks.PostToolUse //= [] |
                (if (.hooks.PostToolUse | map(select(.hooks[0].command | test("continuous-learning"))) | length) == 0 then
                    .hooks.PostToolUse += [{"matcher": "*", "hooks": [{"type": "command", "command": $obs}]}]
                else . end) |
                .hooks.UserPromptSubmit //= [] |
                (if (.hooks.UserPromptSubmit | map(select(.hooks[0].command | test("continuous-learning"))) | length) == 0 then
                    .hooks.UserPromptSubmit += [{"hooks": [{"type": "command", "command": $obs}]}]
                else . end) |
                .hooks.PostToolUseFailure //= [] |
                (if (.hooks.PostToolUseFailure | map(select(.hooks[0].command | test("continuous-learning"))) | length) == 0 then
                    .hooks.PostToolUseFailure += [{"matcher": "*", "hooks": [{"type": "command", "command": $obs}]}]
                else . end) |
                .hooks.Stop //= [] |
                (if (.hooks.Stop | map(select(.hooks[0].command | test("continuous-learning"))) | length) == 0 then
                    .hooks.Stop += [{"hooks": [{"type": "command", "command": $end}]}]
                else . end)
            ' "$settings_file" > "$tmp_settings" 2>/dev/null && mv "$tmp_settings" "$settings_file"
            ok "settings.json hooks configuration"
        else
            skip "jq not found - configure hooks manually in $settings_file"
        fi
        INSTALLED_HOOKS=true
    fi

    # --- Cursor: Copy skill/<name>/SKILL.md -> .cursor/rules/<name>.md ---
    if ! $QODER_ONLY && [[ -n "$target_cursor" ]]; then
        header "Installing Cursor Rules"
        mkdir -p "$target_cursor"

        for skill_dir in "$SKILLS_DIR"/*/; do
            [[ -d "$skill_dir" ]] || continue
            local name
            name="$(basename "$skill_dir")"
            local src="$skill_dir/SKILL.md"
            [[ -f "$src" ]] || continue

            local dest="$target_cursor/$name.md"
            if confirm_overwrite "$dest"; then
                cp "$src" "$dest"
                ok "$name.md"
                INSTALLED_CURSOR=$((INSTALLED_CURSOR + 1))
            else
                skip "$name.md (skipped)"
            fi
        done
    fi
}

# --- Install ---

case "$MODE" in
    global)
        header "Global Install"
        QODER_DIR="$HOME/.qoder/skills"
        CURSOR_DIR="$HOME/.cursor/rules"
        echo "  Target (Qoder):  $QODER_DIR"
        if ! $QODER_ONLY; then echo "  Target (Cursor): $CURSOR_DIR"; fi
        install_skills "$QODER_DIR" "$CURSOR_DIR"
        ;;

    project)
        header "Project Install: $PROJECT_DIR"
        if [[ ! -d "$PROJECT_DIR" ]]; then
            err "Project directory not found: $PROJECT_DIR"
            exit 1
        fi
        QODER_DIR="$PROJECT_DIR/.qoder/skills"
        CURSOR_DIR="$PROJECT_DIR/.cursor/rules"
        echo "  Target (Qoder):  $QODER_DIR"
        if ! $QODER_ONLY; then echo "  Target (Cursor): $CURSOR_DIR"; fi
        install_skills "$QODER_DIR" "$CURSOR_DIR"
        ;;

    help|"")
        cat <<EOF

AI Coding Toolkit - SDD+TDD Workflow Installer

Usage:
  ./install.sh --global                    Install globally (all projects)
  ./install.sh --global --qoder-only       Install Qoder skills only
  ./install.sh --project /path/to/project  Install to a specific project
  ./install.sh --global --force            Skip overwrite prompts

Options:
  --global       Install to ~/.qoder/skills/ and ~/.cursor/rules/
  --project      Install to <project>/.qoder/skills/ and <project>/.cursor/rules/
  --qoder-only   Skip Cursor rules (Qoder-first)
  --force        Skip confirmation prompts

Note: For Qwen Code, use the extension approach:
  qwen extensions install https://codeup.aliyun.com/6892c510e5ba87aaf500637d/basic/ai-coding.git

EOF
        exit 0
        ;;
esac

# --- Summary ---

header "Installation Complete"
echo "  Qoder skills:   $INSTALLED_QODER installed"
echo "  Qoder agents:   $INSTALLED_AGENTS installed"
echo "  Qoder commands:  $INSTALLED_COMMANDS installed"
if $INSTALLED_HOOKS; then echo "  Hooks:           continuous-learning (auto-observation)"; fi
if ! $QODER_ONLY; then echo "  Cursor rules:   $INSTALLED_CURSOR installed"; fi
echo ""
echo -e "  ${GREEN}Commands: /sdd-tdd /spec /task-plan /build /quality-review /debug /ctx-health${NC}"
echo -e "  ${GREEN}         /simplify /perf /secure /api /doc /ship /migrate /ui /idea /learn${NC}"
echo -e "  ${GREEN}Agents:  product-owner, architect, code-reviewer, security-auditor${NC}"
echo -e "  ${GREEN}         test-engineer, backend-specialist, frontend-specialist, performance-engineer${NC}"
echo ""
