import type { FurnitureAsset } from "../state/types";

type MeshyGenerateResponse = {
  taskId?: string;
  status?: string;
  model_urls?: { glb?: string };
  error?: unknown;
  _meta?: {
    matchedName?: string;
    originalPrompt?: string;
    extractedKeywords?: string;
    confidence?: string;
    fallback?: boolean;
  };
};

export type MeshyStreamUpdate = {
  taskId?: string;
  status?: string;
  progress?: number;
  modelUrl?: string;
  thumbnailUrl?: string;
  error?: unknown;
};

type MeshyStreamHandlers = {
  onUpdate: (update: MeshyStreamUpdate) => void;
  onError?: (error: string) => void;
};

// KENNEY-ALT: Instant furniture matching from local asset library
export async function startFurnitureMeshyTask(asset: FurnitureAsset): Promise<FurnitureAsset> {
  try {
    const response = await fetch("/api/meshy/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: asset.prompt }),
    });

    if (!response.ok) {
      return mockReadyAsset(asset, await responseError(response, "Furniture match failed"));
    }

    const generated = (await response.json()) as MeshyGenerateResponse;
    if (!generated.taskId) {
      return mockReadyAsset(
        asset,
        normalizeError(generated.error) ?? "No furniture match found.",
      );
    }

    // KENNEY-ALT: Immediately return as "ready" since matching is instant
    return {
      ...asset,
      taskId: generated.taskId,
      status: "ready",
      progress: 100,
      modelUrl: generated.model_urls?.glb,
      error: undefined,
      _meta: generated._meta,
    };
  } catch (error) {
    return mockReadyAsset(
      asset,
      error instanceof Error
        ? `${error.message}. Make sure the backend API server is running.`
        : "Furniture match failed. Make sure the backend API server is running.",
    );
  }
}

// KENNEY-ALT: No-op stream function for compatibility (matching is instant)
export function openFurnitureMeshyStream(taskId: string, handlers: MeshyStreamHandlers) {
  // Simulate immediate completion for UI responsiveness
  setTimeout(() => {
    handlers.onUpdate({
      taskId,
      status: "SUCCEEDED",
      progress: 100,
    });
  }, 100);

  return { close: () => {} } as EventSource;
}

export function applyMeshyStreamUpdate(asset: FurnitureAsset, update: MeshyStreamUpdate): FurnitureAsset {
  const status = String(update.status ?? "").toUpperCase();
  if (isSuccessStatus(status)) {
    return updateAssetIfChanged(asset, {
      ...asset,
      status: update.modelUrl ? "ready" : "failed",
      progress: 100,
      modelUrl: update.modelUrl ?? asset.modelUrl,
      error: update.modelUrl ? undefined : "No GLB URL provided.",
    });
  }

  if (isFailedStatus(status) || update.error) {
    return updateAssetIfChanged(asset, {
      ...asset,
      status: "failed",
      progress: update.progress ?? asset.progress,
      error: normalizeError(update.error) ?? "Furniture generation failed.",
    });
  }

  return updateAssetIfChanged(asset, {
    ...asset,
    status: "generating",
    progress: update.progress ?? asset.progress,
    error: undefined,
  });
}

export function isTerminalMeshyUpdate(update: MeshyStreamUpdate) {
  const status = String(update.status ?? "").toUpperCase();
  return isSuccessStatus(status) || isFailedStatus(status) || Boolean(update.error);
}

function mockReadyAsset(asset: FurnitureAsset, error: string): FurnitureAsset {
  return {
    ...asset,
    status: "mock",
    taskId: asset.taskId ?? `mock-${asset.id}`,
    error,
  };
}

function updateAssetIfChanged(previous: FurnitureAsset, next: FurnitureAsset): FurnitureAsset {
  return previous.status === next.status &&
    previous.progress === next.progress &&
    previous.modelUrl === next.modelUrl &&
    previous.error === next.error
    ? previous
    : next;
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return normalizeError(body?.message ?? body?.error ?? body) ?? `${fallback}: ${response.status}`;
  } catch {
    return `${fallback}: ${response.status}`;
  }
}

function normalizeError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const value = error as { message?: unknown; error?: unknown; detail?: unknown };
    return normalizeError(value.message) ?? normalizeError(value.error) ?? normalizeError(value.detail) ?? JSON.stringify(error);
  }
  return String(error);
}

function isSuccessStatus(status: string) {
  return ["SUCCEEDED", "SUCCESS", "COMPLETED"].includes(status);
}

function isFailedStatus(status: string) {
  return ["FAILED", "EXPIRED", "CANCELED", "CANCELLED"].includes(status);
}
