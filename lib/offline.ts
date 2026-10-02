"use client";
import type { Bundle, Mutation, QueuedMutation, TripListResponse } from "./types";
import { compareQueuedMutations, compactQueueRows, isCoreOfflineMutation } from "./offline-reliability";

type CacheEntry<T = unknown> = {
  key: string;
  userId: string;
  kind: "trips" | "bundle";
  tripId?: string;
  value: T;
  updatedAt: string;
};

const DB_NAME = "tripflow-v020";
const DB_VERSION = 2;
const CACHE = "cache";
const QUEUE = "queue";
let opening: Promise<IDBDatabase> | null = null;

function available() {
  return typeof window !== "undefined" && !!window.indexedDB;
}

function openDb(): Promise<IDBDatabase> {
  if (!available()) return Promise.reject(new Error("IndexedDB không khả dụng."));
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      let cacheStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(CACHE))
        cacheStore = db.createObjectStore(CACHE, { keyPath: "key" });
      else cacheStore = request.transaction!.objectStore(CACHE);
      if (!cacheStore.indexNames.contains("userId"))
        cacheStore.createIndex("userId", "userId", { unique: false });

      let queueStore: IDBObjectStore;
      if (!db.objectStoreNames.contains(QUEUE))
        queueStore = db.createObjectStore(QUEUE, { keyPath: "operationId" });
      else queueStore = request.transaction!.objectStore(QUEUE);
      if (!queueStore.indexNames.contains("userId"))
        queueStore.createIndex("userId", "userId", { unique: false });
      if (!queueStore.indexNames.contains("tripId"))
        queueStore.createIndex("tripId", "tripId", { unique: false });
      if (!queueStore.indexNames.contains("state"))
        queueStore.createIndex("state", "state", { unique: false });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("Không mở được IndexedDB."));
    request.onblocked = () => reject(new Error("IndexedDB đang bị khóa bởi phiên TripFlow khác."));
  });
  return opening;
}

function idbRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB thất bại."));
  });
}

async function put(storeName: string, value: unknown) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Không lưu được dữ liệu offline."));
    tx.onabort = () => reject(tx.error || new Error("Giao dịch IndexedDB đã hủy."));
  });
}

async function get<T>(storeName: string, key: IDBValidKey) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readonly");
  return idbRequest(tx.objectStore(storeName).get(key)) as Promise<T | undefined>;
}

async function getByUser<T extends { userId: string }>(storeName: string, userId: string) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readonly");
  const index = tx.objectStore(storeName).index("userId");
  return idbRequest(index.getAll(IDBKeyRange.only(userId))) as Promise<T[]>;
}

async function remove(storeName: string, key: IDBValidKey) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Không xóa được dữ liệu offline."));
  });
}


export async function cacheTrips(userId: string, value: TripListResponse) {
  if (!available()) return;
  const row: CacheEntry<TripListResponse> = {
    key: `trips:${userId}`,
    userId,
    kind: "trips",
    value,
    updatedAt: new Date().toISOString(),
  };
  await put(CACHE, row);
}

export async function readCachedTrips(userId: string) {
  if (!available()) return undefined;
  const row = await get<CacheEntry<TripListResponse>>(CACHE, `trips:${userId}`);
  return row?.value;
}

export async function cacheBundle(userId: string, tripId: string, value: Bundle) {
  if (!available()) return;
  const row: CacheEntry<Bundle> = {
    key: `bundle:${userId}:${tripId}`,
    userId,
    kind: "bundle",
    tripId,
    value,
    updatedAt: new Date().toISOString(),
  };
  await put(CACHE, row);
}

export async function readCachedBundle(userId: string, tripId: string) {
  if (!available()) return undefined;
  const row = await get<CacheEntry<Bundle>>(CACHE, `bundle:${userId}:${tripId}`);
  return row?.value;
}

export async function removeCachedBundle(userId: string, tripId: string) {
  if (!available()) return;
  await remove(CACHE, `bundle:${userId}:${tripId}`);
}

export function canQueueMutation(mutation: Mutation) {
  return isCoreOfflineMutation(mutation);
}

export async function enqueueMutation(
  userId: string,
  mutation: Mutation,
  options: {
    allowCompaction?: boolean;
    attempted?: boolean;
    createdAt?: string;
    sequence?: number;
  } = {},
) {
  if (!available()) throw new Error("Trình duyệt không hỗ trợ lưu offline.");
  const previous = await listQueue(userId);
  const now = new Date().toISOString();
  const result = compactQueueRows(previous, mutation, userId, now, options);
  const previousById = new Map(previous.map((row) => [row.operationId, row]));
  const nextIds = new Set(result.rows.map((row) => row.operationId));
  for (const row of previous) {
    if (!nextIds.has(row.operationId)) await remove(QUEUE, row.operationId);
  }
  for (const row of result.rows) {
    const before = previousById.get(row.operationId);
    if (!before || JSON.stringify(before) !== JSON.stringify(row)) await put(QUEUE, row);
  }
  return result;
}

export async function listQueue(userId: string) {
  if (!available()) return [] as QueuedMutation[];
  const rows = await getByUser<QueuedMutation>(QUEUE, userId);
  return rows.sort(compareQueuedMutations);
}

export async function updateQueue(
  operationId: string,
  patch: Partial<
    Pick<
      QueuedMutation,
      | "state"
      | "attempts"
      | "error"
      | "updatedAt"
      | "lastAttemptAt"
      | "nextAttemptAt"
    >
  >,
) {
  if (!available()) return;
  const row = await get<QueuedMutation>(QUEUE, operationId);
  if (!row) return;
  await put(QUEUE, {
    ...row,
    ...patch,
    updatedAt: patch.updatedAt || new Date().toISOString(),
  });
}

export async function removeQueue(operationId: string) {
  if (!available()) return;
  await remove(QUEUE, operationId);
}

export async function recoverStaleQueue(userId: string, staleMs = 45000) {
  if (!available()) return 0;
  const rows = await listQueue(userId);
  const cutoff = Date.now() - staleMs;
  let recovered = 0;
  for (const row of rows) {
    if (row.state !== "sending") continue;
    const last = Date.parse(row.lastAttemptAt || row.updatedAt || row.createdAt);
    if (Number.isFinite(last) && last > cutoff) continue;
    await updateQueue(row.operationId, {
      state: "pending",
      error: "Phiên đồng bộ trước bị gián đoạn; TripFlow sẽ gửi lại an toàn.",
      nextAttemptAt: undefined,
    });
    recovered += 1;
  }
  return recovered;
}

export async function retryQueue(userId: string) {
  if (!available()) return;
  const rows = await listQueue(userId);
  for (const row of rows) {
    if (row.state === "conflict" || row.state === "rejected") {
      await put(QUEUE, {
        ...row,
        state: "pending",
        error: undefined,
        nextAttemptAt: undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function clearUserOfflineData(userId: string) {
  if (!available()) return;
  const db = await openDb();
  const cacheRows = await getByUser<CacheEntry>(CACHE, userId);
  const queueRows = await getByUser<QueuedMutation>(QUEUE, userId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CACHE, QUEUE], "readwrite");
    const cacheStore = tx.objectStore(CACHE);
    const queueStore = tx.objectStore(QUEUE);
    for (const row of cacheRows) cacheStore.delete(row.key);
    for (const row of queueRows) queueStore.delete(row.operationId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Không xóa được dữ liệu offline."));
  });
}
