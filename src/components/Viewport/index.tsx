"use client";

import type { RoomBounds } from "../../state/types";
import { GridCanvas } from "./GridCanvas";
import { useEffect, useState } from "react";

type ViewportProps = {
  room: RoomBounds;
  children: React.ReactNode;
};

export function Viewport({ room: _room, children }: ViewportProps) {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);

  useEffect(() => {
    function onEvent(e: Event) {
      const ev = e as CustomEvent;
      const d = ev.detail as { loading?: boolean; prompt?: string };
      if (typeof d.loading === "boolean") setLoading(d.loading);
      if (d.prompt) setPrompt(d.prompt);
      if (d.loading === false) setTimeout(() => setPrompt(null), 400);
    }
    window.addEventListener("vibe-layout-loading", onEvent as EventListener);
    return () =>
      window.removeEventListener(
        "vibe-layout-loading",
        onEvent as EventListener,
      );
  }, []);
  return (
    <div
      className="cursor-viewport"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "var(--surface-void)",
      }}
    >
      <GridCanvas />
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>

      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 80,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.45)",
              padding: "12px 18px",
              borderRadius: 8,
              color: "white",
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              display: "flex",
              gap: 10,
              alignItems: "center",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                border: "2px solid rgba(255,255,255,0.9)",
                boxSizing: "border-box",
                animation: "spin 900ms linear infinite",
              }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>Designing your vibe…</div>
              {prompt ? (
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.9,
                    marginTop: 2,
                    maxWidth: 420,
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                  }}
                >
                  {prompt}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
