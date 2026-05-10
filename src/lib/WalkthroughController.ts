import * as THREE from "three";
import type { RoomBounds } from "../state/types";

/**
 * Configuration for the walkthrough controller
 */
interface WalkthroughConfig {
  /** Player collision radius (capsule width) */
  playerRadius: number;
  /** Camera height above floor */
  cameraHeight: number;
  /** Movement speed in meters per second */
  movementSpeed: number;
  /** Sprint multiplier */
  sprintMultiplier: number;
  /** Mouse sensitivity for look rotation */
  mouseSensitivity: number;
}

interface WalkthroughCallbacks {
  onExit?: () => void;
}

/**
 * Input state tracking
 */
interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

/**
 * First-person walkthrough controller for room exploration.
 * Handles camera movement, collision detection, and user input.
 */
export class WalkthroughController {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private roomBounds: RoomBounds;
  private wallMeshes: THREE.Mesh[];

  private config: WalkthroughConfig;
  private callbacks: WalkthroughCallbacks;
  private inputState: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  };

  private isActive = false;
  private cameraStartPosition: THREE.Vector3 = new THREE.Vector3();
  private cameraEuler: THREE.Euler = new THREE.Euler(0, 0, 0, "YXZ");

  // Mouse tracking
  private lastMouseX = 0;
  private lastMouseY = 0;
  private yaw = 0;
  private pitch = 0;

  // Velocity and movement
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private moveDirection: THREE.Vector3 = new THREE.Vector3();
  private desiredVelocity: THREE.Vector3 = new THREE.Vector3();

  // Collision detection
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private readonly WALL_CHECK_DISTANCE = 0.5; // Distance to check ahead for walls

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    roomBounds: RoomBounds,
    wallMeshes: THREE.Mesh[],
    config: Partial<WalkthroughConfig> = {},
    callbacks: WalkthroughCallbacks = {},
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.roomBounds = roomBounds;
    this.wallMeshes = wallMeshes;

    this.config = {
      playerRadius: config.playerRadius ?? 0.3,
      cameraHeight: config.cameraHeight ?? 1.6,
      movementSpeed: config.movementSpeed ?? 5,
      sprintMultiplier: config.sprintMultiplier ?? 1.5,
      mouseSensitivity: config.mouseSensitivity ?? 0.003,
    };
    this.callbacks = callbacks;

    this.setupEventListeners();
  }

  /**
   * Enable walkthrough mode
   */
  public enter(): void {
    if (this.isActive) return;

    this.isActive = true;

    // Store current camera state
    this.cameraStartPosition.copy(this.camera.position);

    // Set initial camera position (center of room at eye height)
    const roomCenterX = (this.roomBounds.minX + this.roomBounds.maxX) / 2;
    const roomCenterZ = (this.roomBounds.minZ + this.roomBounds.maxZ) / 2;

    this.camera.position.set(
      roomCenterX,
      this.config.cameraHeight,
      roomCenterZ,
    );

    // Reset rotation state
    this.yaw = 0;
    this.pitch = 0;
    this.velocity.set(0, 0, 0);

    // Request pointer lock
    this.requestPointerLock();

    // Add event listeners
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.renderer.domElement.addEventListener("mousemove", this.onMouseMove);
  }

  /**
   * Disable walkthrough mode and restore original camera state
   */
  public exit(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.velocity.set(0, 0, 0);

    // Exit pointer lock
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }

    // Remove event listeners
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.renderer.domElement.removeEventListener("mousemove", this.onMouseMove);

    // Restore camera to original position
    this.camera.position.copy(this.cameraStartPosition);
    this.camera.quaternion.set(0, 0, 0, 1);

    this.callbacks.onExit?.();
  }

  /**
   * Check if walkthrough mode is active
   */
  public getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Update controller state (call this from animation loop)
   * @param deltaTime Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    if (!this.isActive) return;

    // Update camera rotation
    this.updateCameraRotation();

    // Calculate desired movement direction
    this.calculateMovement();

    // Apply movement with collision detection
    this.applyMovement(deltaTime);

    // Ensure camera stays at correct height
    this.camera.position.y = this.config.cameraHeight;

    // Keep camera within room bounds
    this.clampCameraToRoom();
  }

  /**
   * Update camera rotation based on mouse movement
   */
  private updateCameraRotation(): void {
    // Apply Euler angles in YXZ order for proper FPS camera behavior
    this.cameraEuler.setFromQuaternion(this.camera.quaternion);
    this.cameraEuler.order = "YXZ";
    this.cameraEuler.setFromQuaternion(this.camera.quaternion);

    this.yaw = this.cameraEuler.y;
    this.pitch = this.cameraEuler.x;

    // Clamp pitch to prevent over-rotation
    const pitchLimit = Math.PI / 2.5;
    this.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.pitch));

    this.cameraEuler.order = "YXZ";
    this.cameraEuler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.cameraEuler);
  }

  /**
   * Calculate movement direction from input
   */
  private calculateMovement(): void {
    this.moveDirection.set(0, 0, 0);

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0; // Ignore vertical component
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (this.inputState.forward) {
      this.moveDirection.addScaledVector(forward, 1);
    }
    if (this.inputState.backward) {
      this.moveDirection.addScaledVector(forward, -1);
    }
    if (this.inputState.right) {
      this.moveDirection.addScaledVector(right, 1);
    }
    if (this.inputState.left) {
      this.moveDirection.addScaledVector(right, -1);
    }

    // Normalize to prevent faster diagonal movement
    if (this.moveDirection.lengthSq() > 0) {
      this.moveDirection.normalize();
    }

    // Calculate desired velocity
    const speed =
      this.config.movementSpeed *
      (this.inputState.sprint ? this.config.sprintMultiplier : 1);

    this.desiredVelocity.copy(this.moveDirection).multiplyScalar(speed);
  }

  /**
   * Apply movement with collision detection
   */
  private applyMovement(deltaTime: number): void {
    // Smooth velocity transitions
    const acceleration = 20;
    const deceleration = 15;
    const blendFactor = Math.exp(
      -(this.desiredVelocity.lengthSq() > 0 ? acceleration : deceleration) *
        deltaTime,
    );
    this.velocity.lerp(this.desiredVelocity, 1 - blendFactor);

    if (this.velocity.lengthSq() < 0.001) {
      this.velocity.set(0, 0, 0);
    }

    // Calculate next position
    const nextPosition = this.camera.position
      .clone()
      .addScaledVector(this.velocity, deltaTime);

    // Check collision and apply movement if valid
    if (this.isValidPosition(nextPosition)) {
      this.camera.position.copy(nextPosition);
    } else {
      // Slide along walls: try moving along individual axes
      const slidePosition = this.camera.position.clone();

      const xPosition = slidePosition.clone();
      xPosition.x = nextPosition.x;
      if (this.isValidPosition(xPosition)) {
        slidePosition.copy(xPosition);
      }

      const zPosition = slidePosition.clone();
      zPosition.z = nextPosition.z;
      if (this.isValidPosition(zPosition)) {
        slidePosition.copy(zPosition);
      }

      this.camera.position.copy(slidePosition);
      this.velocity.set(0, 0, 0);
    }
  }

  /**
   * Check if a position is valid (inside room and not colliding with walls)
   */
  private isValidPosition(position: THREE.Vector3): boolean {
    // Check room bounds with player radius
    const minMargin = this.config.playerRadius;
    const maxMargin = this.config.playerRadius;

    if (
      position.x - minMargin < this.roomBounds.minX ||
      position.x + maxMargin > this.roomBounds.maxX ||
      position.z - minMargin < this.roomBounds.minZ ||
      position.z + maxMargin > this.roomBounds.maxZ
    ) {
      return false;
    }

    // Check collision distance from walls using raycasting
    return this.checkWallCollisions(position);
  }

  /**
   * Check collisions with wall meshes using raycasting
   */
  private checkWallCollisions(position: THREE.Vector3): boolean {
    const checkDirections = [
      new THREE.Vector3(1, 0, 0), // Right
      new THREE.Vector3(-1, 0, 0), // Left
      new THREE.Vector3(0, 0, 1), // Forward
      new THREE.Vector3(0, 0, -1), // Backward
      new THREE.Vector3(1, 0, 1).normalize(), // Diagonal
      new THREE.Vector3(-1, 0, 1).normalize(),
      new THREE.Vector3(1, 0, -1).normalize(),
      new THREE.Vector3(-1, 0, -1).normalize(),
    ];

    for (const direction of checkDirections) {
      this.raycaster.set(position, direction.clone().normalize());

      const intersections = this.raycaster.intersectObjects(this.wallMeshes);

      if (intersections.length > 0) {
        const closestDistance = intersections[0].distance;
        if (closestDistance < this.config.playerRadius) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Clamp camera position to room bounds after movement
   */
  private clampCameraToRoom(): void {
    const margin = this.config.playerRadius;

    this.camera.position.x = Math.max(
      this.roomBounds.minX + margin,
      Math.min(this.roomBounds.maxX - margin, this.camera.position.x),
    );

    this.camera.position.z = Math.max(
      this.roomBounds.minZ + margin,
      Math.min(this.roomBounds.maxZ - margin, this.camera.position.z),
    );
  }

  /**
   * Request pointer lock for mouse control
   */
  private requestPointerLock(): void {
    const canvas = this.renderer.domElement;
    if (canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
  }

  /**
   * Setup keyboard and mouse event listeners
   */
  private setupEventListeners(): void {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";

      switch (key) {
        case "w":
          this.inputState.forward = true;
          break;
        case "a":
          this.inputState.left = true;
          break;
        case "s":
          this.inputState.backward = true;
          break;
        case "d":
          this.inputState.right = true;
          break;
        case "shift":
          this.inputState.sprint = true;
          break;
        case "escape":
          if (this.isActive) {
            this.exit();
          }
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";

      switch (key) {
        case "w":
          this.inputState.forward = false;
          break;
        case "a":
          this.inputState.left = false;
          break;
        case "s":
          this.inputState.backward = false;
          break;
        case "d":
          this.inputState.right = false;
          break;
        case "shift":
          this.inputState.sprint = false;
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
  }

  /**
   * Handle pointer lock change event
   */
  private onPointerLockChange = (): void => {
    if (
      document.pointerLockElement !== this.renderer.domElement &&
      this.isActive
    ) {
      // Pointer lock was exited, disable walkthrough
      this.exit();
    }
  };

  /**
   * Handle mouse movement for camera rotation
   */
  private onMouseMove = (event: MouseEvent): void => {
    if (
      !this.isActive ||
      document.pointerLockElement !== this.renderer.domElement
    ) {
      return;
    }

    const deltaX = event.movementX || 0;
    const deltaY = event.movementY || 0;

    // Update yaw and pitch based on mouse movement
    this.yaw -= deltaX * this.config.mouseSensitivity;
    this.pitch -= deltaY * this.config.mouseSensitivity;

    // Clamp pitch to prevent over-rotation
    const pitchLimit = Math.PI / 2.5;
    this.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.pitch));

    // Apply rotation to camera
    this.cameraEuler.order = "YXZ";
    this.cameraEuler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.cameraEuler);
  };

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.isActive) {
      this.exit();
    }

    // Remove event listeners
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
  }
}

/**
 * Helper function to create a walkthrough controller with room walls
 * Extracts wall meshes from a wall geometry group
 */
export function createWalkthroughController(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  roomBounds: RoomBounds,
  wallGroup: THREE.Group | undefined,
  config?: Partial<WalkthroughConfig>,
  callbacks?: WalkthroughCallbacks,
): WalkthroughController {
  const wallMeshes: THREE.Mesh[] = [];

  if (wallGroup) {
    wallGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        wallMeshes.push(object);
      }
    });
  }

  return new WalkthroughController(
    scene,
    camera,
    renderer,
    roomBounds,
    wallMeshes,
    config,
    callbacks,
  );
}
