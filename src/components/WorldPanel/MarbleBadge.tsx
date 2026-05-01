"use client";

import type { MarbleResult } from "../../state/types";

type Config = {
  label: string;
  color: string;
  bg: string;
  border: string;
  pulse?: boolean;
};

const CONFIGS: Partial<Record<MarbleResult["status"], Config>> = {
  uploading: {
    label: "UPLOADING",
    color: "var(--status-generating)",
    bg: "var(--status-generating-bg)",
    border: "var(--status-generating-border)",
    pulse: true,
  },
  generating: {
    label: "GENERATING",
    color: "var(--status-generating)",
    bg: "var(--status-generating-bg)",
    border: "var(--status-generating-border)",
    pulse: true,
  },
  complete: {
    label: "COMPLETE",
    color: "var(--status-ready)",
    bg: "var(--status-ready-bg)",
    border: "var(--status-ready-border)",
  },
  failed: {
    label: "FAILED",
    color: "var(--status-error)",
    bg: "var(--status-error-bg)",
    border: "var(--status-error-border)",
  },
  // FREE-ALT: Show "coming soon" badge when feature is disabled
  disabled: {
    label: "COMING SOON",
    color: "rgba(255,255,255,0.4)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)",
  },
};

export function MarbleBadge({ status }: { status: MarbleResult["status"] }) {
  const cfg = CONFIGS[status];
  if (!cfg) return null;

  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 500,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.07em",
        padding: "2px 5px",
        borderRadius: 3,
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: "nowrap",
        flexShrink: 0,
        lineHeight: 1.4,
      }}
    >
      {cfg.label}
    </span>
  );
}
