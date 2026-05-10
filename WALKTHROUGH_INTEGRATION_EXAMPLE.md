/\*\*

- PRACTICAL INTEGRATION EXAMPLE FOR SCENEVIEW
-
- This file shows how to integrate the WalkthroughController
- into your existing SceneView component.
-
- Copy the relevant sections and adapt to your codebase.
  \*/

// ============================================================================
// STEP 1: Add imports to your SceneContent component
// ============================================================================

import { useWalkthrough } from "../hooks/useWalkthrough";
import { WalkthroughUI } from "../components/WalkthroughUI";
import { useRef } from "react";
import \* as THREE from "three";

// ============================================================================
// STEP 2: Inside SceneContent, add these variables
// ============================================================================

// Add this ref to track the wall group (where your walls are rendered)
const wallGroupRef = useRef<THREE.Group>(null);

// Initialize the walkthrough controller
const { isWalkthrough, enterWalkthrough, exitWalkthrough } = useWalkthrough({
roomBounds: room, // Your existing room bounds
wallGroup: wallGroupRef.current || undefined,
});

// ============================================================================
// STEP 3: Wrap your wall rendering in a ref
// ============================================================================

// BEFORE (existing code in your return statement):
// <BlockoutReferenceLayer ... />

// AFTER (wrap it in a group with a ref):
// <group ref={wallGroupRef}>
// <BlockoutReferenceLayer ... />
// </group>

// ============================================================================
// STEP 4: Add the UI component to your return statement
// ============================================================================

// Add this near the end of your return statement (after </Canvas>):
/\*
{wantsSplat && splatLoadState.status === "ready" ? (
<SplatOverlayControls />
) : null}

// ADD THIS:
<WalkthroughUI
    isWalkthrough={isWalkthrough}
    onEnter={enterWalkthrough}
    onExit={exitWalkthrough}
  />

{splatOpacity > 0 && splatLoadState.status !== "ready" ? (
...
\*/

// ============================================================================
// COMPLETE EXAMPLE CODE SNIPPET
// ============================================================================

/\*\*

- Here's a complete example of the modified SceneContent component:
-
- function SceneContent({
- room,
- assets,
- // ... other props
- }: SceneViewProps & {...}) {
- // ... existing code ...
-
- // NEW: Add wall group ref
- const wallGroupRef = useRef<THREE.Group>(null);
-
- // NEW: Initialize walkthrough
- const { isWalkthrough, enterWalkthrough, exitWalkthrough } = useWalkthrough({
-     roomBounds: room,
-     wallGroup: wallGroupRef.current || undefined,
- });
-
- // ... existing useEffects and handlers ...
-
- return (
-     <>
-       <ViewportCamera />
-       <color attach="background" args={[SCENE_COLORS.background]} />
-       <ambientLight intensity={0.5} />
-       {/* ... lighting ... *}
-
-       <OrbitControls ... />
-       <FirstPersonController active={firstPersonControlsActive} />
-       <VrSplatRig active={firstPersonActive && xrPresenting} />
-
-       {generatedAvailable && marble.spzUrl ? (
-         <MarbleSplatScene ... />
-       ) : null}
-
-       <group visible={blockoutOpacity > 0}>
-         {/* NEW: Wrap BlockoutReferenceLayer in group with ref */}
-         <group ref={wallGroupRef}>
-           <BlockoutReferenceLayer
-             room={room}
-             wallSegments={wallSegments}
-             selected={selected}
-             hovered={hoveredWall ? { type: "wall", id: hoveredWall } : hovered}
-             editable={viewMode === "blockout"}
-             opacity={blockoutOpacity}
-             tool={tool}
-             onReferenceSelect={() => onSelect(null)}
-             onWallPointerDown={handleWallPointerDown}
-             onWallPointerOver={setHoveredWall}
-             onWallPointerOut={(wall) =>
-               setHoveredWall((current) => (current === wall ? null : current))
-             }
-             onFloorPointerDown={handleFloorPointerDown}
-             onSegmentPointerDown={handleSegmentPointerDown}
-             onConnectorPointerDown={handleConnectorPointerDown}
-           />
-         </group>
-
-         {/* ... rest of blockout scene ... */}
-       </group>
-
-       {/* ... cameras, furniture, shapes, etc ... */}
-     </>
- );
- }
-
- // Also in SceneView (the parent component), add:
- // <WalkthroughUI
- // isWalkthrough={isWalkthrough}
- // onEnter={enterWalkthrough}
- // onExit={exitWalkthrough}
- // />
  \*/

// ============================================================================
// ADVANCED: CUSTOM CONFIGURATION
// ============================================================================

/\*\*

- If you want to customize the walkthrough controller behavior,
- you can pass configuration to useWalkthrough:
-
- const { isWalkthrough, enterWalkthrough, exitWalkthrough } = useWalkthrough({
- roomBounds: room,
- wallGroup: wallGroupRef.current,
- // Configuration options (optional):
- // playerRadius: 0.3, // Collision radius
- // cameraHeight: 1.6, // Eye height
- // movementSpeed: 5, // Speed in m/s
- // sprintMultiplier: 1.5, // Sprint speed multiplier
- // mouseSensitivity: 0.003 // Mouse look sensitivity
- });
  \*/

// ============================================================================
// TROUBLESHOOTING CHECKLIST
// ============================================================================

/\*\*

- ✓ Did you add the wallGroupRef to your wall rendering?
- ✓ Did you call useWalkthrough with correct roomBounds?
- ✓ Did you add <WalkthroughUI> to your return statement?
- ✓ Are your wall meshes properly created and visible?
- ✓ Does the scene render without errors?
- ✓ Can you click the "Enter Room" button?
- ✓ Does the button change to "Exit Room" when active?
- ✓ Can you move with WASD?
- ✓ Can you look around with the mouse?
- ✓ Does pressing Escape exit walkthrough mode?
- ✓ Are you prevented from leaving the room?
- ✓ Can you move close to walls but not through them?
  \*/

// ============================================================================
// OPTIONAL: DIRECT CONTROLLER ACCESS
// ============================================================================

/\*\*

- If you need more control, you can access the controller directly:
-
- const { isWalkthrough, enterWalkthrough, exitWalkthrough, controller } =
- useWalkthrough({
-     roomBounds: room,
-     wallGroup: wallGroupRef.current,
- });
-
- // You can now:
- // - Check if walkthrough is active: controller?.getIsActive()
- // - Get current camera position: controller?.camera.position
- // - etc.
  \*/

// ============================================================================
// FILE STRUCTURE REFERENCE
// ============================================================================

/\*\*

- Your src/ directory should now have:
-
- src/
- ├── lib/
- │ ├── WalkthroughController.ts (Core controller class)
- │ ├── WalkthroughController.integration.ts (Integration guide)
- │ └── ... (other lib files)
- ├── hooks/
- │ ├── useWalkthrough.ts (React hook)
- │ └── ... (other hooks)
- ├── components/
- │ ├── WalkthroughUI.tsx (UI components)
- │ ├── SceneView.tsx (Modified to include walkthrough)
- │ └── ... (other components)
- └── ... (other directories)
  \*/

// ============================================================================
// NEXT STEPS
// ============================================================================

/\*\*

- 1.  Copy WalkthroughController.ts to src/lib/
- 2.  Copy useWalkthrough.ts to src/hooks/
- 3.  Copy WalkthroughUI.tsx to src/components/
- 4.  Update your SceneContent component as shown above
- 5.  Update your SceneView component to include <WalkthroughUI>
- 6.  Test the integration:
- - Click "Enter Room"
- - Try moving with WASD
- - Try looking with mouse
- - Press Escape to exit
- 7.  Adjust configuration as needed
      \*/

export {};
