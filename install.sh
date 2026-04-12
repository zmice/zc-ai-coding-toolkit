#!/usr/bin/env bash
#
# AI Coding Toolkit - SDD+TDD Workflow Installer (Linux/Mac)
#
# Usage:
#   ./install.sh --global                    Install globally (all projects)
#   ./install.sh --project /path/to/project  Install to a specific project
#   ./install.sh --global --force            Skip overwrite prompts
#   ./install.sh --global --update           Update from upstream first

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$SCRIPT_DIR/skills"

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

# --- Parse args ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --global)  MODE="global"; shift ;;
        --project) MODE="project"; PROJECT_DIR="$2"; shift 2 ;;
        --force)   FORCE=true; shift ;;
        --update)  UPDATE=true; shift ;;
        -h|--help) MODE="help"; shift ;;
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

copy_skill_files() {
    local target_rules_dir="$1"
    local target_qoder_skills_dir="$2"

    # Copy .md rule files
    if [[ -n "$target_rules_dir" ]]; then
        mkdir -p "$target_rules_dir"
        for file in "$SKILLS_DIR"/*.md; do
            [[ -f "$file" ]] || continue
            local basename
            basename="$(basename "$file")"
            local dest="$target_rules_dir/$basename"
            if confirm_overwrite "$dest"; then
                cp "$file" "$dest"
                ok "$basename -> $target_rules_dir"
            else
                skip "$basename (skipped)"
            fi
        done
    fi

    # Copy sdd-tdd-workflow skill
    if [[ -n "$target_qoder_skills_dir" ]]; then
        local skill_dest="$target_qoder_skills_dir/sdd-tdd-workflow"
        mkdir -p "$skill_dest"
        local dest="$skill_dest/SKILL.md"
        if confirm_overwrite "$dest"; then
            cp "$SKILLS_DIR/sdd-tdd-workflow/SKILL.md" "$dest"
            ok "sdd-tdd-workflow/SKILL.md -> $skill_dest"
        else
            skip "sdd-tdd-workflow/SKILL.md (skipped)"
        fi
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
        declare -A SKILL_MAP=(
            ["spec-driven-development"]="spec-driven-development.md"
            ["test-driven-development"]="test-driven-development.md"
            ["planning-and-task-breakdown"]="planning-and-task-breakdown.md"
            ["incremental-implementation"]="incremental-implementation.md"
            ["code-review-and-quality"]="code-review-and-quality.md"
            ["context-engineering"]="context-engineering.md"
            ["debugging-and-error-recovery"]="debugging-and-error-recovery.md"
            ["git-workflow-and-versioning"]="git-workflow-and-versioning.md"
            ["using-agent-skills"]="using-agent-skills.md"
        )
        for key in "${!SKILL_MAP[@]}"; do
            src="$REPO_DIR/skills/$key/SKILL.md"
            dst="$SKILLS_DIR/${SKILL_MAP[$key]}"
            if [[ -f "$src" ]]; then
                cp "$src" "$dst"
                ok "Synced ${SKILL_MAP[$key]}"
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
        CURSOR_RULES="$HOME/.cursor/rules"
        QODER_SKILLS="$HOME/.qoder/skills"
        echo "  Target (Cursor): $CURSOR_RULES"
        echo "  Target (Qoder):  $QODER_SKILLS"
        copy_skill_files "$CURSOR_RULES" "$QODER_SKILLS"
        ;;

    project)
        header "Project Install: $PROJECT_DIR"
        if [[ ! -d "$PROJECT_DIR" ]]; then
            err "Project directory not found: $PROJECT_DIR"
            exit 1
        fi
        CURSOR_RULES="$PROJECT_DIR/.cursor/rules"
        QODER_SKILLS="$PROJECT_DIR/.qoder/skills"
        echo "  Target (Cursor): $CURSOR_RULES"
        echo "  Target (Qoder):  $QODER_SKILLS"
        copy_skill_files "$CURSOR_RULES" "$QODER_SKILLS"
        ;;

    help|"")
        cat <<EOF

AI Coding Toolkit - SDD+TDD Workflow Installer

Usage:
  ./install.sh --global                    Install globally (all projects)
  ./install.sh --project /path/to/project  Install to a specific project
  ./install.sh --global --force            Skip overwrite prompts
  ./install.sh --global --update           Update from upstream first

Options:
  --global    Install to ~/.cursor/rules/ and ~/.qoder/skills/
  --project   Install to <project>/.cursor/rules/ and <project>/.qoder/skills/
  --force     Skip confirmation prompts
  --update    Pull upstream agent-skills-repo updates before installing

EOF
        exit 0
        ;;
esac

# --- Summary ---

header "Installation Complete"
RULE_COUNT=$(find "$SKILLS_DIR" -maxdepth 1 -name "*.md" -type f | wc -l | tr -d ' ')
echo "  Rules installed:  $RULE_COUNT skill files"
echo "  Qoder skill:     sdd-tdd-workflow"
echo ""
echo -e "  ${GREEN}Commands available: /sdd-tdd /spec /plan /build /review /debug /context${NC}"
echo ""
