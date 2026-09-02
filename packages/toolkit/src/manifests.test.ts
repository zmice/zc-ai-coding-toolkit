import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { resolveToolkitContentRoot } from "./loaders/fs.js";
import {
  createToolkitManifest,
  getToolkitAssetById,
  listToolkitAssetsByKind,
  loadToolkitManifest
} from "./manifests/toolkit-manifest.js";
import { loadToolkitContentTree } from "./loaders/asset-unit.js";

describe("createToolkitManifest", () => {
  it("normalizes assets into a stable manifest", async () => {
    const contentRoot = resolveToolkitContentRoot();
    const assets = await loadToolkitContentTree(contentRoot);
    const manifest = createToolkitManifest(assets, contentRoot);

    assert.equal(manifest.version, 1);
    assert.ok(manifest.counts.total >= 3);
    assert.ok(manifest.counts.skills >= 1);
    assert.ok(manifest.counts.commands >= 1);
    assert.ok(manifest.counts.agents >= 1);
    assert.equal(
      getToolkitAssetById(manifest, "command:verify")?.meta.title,
      "验证"
    );
    assert.equal(
      getToolkitAssetById(manifest, "command:task-plan")?.meta.title,
      "计划"
    );
    assert.equal(
      getToolkitAssetById(manifest, "command:spec")?.meta.tier,
      "core"
    );
    assert.equal(
      getToolkitAssetById(manifest, "command:start")?.meta.workflowFamily,
      "intake"
    );
    assert.equal(
      getToolkitAssetById(manifest, "command:product-analysis")?.meta.workflowRole,
      "workflow-entry"
    );
    assert.equal(
      getToolkitAssetById(manifest, "command:sdd-tdd")?.meta.workflowRole,
      "workflow-entry"
    );
    assert.deepEqual(
      getToolkitAssetById(manifest, "command:start")?.meta.routingWorkflows,
      [
        "product-analysis",
        "full-delivery",
        "bugfix",
        "review-closure",
        "docs-release",
        "investigation"
      ]
    );
    assert.deepEqual(
      getToolkitAssetById(manifest, "command:start")?.meta.taskTypes,
      ["feature", "bugfix", "review", "docs", "release", "investigation"]
    );
    assert.deepEqual(
      getToolkitAssetById(manifest, "command:build")?.meta.routingWorkflows,
      ["full-delivery", "bugfix"]
    );
    assert.deepEqual(
      getToolkitAssetById(manifest, "command:quality-review")?.meta.routingWorkflows,
      ["full-delivery", "bugfix", "review-closure"]
    );
    assert.deepEqual(
      getToolkitAssetById(manifest, "command:product-analysis")?.meta.routingWorkflows,
      ["product-analysis"]
    );
    assert.deepEqual(
      getToolkitAssetById(manifest, "command:product-analysis")?.meta.taskTypes,
      ["feature", "investigation"]
    );
    assert.equal(
      getToolkitAssetById(manifest, "command:spec")?.meta.source?.upstream,
      "agent-skills"
    );
    assert.equal(
      getToolkitAssetById(manifest, "skill:sdd-tdd-workflow")?.meta.source?.originPath,
      "skills/sdd-tdd-workflow/SKILL.md"
    );
    assert.equal(
      getToolkitAssetById(manifest, "skill:engineering-principles")?.meta.source?.upstream,
      "andrej-karpathy-skills"
    );
    assert.ok(Boolean(getToolkitAssetById(manifest, "skill:review-response-and-resolution")));
    assert.ok(Boolean(getToolkitAssetById(manifest, "skill:branch-finish-and-cleanup")));
    assert.ok(Boolean(getToolkitAssetById(manifest, "skill:release-documentation-sync")));
    assert.ok(Boolean(getToolkitAssetById(manifest, "skill:developer-experience-audit")));
    assert.equal(
      getToolkitAssetById(manifest, "skill:ui-ux-review")?.meta.title,
      "界面与体验审查"
    );
    assert.deepEqual(manifest.byRelationship.requires["command:product-analysis"], []);
    assert.deepEqual(manifest.byRelationship.suggests["command:product-analysis"], [
      "command:idea",
      "agent:product-owner",
      "skill:brainstorming-and-design",
      "command:spec",
      "command:plan-review",
      "command:task-plan"
    ]);
    assert.deepEqual(manifest.byRelationship.requires["command:build"], [
      "skill:incremental-implementation",
      "skill:test-driven-development"
    ]);
    assert.deepEqual(manifest.byRelationship.suggests["command:build"], [
      "command:quality-review",
      "command:verify",
      "skill:debugging-and-error-recovery",
      "skill:engineering-principles"
    ]);
    assert.deepEqual(manifest.byRelationship.requires["command:ship"], [
      "skill:shipping-and-launch"
    ]);
    assert.deepEqual(manifest.byRelationship.suggests["command:ctx-health"], [
      "skill:context-budget-audit"
    ]);
    assert.deepEqual(manifest.byRelationship.suggests["skill:spec-driven-development"], [
      "skill:engineering-principles"
    ]);
    assert.deepEqual(manifest.byRelationship.suggests["skill:frontend-ui-engineering"], [
      "skill:ui-ux-review",
      "skill:browser-qa-testing",
      "skill:verification-before-completion"
    ]);
    assert.deepEqual(manifest.byRelationship.suggests["command:ui"], [
      "skill:ui-ux-review",
      "command:qa",
      "skill:browser-qa-testing"
    ]);
    assert.deepEqual(
      getToolkitAssetById(manifest, "command:ui")?.meta.platformExposure,
      {
        codex: "prompt-entry",
        qwen: "command-style",
        claude: "command-style",
        opencode: "command-style",
        "qoder-cn": "command-style"
      }
    );
    assert.deepEqual(
      getToolkitAssetById(manifest, "skill:ui-ux-review")?.meta.platformExposure,
      {
        codex: "primary",
        qwen: "listed",
        claude: "listed",
        opencode: "listed",
        "qoder-cn": "listed"
      }
    );
    assert.deepEqual(manifest.byRelationship.suggests["agent:frontend-specialist"], [
      "skill:ui-ux-review",
      "skill:browser-qa-testing"
    ]);
    assert.deepEqual(
      getToolkitAssetById(manifest, "command:verify")?.meta.platforms,
      ["qwen", "codex", "claude", "opencode", "qoder-cn"]
    );
    assert.ok(listToolkitAssetsByKind(manifest, "agent").length >= 1);
  });
});

describe("loadToolkitManifest", () => {
  it("loads and validates the manifest from content on disk", async () => {
    const manifest = await loadToolkitManifest();

    assert.ok(manifest.assets.length >= 3);
    assert.ok(Boolean(manifest.byId["skill:sdd-tdd-workflow"]));
    assert.ok(Boolean(manifest.byId["skill:engineering-principles"]));
    assert.ok(Boolean(manifest.byId["skill:review-response-and-resolution"]));
    assert.ok(Boolean(manifest.byId["skill:branch-finish-and-cleanup"]));
    assert.ok(Boolean(manifest.byId["skill:release-documentation-sync"]));
    assert.ok(Boolean(manifest.byId["skill:developer-experience-audit"]));
    assert.ok(Boolean(manifest.byId["skill:ui-ux-review"]));
    assert.ok(Boolean(manifest.byId["command:start"]));
    assert.ok(Boolean(manifest.byId["command:context-init"]));
    assert.ok(Boolean(manifest.byId["command:product-analysis"]));
    assert.ok(Boolean(manifest.byId["command:spec"]));
    assert.ok(Boolean(manifest.byId["agent:architect"]));
    assert.ok(Boolean(manifest.byId["agent:context-steward"]));
    assert.equal(manifest.byId["skill:sdd-tdd-workflow"]?.meta.tier, "core");
    assert.equal(manifest.byId["agent:architect"]?.meta.audience, "advanced");
    assert.deepEqual(manifest.byRelationship.requires["command:quality-review"], [
      "skill:code-review-and-quality"
    ]);
    assert.deepEqual(manifest.byRelationship.suggests["command:quality-review"], [
      "command:verify",
      "skill:review-response-and-resolution",
      "skill:security-and-hardening",
      "skill:performance-optimization"
    ]);
    assert.deepEqual(
      manifest.byId["agent:test-engineer"]?.meta.platforms,
      ["qwen", "codex", "claude", "opencode", "qoder-cn"]
    );
    const codexRoleMatrix = {
      "agent:architect": ["gpt-5.6-sol", "high", "read-only"],
      "agent:security-auditor": ["gpt-5.6-sol", "high", "read-only"],
      "agent:code-reviewer": ["gpt-5.6-terra", "high", "read-only"],
      "agent:performance-engineer": ["gpt-5.6-terra", "high", "read-only"],
      "agent:backend-specialist": ["gpt-5.6-terra", "medium", "workspace-write"],
      "agent:frontend-specialist": ["gpt-5.6-terra", "medium", "workspace-write"],
      "agent:test-engineer": ["gpt-5.6-terra", "medium", "workspace-write"],
      "agent:product-owner": ["gpt-5.6-terra", "medium", "read-only"],
      "agent:context-steward": ["gpt-5.6-luna", "medium", "workspace-write"]
    } as const;

    for (const [agentId, [model, modelReasoningEffort, sandboxMode]] of Object.entries(codexRoleMatrix)) {
      assert.deepEqual(manifest.byId[agentId]?.meta.codexAgent, {
        model,
        modelReasoningEffort,
        sandboxMode
      });
    }
  });

  it("keeps the multi-agent control protocol discoverable in canonical content", async () => {
    const manifest = await loadToolkitManifest();

    assert.match(
      manifest.byId["command:start"]?.body ?? "",
      /agent_opportunity:[\s\S]*dispatch_now[\s\S]*loop_budget[\s\S]*worktree-team/
    );
    assert.match(
      manifest.byId["command:context-init"]?.body ?? "",
      /zc context init --plan[\s\S]*\.codex\/context\/project\.md[\s\S]*主动维护规则[\s\S]*agent:context-steward/
    );
    assert.match(
      manifest.byId["agent:context-steward"]?.body ?? "",
      /Context stewardship:[\s\S]*scoped_write[\s\S]*fan-in gate[\s\S]*Recommendation:/
    );
    assert.deepEqual(
      manifest.byId["agent:context-steward"]?.meta.tools,
      ["Read", "Edit", "MultiEdit", "Grep", "Glob", "Bash"]
    );
    assert.match(
      manifest.byId["skill:sdd-tdd-workflow"]?.body ?? "",
      /producer owns fix[\s\S]*reviewer owns regression[\s\S]*controller owns fan-in/
    );
    assert.match(
      manifest.byId["skill:sdd-tdd-workflow"]?.body ?? "",
      /Context Steward Sidecar[\s\S]*agent:context-steward[\s\S]*context stewardship/
    );
    assert.match(
      manifest.byId["skill:planning-and-task-breakdown"]?.body ?? "",
      /Agent Opportunity[\s\S]*dispatch_now[\s\S]*loop_budget/
    );
    assert.match(
      manifest.byId["skill:parallel-agent-dispatch"]?.body ?? "",
      /dispatch_contract[\s\S]*Bounded Loop[\s\S]*Loop budget/
    );
    assert.match(
      manifest.byId["skill:parallel-agent-dispatch"]?.body ?? "",
      /references\/codex-native-lifecycle\.md[\s\S]*runtime capacity[\s\S]*zc agent worktree prepare/
    );
    assert.doesNotMatch(
      manifest.byId["skill:parallel-agent-dispatch"]?.body ?? "",
      /普通 Codex 多 agent 先用 `zc agent plan`/
    );
    const codexLifecycle = manifest.byId["skill:parallel-agent-dispatch"]?.attachments.find(
      (attachment) => attachment.relativePath === "assets/references/codex-native-lifecycle.md"
    );
    assert.match(
      codexLifecycle?.contents ?? "",
      /spawn_agent[\s\S]*followup_task[\s\S]*send_message[\s\S]*interrupt_agent[\s\S]*wait_agent/
    );
    assert.match(
      codexLifecycle?.contents ?? "",
      /fork_turns[\s\S]*available child slots[\s\S]*controller/
    );
    const subagentSkill = manifest.byId["skill:subagent-driven-development"];
    assert.match(
      subagentSkill?.body ?? "",
      /独立任务启动新线程[\s\S]*同一任务[\s\S]*followup_task/
    );
    assert.match(
      subagentSkill?.body ?? "",
      /references\/execution-protocol\.md[\s\S]*Bounded Fix Loop/
    );
    const executionProtocol = subagentSkill?.attachments.find(
      (attachment) => attachment.relativePath === "assets/references/execution-protocol.md"
    );
    assert.match(
      executionProtocol?.contents ?? "",
      /loop budget:[\s\S]*controller decision/i
    );
    assert.match(
      manifest.byId["skill:team-orchestration"]?.body ?? "",
      /agent_opportunity\.mode=worktree-team[\s\S]*用户明确确认[\s\S]*Bounded Team Loop/
    );
  });
});
