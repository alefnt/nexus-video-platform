// FILE: /video-platform/client-web/src/lib/offlineCache.ts
/**
 * 功能说明：
 * - PWA 场景的本地加密缓存（localStorage 简化实现），支持离线读取。
 * - 加密密钥衍生规则：sha256(user_ckb + video_id)。
 * - 设置 navigator.onLine=false 时也能读取缓存。
 */

import { generateEncryptionKeyHash } from "@video-platform/shared/web3/ckb";

const DB_NAME = "vp_cache";
const STORE_NAME = "videos";

function supportsIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const r = store.put(value, key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

async function idbGet<T = any>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const r = store.delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

async function idbListKeys(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const anyStore = store as any;
      // 优先使用 getAllKeys（现代浏览器支持）
      if (typeof anyStore.getAllKeys === "function") {
        const r: IDBRequest<IDBValidKey[]> = anyStore.getAllKeys();
        r.onsuccess = () => resolve((r.result || []).map((k) => String(k)));
        r.onerror = () => reject(r.error);
      } else {
        const keys: string[] = [];
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result as IDBCursorWithValue | null;
          if (cursor) {
            keys.push(String(cursor.key));
            cursor.continue();
          } else {
            resolve(keys);
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      }
    } catch (e: any) {
      reject(e);
    }
  });
}

async function deriveAesKeyFromHash(hashHex: string): Promise<CryptoKey> {
  // 将十六进制哈希转为 ArrayBuffer
  const bytes = new Uint8Array(hashHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptAndCacheVideo(videoId: string, base64: string, userCkbAddress: string): Promise<void> {
  const hash = generateEncryptionKeyHash(userCkbAddress, videoId);
  const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (crypto?.subtle) {
    const key = await deriveAesKeyFromHash(hash);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    const ivB64 = btoa(String.fromCharCode(...iv));
    if (supportsIndexedDB()) {
      await idbPut(videoId, { algo: "AES-GCM", iv: ivB64, data: encrypted });
    } else {
      const encB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
      localStorage.setItem(`vp.cache.${videoId}`, JSON.stringify({ algo: "AES-GCM", iv: ivB64, data: encB64 }));
    }
  } else {
    // Node/JSDOM Fallback：使用 XOR 与 sha256 派生密钥字节实现最小可用加密（仅用于测试）。
    const keyBytes = new Uint8Array(hash.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = data[i] ^ keyBytes[i % keyBytes.length];
    const encB64 = btoa(String.fromCharCode(...out));
    localStorage.setItem(`vp.cache.${videoId}`, JSON.stringify({ algo: "XOR", data: encB64 }));
  }
}

export async function loadCachedVideo(videoId: string): Promise<string | null> {
  // 优先使用 IndexedDB
  const idbRecord = supportsIndexedDB() ? await idbGet<{ algo: string; iv?: string; data: ArrayBuffer }>(videoId) : undefined;
  const json = localStorage.getItem(`vp.cache.${videoId}`);
  if (!idbRecord && !json) return null;
  const userRaw = sessionStorage.getItem("vp.user");
  if (!userRaw) return null;
  const user = JSON.parse(userRaw);
  const hash = generateEncryptionKeyHash(user.ckbAddress, videoId);
  const algo = idbRecord?.algo || (json ? JSON.parse(json).algo : undefined);
  try {
    if (algo === "AES-GCM" && crypto?.subtle) {
      const key = await deriveAesKeyFromHash(hash);
      const ivB64 = idbRecord?.iv || (json ? JSON.parse(json).iv : undefined);
      const ivBytes = Uint8Array.from(atob(ivB64!), (c) => c.charCodeAt(0));
      const encBytes = idbRecord?.data
        ? new Uint8Array(idbRecord.data)
        : Uint8Array.from(atob(JSON.parse(json!).data), (c) => c.charCodeAt(0));
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, encBytes);
      const out = new Uint8Array(decrypted);
      const b64 = btoa(String.fromCharCode(...out));
      return `data:video/mp4;base64,${b64}`;
    } else {
      const parsed = json ? JSON.parse(json) : undefined;
      const encBytes = parsed ? Uint8Array.from(atob(parsed.data), (c) => c.charCodeAt(0)) : undefined;
      if (!encBytes) return null;
      const keyBytes = new Uint8Array(hash.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
      const out = new Uint8Array(encBytes.length);
      for (let i = 0; i < encBytes.length; i++) out[i] = encBytes[i] ^ keyBytes[i % keyBytes.length];
      const b64 = btoa(String.fromCharCode(...out));
      return `data:video/mp4;base64,${b64}`;
    }
  } catch {
    return null;
  }
}

export async function checkCacheExists(videoId: string): Promise<boolean> {
  if (supportsIndexedDB()) {
    const r = await idbGet(videoId);
    if (r) return true;
  }
  return !!localStorage.getItem(`vp.cache.${videoId}`);
}

export async function clearCachedVideo(videoId: string): Promise<void> {
  if (supportsIndexedDB()) {
    try {
      await idbDelete(videoId);
    } catch {}
  }
  localStorage.removeItem(`vp.cache.${videoId}`);
}

export async function listCachedVideoIds(): Promise<string[]> {
  const ids = new Set<string>();
  // IndexedDB 枚举
  if (supportsIndexedDB()) {
    try {
      const k = await idbListKeys();
      for (const id of k) ids.add(String(id));
    } catch {}
  }
  // localStorage 前缀枚举
  try {
    const prefix = "vp.cache.";
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      if (key.startsWith(prefix)) ids.add(key.slice(prefix.length));
    }
  } catch {}
  return Array.from(ids);
}