"use client";

import { useCallback, useState } from "react";
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
};

export function WallColorPalette({
  selectedColor,
  onColorSelect,
  onClose,
  wallInfo,
}: WallColorPaletteProps) {
  const [customColor, setCustomColor] = useState(selectedColor || "#B8C2CC");

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
    <div
      className="fixed inset-0 z-[9998]"
      onClick={onClose}
    >
      <div
        className="fixed left-1/2 top-1/2 z-[9999] w-80 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-300 bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {wallInfo ? `Paint ${wallInfo}` : "Paint Wall"}
        </h3>
        <button
          onClick={onClose}
          className="rounded p-1 hover:bg-gray-100"
          title="Close"
        >
          <X size={16} className="text-gray-600" />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {PRESET_COLORS.map((color) =>
          color.hex ? (
            <button
              key={color.hex}
              onClick={() => handleColorClick(color.hex)}
              className={`rounded border-2 transition-all ${
                selectedColor === color.hex
                  ? "border-blue-500 shadow-md"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={{ backgroundColor: color.hex, height: "40px" }}
              title={color.name}
            />
          ) : null,
        )}
      </div>

      <div className="mb-3 flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-700">
          Custom Color:
        </label>
        <div className="flex gap-2">
          <input
            type="color"
            value={customColor}
            onChange={handleCustomColorChange}
            className="h-10 w-16 cursor-pointer rounded border border-gray-200"
          />
          <input
            type="text"
            value={customColor}
            onChange={handleCustomColorChange}
            className="flex-1 rounded border border-gray-200 px-2 py-2 text-xs font-mono"
            placeholder="#B8C2CC"
          />
        </div>
        <button
          onClick={handleApplyCustom}
          className="rounded bg-blue-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-600"
        >
          Apply Custom
        </button>
      </div>

      <div className="text-xs text-gray-500">
        Click a color to apply, or use custom picker above.
      </div>
      </div>
    </div>
  );
}
