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
#   ./install.sh --global --update           Update from upstream first

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
UPDATE=false
QODER_ONLY=false
INSTALLED_QODER=0
INSTALLED_CURSOR=0
INSTALLED_AGENTS=0
INSTALLED_COMMANDS=0

# --- Parse args ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --global)      MODE="global"; shift ;;
        --project)     MODE="project"; PROJECT_DIR="$2"; shift 2 ;;
        --force)       FORCE=true; shift ;;
        --update)      UPDATE=true; shift ;;
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

# --- Update upstream ---

if $UPDATE; then
    header "Updating upstream agent-skills-repo"
    REPO_DIR="$SCRIPT_DIR/.agent-skills-repo"
    if [[ -d "$REPO_DIR" ]]; then
        (cd "$REPO_DIR" && git pull origin main 2>&1 >/dev/null)
        ok "Upstream updated"

        header "Syncing updated skills"
        SKILL_NAMES=(
            "spec-driven-development" "test-driven-development"
            "planning-and-task-breakdown" "incremental-implementation"
            "code-review-and-quality" "context-engineering"
            "debugging-and-error-recovery" "git-workflow-and-versioning"
            "using-agent-skills"
        )
        for name in "${SKILL_NAMES[@]}"; do
            src="$REPO_DIR/skills/$name/SKILL.md"
            dst="$SKILLS_DIR/$name/SKILL.md"
            if [[ -f "$src" ]]; then
                mkdir -p "$SKILLS_DIR/$name"
                cp "$src" "$dst"
                ok "Synced $name"
            fi
        done
    else
        err "No .agent-skills-repo found. Clone it first."
    fi
fi

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
  ./install.sh --global --update           Update from upstream first

Options:
  --global       Install to ~/.qoder/skills/ and ~/.cursor/rules/
  --project      Install to <project>/.qoder/skills/ and <project>/.cursor/rules/
  --qoder-only   Skip Cursor rules (Qoder-first)
  --force        Skip confirmation prompts
  --update       Pull upstream agent-skills-repo updates before installing

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
if ! $QODER_ONLY; then echo "  Cursor rules:   $INSTALLED_CURSOR installed"; fi
echo ""
echo -e "  ${GREEN}Commands: /sdd-tdd /spec /task-plan /build /quality-review /debug /ctx-health${NC}"
echo -e "  ${GREEN}         /simplify /perf /secure /api /doc /ship /migrate /ui /idea${NC}"
echo -e "  ${GREEN}Agents:  code-reviewer, test-engineer, security-auditor${NC}"
echo -e "  ${GREEN}         architect, performance-engineer, refactoring-expert${NC}"
echo -e "  ${GREEN}         database-architect, frontend-specialist${NC}"
echo -e "  ${GREEN}         product-manager, requirements-engineer${NC}"
echo ""
