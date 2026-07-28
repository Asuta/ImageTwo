const CANVAS_DB_NAME = "image2-canvas-workspace";
const CANVAS_DB_VERSION = 1;
const CANVAS_META_KEY = "default-workspace";
const CANVAS_FALLBACK_KEY = "image2-canvas-workspace-fallback";

let databasePromise;

function makeFallbackSnapshot({ nodes, viewport, settings, updatedAt }) {
  return {
    nodes: nodes.map(node => {
      const {
        url: _runtimeUrl,
        annotationUrl: _annotationRuntimeUrl,
        assetBlob: _assetBlob,
        annotationBlob: _annotationBlob,
        ...serializableNode
      } = node;
      return serializableNode;
    }),
    viewport,
    settings,
    updatedAt
  };
}

function writeFallbackSnapshot(snapshot) {
  try {
    localStorage.setItem(CANVAS_FALLBACK_KEY, JSON.stringify(makeFallbackSnapshot(snapshot)));
  } catch {
    // IndexedDB remains the primary store when localStorage is unavailable.
  }
}

function readFallbackSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(CANVAS_FALLBACK_KEY) || "null");
    return snapshot && Array.isArray(snapshot.nodes) ? snapshot : null;
  } catch {
    return null;
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

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("nodes")) {
        const nodeStore = database.createObjectStore("nodes", { keyPath: "id" });
        nodeStore.createIndex("createdAt", "createdAt");
      }
      if (!database.objectStoreNames.contains("meta")) {
        database.createObjectStore("meta", { keyPath: "key" });
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

export async function loadCanvasSnapshot() {
  const database = await openCanvasDatabase();
  const transaction = database.transaction(["nodes", "meta"], "readonly");
  const done = transactionToPromise(transaction);
  const [nodes, meta] = await Promise.all([
    requestToPromise(transaction.objectStore("nodes").getAll()),
    requestToPromise(transaction.objectStore("meta").get(CANVAS_META_KEY))
  ]);
  await done;

  const fallback = readFallbackSnapshot();
  const databaseUpdatedAt = Date.parse(meta?.updatedAt || "") || 0;
  const fallbackUpdatedAt = Date.parse(fallback?.updatedAt || "") || 0;
  if (fallback && fallbackUpdatedAt >= databaseUpdatedAt) {
    const databaseNodes = new Map(nodes.map(node => [node.id, node]));
    const recoveredNodes = fallback.nodes.flatMap(node => {
      const storedNode = databaseNodes.get(node.id);
      if (node.type === "upload" && !storedNode?.assetBlob) {
        return [];
      }
      return [{
        ...storedNode,
        ...node,
        assetBlob: storedNode?.assetBlob,
        annotationBlob: storedNode?.annotationBlob
      }];
    });
    return {
      nodes: recoveredNodes.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt)),
      viewport: fallback.viewport,
      settings: fallback.settings
    };
  }

  return {
    nodes: nodes.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt)),
    viewport: meta?.viewport,
    settings: meta?.settings
  };
}

export async function saveCanvasSnapshot({ nodes, viewport, settings }) {
  const updatedAt = new Date().toISOString();
  writeFallbackSnapshot({ nodes, viewport, settings, updatedAt });

  const database = await openCanvasDatabase();
  const transaction = database.transaction(["nodes", "meta"], "readwrite");
  const done = transactionToPromise(transaction);
  const nodeStore = transaction.objectStore("nodes");

  nodeStore.clear();
  nodes.forEach(node => {
    const { url: _runtimeUrl, annotationUrl: _annotationRuntimeUrl, ...storableNode } = node;
    nodeStore.put(storableNode);
  });

  transaction.objectStore("meta").put({
    key: CANVAS_META_KEY,
    viewport,
    settings,
    updatedAt
  });

  await done;
}
