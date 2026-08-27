import assert from "node:assert/strict";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, it } from "vitest";

import { resolveQoderCnGlobalPluginRoot } from "./qoder-cn-status.js";

const originalConfigDir = process.env.QODERCN_CONFIG_DIR;

afterEach(() => {
  if (originalConfigDir === undefined) {
    delete process.env.QODERCN_CONFIG_DIR;
  } else {
    process.env.QODERCN_CONFIG_DIR = originalConfigDir;
  }
});

describe("Qoder CN global plugin root", () => {
  it("uses the official ~/.qoder-cn configuration directory by default", () => {
    delete process.env.QODERCN_CONFIG_DIR;

    assert.equal(resolveQoderCnGlobalPluginRoot(), resolve(homedir(), ".qoder-cn"));
  });

  it("honors QODERCN_CONFIG_DIR", () => {
    process.env.QODERCN_CONFIG_DIR = resolve("/tmp/qoder-cn-config");

    assert.equal(resolveQoderCnGlobalPluginRoot(), resolve("/tmp/qoder-cn-config"));
  });
});
