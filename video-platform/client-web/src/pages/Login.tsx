// @ts-nocheck
import React, { useState, useEffect } from "react";
import "../styles/fun.css";
import { getApiClient } from "../lib/apiClient";
import type { AuthResponse } from "@video-platform/shared/types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores";
import { initConfig, connect, signChallenge } from "@joyid/ckb";
import { ccc } from "@ckb-ccc/connector-react";

const client = getApiClient();

const joyidURL = (import.meta as any)?.env?.VITE_JOYID_APP_URL || "https://testnet.joyid.dev";
initConfig({
  name: "Nexus Video",
  logo: "https://fav.farm/🎬",
  joyidAppURL: joyidURL,
});

export default function Login() {
  const [domain, setDomain] = useState("");
  const [walletBoundDomain, setWalletBoundDomain] = useState<string>("");
  const [deviceFingerprint] = useState<string>(() => {
    const ua = navigator.userAgent;
    const scr = `${screen.width}x${screen.height}`;
    return btoa(`${ua}|${scr}`);
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [magicStatus, setMagicStatus] = useState<string>("");
  const [magicLinkUrl, setMagicLinkUrl] = useState<string>("");
  const [bitCheck, setBitCheck] = useState<{ status: string; message?: string }>({ status: "idle" });

  // Phone login state
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("86");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const [countryDropOpen, setCountryDropOpen] = useState(false);

  // Email+Password login state
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [epPassword, setEpPassword] = useState("");
  const [epConfirm, setEpConfirm] = useState("");
  const [epIsRegister, setEpIsRegister] = useState(false);
  const [epLoading, setEpLoading] = useState(false);

  // JoyID
  const [joyidInfo, setJoyidInfo] = useState<any>(null);
  const [ckbAddress, setCkbAddress] = useState<string>("");
  const [cccAddress, setCccAddress] = useState<string>("");
  const [cccLoginLoading, setCccLoginLoading] = useState(false);

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { open: openCcc } = ccc.useCcc();
  const signer = ccc.useSigner();

  useEffect(() => {
    if (!signer) {
      setCccAddress("");
      return;
    }
    signer.getRecommendedAddress().then((addr) => setCccAddress(addr ?? "")).catch(() => setCccAddress(""));
  }, [signer]);

  useEffect(() => {
    const d = (domain || "").trim().toLowerCase();
    if (!d) { setBitCheck({ status: "idle", message: "可选" }); return; }
    if (!d.endsWith(".bit")) { setBitCheck({ status: "invalid", message: "请输入 .bit 域名" }); return; }
    setBitCheck({ status: "checking" });
    client.get<{ unique: boolean; registered: boolean }>(`/auth/bit/check?domain=${encodeURIComponent(d)}`)
      .then((r) => {
        if (!r.unique) setBitCheck({ status: "taken", message: "已被使用" });
        else if (r.registered) setBitCheck({ status: "registered", message: "已注册" });
        else setBitCheck({ status: "available", message: "可用" });
      })
      .catch(() => setBitCheck({ status: "error", message: "检查失败" }));
  }, [domain]);

  async function connectWallet() {
    try {
      setError(null);
      setStatusHint("正在连接 JoyID 钱包...");
      const authData = await connect();
      console.log("JoyID connected:", authData);
      setJoyidInfo(authData);
      setCkbAddress(authData.address);
      setStatusHint("");

      // Try to fetch wallet's existing .bit domain via reverse resolution
      try {
        const checkRes = await client.get<{ domain: string | null }>(`/auth/bit/reverse?address=${encodeURIComponent(authData.address)}`);
        if (checkRes?.domain) {
          setWalletBoundDomain(checkRes.domain);
          if (!domain) {
            setDomain(checkRes.domain);
          }
        }
      } catch {
        // Reverse resolution not available, no problem
      }
    } catch (e: any) {
      console.error("Connect error:", e);
      setError(e?.message || "连接失败");
      setStatusHint("");
    }
  }

  async function loginWithJoyID() {
    try {
      setLoginLoading(true);
      setError(null);
      let info = joyidInfo;
      let address = ckbAddress;
      if (!info || !address) {
        setStatusHint("正在连接 JoyID 钱包...");
        info = await connect();
        address = info.address;
        setJoyidInfo(info);
        setCkbAddress(address);
      }
      if (!address) {
        setError("未获取到钱包地址");
        setLoginLoading(false);
        return;
      }
      setStatusHint("获取登录挑战...");
      const { challenge } = await client.get<{ challenge: string }>("/auth/joyid/nonce");
      setStatusHint("请在 JoyID 中完成签名...");
      const signatureData = await signChallenge(challenge, address);
      setStatusHint("验证签名...");
      const req = { bitDomain: domain || undefined, deviceFingerprint, signatureData: { ...signatureData, challenge }, address };
      const res = await client.post<AuthResponse>("/auth/joyid", req);
      client.setJWT(res.jwt);
      sessionStorage.setItem("vp.jwt", res.jwt);
      sessionStorage.setItem("vp.user", JSON.stringify(res.user));
      sessionStorage.setItem("vp.offlineToken", JSON.stringify(res.offlineToken));
      useAuthStore.getState().login(res.jwt, res.user);
      setStatusHint("登录成功！");
      navigate("/home");
    } catch (e: any) {
      const msg = e?.error || e?.message || "登录失败";
      const code = e?.code || "";
      const existingDid = e?.existingDid || "";
      if (code === "did_mismatch") {
        setError(`⚠️ This wallet is already bound to "${existingDid}". Clear the .bit field to use the existing binding, or enter "${existingDid}".`);
        if (existingDid) setWalletBoundDomain(existingDid);
      } else if (code === "did_taken") {
        setError(`⚠️ "${e?.requestedDid || domain}" is already bound to another wallet. Please use a different .bit domain or leave the field empty.`);
      } else if (code === "address_domain_mismatch") {
        setError(`⚠️ The .bit domain "${domain}" resolves to a different address. Clear the field or use the correct domain.`);
      } else if (msg.includes("verify_failed")) {
        setError("Signature verification failed, please try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoginLoading(false);
      setStatusHint("");
    }
  }

  async function loginWithCCC() {
    if (!cccAddress) { setError("请先点击「CCC 钱包」连接钱包"); return; }
    try {
      setCccLoginLoading(true);
      setError(null);
      setStatusHint("获取登录挑战...");
      const { challenge } = await client.get<{ challenge: string }>("/auth/joyid/nonce");
      setStatusHint("验证 CCC 连接...");
      const req = { deviceFingerprint, address: cccAddress, authType: "ccc" as const, bitDomain: (domain || "").trim() || undefined, signatureData: { challenge, message: "ccc-login", signature: "ccc" } };
      const res = await client.post<AuthResponse>("/auth/joyid", req);
      client.setJWT(res.jwt);
      sessionStorage.setItem("vp.jwt", res.jwt);
      sessionStorage.setItem("vp.user", JSON.stringify(res.user));
      sessionStorage.setItem("vp.offlineToken", JSON.stringify(res.offlineToken));
      useAuthStore.getState().login(res.jwt, res.user);
      setStatusHint("登录成功！");
      navigate("/home");
    } catch (e: any) {
      setError(e?.error || e?.message || "CCC 登录失败");
    } finally {
      setCccLoginLoading(false);
      setStatusHint("");
    }
  }

  async function sendMagicLink() {
    try {
      setError(null);
      setMagicStatus("");
      setMagicLinkUrl("");
      const res = await client.post<{ delivered: string; link?: string; token?: string }>("/auth/email/magic/start", { email, deviceFingerprint });
      if (res?.delivered === "dev" && res?.token) {
        const url = `${window.location.origin}/#/magic?token=${encodeURIComponent(res.token)}`;
        setMagicLinkUrl(url);
        setMagicStatus("开发模式：点击下方链接登录");
      } else {
        setMagicStatus(t('auth.loginWithEmail') + " ✓");
      }
    } catch (e: any) {
      setError(e?.error || t('common.error'));
    }
  }

  const checkColor = bitCheck.status === "available" ? "#10b981"
    : bitCheck.status === "registered" ? "#3b82f6"
      : bitCheck.status === "taken" || bitCheck.status === "invalid" ? "#ef4444"
        : "#9ca3af";

  async function emailPasswordAuth() {
    if (!email || !epPassword) return;
    if (epIsRegister && epPassword !== epConfirm) { setError("Passwords do not match"); return; }
    if (epPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    try {
      setEpLoading(true); setError(null);
      const endpoint = epIsRegister ? "/auth/email/register" : "/auth/email/login";
      const resp = await client.post<AuthResponse>(endpoint, { email, password: epPassword, deviceFingerprint });
      if (resp?.jwt) {
        sessionStorage.setItem("vp.jwt", resp.jwt);
        sessionStorage.setItem("vp.user", JSON.stringify(resp.user));
        useAuthStore.getState().login(resp.jwt, resp.user);
        navigate("/home");
      }
    } catch (e: any) {
      setError(e?.error || e?.message || (epIsRegister ? "Registration failed" : "Login failed"));
    } finally {
      setEpLoading(false);
    }
  }

  const COUNTRIES = [
    { code: "86", flag: "🇨🇳", name: "中国大陆 Mainland China" },
    { code: "852", flag: "🇨🇳", name: "中国香港 Hong Kong" },
    { code: "853", flag: "🇨🇳", name: "中国澳门 Macau" },
    { code: "886", flag: "🇨🇳", name: "中国台湾 Taiwan" },
    { code: "81", flag: "🇯🇵", name: "日本 Japan" },
    { code: "82", flag: "🇰🇷", name: "韩国 Korea" },
    { code: "65", flag: "🇸🇬", name: "新加坡 Singapore" },
    { code: "66", flag: "🇹🇭", name: "泰国 Thailand" },
    { code: "84", flag: "🇻🇳", name: "越南 Vietnam" },
    { code: "60", flag: "🇲🇾", name: "马来西亚 Malaysia" },
    { code: "62", flag: "🇮🇩", name: "印尼 Indonesia" },
    { code: "63", flag: "🇵🇭", name: "菲律宾 Philippines" },
    { code: "91", flag: "🇮🇳", name: "印度 India" },
    { code: "1", flag: "🇺🇸", name: "美国 US/CA" },
    { code: "44", flag: "🇬🇧", name: "英国 UK" },
    { code: "49", flag: "🇩🇪", name: "德国 Germany" },
  ];
  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];

  return (
    <div className="flex items-center justify-center min-h-screen font-sans text-white relative overflow-hidden" style={{ backgroundColor: "#050510" }}>
      <style>{`
        .glass-panel { background: rgba(10, 10, 20, 0.6); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .input-nexus { background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); color: white; transition: all 0.3s ease; }
        .input-nexus:focus { outline: none; border-color: rgba(34, 211, 238, 0.5); box-shadow: 0 0 15px rgba(34, 211, 238, 0.2); background: rgba(34, 211, 238, 0.05); }
        .btn-ghost { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); color: #ccc; transition: all 0.3s ease; }
        .btn-ghost:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); color: white; border-color: rgba(255, 255, 255, 0.2); }
        .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-neon { background: linear-gradient(90deg, #22d3ee, #a855f7); color: black; font-weight: 800; border: none; transition: all 0.3s ease; box-shadow: 0 0 15px rgba(168, 85, 247, 0.4); }
        .btn-neon:hover:not(:disabled) { box-shadow: 0 0 25px rgba(34, 211, 238, 0.6); transform: translateY(-1px); }
        .btn-neon:disabled { filter: grayscale(1); opacity: 0.7; cursor: not-allowed; }
        .grid-bg { background-size: 50px 50px; background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px); transform: perspective(500px) rotateX(60deg); transform-origin: top; }
        .login-container { position: relative; z-index: 10; width: 100%; max-width: 440px; border-radius: 20px; border: 1px solid rgba(34, 211, 238, 0.2); }
        .login-container::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, transparent, #22d3ee, #a855f7, transparent); }
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        .animate-scanline { animation: scanline 8s linear infinite; }
        @keyframes pulse-slow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .7; transform: scale(1.05); } }
        .animate-pulse-slow { animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>

      {/* Ambient Sci-Fi Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, rgba(168,85,247,0.15) 0%, rgba(5,5,16,1) 70%)" }}></div>
        <div className="absolute inset-x-0 bottom-0 h-[60vh] grid-bg opacity-30"></div>
        <div className="absolute inset-0 z-10 opacity-10 mix-blend-overlay">
          <div className="w-full h-[5px] bg-[#22d3ee] blur-[2px] animate-scanline"></div>
        </div>
        <div className="absolute top-[20%] left-[20%] w-[300px] h-[300px] bg-[#22d3ee]/20 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] bg-[#a855f7]/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: "2s" }}></div>
      </div>

      {/* Login Container */}
      <div className="login-container glass-panel shadow-[0_0_50px_rgba(34,211,238,0.1)] backdrop-blur-3xl m-4 w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="p-8 pb-6 border-b border-white/5 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-black border border-white/10 shadow-inner mb-4 relative z-10 cursor-pointer" onClick={() => navigate("/home")}>
            <svg className="w-6 h-6 text-[#22d3ee] drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-[0.2em] relative z-10 mb-1">NEXUS PROTOCOL</h1>
          <p className="text-[10px] uppercase font-mono text-gray-400 tracking-widest relative z-10">Secure Access Terminal v2.4</p>
        </div>

        <div className="p-8 pt-6 space-y-6 relative z-10">

          {(statusHint || error) && (
            <div className="text-center text-xs p-3 rounded-lg bg-black/50 border border-white/10">
              {statusHint && <div className="text-gray-300 animate-pulse">{statusHint}</div>}
              {error && <div className="text-red-400 mt-1">{error}</div>}
            </div>
          )}

          {/* 1. Web3 Native Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#22d3ee] animate-pulse"></span>
              <h2 className="text-xs uppercase font-mono font-bold tracking-widest text-[#22d3ee]">Primary Web3 Identity</h2>
            </div>

            {/* .bit Input */}
            <div className="relative">
              <input type="text"
                className="input-nexus w-full rounded-lg py-3 pl-4 pr-16 text-sm font-mono tracking-wider"
                placeholder="yourname.bit (Optional)" value={domain} onChange={(e) => setDomain(e.target.value)} />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border" style={{ color: checkColor, borderColor: `${checkColor}40`, backgroundColor: `${checkColor}1A` }}>
                  {bitCheck.message || "Optional"}
                </span>
              </div>
              {walletBoundDomain && !domain && (
                <div className="mt-1 text-[10px] font-mono text-cyan-400/70 flex items-center gap-1">
                  <span>💡 This wallet was previously bound to</span>
                  <button className="text-cyan-400 underline cursor-pointer bg-transparent border-none p-0 font-mono text-[10px]" onClick={() => setDomain(walletBoundDomain)}>{walletBoundDomain}</button>
                </div>
              )}
            </div>

            {/* Wallet Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-lg">🔑</div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-gray-400 uppercase">CKB Layer 1 Node</span>
                  <span className="text-xs font-mono font-bold tracking-wider" style={{ color: ckbAddress ? "#22d3ee" : "#6b7280" }}>
                    {ckbAddress ? `${ckbAddress.slice(0, 8)}...${ckbAddress.slice(-6)}` : "AWAITING CONNECTION..."}
                  </span>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full" style={{ background: ckbAddress ? "#22d3ee" : "#4b5563", boxShadow: ckbAddress ? "0 0 10px #22d3ee" : "none" }}></div>
            </div>

            {/* JoyID Actions */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={connectWallet} disabled={loginLoading}
                className="btn-ghost py-3 rounded-lg text-xs font-bold font-sans uppercase tracking-wider flex items-center justify-center gap-2">
                {ckbAddress ? "Switch Wallet" : "Connect Wallet"}
              </button>
              <button onClick={loginWithJoyID} disabled={loginLoading}
                className="btn-neon py-3 rounded-lg text-xs font-bold font-sans uppercase tracking-wider flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
                Passkey Login
              </button>
            </div>

            {/* CCC Action */}
            <button onClick={() => { if (!cccAddress) openCcc(); else loginWithCCC(); }} disabled={cccLoginLoading || loginLoading}
              className="w-full btn-ghost py-2 rounded-lg text-[10px] font-mono text-gray-400 uppercase tracking-widest hover:text-white mt-2">
              {!cccAddress ? "Connect Any CCC Compatible Wallet" : (cccLoginLoading ? "Logging in..." : `Login with CCC: ${cccAddress.slice(0, 10)}...`)}
            </button>
          </div>

          <div className="flex items-center gap-4 opacity-40">
            <div className="h-px bg-white/20 flex-1"></div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-center text-white">EVM Bridges</span>
            <div className="h-px bg-white/20 flex-1"></div>
          </div>

          {/* 2. EVM & Decentralized Identity */}
          <div className="grid grid-cols-3 gap-3">
            <button disabled={loginLoading} onClick={async () => {
              try {
                setError(null); setStatusHint(t('auth.connectingMetaMask'));
                const { connectWallet } = await import("../lib/walletConnect");
                const result = await connectWallet('injected');
                const resp = await client.post<AuthResponse>("/auth/ethereum", { address: result.address, chainId: result.chainId });
                if (resp.jwt) {
                  sessionStorage.setItem("vp.jwt", resp.jwt);
                  sessionStorage.setItem("vp.user", JSON.stringify({ address: result.address, chainId: result.chainId }));
                  useAuthStore.getState().login(resp.jwt, { id: result.address, ckbAddress: result.address });
                  navigate("/home");
                }
              } catch (e: any) { setError(e?.message || "MetaMask failed"); setStatusHint(""); }
            }} className="btn-ghost py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 group">
              <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" className="w-5 h-5 group-hover:scale-110 transition-transform" />
              MetaMask
            </button>
            <button disabled={loginLoading} onClick={async () => {
              try {
                setError(null); setStatusHint("Connecting WalletConnect");
                const { connectWallet } = await import("../lib/walletConnect");
                const result = await connectWallet('walletConnect');
                const resp = await client.post<AuthResponse>("/auth/ethereum", { address: result.address, chainId: result.chainId });
                if (resp.jwt) {
                  sessionStorage.setItem("vp.jwt", resp.jwt);
                  sessionStorage.setItem("vp.user", JSON.stringify({ address: result.address, chainId: result.chainId }));
                  useAuthStore.getState().login(resp.jwt, { id: result.address, ckbAddress: result.address });
                  navigate("/home");
                }
              } catch (e: any) { setError(e?.message || "WalletConnect failed"); setStatusHint(""); }
            }} className="btn-ghost py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 group">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                <span className="text-white text-[10px] font-black">W</span>
              </div>
              WalletConnect
            </button>
            <button disabled={loginLoading} onClick={async () => {
              try {
                setError(null); setStatusHint("Connecting Nostr...");
                const { loginWithNostr } = await import("../lib/nostrAuth");
                const result = await loginWithNostr();
                if (result.jwt) {
                  sessionStorage.setItem("vp.jwt", result.jwt);
                  sessionStorage.setItem("vp.user", JSON.stringify(result.user || {}));
                  useAuthStore.getState().login(result.jwt, result.user);
                  navigate("/home");
                }
              } catch (e: any) { setError(e?.message || "Nostr login failed"); setStatusHint(""); }
            }} className="btn-ghost py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 group">
              <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                <span className="text-white text-[10px] font-black">N</span>
              </div>
              Nostr
            </button>
          </div>

          <div className="flex items-center gap-4 opacity-40">
            <div className="h-px bg-white/20 flex-1"></div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-center text-white">Legacy Auth</span>
            <div className="h-px bg-white/20 flex-1"></div>
          </div>

          {/* 3. Traditional Methods */}
          <div className="space-y-3">
            <div className="relative group">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="input-nexus w-full rounded-lg py-3 pl-4 pr-24 text-sm tracking-wide bg-black/40"
                placeholder="name@example.com" />
              <button onClick={sendMagicLink} disabled={!email}
                className="absolute right-1 top-1 bottom-1 px-4 bg-white/5 hover:bg-white/10 text-xs font-bold rounded text-gray-300 transition-colors uppercase tracking-wider">
                Send Link
              </button>
            </div>
            {magicStatus && <div className="text-xs text-[#22d3ee] p-2 bg-[#22d3ee]/10 rounded border border-[#22d3ee]/20 text-center">{magicStatus}</div>}
            {magicLinkUrl && <div className="text-xs text-center"><a href={magicLinkUrl} className="text-[#a855f7] hover:underline">点击进行开发模式登录</a></div>}

            {/* Email+Password Toggle */}
            <button onClick={() => setShowEmailPassword(!showEmailPassword)}
              className="w-full text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-widest py-1">
              {showEmailPassword ? "▲ Hide Password Login" : "▼ Login with Password"}
            </button>

            {showEmailPassword && (
              <div className="bg-black/40 border border-white/5 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-gray-400 uppercase">{epIsRegister ? "Create Account" : "Sign In"}</span>
                  <button onClick={() => setEpIsRegister(!epIsRegister)} className="text-[10px] font-mono text-[#a855f7] hover:underline bg-transparent border-none cursor-pointer">
                    {epIsRegister ? "Already have account?" : "Create new account"}
                  </button>
                </div>
                <input type="password" value={epPassword} onChange={e => setEpPassword(e.target.value)}
                  className="input-nexus w-full rounded py-2.5 px-3 text-sm" placeholder="Password" />
                {epIsRegister && (
                  <>
                    <input type="password" value={epConfirm} onChange={e => setEpConfirm(e.target.value)}
                      className="input-nexus w-full rounded py-2.5 px-3 text-sm" placeholder="Confirm Password" />
                    {/* Password Strength */}
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{
                          backgroundColor: epPassword.length >= i * 3
                            ? i <= 1 ? '#ef4444' : i <= 2 ? '#f59e0b' : i <= 3 ? '#22d3ee' : '#10b981'
                            : 'rgba(255,255,255,0.1)'
                        }} />
                      ))}
                    </div>
                  </>
                )}
                <button onClick={emailPasswordAuth} disabled={epLoading || !email || !epPassword}
                  className="w-full btn-neon py-2.5 rounded text-xs font-bold uppercase tracking-wider">
                  {epLoading ? "..." : epIsRegister ? "Create Account" : "Sign In"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button disabled={loginLoading} onClick={async () => {
                try {
                  setError(null); setStatusHint("Connecting Twitter...");
                  const resp = await client.get<{ authUrl: string }>(`/auth/twitter/start?dfp=${encodeURIComponent(deviceFingerprint)}`);
                  if (resp.authUrl) window.location.href = resp.authUrl;
                } catch (e: any) { setError(e?.message || "Twitter failed"); setStatusHint(""); }
              }} className="btn-ghost py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 group text-gray-400">
                <svg className="w-4 h-4 text-white group-hover:drop-shadow-[0_0_5px_white]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 5.925H5.022z" />
                </svg>
                Twitter/X
              </button>
              <button disabled={loginLoading} onClick={async () => {
                try {
                  setError(null); setStatusHint("Connecting Google...");
                  const resp = await client.get<{ authUrl: string }>(`/auth/google/start?dfp=${encodeURIComponent(deviceFingerprint)}`);
                  if (resp.authUrl) window.location.href = resp.authUrl;
                } catch (e: any) { setError(e?.message || "Google failed"); setStatusHint(""); }
              }} className="btn-ghost py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 group text-gray-400">
                <svg className="w-4 h-4 text-white group-hover:drop-shadow-[0_0_5px_white]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                </svg>
                Google
              </button>
            </div>

            <button onClick={() => setShowPhoneLogin(!showPhoneLogin)} className="w-full btn-ghost py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 text-gray-400 group">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
              Continue with Phone Number
            </button>

            {showPhoneLogin && (
              <div className="bg-black/40 border border-white/5 rounded-lg p-4 space-y-3 mt-2">
                <div className="flex gap-2 relative">
                  <button onClick={() => setCountryDropOpen(!countryDropOpen)} className="btn-ghost px-3 rounded flex items-center gap-1 text-sm bg-black/60">
                    <span className="text-lg">{selectedCountry.flag}</span>
                    <span className="text-xs text-gray-400">+{selectedCountry.code}</span>
                  </button>
                  {countryDropOpen && (
                    <div className="absolute top-full left-0 mt-1 w-[280px] max-h-48 overflow-y-auto bg-gray-900 border border-gray-700 rounded z-50 shadow-xl">
                      {COUNTRIES.map(c => (
                        <div key={c.code} onClick={() => { setCountryCode(c.code); setCountryDropOpen(false); }} className="px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/10 cursor-pointer">
                          <span className="text-lg">{c.flag}</span>
                          <span className="flex-1 text-gray-300">{c.name}</span>
                          <span className="text-gray-500 font-mono">+{c.code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))} className="input-nexus flex-1 rounded px-3 py-2 text-sm" placeholder="13800138000" onFocus={() => setCountryDropOpen(false)} />
                </div>

                {!phoneSent ? (
                  <button disabled={!phoneNumber || phoneNumber.length < 5 || phoneLoading} onClick={async () => {
                    try {
                      setPhoneLoading(true); setError(null);
                      const resp = await client.post<{ code?: string }>("/auth/phone/start", { phone: `+${countryCode}${phoneNumber}`, countryCode, deviceFingerprint });
                      setPhoneSent(true); setPhoneCountdown(60);
                      if (resp.code) setPhoneCode(resp.code);
                      const timer = setInterval(() => { setPhoneCountdown(c => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; }); }, 1000);
                    } catch (e: any) { setError(e?.message || e?.error || 'Failed to send code'); } finally { setPhoneLoading(false); }
                  }} className="w-full btn-neon py-2 rounded text-xs font-bold uppercase tracking-wider">
                    {phoneLoading ? "..." : "Send Verification Code"}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <input type="text" maxLength={6} value={phoneCode} onChange={e => setPhoneCode(e.target.value.replace(/\D/g, ''))} className="input-nexus w-full rounded py-2 text-center tracking-[0.5em] font-mono font-bold" placeholder="000000" />
                    <div className="flex gap-2">
                      <button disabled={phoneCountdown > 0} onClick={() => { setPhoneSent(false); setPhoneCode(""); }} className="flex-1 btn-ghost py-2 rounded text-[10px] font-bold uppercase">
                        {phoneCountdown > 0 ? `Resend (${phoneCountdown}s)` : "Resend"}
                      </button>
                      <button disabled={phoneCode.length < 4 || phoneLoading} onClick={async () => {
                        try {
                          setPhoneLoading(true); setError(null);
                          const resp = await client.post<any>("/auth/phone/verify", { phone: `+${countryCode}${phoneNumber}`, code: phoneCode });
                          if (resp.jwt) { sessionStorage.setItem("vp.jwt", resp.jwt); sessionStorage.setItem("vp.user", JSON.stringify(resp.user)); useAuthStore.getState().login(resp.jwt, resp.user); navigate("/home"); }
                        } catch (e: any) { setError(e?.message || e?.error || 'Verification failed'); } finally { setPhoneLoading(false); }
                      }} className="flex-1 btn-neon py-2 rounded text-[10px] font-bold uppercase">
                        {phoneLoading ? "..." : "Verify & Login"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/60 border-t border-white/5 text-center text-[9px] font-mono text-gray-500 uppercase tracking-widest font-bold">
          Entering the Nexus binds you to the <a href="#" className="text-[#22d3ee] hover:underline hover:drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">Protocol Mandates</a>
        </div>
      </div>
    </div>
  );
}