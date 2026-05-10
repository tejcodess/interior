import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type LayoutItem = {
  assetKey: string;
  x: number;
  z: number;
  rotationY: number;
  scale: number;
  label: string;
  rationale: string;
};

export type ResolvedLayoutItem = LayoutItem & {
  assetId: string;
  assetName: string;
  modelUrl: string;
};

type FurnitureInstance = {
  id: string;
  assetId: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

type RequestBody = {
  prompt: string;
  roomWidth?: number;
  roomDepth?: number;
  existingInstances?: FurnitureInstance[];
};

// ──────────────────────────────────────────────────────────────────────────────
// Asset-key → manifest-id mapping
// The Groq system prompt uses camelCase keys that may differ from manifest ids.
// ──────────────────────────────────────────────────────────────────────────────

const ASSET_KEY_MAP: Record<string, string[]> = {
  // Tables
  tableCoffee: ["table-coffee", "table-coffee-square", "table-coffee-glass"],
  tableDining: ["table", "table-round", "table-glass"],
  tableDesk: ["desk", "desk-corner"],
  // Seating
  chairArmchair: [
    "chair-cushion",
    "chair-modern-cushion",
    "chair-rounded",
    "lounge-chair",
  ],
  chairDining: ["chair", "design-chair"],
  chairOffice: ["chair-desk"],
  sofaDouble: ["sofa-long", "design-sofa"],
  sofaSingle: ["sofa", "lounge-chair-relax"],
  // Beds
  bedDouble: ["bed-double"],
  bedSingle: ["bed-single"],
  // Lighting
  lampFloor: ["lamp-floor"],
  lampTable: ["lamp-table"],
  // Storage / shelving
  shelfBookcase: ["bookcase-open", "bookcase-closed"],
  shelfSmall: ["bookcase-open", "side-table"],
  dresser: ["side-table-drawers"],
  nightstand: ["side-table-drawers", "side-table"],
  tvStand: ["cabinet-television"],
  // Decor
  plantLarge: ["plant-potted"],
  plantSmall: ["plant-potted"],
  rugLarge: ["rug-rectangular", "rug-round"],
  rugSmall: ["rug-round"],
  mirrorLarge: ["bookcase-closed"], // best available fallback
  curtains: ["bookcase-closed"], // best available fallback
  pictureFrame: ["plant-potted"], // best available fallback
};

// ──────────────────────────────────────────────────────────────────────────────
// Manifest loader
// ──────────────────────────────────────────────────────────────────────────────

function loadManifest(): Array<{
  id: string;
  file: string;
  tags: string[];
  category: string;
}> {
  const manifestPath = path.join(
    process.cwd(),
    "public",
    "assets",
    "furniture",
    "manifest.json",
  );
  const raw = fs.readFileSync(manifestPath, "utf-8");
  return JSON.parse(raw);
}

// ──────────────────────────────────────────────────────────────────────────────
// Groq call
// ──────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `STRICT RULES — You are an expert interior designer and spatial planner. STRICTLY follow the rules below or return an empty JSON array.

Return format:
- Return ONLY a raw JSON array (no markdown, no explanation, no extra text).
- Each item must be an object with keys: "assetKey", "x", "z", "rotationY", "scale", "label", "rationale".

Placement rules:
- Use only these asset keys (Kenney library): tableCoffee, tableDining, tableDesk, chairArmchair, chairDining, chairOffice, sofaDouble, sofaSingle, bedDouble, bedSingle, lampFloor, lampTable, shelfBookcase, shelfSmall, dresser, nightstand, tvStand, plantLarge, plantSmall, rugLarge, rugSmall, mirrorLarge, curtains, pictureFrame
- Ensure no two items occupy the same position (minimum 0.6m separation between centers).
- Keep all items within the room bounds (x within ±roomWidth/2, z within ±roomDepth/2) leaving 0.3m wall clearance.
- Group related items spatially where it makes sense (e.g., sofa + coffee table + floor lamp form a cluster).
- Rotate furniture to face logically (chairs face tables, sofas face TVs, etc.).
- Favor accurate assetKey usage — prefer specific keys (chairArmchair) over generic labels.

ITEM COUNT — YOU decide the right number based on the vibe:
- Analyze the density implied by the vibe description.
- Sparse/minimal/calm/zen/Japandi/wabi-sabi/Nordic/simple vibes: use 4–5 items with generous negative space.
- Warm/cozy/Scandinavian/cottage/hygge vibes: use 5–6 items clustered naturally.
- Balanced/transitional/modern/contemporary vibes: use 6–7 items.
- Rich/layered/maximalist/eclectic/baroque/Victorian/gothic/bohemian/grandmillenial vibes: use 7–8 items.
- Corner/nook/reading spot/studio/alcove descriptions: use 4 items regardless of style.
- Never place fewer than 4 or more than 8 items under any circumstance.

FURNITURE SELECTION — match furniture to the vibe:
- Sparse vibes: avoid tvStand, curtains, pictureFrame, rugLarge.
- Corner/nook vibes: avoid sofaDouble, bedDouble, tableDining, tvStand.
- Office vibes: anchor with tableDesk + chairOffice, avoid sofaDouble, bedDouble, tableDining.
- Bedroom vibes: anchor with bedDouble or bedSingle, avoid tableDesk, tvStand, sofaDouble.
- Living room vibes: anchor with sofa + tableCoffee, include rugLarge, avoid tableDesk, bedDouble.
- Library/reading vibes: prioritize shelfBookcase, chairArmchair, lampFloor, rugLarge — avoid tvStand, tableDesk, bedDouble.
- Do NOT place furniture that contradicts the room type. A gothic library should never have a tvStand. A minimalist office should never have curtains and pictureFrame.

Failure handling:
- If the vibe is too abstract and fewer than 3 matched assetKeys are possible from the allowed set, return an HTTP 422 with a short error message (server will handle this).
`;

async function callGroq(
  prompt: string,
  roomWidth: number,
  roomDepth: number,
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY not set");

  console.log(
    "SYSTEM_PROMPT (first 150 chars):",
    SYSTEM_PROMPT.substring(0, 150),
  );

  const isSmallRoom = roomWidth <= 3.5 || roomDepth <= 3.5;

  const userMessage = [
    `Room: ${roomWidth}m wide × ${roomDepth}m deep.`,
    `Vibe: "${prompt}".`,
    isSmallRoom
      ? `This is a small room. Use maximum 4 compact items. Avoid large furniture (sofaDouble, bedDouble, tableDining).`
      : `Choose item count based on the density of this vibe (4–8 items).`,
    `Every label must be a specific descriptive furniture name, not a category word.`,
    `Every rationale must reference the vibe "${prompt}" specifically.`,
    `Return ONLY the JSON array. No markdown. No explanation.`,
  ].join("\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1800,
      temperature: 0.65,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  return content.trim();
}

const VALID_ASSET_KEYS = Object.keys(ASSET_KEY_MAP);

const GENERIC_LABELS = new Set([
  "seating",
  "lighting",
  "entertainment",
  "storage",
  "textile",
  "workspace",
  "decor",
  "furniture",
  "sofa",
  "armchair",
  "chair",
  "table",
  "lamp",
  "rug",
  "desk",
  "shelf",
  "plant",
  "mirror",
  "coffee table",
  "floor lamp",
  "table lamp",
  "tv stand",
  "area rug",
  "office chair",
  "bookcase",
  "dresser",
]);

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function normalizeRotation(rot: number): number {
  if (rot === 0) return 0;
  // Values between -7 and 7 are almost certainly radians
  if (Math.abs(rot) < 7) {
    return Math.round(rot * (180 / Math.PI));
  }
  return Math.round(rot); // already degrees, just clean it up
}

// ──────────────────────────────────────────────────────────────────────────────
// Resolution: map assetKey → manifest entry
// ──────────────────────────────────────────────────────────────────────────────

function resolveAssetKey(
  assetKey: string,
  manifest: Array<{
    id: string;
    file: string;
    tags: string[];
    category: string;
  }>,
): { id: string; file: string; name: string } | null {
  const candidateIds = ASSET_KEY_MAP[assetKey];
  if (!candidateIds || candidateIds.length === 0) return null;

  for (const candidateId of candidateIds) {
    const entry = manifest.find((m) => m.id === candidateId);
    if (entry) {
      // Derive a human-readable name from the id
      const name = entry.id
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return { id: entry.id, file: entry.file, name };
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Route handler
// ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const roomWidth = body.roomWidth ?? 4;
    const roomDepth = body.roomDepth ?? 4;
    const { prompt } = body;

    console.log("ROOM DIMS:", roomWidth, roomDepth);

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    // Call Groq
    const rawGroqResponse = await callGroq(prompt.trim(), roomWidth, roomDepth);

    // Parse the JSON array from Groq's response and filter to known keys
    // Strip any accidental markdown fences
    const cleaned = rawGroqResponse
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    let layoutItems: LayoutItem[];
    try {
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");

      // Pre-filter to allowed asset keys to avoid hallucinated unknown items
      const filtered = (parsed as LayoutItem[]).filter(
        (it) =>
          typeof it?.assetKey === "string" &&
          VALID_ASSET_KEYS.includes(it.assetKey),
      );

      // If too few matched the library, fail fast so client can re-prompt
      if (filtered.length < 3) {
        return NextResponse.json(
          {
            error:
              "Layout generation failed — vibe too abstract for asset library",
            raw: parsed,
          },
          { status: 422 },
        );
      }

      layoutItems = filtered;
    } catch (parseErr) {
      return NextResponse.json(
        { error: "Layout generation failed", raw: rawGroqResponse },
        { status: 422 },
      );
    }

    // Load manifest and resolve each item
    const manifest = loadManifest();
    const halfWidth = roomWidth / 2;
    const halfDepth = roomDepth / 2;
    const wallClearance = 0.3;

    const resolved: ResolvedLayoutItem[] = [];

    for (const item of layoutItems) {
      // Validate required fields
      if (
        typeof item.assetKey !== "string" ||
        typeof item.x !== "number" ||
        typeof item.z !== "number"
      ) {
        continue; // skip malformed
      }

      // Clamp within room bounds (use helper clamp to be explicit)
      const x = clamp(
        item.x,
        -(halfWidth - wallClearance),
        halfWidth - wallClearance,
      );
      const z = clamp(
        item.z,
        -(halfDepth - wallClearance),
        halfDepth - wallClearance,
      );

      // Resolve asset
      const asset = resolveAssetKey(item.assetKey, manifest);
      if (!asset) continue; // gracefully skip unknown keys
      resolved.push({
        ...item,
        x,
        z,
        rotationY: normalizeRotation(
          typeof item.rotationY === "number" ? item.rotationY : 0,
        ),
        // Enforce sane scale bounds on server (narrower than before)
        scale:
          typeof item.scale === "number" ? clamp(item.scale, 0.5, 1.5) : 1.0,
        label: item.label ?? asset.name,
        rationale: item.rationale ?? "",
        assetId: asset.id,
        assetName: asset.name,
        modelUrl: asset.file,
      });
    }

    // Post-process: snap chairs to face nearest table within 1.5m
    const chairCorrected = resolved.map((item) => {
      if (!item.assetKey.toLowerCase().includes("chair")) return item;

      const tableCandidates = resolved.filter((r) =>
        r.assetKey?.toLowerCase().includes("table"),
      );

      let best = { dist2: Infinity, tx: 0, tz: 0 };
      for (const t of tableCandidates) {
        const dx = t.x - item.x;
        const dz = t.z - item.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < best.dist2) best = { dist2: d2, tx: t.x, tz: t.z };
      }

      if (best.dist2 <= 1.5 * 1.5) {
        const dx = best.tx - item.x;
        const dz = best.tz - item.z;
        return {
          ...item,
          rotationY: Math.round(Math.atan2(dx, dz) * (180 / Math.PI)),
        };
      }

      return item;
    });

    // Post-process: snap sofas to face focal point (TV or coffee table)
    const correctedWithSofa = chairCorrected.map((item) => {
      const isSofa =
        item.assetKey.includes("sofa") || item.assetKey.includes("Sofa");
      if (!isSofa) return item;

      const focal = chairCorrected.find(
        (other) =>
          other.assetKey === "tvStand" || other.assetKey === "tableCoffee",
      );
      if (!focal) return item;

      const dx = focal.x - item.x;
      const dz = focal.z - item.z;
      const angle = Math.round(Math.atan2(dx, dz) * (180 / Math.PI));
      return { ...item, rotationY: angle };
    });

    // Post-process: replace generic labels with asset keys
    const withLabels = correctedWithSofa.map((item) => {
      if (!item.label || !GENERIC_LABELS.has(item.label.toLowerCase())) {
        return item;
      }
      return { ...item, label: item.assetKey };
    });

    // Persist Groq output + prompt for auditing/debugging
    try {
      const outputsDir = path.join(process.cwd(), "data", "groq-outputs");
      fs.mkdirSync(outputsDir, { recursive: true });

      const outObj = {
        prompt: prompt.trim(),
        raw: rawGroqResponse,
        cleaned,
        items: withLabels,
        timestamp: new Date().toISOString(),
      };

      const slug =
        prompt
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 40) || "prompt";

      const filename = `${Date.now()}-${slug}.json`;
      fs.writeFileSync(
        path.join(outputsDir, filename),
        JSON.stringify(outObj, null, 2),
        "utf-8",
      );
    } catch (writeErr) {
      // Don't fail the request if logging fails; just warn server-side
      console.warn(
        "Failed to write Groq output file:",
        writeErr instanceof Error ? writeErr.message : writeErr,
      );
    }

    return NextResponse.json({ items: withLabels, prompt: prompt.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
