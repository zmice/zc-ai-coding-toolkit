#!/usr/bin/env bash
#
# AI Coding Toolkit - SDD+TDD Workflow Installer (Linux/Mac)
#
# Qoder-first: installs all skills as proper Qoder skill directories.
# Also supports Cursor rules, Codex global installation, and Codex project-level installation.
# Global install (--global) also installs Codex globally to ~/.codex/ (AGENTS.md + skills).
# For Qwen Code, use the extension approach: qwen extensions install https://codeup.aliyun.com/6892c510e5ba87aaf500637d/basic/ai-coding.git
#
# Usage:
#   ./install.sh --global                    Install globally (Qoder + Cursor + Codex)
#   ./install.sh --global --qoder-only       Install Qoder skills only (skip Cursor & Codex)
#   ./install.sh --project /path/to/project  Install to a specific project
#   ./install.sh --codex-project /path/to/project  Install Codex context to a project
#   ./install.sh --global --force            Skip overwrite prompts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$SCRIPT_DIR/skills"
AGENTS_DIR="$SCRIPT_DIR/agents"
COMMANDS_DIR="$SCRIPT_DIR/commands"
INSTRUCTIONS_FILE="$SCRIPT_DIR/instructions.md"
AGENTS_MD_FILE="$SCRIPT_DIR/AGENTS.md"

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
CODEX_PROJECT=""
FORCE=false
QODER_ONLY=false
INSTALLED_QODER=0
INSTALLED_CURSOR=0
INSTALLED_AGENTS=0
INSTALLED_COMMANDS=0

INSTALLED_HOOKS=false
CODEX_GLOBAL_INSTALLED_SKILLS=0
CODEX_GLOBAL_INSTALLED_AGENTS_MD=false

# --- Parse args ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --global)      MODE="global"; shift ;;
        --project)     MODE="project"; PROJECT_DIR="$2"; shift 2 ;;
        --codex-project) CODEX_PROJECT="$2"; shift 2 ;;
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

        # --- Codex Global Install ---
        if ! $QODER_ONLY; then
            CODEX_GLOBAL_DIR="$HOME/.codex"
            CODEX_GLOBAL_SKILLS_DIR="$CODEX_GLOBAL_DIR/skills"
            CODEX_GLOBAL_AGENTS_MD="$CODEX_GLOBAL_DIR/AGENTS.md"

            header "Installing Codex Global"
            echo "  Target (Codex):  $CODEX_GLOBAL_DIR"

            CODEX_GLOBAL_INSTALLED_SKILLS=0
            CODEX_GLOBAL_INSTALLED_AGENTS_MD=false

            # 1. Install AGENTS.md -> ~/.codex/AGENTS.md
            if [[ -f "$AGENTS_MD_FILE" ]]; then
                mkdir -p "$CODEX_GLOBAL_DIR"
                if confirm_overwrite "$CODEX_GLOBAL_AGENTS_MD"; then
                    cp "$AGENTS_MD_FILE" "$CODEX_GLOBAL_AGENTS_MD"
                    ok "AGENTS.md"
                    CODEX_GLOBAL_INSTALLED_AGENTS_MD=true
                else
                    skip "AGENTS.md (skipped)"
                fi
            else
                skip "AGENTS.md (source not found)"
            fi

            # 2. Install Skills -> ~/.codex/skills/<name>/SKILL.md
            header "Installing Codex Global Skills"
            for skill_dir in "$SKILLS_DIR"/*/; do
                [[ -d "$skill_dir" ]] || continue
                name="$(basename "$skill_dir")"
                src="$skill_dir/SKILL.md"
                [[ -f "$src" ]] || continue

                dest_dir="$CODEX_GLOBAL_SKILLS_DIR/$name"
                dest="$dest_dir/SKILL.md"
                mkdir -p "$dest_dir"

                if confirm_overwrite "$dest"; then
                    cp "$src" "$dest"
                    ok "$name/SKILL.md"
                    CODEX_GLOBAL_INSTALLED_SKILLS=$((CODEX_GLOBAL_INSTALLED_SKILLS + 1))
                else
                    skip "$name (skipped)"
                fi
            done
        fi
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
        if [[ -z "$CODEX_PROJECT" ]]; then
        cat <<EOF

AI Coding Toolkit - SDD+TDD Workflow Installer

Usage:
  ./install.sh --global                                  Install globally (Qoder + Cursor + Codex)
  ./install.sh --global --qoder-only                     Install Qoder skills only (skip Cursor & Codex)
  ./install.sh --project /path/to/project                Install to a specific project
  ./install.sh --codex-project /path/to/project          Install Codex context to a project
  ./install.sh --global --codex-project /path/to/project Install both globally and Codex project
  ./install.sh --global --force                          Skip overwrite prompts

Options:
  --global         Install to ~/.qoder/skills/, ~/.cursor/rules/, and ~/.codex/
  --project        Install to <project>/.qoder/skills/ and <project>/.cursor/rules/
  --codex-project  Install AGENTS.md and skills to <project>/ for Codex CLI
  --qoder-only     Skip Cursor rules and Codex global installation (Qoder-first)
  --force          Skip confirmation prompts

Note: For Qwen Code, use the extension approach:
  qwen extensions install https://codeup.aliyun.com/6892c510e5ba87aaf500637d/basic/ai-coding.git

EOF
        exit 0
        fi
        ;;
esac

# --- Codex Project Install ---

CODEX_INSTALLED_SKILLS=0
CODEX_INSTALLED_AGENTS_MD=false

if [[ -n "$CODEX_PROJECT" ]]; then
    header "Codex Project Install: $CODEX_PROJECT"

    if [[ ! -d "$CODEX_PROJECT" ]]; then
        err "Codex project directory not found: $CODEX_PROJECT"
        exit 1
    fi

    # --- Codex: Copy AGENTS.md -> <project>/AGENTS.md ---
    if [[ -f "$AGENTS_MD_FILE" ]]; then
        local_dest="$CODEX_PROJECT/AGENTS.md"
        if confirm_overwrite "$local_dest"; then
            cp "$AGENTS_MD_FILE" "$local_dest"
            ok "AGENTS.md"
            CODEX_INSTALLED_AGENTS_MD=true
        else
            skip "AGENTS.md (skipped)"
        fi
    else
        skip "AGENTS.md (source not found)"
    fi

    # --- Codex: Copy skills/<name>/SKILL.md -> <project>/.codex/skills/<name>/SKILL.md ---
    header "Installing Codex Skills"
    for skill_dir in "$SKILLS_DIR"/*/; do
        [[ -d "$skill_dir" ]] || continue
        name="$(basename "$skill_dir")"
        src="$skill_dir/SKILL.md"
        [[ -f "$src" ]] || continue

        dest_dir="$CODEX_PROJECT/.codex/skills/$name"
        dest="$dest_dir/SKILL.md"
        mkdir -p "$dest_dir"

        if confirm_overwrite "$dest"; then
            cp "$src" "$dest"
            ok "$name/SKILL.md"
            CODEX_INSTALLED_SKILLS=$((CODEX_INSTALLED_SKILLS + 1))
        else
            skip "$name (skipped)"
        fi
    done
fi

# --- zc CLI Install (optional) ---

header "zc CLI Installation"
ZC_DIR="$SCRIPT_DIR/zc"
if [[ ! -d "$ZC_DIR" ]]; then
    skip "zc/ directory not found — skipping zc CLI installation"
else
    if ! command -v node &>/dev/null; then
        skip "Node.js not found — skipping zc CLI (install Node.js >= 20 and re-run)"
    else
        NODE_VERSION_RAW="$(node --version 2>/dev/null || true)"
        NODE_MAJOR=0
        if [[ "$NODE_VERSION_RAW" =~ ^v([0-9]+) ]]; then
            NODE_MAJOR="${BASH_REMATCH[1]}"
        fi
        if [[ "$NODE_MAJOR" -lt 20 ]]; then
            skip "Node.js $NODE_VERSION_RAW found but >= 20 required — skipping zc CLI"
        else
            ok "Node.js $NODE_VERSION_RAW detected"

            (
                cd "$ZC_DIR"

                echo -e "  ${CYAN}Installing npm dependencies...${NC}"
                if ! npm install --no-fund --no-audit >/dev/null 2>&1; then
                    err "npm install failed"; exit 1
                fi
                ok "npm install"

                echo -e "  ${CYAN}Building zc CLI...${NC}"
                if ! npm run build >/dev/null 2>&1; then
                    err "npm run build failed"; exit 1
                fi
                ok "npm run build"
            )
            ZC_BUILD_STATUS=$?

            if [[ $ZC_BUILD_STATUS -eq 0 ]]; then
                # Create symlink
                CLI_ENTRY="$ZC_DIR/dist/cli/index.js"
                BIN_DIR="$SCRIPT_DIR/.bin"
                mkdir -p "$BIN_DIR"
                SYMLINK="$BIN_DIR/zc"

                # Create wrapper script
                cat > "$SYMLINK" <<EOFLNK
#!/usr/bin/env bash
exec node "$CLI_ENTRY" "\$@"
EOFLNK
                chmod +x "$SYMLINK"
                ok "Wrapper created at $SYMLINK"

                # Hint: add to PATH
                case ":$PATH:" in
                    *":$BIN_DIR:"*) ;;
                    *)
                        echo -e "  ${YELLOW}[INFO] Add this to your PATH to use 'zc' globally:${NC}"
                        echo -e "  ${YELLOW}       export PATH=\"$BIN_DIR:\$PATH\"${NC}"
                        ;;
                esac
            else
                err "zc CLI build failed — skipping symlink creation"
            fi

            # tmux hint
            if [[ "$(uname)" == "Darwin" ]]; then
                if ! command -v tmux &>/dev/null; then
                    echo -e "  ${YELLOW}[INFO] zc team mode requires tmux. Install with: brew install tmux${NC}"
                fi
            elif [[ "$(uname)" == "Linux" ]]; then
                if ! command -v tmux &>/dev/null; then
                    echo -e "  ${YELLOW}[INFO] zc team mode requires tmux. Install with: sudo apt install tmux${NC}"
                fi
            fi
        fi
    fi
fi

# --- Summary ---

HAS_QODER_INSTALL=false
if [[ "$MODE" == "global" || "$MODE" == "project" ]]; then
    HAS_QODER_INSTALL=true
fi

header "Installation Complete"
if $HAS_QODER_INSTALL; then
    echo "  Qoder skills:   $INSTALLED_QODER installed"
    echo "  Qoder agents:   $INSTALLED_AGENTS installed"
    echo "  Qoder commands:  $INSTALLED_COMMANDS installed"
    if $INSTALLED_HOOKS; then echo "  Hooks:           continuous-learning (auto-observation)"; fi
    if ! $QODER_ONLY; then echo "  Cursor rules:   $INSTALLED_CURSOR installed"; fi
fi
if [[ "$MODE" == "global" ]] && ! $QODER_ONLY && [[ $CODEX_GLOBAL_INSTALLED_SKILLS -gt 0 || "$CODEX_GLOBAL_INSTALLED_AGENTS_MD" == "true" ]]; then
    echo "  Codex AGENTS.md: $( $CODEX_GLOBAL_INSTALLED_AGENTS_MD && echo 'installed' || echo 'skipped' )"
    echo "  Codex global skills: $CODEX_GLOBAL_INSTALLED_SKILLS installed"
fi
if [[ -n "$CODEX_PROJECT" ]]; then
    echo "  Codex AGENTS.md: $( $CODEX_INSTALLED_AGENTS_MD && echo 'installed' || echo 'skipped' )"
    echo "  Codex skills:   $CODEX_INSTALLED_SKILLS installed"
fi
echo ""
echo -e "  ${GREEN}Commands: /sdd-tdd /spec /task-plan /build /quality-review /debug /ctx-health${NC}"
echo -e "  ${GREEN}         /simplify /perf /secure /api /doc /ship /ci /commit /migrate /ui /idea /learn${NC}"
echo -e "  ${GREEN}Agents:  product-owner, architect, code-reviewer, security-auditor${NC}"
echo -e "  ${GREEN}         test-engineer, backend-specialist, frontend-specialist, performance-engineer${NC}"
echo ""
