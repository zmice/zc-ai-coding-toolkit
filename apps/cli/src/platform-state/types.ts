import type { OverwriteMode, PlatformArtifact, PlatformName } from "@zmice/platform-core";

export interface PlatformInstallPlanLike {
  readonly platform: PlatformName;
  readonly destinationRoot: string;
  readonly manifestSource: string;
  readonly overwrite?: OverwriteMode;
  readonly artifacts: readonly PlatformArtifact[];
  readonly metadata?: {
    readonly fingerprint: {
      readonly algorithm: "sha256";
      readonly value: string;
    };
  };
}

export interface PlatformInstallReceiptArtifact {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface PlatformInstallReceipt {
  readonly schemaVersion: 1;
  readonly platform: PlatformName;
  readonly destinationRoot: string;
  readonly manifestSource: string;
  readonly overwrite: OverwriteMode;
  readonly installedAt: string;
  readonly zcVersion?: string;
  readonly contentFingerprint?: string;
  readonly artifacts: readonly PlatformInstallReceiptArtifact[];
}

export type PlatformInstallStatusKind =
  | "not-installed"
  | "up-to-date"
  | "update-available"
  | "drifted";

export interface PlatformInstallArtifactStatus {
  readonly path: string;
  readonly receiptSha256: string | null;
  readonly actualSha256: string | null;
  readonly plannedSha256: string | null;
  readonly matchesReceiptOnDisk: boolean | null;
  readonly differsFromPlan: boolean;
}

export interface PlatformInstallStatusSummary {
  readonly trackedArtifacts: number;
  readonly driftedArtifacts: number;
  readonly missingArtifacts: number;
  readonly plannedChanges: number;
}

export interface PlatformInstallStatusResult {
  readonly kind: PlatformInstallStatusKind;
  readonly platform: PlatformName;
  readonly receiptPath: string;
  readonly receipt: PlatformInstallReceipt | null;
  readonly zcVersion?: string;
  readonly installedZcVersion?: string;
  readonly contentFingerprint?: string;
  readonly installedContentFingerprint?: string;
  readonly summary: PlatformInstallStatusSummary;
  readonly artifacts: readonly PlatformInstallArtifactStatus[];
}
