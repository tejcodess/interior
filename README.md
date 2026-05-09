# BUILD ARENA

BUILD ARENA is an AI-assisted 3D interior design studio for moving quickly from an idea for a room to an explorable spatial concept. It gives designers and everyday users a compact workspace for planning, decorating, and reimagining interiors without jumping between moodboards, modeling tools, and floor-plan software.

## What It Does

BUILD ARENA lets users define and edit a room, add architectural details, generate furniture from text, and view the result as both a 3D blockout and a synchronized 2D blueprint.

Core capabilities include:

- Editable room bounds, cut wall segments, doors, windows, cameras, furniture, and custom primitive shapes.
- Direct manipulation in 3D and blueprint views, including drag, resize, rotate, wall cutting, and dimension editing.
- Resizable doors and windows that stay clamped to the active wall or cut-wall run.
- Text-to-3D furniture generation from prompts such as `round walnut coffee table`.
- GLB/GLTF upload support for user-provided furniture and scene assets.
- Furniture placement, rotation, scaling, deletion, and local library persistence.
- Product search for furniture and decor using eBay results through SerpAPI.
- A full-screen 3D workspace paired with a synchronized blueprint renderer.
- A room-to-world workflow that turns room captures and prompts into an immersive Gaussian splat visualization.
- WebXR entry for exploring generated splat worlds in a headset when supported.
- A companion Unity Quest capture project under `quest-capture/` for headset-based room capture and export workflows.

Current room-editing flow highlights:

- Enter Room mode for a focused first-person walkthrough of the blockout.
- Press `Esc` to leave the room POV and return to the editable editor chrome.
- Right-click walls or wall segments to open the wall color palette near the selected surface.
- The wall color picker now follows the selected wall and can be dismissed with `Esc` or the close button.

The goal is to make early interior design exploration feel fast, spatial, and directly editable: generate ideas with AI, then refine them by moving through the room and manipulating objects yourself.

## Tech Stack

BUILD ARENA is built with:

- Next.js
- React
- TypeScript
- Three.js
- React Three Fiber
- Drei
- React Three XR
- Tailwind CSS and CSS design tokens
- GLB/GLTF asset workflows
- Gaussian splat rendering for immersive room views
- SerpAPI eBay search for product discovery
- Unity, OpenXR, and Meta XR tooling for the Quest capture companion app

The editor is driven by shared application state for rooms, furniture assets, furniture instances, wall segments, doors, windows, cameras, custom shapes, generated worlds, and persisted library entries.

## AI Pipeline

BUILD ARENA combines multiple AI systems so users can move between text, imagery, 3D furniture, and immersive room visualization.

### Text-to-3D Furniture

Users describe a furniture object in natural language. BUILD ARENA uses tag-based matching with Groq keyword extraction to instantly find the best-matching furniture from a local Kenney asset library (40+ pre-modeled GLB items). Generated assets can be placed in the room, saved to the local library, reused, uploaded, or combined with manually imported models.

### Design Reasoning

Groq's llama-3.3-70b-versatile model provides BUILD ARENA's design reasoning layer. It helps interpret user intent, extract keywords for furniture matching, estimate real-world furniture dimensions, and provide structured guidance for downstream generation steps. Running this layer through Groq gives the project zero-cost access to powerful reasoning without self-hosting infrastructure.

### Visual Understanding

Room image analysis is wired for Gemini 2.5 Flash and tracked as a ready pipeline for future room-understanding workflows. The intended flow is to combine object and layout cues so the room-to-world pipeline can reason about spatial structure instead of treating a capture as a purely image-based input.

### Product Search

Users can search for real furniture and decor products directly from the left-side product panel. BUILD ARENA queries SerpAPI's eBay engine through a local Next.js API route and displays product cards with title, price, seller, shipping, thumbnail, and outbound listing links.

### Room to World

BUILD ARENA supports a room-to-world pipeline where a room capture and design prompt are sent through the World Labs Marble API route. The result can be loaded as an immersive Gaussian splat so users can compare the editable blockout against a generated spatial concept. Image generation provides style and atmosphere; Gaussian splats make the output feel present and walkable.

### Room Walkthrough and Wall Styling

The editor also includes a room walkthrough mode for inspecting the blockout from a first-person point of view. It uses pointer lock and keyboard movement for a lightweight room-preview experience, with Escape used as the fastest way to return to the normal editor UI.

Walls can be recolored directly in the scene through a context-menu driven palette, which keeps the styling workflow close to the surface being edited and avoids switching away from the viewport.

## Free API Migration

BUILD ARENA was originally built on paid APIs (Meshy for 3D generation, Vultr SSH for Gemma reasoning, World Labs for immersive views). We migrated to a zero-cost stack:

| Feature                  | Old                 | New                                  | Status     |
| ------------------------ | ------------------- | ------------------------------------ | ---------- |
| **Furniture Generation** | Meshy API           | Local Kenney library + Groq matching | ✅ Live    |
| **Design Reasoning**     | Vultr SSH + Gemma   | Groq llama-3.3-70b-versatile         | ✅ Live    |
| **Keyword Extraction**   | N/A                 | Groq API                             | ✅ Live    |
| **Product Search**       | N/A                 | SerpAPI (100 free/month)             | ✅ Live    |
| **Room Image Analysis**  | Google Cloud Vision | Gemini 2.5 Flash pipeline            | 📋 Ready   |
| **Immersive Views**      | World Labs Marble   | Coming Soon (graceful degradation)   | ⏳ Pending |

**Result:** BUILD ARENA now runs on the free tier of three APIs (Groq, SerpAPI, Gemini) + a local 40-asset Kenney library. **Total cost: $0/month.**

### How Furniture Matching Works

When a user enters a furniture prompt like _"round walnut coffee table"_:

1. The prompt is sent to the `/api/furniture-match` endpoint
2. **Groq extracts keywords:** `["round", "walnut", "coffee table"]`
3. **Tag-based scoring** ranks all 40+ Kenney assets against extracted keywords:
   - Exact tag match: +3 points
   - Partial word overlap: +1 point
4. **Top match is returned instantly** with:
   - GLB file path (e.g., `/assets/furniture/tableCoffee.glb`)
   - Confidence level (high/medium/low)
   - Original extracted keywords
5. **No polling, no waiting** — furniture appears in the 3D scene immediately

This replaces Meshy's 30–60 second generation time with instant results while maintaining visual accuracy through careful Kenney asset tagging.

## Getting Started

### Install Dependencies

```bash
npm install
# or
pnpm install
```

### Environment Setup

Create a local environment file:

```bash
cp .env.example .env.local
```

Fill in the required API keys (**all free tier**):

```bash
# Required - get free at console.groq.com
GROQ_API_KEY=your_groq_api_key

# Optional - 100 free searches/month at serpapi.com (product search)
SERPAPI_API_KEY=your_serpapi_key

# Optional - free at aistudio.google.com (future room image analysis)
GEMINI_API_KEY=your_gemini_key
```

### Run Development Server

```bash
npm run dev
# or
pnpm dev
```

Open the app at: **http://localhost:3001**

### Zero-Cost Operation

BUILD ARENA runs entirely on free APIs:

- **Groq** (free tier): Powers furniture matching, design reasoning, and keyword extraction
- **SerpAPI** (100 searches/month free): Product search feature
- **Kenney Furniture Library** (local assets): 40+ pre-modeled GLB items for instant generation
- **Gemini 2.5 Flash** (optional, free): Room image analysis pipeline (ready for future use)

No Meshy, Vultr SSH, or World Labs APIs needed — all paid services have been replaced with free alternatives or local solutions.

## Quest Capture Project

The `quest-capture/` folder is a separate Unity project for Meta Quest room capture workflows. It includes Unity project settings, XR/OpenXR configuration, Meta/Oculus assets, and scripts such as `FloorPlanReader` and `RoomMeshExporterUI` for reading room layout data and exporting capture artifacts.

Open `quest-capture/` directly in Unity when working on the headset capture side. It is intentionally kept separate from the Next.js app runtime and does not participate in the `pnpm` scripts.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm start
```

## Project Structure

```text
app/          Next.js app routes and API endpoints
src/api/      Client-side wrappers for generation, library, and world APIs
src/components/
              Editor panels, viewport, blueprint, landing page, and controls
src/server/   Server-side API helpers and asset persistence
src/state/    Editor state, geometry helpers, and shared types
src/styles/   Global styles and design tokens
public/       Generated meshes, splats, icons, and static assets
quest-capture/
              Unity project for Meta Quest room capture and export workflows
```

## Challenges

The hardest parts of BUILD ARENA are the pieces between generation and usability:

- **Keeping the 2D blueprint and 3D scene synchronized** — two views must react to the same state changes instantly
- **Maintaining real-world scale for generated furniture** — LLMs estimate dimension ranges; we use Groq to normalize these to believable meters
- **Making generated and uploaded assets behave like editable design objects** — must support rotation, scaling, deletion, library persistence, and drag-and-drop
- **Managing instant furniture matching** — tag-based scoring balances matching quality with real-time responsiveness
- **Building a panoramic-to-Gaussian-splat workflow** — preserves the feel of a real room while enabling AI reinterpretation
- **Keeping immersive controls and editor chrome in sync** — Escape, pointer lock, and floating palettes must cleanly return control to the rest of the UI
- **Operating at zero cost** — replaced all paid APIs (Meshy, Vultr SSH, World Labs) with free alternatives or local solutions

## What We Learned

**On Generation and Usability:**
Generated 3D assets are only useful when paired with direct manipulation. Prompt-based generation creates a strong starting point, but users need precise placement, scale, camera behavior, footprints, comparison, and iteration to refine it.

**On AI-Assisted Design:**
Image generation and spatial visualization solve different parts of the problem. Image generation excels at atmosphere and style; Gaussian splats make results feel present and immersive.

**On Cost Optimization:**
Free APIs are powerful enough for production use. Groq's reasoning model, SerpAPI's free tier, and local asset libraries can replace expensive proprietary services while maintaining feature parity or better. The key is thoughtful architecture: instant local matching beats waiting for API generation.

## What's Next

Next steps for BUILD ARENA include:

- Room scanning and better measurement tools.
- Richer material and style controls.
- More polished walkthrough affordances and scene interaction hints.
- Multiplayer design sessions.
- Exportable floor plans.
- More realistic final renders.
- Faster and more accurate panoramic-to-splat generation.
- Full-room concept generation from an existing layout, not just individual furniture generation.
