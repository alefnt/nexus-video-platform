// FILE: /video-platform/client-mobile/screens/LoginScreen.tsx
/**
 * 功能说明：
 * - 移动端登录：通过 WebView 调用 Web 端 JoyID 页面完成真实连接与签名。
 * - 成功后后端验签并签发 JWT，导航到播放器页。
 */

import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Modal, Platform, Dimensions } from "react-native";
import { WebView } from "react-native-webview";
import { ApiClient } from "@video-platform/shared/api/client";
import type { JoyIDAuthRequest, AuthResponse } from "@video-platform/shared/types";

const client = new ApiClient();

export default function LoginScreen({ navigation }: any) {
  const [domain, setDomain] = useState("alice.bit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [webUrl, setWebUrl] = useState<string>("");

  function getDeviceFingerprint(): string {
    try {
      const { width, height } = Dimensions.get("window");
      const val = `${Platform.OS}|${Platform.Version}|${width}x${height}`;
      return Buffer.from(val).toString("base64");
    } catch {
      return Buffer.from("rn-device").toString("base64");
    }
  }

  async function startJoyIdLogin() {
    setLoading(true);
    setError(null);
    try {
      // 获取后端挑战
      const { challenge } = await client.get<{ challenge: string; nonceId: string }>("/auth/joyid/nonce");
      // Android 模拟器通过 10.0.2.2 访问宿主机；iOS/网页使用 localhost
      const defaultOrigin = Platform.OS === "android" ? "http://10.0.2.2:5173" : "http://localhost:5173";
      const WEB_ORIGIN = (process as any)?.env?.EXPO_PUBLIC_WEB_ORIGIN || (process as any)?.env?.WEB_APP_URL || defaultOrigin;
      const JOYID_URL = "https://testnet.joyid.dev";
      const url = `${WEB_ORIGIN}/mobile-joyid-auth?joyidAppURL=${encodeURIComponent(JOYID_URL)}&challenge=${encodeURIComponent(challenge)}`;
      setWebUrl(url);
      setShowWebView(true);
    } catch (e: any) {
      setError(e?.error || "获取挑战失败");
    } finally {
      setLoading(false);
    }
  }

  async function onWebMessage(ev: any) {
    try {
      const data = JSON.parse(ev?.nativeEvent?.data || "{}");
      if (data?.type !== "joyid-auth") throw new Error("无效数据");
      const req: JoyIDAuthRequest = {
        bitDomain: domain || undefined,
        deviceFingerprint: getDeviceFingerprint(),
        signatureData: data.signatureData,
        address: data.address,
      };
      const res = await client.post<AuthResponse>("/auth/joyid", req);
      client.setJWT(res.jwt);
      setShowWebView(false);
      navigation.navigate("Player", { videoId: "demo-video" });
    } catch (e: any) {
      setError(e?.error || e?.message || "登录失败");
      setShowWebView(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>移动端登录（JoyID）</Text>
      <Text>.bit 域名（可选）</Text>
      <TextInput value={domain} onChangeText={setDomain} style={styles.input} />
      <Button title={loading ? "准备中..." : "使用 JoyID 登录"} onPress={startJoyIdLogin} disabled={loading} />
      {error && <Text style={{ color: "red", marginTop: 8 }}>{error}</Text>}

      <Modal visible={showWebView} animationType="slide" onRequestClose={() => setShowWebView(false)}>
        <View style={{ flex: 1 }}>
          <View style={{ height: 48, justifyContent: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
            <Text style={{ fontSize: 16 }}>JoyID 登录</Text>
          </View>
          {webUrl ? (
            <WebView source={{ uri: webUrl }} onMessage={onWebMessage} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text>正在加载...</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 22, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", marginBottom: 12, padding: 8 },
});