const CANVAS_DB_NAME = "image2-canvas-workspace";
const CANVAS_DB_VERSION = 2;
const LEGACY_CANVAS_ID = "default-workspace";
const CANVAS_FALLBACK_KEY = "image2-canvas-workspace-fallback";
const CANVAS_FALLBACK_PREFIX = `${CANVAS_FALLBACK_KEY}:`;

let databasePromise;

function sanitizeReferenceAssets(referenceAssets, { keepBlobs }) {
  if (!Array.isArray(referenceAssets)) {
    return [];
  }

  return referenceAssets.map(reference => {
    const {
      url: _runtimeUrl,
      blob: _blob,
      ...serializableReference
    } = reference;
    return keepBlobs
      ? { ...serializableReference, blob: reference.blob }
      : serializableReference;
  });
}

function sanitizeNode(node, { keepBlobs }) {
  const {
    url: _runtimeUrl,
    annotationUrl: _annotationRuntimeUrl,
    assetBlob: _assetBlob,
    annotationBlob: _annotationBlob,
    ...serializableNode
  } = node;
  return {
    ...serializableNode,
    ...(keepBlobs
      ? {
          assetBlob: node.assetBlob,
          annotationBlob: node.annotationBlob
        }
      : {}),
    referenceAssets: sanitizeReferenceAssets(node.referenceAssets, { keepBlobs })
  };
}

function getFallbackKey(canvasId) {
  return canvasId === LEGACY_CANVAS_ID
    ? CANVAS_FALLBACK_KEY
    : `${CANVAS_FALLBACK_PREFIX}${canvasId}`;
}

function makeFallbackSnapshot({ nodes, viewport, settings, updatedAt }) {
  return {
    nodes: nodes.map(node => sanitizeNode(node, { keepBlobs: false })),
    viewport,
    settings,
    updatedAt
  };
}

function writeFallbackSnapshot(canvasId, snapshot) {
  try {
    localStorage.setItem(getFallbackKey(canvasId), JSON.stringify(makeFallbackSnapshot(snapshot)));
  } catch {
    // IndexedDB remains the primary store when localStorage is unavailable.
  }
}

function readFallbackSnapshot(canvasId) {
  try {
    const snapshot = JSON.parse(localStorage.getItem(getFallbackKey(canvasId)) || "null");
    return snapshot && Array.isArray(snapshot.nodes) ? snapshot : null;
  } catch {
    return null;
  }
}

function clearFallbackSnapshot(canvasId) {
  try {
    localStorage.removeItem(getFallbackKey(canvasId));
  } catch {
    // Ignore localStorage cleanup failures after IndexedDB deletion succeeds.
  }
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Canvas transaction was aborted."));
  });
}

function openCanvasDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CANVAS_DB_NAME, CANVAS_DB_VERSION);

    request.onupgradeneeded = event => {
      const database = request.result;
      const transaction = request.transaction;
      let nodeStore;

      if (!database.objectStoreNames.contains("nodes")) {
        nodeStore = database.createObjectStore("nodes", { keyPath: "id" });
        nodeStore.createIndex("createdAt", "createdAt");
      } else {
        nodeStore = transaction.objectStore("nodes");
      }
      if (!nodeStore.indexNames.contains("canvasId")) {
        nodeStore.createIndex("canvasId", "canvasId");
      }

      if (!database.objectStoreNames.contains("meta")) {
        database.createObjectStore("meta", { keyPath: "key" });
      }
      const projectStore = database.objectStoreNames.contains("projects")
        ? transaction.objectStore("projects")
        : database.createObjectStore("projects", { keyPath: "id" });

      if (event.oldVersion > 0 && event.oldVersion < 2) {
        const migratedAt = new Date().toISOString();
        projectStore.put({
          id: LEGACY_CANVAS_ID,
          title: "Image2 创意画布",
          createdAt: migratedAt,
          updatedAt: migratedAt
        });

        const cursorRequest = nodeStore.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            return;
          }
          cursor.update({ ...cursor.value, canvasId: LEGACY_CANVAS_ID });
          cursor.continue();
        };
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      databasePromise = undefined;
      reject(new Error("Canvas database is blocked by another tab."));
    };
  });

  return databasePromise;
}

function createCanvasId() {
  return `canvas-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function createProjectCover(nodes) {
  const coverNode = [...nodes].reverse().find(node => (
    !node.hidden
    && (node.type === "upload" || node.type === "history-image")
    && node.status !== "error"
  ));
  if (!coverNode) {
    return null;
  }
  if (coverNode.type === "upload") {
    const blob = coverNode.annotationBlob || coverNode.assetBlob;
    return blob ? { type: "blob", blob, name: coverNode.name || "" } : null;
  }
  return {
    type: "history",
    taskId: coverNode.taskId,
    imageId: coverNode.imageId
  };
}

export async function loadCanvasProjects() {
  const database = await openCanvasDatabase();
  const transaction = database.transaction(["projects", "nodes"], "readonly");
  const done = transactionToPromise(transaction);
  const [projects, nodes] = await Promise.all([
    requestToPromise(transaction.objectStore("projects").getAll()),
    requestToPromise(transaction.objectStore("nodes").getAll())
  ]);
  await done;

  const nodesByCanvas = new Map();
  nodes.forEach(node => {
    const canvasId = node.canvasId || LEGACY_CANVAS_ID;
    const canvasNodes = nodesByCanvas.get(canvasId) || [];
    canvasNodes.push(node);
    nodesByCanvas.set(canvasId, canvasNodes);
  });

  return projects
    .map(project => {
      const projectNodes = nodesByCanvas.get(project.id) || [];
      return {
        ...project,
        nodeCount: projectNodes.filter(node => !node.hidden).length,
        cover: createProjectCover(projectNodes)
      };
    })
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
}

export async function createCanvasProject({ title, initialPrompt = "" } = {}) {
  const database = await openCanvasDatabase();
  const id = createCanvasId();
  const createdAt = new Date().toISOString();
  const project = {
    id,
    title: String(title || "未命名画布").trim() || "未命名画布",
    createdAt,
    updatedAt: createdAt
  };
  const transaction = database.transaction(["projects", "meta"], "readwrite");
  const done = transactionToPromise(transaction);
  transaction.objectStore("projects").put(project);
  transaction.objectStore("meta").put({
    key: id,
    viewport: { x: 32, y: 32, zoom: 1 },
    settings: {
      prompt: String(initialPrompt || ""),
      aspectRatio: "auto",
      quality: "medium",
      count: 1
    },
    updatedAt: createdAt
  });
  await done;
  return project;
}

export async function renameCanvasProject(canvasId, title) {
  const database = await openCanvasDatabase();
  const transaction = database.transaction("projects", "readwrite");
  const done = transactionToPromise(transaction);
  const store = transaction.objectStore("projects");
  const existing = await requestToPromise(store.get(canvasId));
  if (!existing) {
    transaction.abort();
    throw new Error("Canvas project does not exist.");
  }
  const updated = {
    ...existing,
    title: String(title || "").trim() || existing.title,
    updatedAt: new Date().toISOString()
  };
  store.put(updated);
  await done;
  return updated;
}

export async function deleteCanvasProject(canvasId) {
  const database = await openCanvasDatabase();
  const transaction = database.transaction(["projects", "nodes", "meta"], "readwrite");
  const done = transactionToPromise(transaction);
  transaction.objectStore("projects").delete(canvasId);
  transaction.objectStore("meta").delete(canvasId);
  const nodeStore = transaction.objectStore("nodes");
  const cursorRequest = nodeStore.index("canvasId").openCursor(canvasId);
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) {
      return;
    }
    cursor.delete();
    cursor.continue();
  };
  await done;
  clearFallbackSnapshot(canvasId);
}

export async function loadCanvasSnapshot(canvasId) {
  const database = await openCanvasDatabase();
  const transaction = database.transaction(["projects", "nodes", "meta"], "readonly");
  const done = transactionToPromise(transaction);
  const [project, nodes, meta] = await Promise.all([
    requestToPromise(transaction.objectStore("projects").get(canvasId)),
    requestToPromise(transaction.objectStore("nodes").index("canvasId").getAll(canvasId)),
    requestToPromise(transaction.objectStore("meta").get(canvasId))
  ]);
  await done;

  const fallback = readFallbackSnapshot(canvasId);
  const databaseUpdatedAt = Date.parse(meta?.updatedAt || "") || 0;
  const fallbackUpdatedAt = Date.parse(fallback?.updatedAt || "") || 0;
  if (fallback && fallbackUpdatedAt >= databaseUpdatedAt) {
    const databaseNodes = new Map(nodes.map(node => [node.id, node]));
    const recoveredNodes = fallback.nodes.flatMap(node => {
      const storedNode = databaseNodes.get(node.id);
      if (node.type === "upload" && !storedNode?.assetBlob) {
        return [];
      }
      const storedReferences = new Map(
        (storedNode?.referenceAssets || []).map(reference => [reference.id, reference])
      );
      const referenceAssets = (node.referenceAssets || []).flatMap(reference => {
        const storedReference = storedReferences.get(reference.id);
        if (!storedReference?.blob) {
          return [];
        }
        return [{
          ...storedReference,
          ...reference,
          blob: storedReference.blob
        }];
      });
      return [{
        ...storedNode,
        ...node,
        assetBlob: storedNode?.assetBlob,
        annotationBlob: storedNode?.annotationBlob,
        referenceAssets
      }];
    });
    return {
      project,
      nodes: recoveredNodes.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt)),
      viewport: fallback.viewport,
      settings: fallback.settings
    };
  }

  return {
    project,
    nodes: nodes.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt)),
    viewport: meta?.viewport,
    settings: meta?.settings
  };
}

export async function saveCanvasSnapshot({ canvasId, nodes, viewport, settings }) {
  if (!canvasId) {
    throw new Error("A canvasId is required to save a Canvas workspace.");
  }

  const updatedAt = new Date().toISOString();
  writeFallbackSnapshot(canvasId, { nodes, viewport, settings, updatedAt });

  const database = await openCanvasDatabase();
  const transaction = database.transaction(["projects", "nodes", "meta"], "readwrite");
  const done = transactionToPromise(transaction);
  const nodeStore = transaction.objectStore("nodes");
  const cursorRequest = nodeStore.index("canvasId").openCursor(canvasId);
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
      return;
    }
    nodes.forEach(node => {
      nodeStore.put({
        ...sanitizeNode(node, { keepBlobs: true }),
        canvasId
      });
    });
  };

  transaction.objectStore("meta").put({
    key: canvasId,
    viewport,
    settings,
    updatedAt
  });

  const projectStore = transaction.objectStore("projects");
  const projectRequest = projectStore.get(canvasId);
  projectRequest.onsuccess = () => {
    const existing = projectRequest.result;
    projectStore.put({
      id: canvasId,
      title: existing?.title || "未命名画布",
      createdAt: existing?.createdAt || updatedAt,
      updatedAt
    });
  };

  await done;
}
