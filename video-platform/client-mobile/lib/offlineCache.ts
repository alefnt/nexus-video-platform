// FILE: /video-platform/client-mobile/lib/offlineCache.ts
/**
 * 功能说明：
 * - 移动端离线缓存工具，基于 expo-file-system 存储加密视频数据。
 * - 加密方案：默认使用简化 XOR（Expo 环境缺少原生 AES-GCM 支持）；密钥派生与 Web 对齐：sha256(user_ckb + video_id)。
 * - 提供加密写入、存在性检查、清理、离线加载（解密到临时文件供 react-native-video 播放）。
 */

import * as FileSystem from "expo-file-system";
import { generateEncryptionKeyHash } from "@video-platform/shared/web3/ckb";

function keyBytesFromHash(hash: string): Uint8Array {
  return new Uint8Array(hash.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

function xorEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  return out;
}

function cachePath(videoId: string): string {
  return `${FileSystem.documentDirectory}vp_cache_${videoId}.bin`;
}

function tempPath(videoId: string): string {
  return `${FileSystem.cacheDirectory}vp_${videoId}.mp4`;
}

export async function encryptAndCacheVideoRN(videoId: string, base64: string, userCkbAddress: string): Promise<void> {
  const rawBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const hash = generateEncryptionKeyHash(userCkbAddress, videoId);
  const key = keyBytesFromHash(hash);
  const enc = xorEncrypt(rawBytes, key);
  const encB64 = btoa(String.fromCharCode(...enc));
  const path = cachePath(videoId);
  await FileSystem.writeAsStringAsync(path, encB64, { encoding: FileSystem.EncodingType.Base64 });
}

export async function checkCacheExistsRN(videoId: string): Promise<boolean> {
  const path = cachePath(videoId);
  const info = await FileSystem.getInfoAsync(path);
  return !!info.exists;
}

export async function clearCachedVideoRN(videoId: string): Promise<void> {
  const path = cachePath(videoId);
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
  const tmp = tempPath(videoId);
  const tinf = await FileSystem.getInfoAsync(tmp);
  if (tinf.exists) await FileSystem.deleteAsync(tmp, { idempotent: true });
}

export async function loadCachedVideoRN(videoId: string, userCkbAddress: string): Promise<string | null> {
  const path = cachePath(videoId);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const encB64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
  const encBytes = Uint8Array.from(atob(encB64), (c) => c.charCodeAt(0));
  const hash = generateEncryptionKeyHash(userCkbAddress, videoId);
  const key = keyBytesFromHash(hash);
  const dec = xorEncrypt(encBytes, key);
  const tmp = tempPath(videoId);
  const decB64 = btoa(String.fromCharCode(...dec));
  await FileSystem.writeAsStringAsync(tmp, decB64, { encoding: FileSystem.EncodingType.Base64 });
  return tmp; // file:// URI 可被 react-native-video 播放
}