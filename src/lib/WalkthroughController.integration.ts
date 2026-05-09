/**
 * WALKTHROUGH CONTROLLER INTEGRATION GUIDE
 *
 * This file demonstrates how to integrate the WalkthroughController
 * into your Three.js React scene.
 */

/**
 * STEP 1: Inside your SceneContent component, use the hook
 *
 * Example:
 *
 * import { useWalkthrough } from "../hooks/useWalkthrough";
 * import { WalkthroughUI } from "../components/WalkthroughUI";
 *
 * function SceneContent(props: SceneViewProps & {...}) {
 *   const { scene, camera, gl } = useThree();
 *
 *   // ... existing code ...
 *
 *   // Get wall group reference (find where walls are rendered)
 *   const wallGroupRef = useRef<THREE.Group>(null);
 *
 *   // Initialize walkthrough controller
 *   const { isWalkthrough, enterWalkthrough, exitWalkthrough } = useWalkthrough({
 *     roomBounds: room,
 *     wallGroup: wallGroupRef.current || undefined,
 *   });
 *
 *   return (
 *     <>
 *       {/* Existing scene content */}
 *       <group ref={wallGroupRef}>
 *         {/* Your wall meshes go here */}
 *       </group>
 *
 *       {/* UI Controls */}
 *       <WalkthroughUI
 *         isWalkthrough={isWalkthrough}
 *         onEnter={enterWalkthrough}
 *         onExit={exitWalkthrough}
 *       />
 *     </>
 *   );
 * }
 */

/**
 * STEP 2: Make sure your wall meshes are registered
 *
 * The WalkthroughController uses raycasting against wall meshes.
 * Ensure your walls are Three.Mesh objects and are part of a group
 * that can be traversed.
 *
 * Example wall mesh setup:
 *
 * <group ref={wallGroupRef}>
 *   {walls.map(wall => (
 *     <mesh key={wall.id} geometry={geometry} material={material}>
 *       {/* Wall mesh */}
 *     </mesh>
 *   ))}
 * </group>
 */

/**
 * STEP 3: Configure the controller (optional)
 *
 * You can customize the walkthrough behavior by passing a config object:
 *
 * const { isWalkthrough, enterWalkthrough, exitWalkthrough } = useWalkthrough({
 *   roomBounds: room,
 *   wallGroup: wallGroupRef.current || undefined,
 * });
 *
 * The WalkthroughController accepts these options:
 * - playerRadius: number (default: 0.3) - player collision radius in meters
 * - cameraHeight: number (default: 1.6) - eye height in meters
 * - movementSpeed: number (default: 5) - speed in meters per second
 * - sprintMultiplier: number (default: 1.5) - sprint speed multiplier
 * - mouseSensitivity: number (default: 0.003) - mouse look sensitivity
 */

/**
 * STEP 4: Keyboard Controls
 *
 * Once in walkthrough mode, the following controls are available:
 *
 * W/A/S/D - Move forward/left/backward/right
 * Shift   - Sprint (1.5x speed)
 * Mouse   - Look around (requires pointer lock)
 * Esc     - Exit walkthrough mode
 *
 * The controller automatically:
 * - Locks the pointer for mouse control
 * - Keeps the camera at eye height (1.6m)
 * - Prevents movement outside the room
 * - Prevents passing through walls using collision detection
 * - Uses a capsule collider (playerRadius = 0.3m)
 */

/**
 * STEP 5: Advanced: Direct controller access
 *
 * If you need more control, you can use the controller directly:
 *
 * import { WalkthroughController } from "../lib/WalkthroughController";
 *
 * // Create controller
 * const controller = new WalkthroughController(
 *   scene,
 *   camera as THREE.PerspectiveCamera,
 *   renderer,
 *   roomBounds,
 *   wallMeshes,
 *   {
 *     playerRadius: 0.3,
 *     cameraHeight: 1.6,
 *     movementSpeed: 5,
 *     sprintMultiplier: 1.5,
 *     mouseSensitivity: 0.003,
 *   }
 * );
 *
 * // Enter walkthrough mode
 * controller.enter();
 *
 * // Update in animation loop
 * function animate() {
 *   const deltaTime = 1/60; // from your game loop
 *   controller.update(deltaTime);
 *   renderer.render(scene, camera);
 * }
 *
 * // Exit walkthrough mode
 * controller.exit();
 *
 * // Clean up resources
 * controller.dispose();
 */

/**
 * STEP 6: Collision Detection Details
 *
 * The WalkthroughController uses multiple collision detection methods:
 *
 * 1. Room Bounds Check:
 *    - Clamps player position to room AABB (axis-aligned bounding box)
 *    - Adds playerRadius margin to prevent going outside
 *
 * 2. Wall Raycasting:
 *    - Casts 8 rays in different directions from player position
 *    - Checks distance to wall meshes
 *    - Rejects movement if collision distance < playerRadius
 *
 * 3. Wall Sliding:
 *    - If full movement is blocked, tries moving along X or Z axis
 *    - Allows "sliding" along walls instead of getting stuck
 *
 * This approach provides smooth collision response while preventing
 * the player from getting stuck in corners.
 */

/**
 * TROUBLESHOOTING
 *
 * Issue: Pointer lock doesn't work
 * Solution: Ensure the scene is clicked first. Pointer lock requires
 *          user interaction. The WalkthroughController automatically
 *          requests pointer lock on enter().
 *
 * Issue: Player is clipping through walls
 * Solution: Increase playerRadius or check that wallMeshes are properly
 *          registered. Ensure wall geometries are correctly positioned.
 *
 * Issue: Movement is jerky or laggy
 * Solution: Check deltaTime calculation. Ensure update() is called
 *          in the animation loop. Consider reducing raycasting directions.
 *
 * Issue: Camera is too high or too low
 * Solution: Adjust the cameraHeight config option (default: 1.6m).
 *          This should be around human eye level for realistic view.
 */

export {};
