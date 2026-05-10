import { useState } from "react";

interface WalkthroughUIProps {
  isWalkthrough: boolean;
  onEnter: () => void;
  onExit: () => void;
}

/**
 * UI component for walkthrough mode controls
 * Shows "Enter Room" button in normal mode, "Exit Room" button in walkthrough mode
 */
export function WalkthroughUI({
  isWalkthrough,
  onEnter,
  onExit,
}: WalkthroughUIProps) {
  return (
    <div className="pointer-events-auto absolute top-1/2 right-6 z-40 flex -translate-y-1/2 items-center gap-2">
      {isWalkthrough ? (
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-[color-mix(in_srgb,#16181d_88%,transparent)] px-3 py-2 text-xs text-[var(--text-secondary)] border border-[var(--border-mid)] backdrop-blur-sm">
            <div className="font-mono text-[var(--text-bright)] mb-1">WASD</div>
            <div className="text-[10px]">Move · Shift Sprint</div>
            <div className="text-[10px] mt-1">Mouse Look · Esc Exit</div>
          </div>
          <button
            onClick={onExit}
            className="rounded-md border border-[var(--border-mid)] bg-[color-mix(in_srgb,#16181d_92%,transparent)] px-3 py-2 text-xs font-medium uppercase tracking-wider text-[var(--text-bright)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] [backdrop-filter:blur(6px)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-dim,#3a4250)_60%,#16181d)]"
            title="Exit walkthrough mode (or press Esc)"
          >
            Exit Room
          </button>
        </div>
      ) : (
        <button
          onClick={onEnter}
          className="rounded-md border border-[var(--border-mid)] bg-[color-mix(in_srgb,#16181d_92%,transparent)] px-4 py-2 text-xs font-medium uppercase tracking-wider text-[var(--text-bright)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] [backdrop-filter:blur(6px)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-dim,#3a4250)_60%,#16181d)]"
          title="Enter walkthrough mode - use mouse to look around, WASD to move"
        >
          Enter Room
        </button>
      )}
    </div>
  );
}

/**
 * Standalone walkthrough button component
 * Can be used separately if needed
 */
export function EnterRoomButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-[var(--border-mid)] bg-[color-mix(in_srgb,#16181d_92%,transparent)] px-4 py-2 text-xs font-medium uppercase tracking-wider text-[var(--text-bright)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] [backdrop-filter:blur(6px)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-dim,#3a4250)_60%,#16181d)] disabled:opacity-50 disabled:cursor-not-allowed"
      title="Enter walkthrough mode"
    >
      Enter Room
    </button>
  );
}

/**
 * Exit button component
 */
export function ExitRoomButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-[var(--border-mid)] bg-[color-mix(in_srgb,#16181d_92%,transparent)] px-4 py-2 text-xs font-medium uppercase tracking-wider text-[var(--text-bright)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] [backdrop-filter:blur(6px)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-dim,#3a4250)_60%,#16181d)] disabled:opacity-50 disabled:cursor-not-allowed"
      title="Exit walkthrough mode"
    >
      Exit Room
    </button>
  );
}
