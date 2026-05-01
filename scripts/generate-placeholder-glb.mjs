#!/usr/bin/env node
/**
 * Generates a minimal placeholder GLB file with a simple box geometry.
 * This script creates a valid GLB v2 file with a single triangle mesh.
 * 
 * Usage: node scripts/generate-placeholder-glb.mjs
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a minimal valid GLB v2 file containing a simple cube mesh.
 * This uses raw binary encoding to avoid Three.js dependencies.
 */
function createMinimalGLB() {
  // Minimal glTF 2.0 JSON structure
  const gltfJson = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        indices: 1,
        mode: 4 // TRIANGLES
      }]
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: 24,
        type: "VEC3",
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5]
      },
      {
        bufferView: 1,
        componentType: 5125, // UNSIGNED_INT
        count: 36,
        type: "SCALAR"
      }
    ],
    bufferViews: [
      {
        buffer: 0,
        byteLength: 288,
        byteOffset: 0,
        target: 34962 // ARRAY_BUFFER
      },
      {
        buffer: 0,
        byteLength: 144,
        byteOffset: 288,
        target: 34963 // ELEMENT_ARRAY_BUFFER
      }
    ],
    buffers: [{ byteLength: 432 }]
  };

  // Create vertex positions for a unit cube (-0.5 to 0.5)
  const vertices = new Float32Array([
    // Front face
    -0.5, -0.5, 0.5,
    0.5, -0.5, 0.5,
    0.5, 0.5, 0.5,
    -0.5, 0.5, 0.5,
    // Back face
    -0.5, -0.5, -0.5,
    -0.5, 0.5, -0.5,
    0.5, 0.5, -0.5,
    0.5, -0.5, -0.5,
    // Top face
    -0.5, 0.5, -0.5,
    -0.5, 0.5, 0.5,
    0.5, 0.5, 0.5,
    0.5, 0.5, -0.5,
    // Bottom face
    -0.5, -0.5, -0.5,
    0.5, -0.5, -0.5,
    0.5, -0.5, 0.5,
    -0.5, -0.5, 0.5,
    // Right face
    0.5, -0.5, -0.5,
    0.5, 0.5, -0.5,
    0.5, 0.5, 0.5,
    0.5, -0.5, 0.5,
    // Left face
    -0.5, -0.5, -0.5,
    -0.5, -0.5, 0.5,
    -0.5, 0.5, 0.5,
    -0.5, 0.5, -0.5
  ]);

  // Create indices for the cube (2 triangles per face, 6 faces)
  const indices = new Uint32Array([
    // Front
    0, 1, 2,
    0, 2, 3,
    // Back
    4, 6, 5,
    4, 7, 6,
    // Top
    8, 9, 10,
    8, 10, 11,
    // Bottom
    12, 14, 13,
    12, 15, 14,
    // Right
    16, 18, 17,
    16, 19, 18,
    // Left
    20, 21, 22,
    20, 22, 23
  ]);

  // Combine buffers
  const bufferData = Buffer.concat([
    Buffer.from(vertices.buffer),
    Buffer.from(indices.buffer)
  ]);

  // Encode JSON to string then to bytes
  const jsonString = JSON.stringify(gltfJson);
  const jsonBytes = Buffer.from(jsonString, 'utf-8');

  // Pad JSON to 4-byte boundary
  const jsonPaddingLength = (4 - (jsonBytes.length % 4)) % 4;
  const jsonPadded = Buffer.alloc(jsonBytes.length + jsonPaddingLength);
  jsonBytes.copy(jsonPadded);
  jsonPadded.fill(0x20, jsonBytes.length); // Space character

  // Create GLB header
  const glbHeader = Buffer.alloc(12);
  glbHeader.writeUInt32LE(0x46546C67, 0); // "glTF" magic number
  glbHeader.writeUInt32LE(2, 4); // Version 2
  glbHeader.writeUInt32LE(
    12 + // Header
    8 + // JSON chunk header
    jsonPadded.length +
    8 + // Binary chunk header
    bufferData.length,
    8 // File size
  );

  // Create JSON chunk header
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"

  // Create binary chunk header
  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(bufferData.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // "BIN\0"

  // Assemble final GLB
  const glbFile = Buffer.concat([
    glbHeader,
    jsonChunkHeader,
    jsonPadded,
    binChunkHeader,
    bufferData
  ]);

  return glbFile;
}

// Generate and write the GLB file
try {
  const glbFile = createMinimalGLB();
  const publicDir = path.join(__dirname, '../public');
  const outputPath = path.join(publicDir, 'placeholder-furniture.glb');

  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Write the GLB file
  fs.writeFileSync(outputPath, glbFile);
  console.log(`✓ Created placeholder GLB: ${outputPath}`);
  console.log(`  File size: ${fs.statSync(outputPath).size} bytes`);
  process.exit(0);
} catch (error) {
  console.error('Failed to create GLB:', error);
  process.exit(1);
}
