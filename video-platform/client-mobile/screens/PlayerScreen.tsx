// FILE: /video-platform/client-mobile/screens/PlayerScreen.tsx
/**
 * 功能说明：
 * - 使用 react-native-video 播放视频。
 * - 从网关获取播放源 URL（HLS 或 data URL）。
 */

import React, { useEffect, useState } from "react";
import { View, Text, Button, Platform, Dimensions } from "react-native";
import Video from "react-native-video";
import { ApiClient } from "@video-platform/shared/api/client";
import { encryptAndCacheVideoRN, loadCachedVideoRN, checkCacheExistsRN, clearCachedVideoRN } from "../lib/offlineCache";
import type { VideoMeta } from "@video-platform/shared/types";

const client = new ApiClient();

export default function PlayerScreen({ route }: any) {
  const { videoId } = route.params || { videoId: "demo-video" };
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState("准备中...");
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  function getDeviceFingerprint(): string {
    try {
      const { width, height } = Dimensions.get("window");
      const val = `${Platform.OS}|${Platform.Version}|${width}x${height}`;
      return Buffer.from(val).toString("base64");
    } catch {
      return Buffer.from("rn-device").toString("base64");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        // 优先离线播放
        setStatus("检查离线缓存...");
        const userRaw = sessionStorage.getItem("vp.user");
        let userCkb = "";
        if (userRaw) {
          try { userCkb = JSON.parse(userRaw).ckbAddress || ""; } catch {}
        }
        const offlineUri = userCkb ? await loadCachedVideoRN(videoId, userCkb) : null;
        if (offlineUri) {
          setSrc(offlineUri);
          setStatus("使用离线缓存播放");
          return;
        }

        // 在线拉流并异步写缓存
        setStatus("获取在线流...");
        const stream = await client.get<{ url: string }>(`/content/stream/${videoId}`);
        setSrc(stream.url);
        setStatus("播放在线流，并写入离线缓存...");
        const m = await client.get<VideoMeta>(`/metadata/${videoId}`);
        setMeta(m);

        // 申请离线授权 + 写缓存
        const dfp = getDeviceFingerprint();
        const grant = await client.post<{ video_id: string; offline_token: string; expires_in: number; cdn_urls: string[] }>("/content/play/offline", { videoId, deviceFingerprint: dfp });
        const offlineClient = new ApiClient({ jwt: grant.offline_token });
        const raw = await offlineClient.get<{ base64: string }>(`/content/raw/${videoId}`);
        const userAddr = m.creatorCkbAddress || userCkb || "";
        if (userAddr) await encryptAndCacheVideoRN(videoId, raw.base64, userAddr);
      } catch (e: any) {
        setStatus(e?.error || e?.message || "加载失败");
      }
    })();
  }, [videoId]);

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ padding: 12 }}>{status}</Text>
      {src && (
        <Video source={{ uri: src }} style={{ flex: 1 }} controls={true} resizeMode="contain" />
      )}
      <View style={{ padding: 12, flexDirection: "row" }}>
        <Button title="离线播放" onPress={async () => {
          try {
            const userRaw = sessionStorage.getItem("vp.user");
            const userCkb = userRaw ? JSON.parse(userRaw).ckbAddress : "";
            const offlineUri = userCkb ? await loadCachedVideoRN(videoId, userCkb) : null;
            if (offlineUri) {
              setSrc(offlineUri);
              setStatus("离线播放");
            } else {
              setStatus("离线缓存不存在");
            }
          } catch (e: any) {
            setStatus(e?.error || e?.message || "离线播放失败");
          }
        }} />
        <View style={{ width: 12 }} />
        <Button title={downloading ? "缓存中..." : "下载离线"} disabled={downloading} onPress={async () => {
          try {
            setDownloading(true);
            setStatus("请求离线授权...");
            const dfp = getDeviceFingerprint();
            const grant = await client.post<{ video_id: string; offline_token: string; expires_in: number; cdn_urls: string[] }>("/content/play/offline", { videoId, deviceFingerprint: dfp });
            const offlineClient = new ApiClient({ jwt: grant.offline_token });
            const raw = await offlineClient.get<{ base64: string }>(`/content/raw/${videoId}`);
            const m = meta || (await client.get<VideoMeta>(`/metadata/${videoId}`));
            await encryptAndCacheVideoRN(videoId, raw.base64, m.creatorCkbAddress);
            setStatus("离线缓存完成，可断网播放");
          } catch (e: any) {
            setStatus(e?.error || e?.message || "离线授权/缓存失败");
          } finally {
            setDownloading(false);
          }
        }} />
        <View style={{ width: 12 }} />
        <Button title="清除缓存" onPress={async () => {
          await clearCachedVideoRN(videoId);
          setStatus("已清除离线缓存");
        }} />
      </View>
    </View>
  );
}