"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

const PRESET_COLORS = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Light Gray", hex: "#E8E8E8" },
  { name: "Medium Gray", hex: "#C0C0C0" },
  { name: "Dark Gray", hex: "#808080" },
  { name: "Off-White", hex: "#F5F5F0" },
  { name: "Beige", hex: "#E8D5C4" },
  { name: "Cream", hex: "#FFFDD0" },
  { name: "Light Blue", hex: "#ADD8E6" },
  { name: "Sky Blue", hex: "#87CEEB" },
  { name: "Soft Green", hex: "#90EE90" },
  { name: "Pale Green", hex: "#98FB98" },
  { name: "Light Brown", hex: "#D2B48C" },
  { name: "Tan", hex: "#D2B48C" },
  { name: "Warm Gray", hex: "#A9A9A9" },
  { name: "Custom", hex: "" },
];

type WallColorPaletteProps = {
  selectedColor: string | undefined;
  onColorSelect: (hex: string) => void;
  onClose: () => void;
  wallInfo?: string;
  position?: {
    x: number;
    y: number;
  };
};

export function WallColorPalette({
  selectedColor,
  onColorSelect,
  onClose,
  wallInfo,
  position,
}: WallColorPaletteProps) {
  const [customColor, setCustomColor] = useState(selectedColor || "#B8C2CC");

  useEffect(() => {
    setCustomColor(selectedColor || "#B8C2CC");
  }, [selectedColor]);

  const handleColorClick = useCallback(
    (hex: string) => {
      if (hex) {
        onColorSelect(hex);
        onClose();
      }
    },
    [onColorSelect, onClose],
  );

  const handleCustomColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCustomColor(e.target.value);
    },
    [],
  );

  const handleApplyCustom = useCallback(() => {
    if (customColor) {
      onColorSelect(customColor);
      onClose();
    }
  }, [customColor, onColorSelect, onClose]);

  return (
    <div className="fixed inset-0 z-[9998]" onClick={onClose}>
      <div
        className={`fixed z-[9999] w-[19rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-[var(--border-mid)] bg-[color-mix(in_srgb,var(--surface-raised)_96%,transparent)] p-3 text-[var(--text-primary)] shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-md ${
          position ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        }`}
        style={position ? { left: position.x, top: position.y } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-[var(--border-dim)] pb-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-wide text-[var(--text-bright)]">
              {wallInfo ? `Paint ${wallInfo}` : "Paint Wall"}
            </h3>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
              Right-click a wall to change its finish.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--border-dim)] bg-[var(--surface-input)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-mid)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-2">
          {PRESET_COLORS.map((color) =>
            color.hex ? (
              <button
                key={`${color.name}-${color.hex}`}
                onClick={() => handleColorClick(color.hex)}
                className={`h-10 rounded-lg border transition-all duration-150 ${
                  selectedColor === color.hex
                    ? "border-[var(--accent-border)] shadow-[0_0_0_1px_var(--accent-border),0_10px_18px_rgba(0,0,0,0.22)]"
                    : "border-[var(--border-dim)] hover:border-[var(--border-mid)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.16)]"
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ) : null,
          )}
        </div>

        <div className="mb-3 flex flex-col gap-2">
          <label className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            Custom Color
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={customColor}
              onChange={handleCustomColorChange}
              className="h-10 w-12 cursor-pointer rounded-md border border-[var(--border-dim)] bg-[var(--surface-input)]"
            />
            <input
              type="text"
              value={customColor}
              onChange={handleCustomColorChange}
              className="flex-1 rounded-md border border-[var(--border-dim)] bg-[var(--surface-input)] px-2 py-2 text-xs font-mono text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-secondary)] focus:border-[var(--border-mid)]"
              placeholder="#B8C2CC"
            />
          </div>
          <button
            onClick={handleApplyCustom}
            className="rounded-md border border-[var(--accent-border)] bg-[var(--accent-dim)] px-3 py-2 text-xs font-medium text-[var(--accent-text)] transition-colors hover:bg-[var(--surface-active)]"
          >
            Apply Custom
          </button>
        </div>

        <div className="text-[11px] leading-4 text-[var(--text-secondary)]">
          Click a swatch to apply it immediately, or use the custom picker for a
          precise finish.
        </div>
      </div>
    </div>
  );
}
