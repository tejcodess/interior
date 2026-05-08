"use client";

import { Wand2, Loader2, X, CheckCircle, AlertCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type {
  FurnitureAsset,
  FurnitureInstance,
  ResolvedLayoutItem,
} from "../state/types";
import { nudgeUntilClear } from "../state/geometry";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Convert degrees → radians */
function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// ──────────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────────

export type VibeLayoutInputProps = {
  /** Current room width in meters (room.maxX - room.minX) */
  roomWidth: number;
  /** Current room depth in meters (room.maxZ - room.minZ) */
  roomDepth: number;
  /** Snapshot of all current furniture instances for collision checking */
  existingInstances: FurnitureInstance[];
  /**
   * Called with a batch of new instances AND their backing assets.
   * The component ensures this is a single atomic state update.
   */
  onBatchAdd: (
    instances: FurnitureInstance[],
    assets: FurnitureAsset[],
    vibe?: string,
  ) => void;
  /** Wrap the batch placement in a single undo step */
  onPushUndo: (instances: FurnitureInstance[]) => void;
};

// ──────────────────────────────────────────────────────────────────────────────
// Toast types
// ──────────────────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error";

type Toast = {
  id: string;
  variant: ToastVariant;
  message: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function VibeLayoutInput({
  roomWidth,
  roomDepth,
  existingInstances,
  onBatchAdd,
  onPushUndo,
}: VibeLayoutInputProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const pushToast = useCallback((variant: ToastVariant, message: string) => {
    const id = createId();
    setToasts((prev) => [...prev, { id, variant, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    // Notify viewport (and any listeners) that auto-layout has started
    typeof window !== "undefined" &&
      window.dispatchEvent(
        new CustomEvent("vibe-layout-loading", {
          detail: { loading: true, prompt: trimmed },
        }),
      );
    setLoading(true);

    try {
      console.log("SENDING DIMS:", roomWidth, roomDepth);
      const res = await fetch("/api/vibe-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          roomWidth,
          roomDepth,
          existingInstances,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errMsg = data?.error ?? `Server error ${res.status}`;
        pushToast(
          "error",
          "Couldn't generate layout — try rephrasing your vibe",
        );
        console.error("[VibeLayout] API error:", errMsg, data?.raw);
        return;
      }

      const data: { items: ResolvedLayoutItem[]; prompt: string } =
        await res.json();
      const items = data.items ?? [];

      if (items.length === 0) {
        pushToast(
          "error",
          "No furniture matched that vibe — try a different prompt",
        );
        return;
      }

      // ── Collision avoidance + instance creation ──────────────────────────
      const newInstances: FurnitureInstance[] = [];
      const newAssets: FurnitureAsset[] = [];
      // Build a running list of placed positions (existing + newly placed)
      // so successive items in the same batch also avoid each other.
      const placedSoFar: Array<{ position: [number, number, number] }> = [
        ...existingInstances,
      ];

      for (const item of items) {
        // Collision nudge
        const cleared = nudgeUntilClear(item.x, item.z, placedSoFar, {
          minDist: 0.6,
          nudgeStep: 0.5,
          maxAttempts: 4,
        });
        if (!cleared) continue; // skip — no clear spot found

        const { x, z } = cleared;

        // Create a FurnitureAsset record backed by the resolved Kenney GLB
        // Use a less generic label if the model returned a very generic label
        const genericRe =
          /^(seating|seating area|seating group|furniture|table area|dining area)$/i;
        const label =
          item.label &&
          typeof item.label === "string" &&
          !genericRe.test(item.label)
            ? item.label
            : item.assetName;

        const assetId = item.assetId + "-vibe-" + createId();
        const asset: FurnitureAsset = {
          id: assetId,
          prompt: label,
          name: item.assetName,
          status: "ready" as const,
          createdAt: Date.now(),
          primitive: inferPrimitive(item.assetKey),
          modelUrl: item.modelUrl,
          _meta: {
            matchedName: item.assetName,
            originalPrompt: trimmed,
            extractedKeywords: item.assetKey,
            confidence: "high",
          },
        };

        // Normalize rotation: if value is large assume degrees, else assume radians
        const normalizeRotation = (r: number) =>
          Math.abs(r) > 6.5 ? degToRad(r) : r;
        const instance: FurnitureInstance = {
          id: createId(),
          assetId,
          name: label,
          position: [x, 0, z],
          rotation: [0, normalizeRotation(item.rotationY ?? 0), 0],
          scale: [item.scale, item.scale, item.scale],
        };

        newInstances.push(instance);
        newAssets.push(asset);
        placedSoFar.push({ position: [x, 0, z] });
      }

      if (newInstances.length === 0) {
        pushToast(
          "error",
          "Couldn't generate layout — try rephrasing your vibe",
        );
        return;
      }

      // Push a single undo checkpoint BEFORE committing the batch
      onPushUndo(existingInstances);

      // Single atomic state update with vibe prompt for tracking
      onBatchAdd(newInstances, newAssets, trimmed);
      setPrompt("");

      const vibeLabel =
        trimmed.length > 28 ? trimmed.slice(0, 28) + "…" : trimmed;
      pushToast(
        "success",
        `Placed ${newInstances.length} item${newInstances.length !== 1 ? "s" : ""} · "${vibeLabel}"`,
      );
    } catch (err) {
      console.error("[VibeLayout] Unexpected error:", err);
      pushToast("error", "Couldn't generate layout — try rephrasing your vibe");
    } finally {
      setLoading(false);
      typeof window !== "undefined" &&
        window.dispatchEvent(
          new CustomEvent("vibe-layout-loading", {
            detail: { loading: false },
          }),
        );
    }
  }, [
    prompt,
    loading,
    roomWidth,
    roomDepth,
    existingInstances,
    onBatchAdd,
    onPushUndo,
    pushToast,
  ]);

  const canGenerate = Boolean(prompt.trim()) && !loading;

  return (
    <>
      {/* ── Vibe Input Section ─────────────────────────────────────────── */}
      <div
        style={{
          padding: "10px 12px 12px",
          flexShrink: 0,
          borderBottom: "1px solid var(--border-dim)",
          background: "rgba(59,142,255,0.025)",
        }}
      >
        {/* Label row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginBottom: 7,
          }}
        >
          <Wand2 size={9} strokeWidth={1.5} color="var(--accent-text)" />
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              color: "var(--accent-text)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Vibe auto-layout
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 8,
              fontFamily: "var(--font-mono)",
              color: "var(--text-ghost)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              background: "var(--accent-dim)",
              border: "1px solid var(--accent-border)",
              padding: "0 4px",
              borderRadius: 2,
            }}
          >
            AI
          </span>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          id="vibe-layout-input"
          className="precision-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canGenerate) handleGenerate();
          }}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="cozy Japandi reading nook…"
          disabled={loading}
          style={{
            width: "100%",
            height: 34,
            background: loading
              ? "rgba(59,142,255,0.05)"
              : "var(--surface-input)",
            border: "1px solid var(--border-dim)",
            borderRadius: 4,
            padding: "0 10px",
            paddingLeft: inputFocused ? 8 : 10,
            fontSize: 12,
            color: "var(--text-bright)",
            fontFamily: "var(--font-ui)",
            outline: "none",
            boxSizing: "border-box",
            display: "block",
            opacity: loading ? 0.55 : 1,
            boxShadow: inputFocused
              ? "inset 2px 0 0 var(--accent), 0 0 0 1px var(--accent-border)"
              : "none",
            transition:
              "box-shadow 150ms ease, padding-left 150ms ease, opacity 150ms ease",
          }}
        />

        {/* Generate Layout button */}
        <button
          type="button"
          id="vibe-layout-generate-btn"
          onClick={handleGenerate}
          disabled={!canGenerate}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          style={{
            width: "100%",
            height: 32,
            marginTop: 7,
            background: loading
              ? "rgba(59,142,255,0.12)"
              : canGenerate && btnHovered
                ? "var(--surface-active)"
                : canGenerate
                  ? "rgba(59,142,255,0.08)"
                  : "transparent",
            border: `1px solid ${
              loading
                ? "var(--accent-border)"
                : canGenerate
                  ? btnHovered
                    ? "var(--accent)"
                    : "var(--accent-border)"
                  : "rgba(255,255,255,0.03)"
            }`,
            borderRadius: 4,
            color:
              canGenerate || loading
                ? "var(--accent-text)"
                : "var(--text-ghost)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: canGenerate ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "all 140ms ease",
          }}
        >
          {loading ? (
            <>
              <Loader2
                size={10}
                strokeWidth={1.5}
                style={{
                  animation: "spin 800ms linear infinite",
                }}
              />
              Generating…
            </>
          ) : (
            <>
              <Wand2
                size={10}
                strokeWidth={1.5}
                style={{ opacity: canGenerate ? 1 : 0.3 }}
              />
              Generate Layout
              {canGenerate && (
                <span
                  style={{
                    fontSize: 9,
                    opacity: 0.4,
                    fontFamily: "var(--font-mono)",
                    marginLeft: 2,
                  }}
                >
                  ↵
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* ── Toast portal ───────────────────────────────────────────────── */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Toast stack — rendered fixed to viewport bottom-left above the icon rail
// ──────────────────────────────────────────────────────────────────────────────

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 52,
        left: 56,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const isError = toast.variant === "error";

  return (
    <div
      style={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--surface-raised)",
        border: `1px solid ${isError ? "var(--status-error-border)" : "var(--status-ready-border)"}`,
        borderRadius: 5,
        padding: "7px 10px 7px 8px",
        fontSize: 11,
        fontFamily: "var(--font-ui)",
        color: isError ? "var(--status-error)" : "var(--status-ready)",
        maxWidth: 280,
        boxShadow: "0 4px 20px rgba(0,0,0,0.55)",
        animation: "fade-in 200ms ease",
      }}
    >
      {isError ? (
        <AlertCircle size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />
      ) : (
        <CheckCircle size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />
      )}
      <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "inherit",
          opacity: 0.5,
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <X size={10} strokeWidth={2} />
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function inferPrimitive(assetKey: string): FurnitureAsset["primitive"] {
  const key = assetKey.toLowerCase();
  if (key.includes("chair") || key.includes("sofa") || key.includes("bench"))
    return "sofa";
  if (key.includes("lamp")) return "lamp";
  if (key.includes("plant")) return "plant";
  if (
    key.includes("shelf") ||
    key.includes("dresser") ||
    key.includes("stand") ||
    key.includes("nightstand")
  )
    return "cabinet";
  if (key.includes("table") || key.includes("desk")) return "table";
  if (
    key.includes("rug") ||
    key.includes("curtain") ||
    key.includes("mirror") ||
    key.includes("picture")
  )
    return "cabinet";
  if (key.includes("bed")) return "sofa";
  return "cabinet";
}
