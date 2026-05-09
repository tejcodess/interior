import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WalkthroughController } from "../lib/WalkthroughController";
import type { RoomBounds } from "../state/types";

interface UseWalkthroughOptions {
  roomBounds: RoomBounds;
  wallGroup: THREE.Group | undefined;
  enabled?: boolean;
}

/**
 * React hook for managing walkthrough controller
 * Handles initialization, animation loop integration, and cleanup
 *
 * @example
 * const { isWalkthrough, enterWalkthrough, exitWalkthrough } = useWalkthrough({
 *   roomBounds,
 *   wallGroup,
 * });
 */
export function useWalkthrough(options: UseWalkthroughOptions) {
  const { scene, camera, gl } = useThree();
  const controllerRef = useRef<WalkthroughController | null>(null);
  const [isWalkthrough, setIsWalkthrough] = useState(false);
  const animationIdRef = useRef<number | null>(null);

  // Initialize controller
  useEffect(() => {
    if (!camera || !(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }

    // Create controller
    const controller = new WalkthroughController(
      scene,
      camera,
      gl,
      options.roomBounds,
      extractWallMeshes(options.wallGroup),
      {
        playerRadius: 0.3,
        cameraHeight: 1.6,
        movementSpeed: 5,
        sprintMultiplier: 1.5,
        mouseSensitivity: 0.003,
      },
    );

    controllerRef.current = controller;

    // Animation loop
    const lastTimeRef = { value: performance.now() };

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTimeRef.value) / 1000;
      lastTimeRef.value = currentTime;

      controller.update(deltaTime);
      animationIdRef.current = requestAnimationFrame(animate);
    };

    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current);
      }
      controller.dispose();
      controllerRef.current = null;
    };
  }, [scene, camera, gl, options.roomBounds, options.wallGroup]);

  const enterWalkthrough = () => {
    if (controllerRef.current && !controllerRef.current.getIsActive()) {
      controllerRef.current.enter();
      setIsWalkthrough(true);
    }
  };

  const exitWalkthrough = () => {
    if (controllerRef.current && controllerRef.current.getIsActive()) {
      controllerRef.current.exit();
      setIsWalkthrough(false);
    }
  };

  return {
    isWalkthrough,
    enterWalkthrough,
    exitWalkthrough,
    controller: controllerRef.current,
  };
}

/**
 * Extract all mesh objects from a THREE.Group
 */
function extractWallMeshes(group: THREE.Group | undefined): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  if (!group) return meshes;

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      meshes.push(object);
    }
  });

  return meshes;
}
