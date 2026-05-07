import {
  buildFloorPolygon,
  createDefaultWallSegmentation,
} from "../state/editor";
import type {
  CustomShape,
  Door,
  FurnitureAsset,
  FurnitureAssetMap,
  FurnitureInstance,
  RoomBounds,
  WallId,
  WallSegment,
  WallSegmentation,
  WindowOpening,
} from "../state/types";

type BlueprintDxfInput = {
  projectTitle: string;
  room: RoomBounds;
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  instances: FurnitureInstance[];
  shapes: CustomShape[];
  doors: Door[];
  windows: WindowOpening[];
  wallSegments?: WallSegmentation;
};

type DxfEntity = string[];

const DXF_LAYERS = [
  "ROOM",
  "WALLS",
  "OPENINGS",
  "FURNITURE",
  "SHAPES",
  "DIMENSIONS",
  "TEXT",
] as const;

export function buildBlueprintDxf(input: BlueprintDxfInput) {
  const wallSegments = input.wallSegments ?? createDefaultWallSegmentation();
  const floorPolygon = buildFloorPolygon(input.room, wallSegments);
  const floorBounds = floorBoundsFromPolygon(input.room, floorPolygon);
  const entities: DxfEntity[] = [];

  if (floorPolygon.length >= 2) {
    addClosedPolyline(
      entities,
      floorPolygon.map((point) => ({ x: point.x, y: point.z })),
      "ROOM",
    );
    // Also emit explicit line edges as a compatibility fallback for viewers
    const pts = floorPolygon.map((p) => ({ x: p.x, y: p.z }));
    addPolylineEdgesAsLines(entities, pts, "ROOM");
  }

  if (input.wallSegments) {
    addWallGeometry(entities, input.room, input.wallSegments);
  } else {
    addRectangle(
      entities,
      input.room.minX,
      input.room.minZ,
      input.room.maxX,
      input.room.maxZ,
      "WALLS",
    );
  }

  addRoomDimensions(entities, floorBounds);
  addOpenings(
    entities,
    input.room,
    input.wallSegments,
    input.doors,
    input.windows,
  );
  addFurniture(entities, input.assets, input.assetById, input.instances);
  addShapes(entities, input.shapes);
  addWallLabels(entities, input.room, wallSegments);
  addText(
    entities,
    (floorBounds.minX + floorBounds.maxX) / 2,
    floorBounds.maxZ + 1.05,
    `Blueprint export - ${input.projectTitle}`,
    "TEXT",
    0.24,
    "MC",
  );
  addText(
    entities,
    (floorBounds.minX + floorBounds.maxX) / 2,
    floorBounds.maxZ + 0.72,
    "Units: meters",
    "TEXT",
    0.18,
    "MC",
  );

  return {
    fileName: `${sanitizeFileName(input.projectTitle || "blueprint")}-blueprint.dxf`,
    dxf: composeDxf(entities),
  };
}

function composeDxf(entities: DxfEntity[]) {
  const sections = [
    headerSection(),
    tablesSection(),
    entitiesSection(entities),
  ];
  return [...sections, "0", "EOF"].join("\n");
}

function headerSection() {
  return [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1015",
    "9",
    "$INSUNITS",
    "70",
    "6",
    "0",
    "ENDSEC",
  ].join("\n");
}

function tablesSection() {
  const layerDefs = DXF_LAYERS.map((layer, index) =>
    [
      "0",
      "LAYER",
      "2",
      layer,
      "70",
      "0",
      "62",
      String((index % 7) + 1),
      "6",
      "CONTINUOUS",
    ].join("\n"),
  );

  return [
    "0",
    "SECTION",
    "2",
    "TABLES",
    "0",
    "TABLE",
    "2",
    "LAYER",
    "70",
    String(DXF_LAYERS.length),
    ...layerDefs,
    "0",
    "ENDTAB",
    "0",
    "ENDSEC",
  ].join("\n");
}

function entitiesSection(entities: DxfEntity[]) {
  return [
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    ...entities.flat(),
    "0",
    "ENDSEC",
  ].join("\n");
}

function addLine(
  entities: DxfEntity[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  layer: string,
) {
  entities.push([
    "0",
    "LINE",
    "8",
    layer,
    "10",
    formatNumber(x1),
    "20",
    formatNumber(y1),
    "30",
    "0",
    "11",
    formatNumber(x2),
    "21",
    formatNumber(y2),
    "31",
    "0",
  ]);
}

function addCircle(
  entities: DxfEntity[],
  x: number,
  y: number,
  radius: number,
  layer: string,
) {
  entities.push([
    "0",
    "CIRCLE",
    "8",
    layer,
    "10",
    formatNumber(x),
    "20",
    formatNumber(y),
    "30",
    "0",
    "40",
    formatNumber(radius),
  ]);
}

function addArc(
  entities: DxfEntity[],
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  layer: string,
) {
  entities.push([
    "0",
    "ARC",
    "8",
    layer,
    "10",
    formatNumber(x),
    "20",
    formatNumber(y),
    "30",
    "0",
    "40",
    formatNumber(radius),
    "50",
    formatNumber(startAngle),
    "51",
    formatNumber(endAngle),
  ]);
}

function addText(
  entities: DxfEntity[],
  x: number,
  y: number,
  value: string,
  layer: string,
  height: number,
  attachmentPoint = "MC",
) {
  const points = attachmentCode(attachmentPoint);
  entities.push([
    "0",
    "TEXT",
    "8",
    layer,
    "10",
    formatNumber(x),
    "20",
    formatNumber(y),
    "30",
    "0",
    "40",
    formatNumber(height),
    "1",
    escapeDxfText(value),
    "50",
    "0",
    "7",
    "STANDARD",
    "72",
    String(points.horizontal),
    "73",
    String(points.vertical),
  ]);
}

function addClosedPolyline(
  entities: DxfEntity[],
  points: Array<{ x: number; y: number }>,
  layer: string,
) {
  if (points.length < 2) return;
  entities.push([
    "0",
    "LWPOLYLINE",
    "8",
    layer,
    "90",
    String(points.length),
    "70",
    "1",
    ...points.flatMap((point) => [
      "10",
      formatNumber(point.x),
      "20",
      formatNumber(point.y),
    ]),
  ]);
}

function addRectangle(
  entities: DxfEntity[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  layer: string,
) {
  addLine(entities, minX, minY, maxX, minY, layer);
  addLine(entities, maxX, minY, maxX, maxY, layer);
  addLine(entities, maxX, maxY, minX, maxY, layer);
  addLine(entities, minX, maxY, minX, minY, layer);
}

function addWallGeometry(
  entities: DxfEntity[],
  room: RoomBounds,
  wallSegments: WallSegmentation,
) {
  for (const wall of ["north", "south", "east", "west"] as WallId[]) {
    const lines = wallDisplayLines(wall, room, wallSegments);
    for (const line of lines) {
      addLine(entities, line.x1, line.y1, line.x2, line.y2, "WALLS");
    }
  }
}

function addWallLabels(
  entities: DxfEntity[],
  room: RoomBounds,
  wallSegments: WallSegmentation,
) {
  for (const wall of ["north", "south", "east", "west"] as WallId[]) {
    for (const line of wallDisplayLines(wall, room, wallSegments)) {
      const length = lineLength(line);
      if (length < 0.2) continue;
      const mid = lineMidpoint(line);
      const normal = lineNormal(line);
      addText(
        entities,
        mid.x + normal.x * 0.28,
        mid.y + normal.y * 0.28,
        `${formatMeasure(length)}m`,
        "TEXT",
        0.18,
        "MC",
      );
    }
  }
}

function addRoomDimensions(
  entities: DxfEntity[],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
) {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const widthY = bounds.minZ - 0.55;
  const depthX = bounds.maxX + 0.55;

  addLine(entities, bounds.minX, widthY, bounds.maxX, widthY, "DIMENSIONS");
  addLine(
    entities,
    bounds.minX,
    bounds.minZ,
    bounds.minX,
    widthY,
    "DIMENSIONS",
  );
  addLine(
    entities,
    bounds.maxX,
    bounds.minZ,
    bounds.maxX,
    widthY,
    "DIMENSIONS",
  );
  addText(
    entities,
    (bounds.minX + bounds.maxX) / 2,
    widthY - 0.12,
    `${formatMeasure(width)}m`,
    "DIMENSIONS",
    0.22,
    "MC",
  );

  addLine(entities, depthX, bounds.minZ, depthX, bounds.maxZ, "DIMENSIONS");
  addLine(
    entities,
    bounds.maxX,
    bounds.minZ,
    depthX,
    bounds.minZ,
    "DIMENSIONS",
  );
  addLine(
    entities,
    bounds.maxX,
    bounds.maxZ,
    depthX,
    bounds.maxZ,
    "DIMENSIONS",
  );
  addText(
    entities,
    depthX + 0.14,
    (bounds.minZ + bounds.maxZ) / 2,
    `${formatMeasure(depth)}m`,
    "DIMENSIONS",
    0.22,
    "MC",
  );
}

function addOpenings(
  entities: DxfEntity[],
  room: RoomBounds,
  wallSegments: WallSegmentation | undefined,
  doors: Door[],
  windows: WindowOpening[],
) {
  for (const door of doors) {
    const segment = openingSegment(door, room, wallSegments?.[door.wall]);
    addLine(
      entities,
      segment.x1,
      segment.y1,
      segment.x2,
      segment.y2,
      "OPENINGS",
    );
    const arc = doorArcGeometry(door, segment);
    addArc(
      entities,
      arc.cx,
      arc.cy,
      arc.radius,
      arc.startAngle,
      arc.endAngle,
      "OPENINGS",
    );
  }

  for (const win of windows) {
    const segment = openingSegment(win, room, wallSegments?.[win.wall]);
    addLine(
      entities,
      segment.x1,
      segment.y1,
      segment.x2,
      segment.y2,
      "OPENINGS",
    );
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const nx = -dy / (Math.hypot(dx, dy) || 1);
    const ny = dx / (Math.hypot(dx, dy) || 1);
    addLine(
      entities,
      segment.x1 + nx * 0.06,
      segment.y1 + ny * 0.06,
      segment.x2 + nx * 0.06,
      segment.y2 + ny * 0.06,
      "OPENINGS",
    );
  }
}

function addFurniture(
  entities: DxfEntity[],
  assets: FurnitureAsset[],
  assetById: FurnitureAssetMap | undefined,
  instances: FurnitureInstance[],
) {
  for (const instance of instances) {
    const asset =
      assetById?.get(instance.assetId) ??
      assets.find((item) => item.id === instance.assetId);
    const footprint = resolveFurnitureFootprint(asset);
    const corners = rotatedRectangleCorners(
      instance.position[0],
      instance.position[2],
      footprint.width * Math.abs(instance.scale[0]),
      footprint.depth * Math.abs(instance.scale[2]),
      instance.rotation[1],
    );
    addClosedPolyline(entities, corners, "FURNITURE");
    addPolylineEdgesAsLines(entities, corners, "FURNITURE");
    addText(
      entities,
      instance.position[0],
      instance.position[2],
      asset?.name ?? instance.name,
      "TEXT",
      0.16,
      "MC",
    );
  }
}

function addShapes(entities: DxfEntity[], shapes: CustomShape[]) {
  for (const shape of shapes) {
    const width = Math.max(0.1, Math.abs(shape.scale[0]));
    const depth = Math.max(0.1, Math.abs(shape.scale[2]));
    const x = shape.position[0];
    const y = shape.position[2];
    if (
      shape.kind === "sphere" ||
      shape.kind === "cylinder" ||
      shape.kind === "cone"
    ) {
      addCircle(entities, x, y, Math.max(width, depth) / 2, "SHAPES");
    } else {
      const corners = rotatedRectangleCorners(
        x,
        y,
        width,
        depth,
        shape.rotation[1],
      );
      addClosedPolyline(entities, corners, "SHAPES");
      addPolylineEdgesAsLines(entities, corners, "SHAPES");
    }
    addText(entities, x, y, shape.kind, "TEXT", 0.14, "MC");
  }
}

function addPolylineEdgesAsLines(
  entities: DxfEntity[],
  points: Array<{ x: number; y: number }>,
  layer: string,
) {
  if (points.length < 2) return;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    addLine(entities, a.x, a.y, b.x, b.y, layer);
  }
}

function wallDisplayLines(
  wall: WallId,
  room: RoomBounds,
  wallSegments: WallSegmentation,
) {
  const segments = wallSegments[wall];
  if (!segments?.length)
    return [] as Array<{ x1: number; y1: number; x2: number; y2: number }>;
  const lines = segments
    .map((segment) => segmentLineCoords(wall, segment, room, wallSegments))
    .filter((line) => lineLength(line) > 0.02);

  for (let index = 0; index < segments.length - 1; index += 1) {
    const current = segments[index];
    const next = segments[index + 1];
    if (Math.abs(next.displacement - current.displacement) < 0.001) continue;
    lines.push(connectorLineCoords(wall, current, next, room));
  }

  return lines;
}

function segmentLineCoords(
  wall: WallId,
  segment: WallSegment,
  room: RoomBounds,
  wallSegments?: WallSegmentation,
) {
  const sign = wallSurfaceSign(wall);
  if (wall === "north") {
    const baseZ = room.maxZ + sign * segment.displacement;
    return {
      x1:
        segment.start <= 0.001
          ? room.minX +
            (wallSegments?.west[(wallSegments?.west.length ?? 1) - 1]
              ?.displacement ?? 0)
          : room.minX + segment.start * (room.maxX - room.minX),
      y1: baseZ,
      x2:
        segment.end >= 0.999
          ? room.maxX -
            (wallSegments?.east[(wallSegments?.east.length ?? 1) - 1]
              ?.displacement ?? 0)
          : room.minX + segment.end * (room.maxX - room.minX),
      y2: baseZ,
    };
  }
  if (wall === "south") {
    const baseZ = room.minZ + sign * segment.displacement;
    return {
      x1:
        segment.start <= 0.001
          ? room.minX + (wallSegments?.west[0]?.displacement ?? 0)
          : room.minX + segment.start * (room.maxX - room.minX),
      y1: baseZ,
      x2:
        segment.end >= 0.999
          ? room.maxX - (wallSegments?.east[0]?.displacement ?? 0)
          : room.minX + segment.end * (room.maxX - room.minX),
      y2: baseZ,
    };
  }
  if (wall === "east") {
    const baseX = room.maxX + sign * segment.displacement;
    return {
      x1: baseX,
      y1:
        segment.start <= 0.001
          ? room.minZ +
            (wallSegments?.south[(wallSegments?.south.length ?? 1) - 1]
              ?.displacement ?? 0)
          : room.minZ + segment.start * (room.maxZ - room.minZ),
      x2: baseX,
      y2:
        segment.end >= 0.999
          ? room.maxZ -
            (wallSegments?.north[(wallSegments?.north.length ?? 1) - 1]
              ?.displacement ?? 0)
          : room.minZ + segment.end * (room.maxZ - room.minZ),
    };
  }
  const baseX = room.minX + sign * segment.displacement;
  return {
    x1: baseX,
    y1:
      segment.start <= 0.001
        ? room.minZ + (wallSegments?.south[0]?.displacement ?? 0)
        : room.minZ + segment.start * (room.maxZ - room.minZ),
    x2: baseX,
    y2:
      segment.end >= 0.999
        ? room.maxZ - (wallSegments?.north[0]?.displacement ?? 0)
        : room.minZ + segment.end * (room.maxZ - room.minZ),
  };
}

function connectorLineCoords(
  wall: WallId,
  current: WallSegment,
  next: WallSegment,
  room: RoomBounds,
) {
  const sign = wallSurfaceSign(wall);
  if (wall === "north" || wall === "south") {
    const x = room.minX + current.end * (room.maxX - room.minX);
    const baseZ = wall === "north" ? room.maxZ : room.minZ;
    return {
      x1: x,
      y1: baseZ + sign * current.displacement,
      x2: x,
      y2: baseZ + sign * next.displacement,
    };
  }
  const y = room.minZ + current.end * (room.maxZ - room.minZ);
  const baseX = wall === "east" ? room.maxX : room.minX;
  return {
    x1: baseX + sign * current.displacement,
    y1: y,
    x2: baseX + sign * next.displacement,
    y2: y,
  };
}

function openingSegment(
  opening: Door | WindowOpening,
  room: RoomBounds,
  segments?: WallSegment[],
) {
  const half = opening.width / 2;
  const centerX = (room.minX + room.maxX) / 2;
  const centerZ = (room.minZ + room.maxZ) / 2;
  const { dx, dz } = applySegmentationToOpening(
    room,
    opening.wall,
    opening.offset,
    segments,
  );

  if (opening.wall === "north" || opening.wall === "south") {
    const z = (opening.wall === "north" ? room.maxZ : room.minZ) + dz;
    return {
      x1: centerX + opening.offset - half,
      y1: z,
      x2: centerX + opening.offset + half,
      y2: z,
    };
  }

  const x = (opening.wall === "east" ? room.maxX : room.minX) + dx;
  return {
    x1: x,
    y1: centerZ + opening.offset - half,
    x2: x,
    y2: centerZ + opening.offset + half,
  };
}

function doorArcGeometry(
  door: Door,
  segment: { x1: number; y1: number; x2: number; y2: number },
) {
  const radius = door.width;
  let normalX = 0;
  let normalY = 0;
  if (door.wall === "north") normalY = -1;
  else if (door.wall === "south") normalY = 1;
  else if (door.wall === "east") normalX = -1;
  else normalX = 1;

  const cx = segment.x1;
  const cy = segment.y1;
  const endX = cx + normalX * radius;
  const endY = cy + normalY * radius;
  const startAngle = angleDegrees(segment.x2 - cx, segment.y2 - cy);
  const endAngle = angleDegrees(endX - cx, endY - cy);
  return {
    cx,
    cy,
    radius,
    startAngle,
    endAngle: normalizeArcEnd(startAngle, endAngle),
  };
}

function applySegmentationToOpening(
  room: RoomBounds,
  wall: WallId,
  offset: number,
  segments: WallSegment[] | undefined,
) {
  if (!segments || segments.length === 0) return { dx: 0, dz: 0 };
  const fraction = offsetToFraction(room, wall, offset);
  const segment = findSegmentAtFraction(segments, fraction);
  const sign = wallSurfaceSign(wall);
  if (wall === "north" || wall === "south") {
    return { dx: 0, dz: sign * segment.displacement };
  }
  return { dx: sign * segment.displacement, dz: 0 };
}

function offsetToFraction(room: RoomBounds, wall: WallId, offset: number) {
  const length =
    wall === "east" || wall === "west"
      ? room.maxZ - room.minZ
      : room.maxX - room.minX;
  if (length <= 0) return 0.5;
  return Math.min(1, Math.max(0, offset / length + 0.5));
}

function findSegmentAtFraction(segments: WallSegment[], fraction: number) {
  return (
    segments.find(
      (segment) => fraction >= segment.start && fraction <= segment.end,
    ) ?? segments[0]
  );
}

function lineLength(line: { x1: number; y1: number; x2: number; y2: number }) {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

function lineMidpoint(line: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  return { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 };
}

function lineNormal(line: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function wallSurfaceSign(wall: WallId) {
  return wall === "north" || wall === "east" ? -1 : 1;
}

function floorBoundsFromPolygon(
  room: RoomBounds,
  polygon: Array<{ x: number; z: number }>,
) {
  let minX = room.minX;
  let maxX = room.maxX;
  let minZ = room.minZ;
  let maxZ = room.maxZ;

  for (const point of polygon) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.z < minZ) minZ = point.z;
    if (point.z > maxZ) maxZ = point.z;
  }

  return { minX, maxX, minZ, maxZ };
}

function resolveFurnitureFootprint(asset?: FurnitureAsset) {
  const measured = asset?.footprint;
  if (
    measured &&
    Number.isFinite(measured.width) &&
    Number.isFinite(measured.depth) &&
    measured.width > 0 &&
    measured.depth > 0
  ) {
    return { width: measured.width, depth: measured.depth };
  }
  return footprintFor(asset?.primitive);
}

function footprintFor(primitive?: FurnitureAsset["primitive"]) {
  if (primitive === "table") return { width: 1.15, depth: 1.15 };
  if (primitive === "chair") return { width: 0.7, depth: 0.75 };
  if (primitive === "lamp" || primitive === "plant")
    return { width: 0.55, depth: 0.55 };
  if (primitive === "cabinet") return { width: 1.35, depth: 0.5 };
  return { width: 1.65, depth: 0.9 };
}

function rotatedRectangleCorners(
  centerX: number,
  centerY: number,
  width: number,
  depth: number,
  rotationY: number,
) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const points = [
    { x: -halfWidth, y: -halfDepth },
    { x: halfWidth, y: -halfDepth },
    { x: halfWidth, y: halfDepth },
    { x: -halfWidth, y: halfDepth },
  ];
  return points.map((point) =>
    rotatePoint(point.x, point.y, rotationY, centerX, centerY),
  );
}

function rotatePoint(
  x: number,
  y: number,
  rotation: number,
  centerX: number,
  centerY: number,
) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: centerX + x * cos - y * sin,
    y: centerY + x * sin + y * cos,
  };
}

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 80) || "blueprint"
  );
}

function formatMeasure(value: number) {
  return (Math.round(Math.max(0, value) * 100) / 100).toString();
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
}

function escapeDxfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, " ").replace(/\r/g, " ");
}

function attachmentCode(code: string) {
  if (code === "MC") return { horizontal: 1, vertical: 2 };
  if (code === "TC") return { horizontal: 1, vertical: 3 };
  if (code === "BC") return { horizontal: 1, vertical: 1 };
  return { horizontal: 0, vertical: 0 };
}

function angleDegrees(dx: number, dy: number) {
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function normalizeArcEnd(startAngle: number, endAngle: number) {
  let normalized = endAngle;
  while (normalized <= startAngle) normalized += 360;
  return normalized;
}
