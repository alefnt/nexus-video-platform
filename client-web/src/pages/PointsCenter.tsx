// @ts-nocheck
import React, { useEffect, useState } from "react";
import "../styles/fun.css";
import { getApiClient } from "../lib/apiClient";
import type { PointsBalance, USDIBalance, CKBBalance, FiberInvoiceCreateResponse, FiberInvoiceStatusResponse, PointsTransaction, CkbPurchaseIntentResponse, CkbIntentStatusResponse } from "@video-platform/shared/types";
import { initConfig, connect, signTransaction } from "@joyid/ckb";
import { ccc } from "@ckb-ccc/connector-react";
import { Buffer as BufferPolyfill } from "buffer";
import { useNavigate } from "react-router-dom";
const OnRampWidget = React.lazy(() => import("../components/OnRampWidget"));
const OffRampWidget = React.lazy(() => import("../components/OffRampWidget"));

if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = BufferPolyfill;
}

if (typeof (BigInt.prototype as any).toJSON === "undefined") {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

const joyidURL = (import.meta as any)?.env?.VITE_JOYID_APP_URL || "https://testnet.joyid.dev";
initConfig({
  name: "Nexus Video",
  logo: "https://fav.farm/🎬",
  joyidAppURL: joyidURL,
});

function padHexBytes(val: any, bytes: number) {
  let s = typeof val === "string" ? val : String(val ?? "0x0");
  if (!s.startsWith("0x")) s = "0x" + s;
  let h = s.slice(2);
  if (h.length % 2 === 1) h = "0" + h;
  if (h === "" || /^0+$/i.test(h)) h = "";
  while (h.length < bytes * 2) h = "0" + h;
  if (h.length > bytes * 2) h = h.slice(-bytes * 2);
  return "0x" + h;
}

function packLEHexBytes(val: any, bytes: number) {
  try {
    if (typeof val === "string") {
      let s0 = val.trim();
      if (!s0.startsWith("0x")) s0 = "0x" + s0;
      let h0 = s0.slice(2).toLowerCase();
      if (h0.length % 2 === 1) h0 = "0" + h0;
      if (h0.length === bytes * 2) return "0x" + h0;
    }
    let n: bigint;
    if (typeof val === "bigint") n = val;
    else if (typeof val === "number") n = BigInt(val);
    else {
      let s = String(val ?? "0x0").trim();
      if (!s) s = "0";
      if (s.startsWith("0x") || s.startsWith("0X")) n = BigInt(s);
      else n = BigInt(s);
    }
    const parts: string[] = [];
    for (let i = 0; i < bytes; i++) {
      const b = Number((n >> BigInt(i * 8)) & 0xffn);
      parts.push(b.toString(16).padStart(2, "0"));
    }
    return "0x" + parts.join("");
  } catch {
    return "0x" + new Array(bytes).fill("00").join("");
  }
}

function toRpcScript(s: any) {
  if (!s) return undefined;
  return { code_hash: s.code_hash ?? s.codeHash, hash_type: s.hash_type ?? s.hashType, args: s.args };
}
function toJoyidScript(s: any) {
  if (!s) return undefined;
  return { codeHash: s.codeHash ?? s.code_hash, hashType: s.hashType ?? s.hash_type, args: s.args ?? "0x" };
}

function canonicalHex(val: any) {
  let s = typeof val === "string" ? val : String(val ?? "0x0");
  if (!s.startsWith("0x")) s = "0x" + s;
  let h = s.slice(2).replace(/^0+/i, "");
  if (h === "") h = "0";
  return "0x" + h.toLowerCase();
}

// Canonical even-length hex (pad odd digits with leading 0)
function canonicalEvenHex(val: any) {
  const s = canonicalHex(val);
  const h = s.slice(2);
  return h.length % 2 === 1 ? ("0x0" + h) : s;
}
function canonicalUint32(val: any) { return packLEHexBytes(val, 4); }
function canonicalUint64(val: any) { return packLEHexBytes(val, 8); }
function minimalUint32(val: any) { return canonicalHex(val); }

// WitnessArgs serialization helper for JoyID
function createWitnessArgsPlaceholder(lockSize: number): string {
  const totalSize = 16 + 4 + lockSize;
  const lockOffset = 16;
  const inputTypeOffset = lockOffset + 4 + lockSize;
  const outputTypeOffset = inputTypeOffset;
  const hexBytes: string[] = [];
  const writeU32LE = (val: number) => {
    hexBytes.push(
      (val & 0xff).toString(16).padStart(2, '0'),
      ((val >> 8) & 0xff).toString(16).padStart(2, '0'),
      ((val >> 16) & 0xff).toString(16).padStart(2, '0'),
      ((val >> 24) & 0xff).toString(16).padStart(2, '0')
    );
  };
  writeU32LE(totalSize);
  writeU32LE(lockOffset);
  writeU32LE(inputTypeOffset);
  writeU32LE(outputTypeOffset);
  writeU32LE(lockSize);
  for (let i = 0; i < lockSize; i++) hexBytes.push('00');
  return '0x' + hexBytes.join('');
}

// Convert RPC snake_case TX to JoyID camelCase format
function toJoyidTx(tx: any) {
  if (!tx || typeof tx !== "object") {
    return { version: "0x00000000", cellDeps: [], headerDeps: [], inputs: [], outputs: [], outputsData: [], witnesses: [] };
  }
  const rawInputs = Array.isArray(tx.inputs) ? tx.inputs : [];
  const inputs = rawInputs.map((i: any) => {
    const prevOut = i?.previous_output || i?.previousOutput || {};
    return {
      previousOutput: {
        txHash: prevOut?.tx_hash || prevOut?.txHash || "0x" + "0".repeat(64),
        index: minimalUint32(prevOut?.index ?? "0x0")
      },
      since: canonicalUint64(i?.since ?? "0x0"),
    };
  });
  const rawOutputs = Array.isArray(tx.outputs) ? tx.outputs : [];
  const outputs = rawOutputs.map((o: any) => {
    const lock = o?.lock || {};
    const result: any = {
      capacity: canonicalEvenHex(o?.capacity ?? "0x0"),
      lock: {
        codeHash: lock?.codeHash || lock?.code_hash || "0x" + "0".repeat(64),
        hashType: lock?.hashType || lock?.hash_type || "type",
        args: lock?.args || "0x"
      }
    };
    if (o?.type) {
      result.type = toJoyidScript(o.type);
    }
    return result;
  });
  let outputsData = tx?.outputs_data ?? tx?.outputsData ?? [];
  if (!Array.isArray(outputsData)) outputsData = [];
  while (outputsData.length < outputs.length) outputsData.push("0x");
  outputsData = outputsData.slice(0, outputs.length);
  let witnesses = tx?.witnesses ?? [];
  if (!Array.isArray(witnesses)) witnesses = [];
  while (witnesses.length < inputs.length) witnesses.push("0x");
  if (inputs.length > 0 && (!witnesses[0] || witnesses[0] === "0x" || witnesses[0].length < 20)) {
    witnesses[0] = createWitnessArgsPlaceholder(65);
  }
  const rawCellDeps = tx?.cell_deps ?? tx?.cellDeps ?? [];
  const cellDeps = Array.isArray(rawCellDeps) ? rawCellDeps.map((d: any) => {
    const outPoint = d?.out_point || d?.outPoint || {};
    const rawDepType = d?.dep_type || d?.depType || "code";
    const depType = rawDepType === "dep_group" ? "depGroup" : (rawDepType === "depGroup" ? "depGroup" : "code");
    return {
      outPoint: {
        txHash: outPoint?.tx_hash || outPoint?.txHash || "0x" + "0".repeat(64),
        index: minimalUint32(outPoint?.index ?? "0x0")
      },
      depType
    };
  }) : [];
  const headerDeps = Array.isArray(tx?.header_deps ?? tx?.headerDeps) ? (tx?.header_deps ?? tx?.headerDeps) : [];
  return { version: packLEHexBytes(tx?.version ?? "0x0", 4), cellDeps, headerDeps, inputs, outputs, outputsData, witnesses };
}

function toRpcTx(tx: any) {
  const inputs = Array.isArray(tx?.inputs) ? tx.inputs.map((i: any) => ({
    previous_output: { tx_hash: i?.previousOutput?.txHash ?? i?.previous_output?.tx_hash, index: canonicalHex(i?.previousOutput?.index ?? i?.previous_output?.index ?? "0x0") },
    since: canonicalHex(i?.since ?? "0x0"),
  })) : [];
  const outputs = Array.isArray(tx?.outputs) ? tx.outputs.map((o: any) => ({
    capacity: canonicalHex(o?.capacity ?? "0x0"),
    lock: toRpcScript(o?.lock),
    ...(o?.type ? { type: toRpcScript(o?.type) } : {}),
  })) : [];
  const outputs_data = Array.isArray(tx?.outputsData ?? tx?.outputs_data) ? (tx?.outputsData ?? tx?.outputs_data) : new Array(outputs.length).fill("0x");
  const witnesses = Array.isArray(tx?.witnesses) ? tx.witnesses : new Array(inputs.length).fill("0x");
  const cell_deps = Array.isArray(tx?.cellDeps ?? tx?.cell_deps) ? (tx?.cellDeps ?? tx?.cell_deps).map((d: any) => {
    const rawDepType = d?.depType ?? d?.dep_type ?? "code";
    const dep_type = rawDepType === "depGroup" ? "dep_group" : rawDepType;
    return {
      out_point: { tx_hash: d?.outPoint?.txHash ?? d?.out_point?.tx_hash, index: canonicalHex(d?.outPoint?.index ?? d?.out_point?.index ?? "0x0") },
      dep_type,
    };
  }) : [];
  const header_deps = tx?.headerDeps ?? tx?.header_deps ?? [];
  return { version: canonicalHex(tx?.version ?? "0x0"), cell_deps, header_deps, inputs, outputs, outputs_data, witnesses };
}

// Hex validation utilities
function isHex(str: any) { return typeof str === "string" && /^0x[0-9a-fA-F]*$/.test(str); }
function isHexOfBytes(str: any, bytes: number) {
  if (!isHex(str)) return false;
  return String(str).slice(2).length === bytes * 2;
}
function isEvenHex(str: any) {
  if (!isHex(str)) return false;
  return String(str).slice(2).length % 2 === 0;
}

const client = getApiClient();

export default function PointsCenter() {
  const navigate = useNavigate();
  const [points, setPoints] = useState<PointsBalance | null>(null);
  const [usdi, setUsdi] = useState<USDIBalance | null>(null);
  const [ckb, setCkb] = useState<CKBBalance | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [earnAmt, setEarnAmt] = useState<string>("100");
  const [buyAmt, setBuyAmt] = useState<string>("0.10");
  const [buyAmtCKB, setBuyAmtCKB] = useState<string>("100");
  const [earnLoading, setEarnLoading] = useState(false);
  const [buyPointsLoading, setBuyPointsLoading] = useState(false);
  const [ckbOrderLoading, setCkbOrderLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [joyidEnabled, setJoyidEnabled] = useState<boolean>(() => {
    const hasWindow = typeof window !== "undefined";
    const stored = hasWindow ? localStorage.getItem("vp.pointsJoyid") : null;
    if (stored !== null) return stored === "1";
    const envDefault = (((import.meta as any)?.env?.VITE_ENABLE_REAL_POINTS_BUY) || "").toString().toLowerCase();
    return envDefault === "true" || envDefault === "1";
  });
  const [currency, setCurrency] = useState<"USDI" | "CKB">("USDI");
  const [fiberAsset, setFiberAsset] = useState<"USDI" | "CKB">("USDI");
  const [fiberAmount, setFiberAmount] = useState<number>(0);
  const [fiberInvoice, setFiberInvoice] = useState<FiberInvoiceCreateResponse | null>(null);
  const [fiberStatus, setFiberStatus] = useState<FiberInvoiceStatusResponse | null>(null);
  const [fiberBusy, setFiberBusy] = useState(false);
  const [fiberMsg, setFiberMsg] = useState("");
  const [autoPollEnabled] = useState<boolean>(true);
  const [autoPollIntervalSec] = useState<number>(7);
  const [ckbIntent, setCkbIntent] = useState<any | null>(null);
  const [ckbTxHash, setCkbTxHash] = useState<string>("");
  const [joyidPaying, setJoyidPaying] = useState<boolean>(false);
  const [joyidPayMsg, setJoyidPayMsg] = useState<string>("");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [ledgerTxns, setLedgerTxns] = useState<PointsTransaction[]>([]);
  const [redeemId, setRedeemId] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [showOnRamp, setShowOnRamp] = useState(false);
  const [showOffRamp, setShowOffRamp] = useState(false);
  const [hideBalances, setHideBalances] = useState<boolean>(() => {
    try {
      const v = typeof window !== "undefined" ? localStorage.getItem("vp.hideBalances") : null;
      if (v === "0") return false; if (v === "1") return true;
    } catch { }
    return true;
  });

  async function redeemById() {
    if (!redeemId) return;
    try {
      setRedeemLoading(true);
      await client.post("/payment/redeem", { intentId: redeemId });
      alert("Redeemed successfully");
    } catch (e: any) {
      alert("Redeem failed: " + (e?.message || e?.error));
    } finally {
      setRedeemLoading(false);
    }
  }

  const { open, signer } = ccc.useCcc();
  const [ckbAddress, setCkbAddress] = useState<string>("");

  useEffect(() => {
    const hasInvoice = !!fiberInvoice?.invoiceId;
    const paid = fiberStatus?.status === "paid";
    if (!hasInvoice || paid || !autoPollEnabled) return;
    const interval = Math.max(5, Math.min(10, Number(autoPollIntervalSec) || 7));
    const timer = setInterval(async () => {
      try {
        const status = await client.post<FiberInvoiceStatusResponse>("/payment/fiber/invoice/status", { invoiceId: fiberInvoice?.invoiceId });
        setFiberStatus(status);
        if (status?.status === "paid") {
          if (typeof (status as any)?.creditedPoints === "number") {
            setFiberMsg(`已支付，已入账 +${(status as any).creditedPoints} 积分`);
          } else {
            setFiberMsg("已支付（此前可能已入账）");
          }
          await refreshAll();
        }
      } catch (_e) { }
    }, interval * 1000);
    return () => clearInterval(timer);
  }, [autoPollEnabled, autoPollIntervalSec, fiberInvoice?.invoiceId, fiberStatus?.status]);

  useEffect(() => {
    const usrRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
    if (usrRaw) {
      try {
        const usr = JSON.parse(usrRaw);
        if (usr?.ckbAddress) {
          setCkbAddress(usr.ckbAddress);
          return;
        }
      } catch { }
    }
    if (signer) {
      signer.getAddresses().then(addrs => {
        if (addrs.length > 0) setCkbAddress(addrs[0]);
      }).catch(() => setCkbAddress(""));
    } else {
      setCkbAddress("");
    }
  }, [signer]);

  const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
  if (jwt) client.setJWT(jwt);

  useEffect(() => {
    if (joyidEnabled) {
      const joyidURL = (import.meta as any)?.env?.VITE_JOYID_APP_URL || "https://testnet.joyid.dev";
      initConfig({ name: "Video Platform", logo: "https://fav.farm/🎬", joyidAppURL: joyidURL });
    }
  }, [joyidEnabled]);

  useEffect(() => { refreshAll(); }, []);

  async function refreshAll() {
    setLoading(true);
    try { await Promise.all([loadPoints(), loadUSDI(), loadCKB(), loadLedgerTxns()]); } finally { setLoading(false); }
  }

  async function loadPoints() { try { const bal = await client.get<PointsBalance>("/payment/points/balance"); setPoints(bal); } catch { } }
  async function loadUSDI() { try { const bal = await client.get<USDIBalance>("/payment/usdi/balance"); setUsdi(bal); } catch { } }
  async function loadCKB() { try { const bal = await client.get<CKBBalance>("/payment/ckb/balance"); setCkb(bal); } catch { } }
  async function loadLedgerTxns() { try { const res = await client.get<{ txns: PointsTransaction[] }>("/payment/points/ledger/me"); setLedgerTxns(Array.isArray(res?.txns) ? res.txns : []); } catch { } }
  function copyToClipboard(text: string) { try { navigator.clipboard.writeText(text); } catch { } }
  function toggleBalances() {
    setHideBalances((prev) => {
      const next = !prev;
      try { localStorage.setItem("vp.hideBalances", next ? "1" : "0"); } catch { }
      return next;
    });
  }

  async function earnPoints() {
    setError(null);
    const amt = earnAmt.trim();
    if (!/^\d+$/.test(amt)) { setError("请输入正确的积分数量（整数）"); return; }
    if (!jwt) { setError("请先登录后再领取积分"); return; }
    try {
      setEarnLoading(true);
      const res = await client.post<{ amount: number }>("/payment/points/earn", { amount: parseInt(amt, 10) });
      await refreshAll();
      alert(`领取成功，获得 ${res?.amount ?? ""} 积分`);
    } catch (e: any) { setError(String(e?.message || e?.error || '领取积分失败')); } finally { setEarnLoading(false); }
  }

  async function buyPoints() {
    setError(null);
    const amt = buyAmt.trim();
    if (!/^\d+(?:\.\d{1,6})?$/.test(amt)) { setError("请输入正确的 USDI 金额（最多 6 位小数）"); return; }
    try {
      setBuyPointsLoading(true);
      const usrRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
      const usr = usrRaw ? JSON.parse(usrRaw) : null;
      const address = usr?.ckbAddress || "";
      if (joyidEnabled && !address) { setError("请先在登录页使用 JoyID 登录后再购买积分"); return; }
      const res = await client.post<{ creditedPoints?: number }>("/payment/points/buy", { usdiAmount: amt, address });
      await refreshAll();
      alert(`购买成功，获得 ${res?.creditedPoints ?? ""} 积分`);
    } catch (e: any) { setError(e?.error || e?.message || "购买积分失败"); } finally { setBuyPointsLoading(false); }
  }

  async function buyPointsByCKB() {
    setError(null);
    const amt = buyAmtCKB.trim();
    if (!/^\d+(?:\.\d{1,8})?$/.test(amt)) { setError("请输入正确的 CKB 金额（最多 8 位小数）"); return; }
    if (joyidEnabled && !ckbAddress) { setError("请先登录 JoyID"); return; }
    try {
      setCkbOrderLoading(true);
      let payerAddress = (joyidEnabled && ckbAddress) ? ckbAddress : undefined;
      const intent = await client.post<CkbPurchaseIntentResponse>("/payment/ckb/purchase_intent", { ckbAmount: amt, payerAddress });
      setCkbIntent(intent);
      setCkbTxHash("");
      if (joyidEnabled) {
        if (!signer) { setError("请先在登录页面连接钱包后再购买"); return; }
        setJoyidPayMsg("已创建订单，准备发起付款...");
        startJoyIDPaymentRecommendedInner();
      } else {
        alert(`订单已创建：请向 ${intent.depositAddress} 转账 ${intent.expectedAmountCKB} CKB`);
      }
    } catch (e: any) { setError(e?.error || e?.message || "创建购买订单失败"); } finally { setCkbOrderLoading(false); }
  }

  async function confirmCkbPurchase() {
    const intentId = ckbIntent?.orderId || "";
    if (!intentId) { setError("缺少订单ID"); return; }
    try {
      setConfirmLoading(true);
      const status = await client.get<CkbIntentStatusResponse | { status: string; creditedPoints?: number }>(`/payment/ckb/intent/${intentId}`);
      if (status?.status === "confirmed") { alert(`已入账：+${status?.creditedPoints} 积分`); await refreshAll(); }
      else { alert("尚未确认，请稍后再试"); }
    } catch (e: any) { setError(String(e?.message || e?.error || "查询失败")); } finally { setConfirmLoading(false); }
  }

  async function handleWithdraw() {
    if (!withdrawAmt || isNaN(Number(withdrawAmt)) || Number(withdrawAmt) <= 0) { alert("请输入有效的提现积分数量"); return; }
    const amt = Math.floor(Number(withdrawAmt));
    const balance = points?.balance ?? (points as any)?.points ?? 0;
    if (amt > balance) { alert("余额不足"); return; }
    const estimatedCKB = Math.floor(amt / 10000);
    if (!confirm(`确认提现 ${amt} 积分？\n预计到账: ${estimatedCKB} CKB (直接转入您的 JoyID 钱包)\n\n注意：此操作不可撤销。`)) return;
    try {
      setWithdrawing(true);
      const res = await client.post<{ ok: boolean; receivedCKB: number; txHash: string }>("/payment/withdraw", { amountPoints: amt });
      if (res.ok) {
        alert(`提现成功！\n已发送: ${res.receivedCKB} CKB\n交易哈希: ${res.txHash}`);
        setShowWithdrawModal(false); setWithdrawAmt(""); refreshAll();
      }
    } catch (e: any) { alert(e?.error || e?.message || "提现失败"); } finally { setWithdrawing(false); }
  }

  const startJoyIDPaymentRecommendedInner = async () => {
    try {
      setJoyidPaying(true); setJoyidPayMsg("正在准备交易，请稍候..");
      const raw = String(buyAmtCKB ?? "").trim();
      const parts = raw.split(".");
      if (parts[1] && parts[1].length > 8) { setError("CKB 金额最多支持 8 位小数"); setJoyidPaying(false); return; }

      let fromAddress = ckbAddress;
      if (!fromAddress) {
        try { const u = JSON.parse(sessionStorage.getItem("vp.user") || "{}"); fromAddress = u?.ckbAddress || ""; } catch { }
      }
      if (!fromAddress) { setError("未检测到钱包地址，请先登录 JoyID"); setJoyidPaying(false); return; }

      setJoyidPayMsg("正在创建订单...");
      const intentResp = await client.post<CkbPurchaseIntentResponse & { error?: string }>("/payment/ckb/purchase_intent", { ckbAmount: raw, payerAddress: fromAddress });
      if (!intentResp || intentResp?.error) { setError(intentResp?.error || "创建订单失败"); setJoyidPaying(false); return; }

      const amountShannons = BigInt(Math.floor(Number(intentResp.expectedAmountCKB || raw) * 1e8)).toString();
      setJoyidPayMsg("请在 JoyID 中确认签名...");

      const signedTx = await signTransaction({ to: intentResp.depositAddress, from: fromAddress, amount: amountShannons });
      setJoyidPayMsg("正在广播交易...");

      const sendResp = await client.post<{ txHash?: string; error?: string }>("/payment/ckb/send_tx", { orderId: intentResp.orderId, tx: toRpcTx(signedTx) });
      if (sendResp?.error) { setError(sendResp.error); setJoyidPaying(false); return; }

      if (sendResp?.txHash) setCkbTxHash(sendResp.txHash);
      setJoyidPayMsg("交易已广播，正在确认入账...");

      try {
        const confirmResp = await client.post<{ ok?: boolean; creditedPoints?: number }>("/payment/ckb/confirm_tx", { orderId: intentResp.orderId, txHash: sendResp!.txHash });
        if (confirmResp?.ok) alert(`支付成功！获得 ${confirmResp.creditedPoints} 积分\n交易哈希: ${sendResp!.txHash}`);
        else alert(`交易已广播，积分将稍后入账\n交易哈希: ${sendResp!.txHash}`);
      } catch (e) { alert(`交易已广播，积分将在确认后入账\n交易哈希: ${sendResp!.txHash}`); }

      setJoyidPayMsg(""); setJoyidPaying(false); refreshAll();
    } catch (e: any) {
      const msg = e?.message || e?.error || "";
      if (msg.includes("cancel") || msg.includes("reject") || msg.includes("denied")) setError("用户取消了签名");
      else setError(msg || "JoyID 付款失败");
      setJoyidPayMsg(""); setJoyidPaying(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-white font-sans bg-[#050510] relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-x-0 bottom-0 h-[60vh] opacity-20" style={{ backgroundImage: "linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)", backgroundSize: "40px 40px", transform: "perspective(500px) rotateX(60deg)", transformOrigin: "top" }}></div>
        <div className="absolute top-[10%] left-[10%] w-[400px] h-[400px] bg-[#22d3ee]/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-[#a855f7]/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: "2s" }}></div>
      </div>
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8 relative z-10 w-full pt-12 md:pt-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">NEXUS WALLET</h1>
          <div className="flex items-center gap-3">
            <button className="hidden md:flex bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-widest hover:bg-white/10 transition-colors uppercase items-center gap-2" onClick={refreshAll} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <div className="flex items-center px-4 py-2 bg-black/50 border border-white/10 rounded-lg backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></span>
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Network Online</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Worth View */}
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0a0a14] rounded-2xl p-6 border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#22d3ee]/20 blur-[50px] rounded-full mix-blend-screen group-hover:bg-[#22d3ee]/30 transition-colors"></div>
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mb-1">Total Equivalence</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white tracking-widest">
                    {hideBalances ? "****" : ((points?.balance ?? (points as any)?.points ?? 0).toLocaleString())}
                  </span>
                  <span className="text-sm font-bold text-[#22d3ee]">PTS</span>
                </div>
              </div>
              <button className="text-gray-500 hover:text-white" onClick={toggleBalances}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              </button>
            </div>
            <div className="relative z-10">
              <p className="text-xs text-gray-500 font-mono mb-2">Internal Conversion Rate</p>
              <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-[#22d3ee] to-[#a855f7]" style={{ width: "100%" }}></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
                <span>1000 PTS</span>
                <span>1.00 USDI</span>
              </div>
            </div>
          </div>

          {/* USDI Secure Vault */}
          <div className="bg-[#0a0a14] rounded-2xl p-6 border border-white/5 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.64-2.25 1.64-1.74 0-2.26-.97-2.32-1.92H7.9c.08 1.82 1.25 3.08 3 3.48V20h2.34v-1.7c1.69-.32 2.87-1.41 2.87-3.02 0-2.14-1.76-2.98-3.8-3.48z" /></svg>
            </div>
            <div className="mb-6 relative z-10 flex items-center justify-between">
              <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mb-1">USDI Vault</p>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Stable</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-black text-white tracking-wider">{hideBalances ? "****" : (usdi?.balance ?? "0.00")}</span>
              <span className="text-sm font-bold text-gray-500">USDI</span>
            </div>
          </div>

          {/* L1 Integration (CKB) */}
          <div className="bg-[#0a0a14] rounded-2xl p-6 border border-white/5 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            <div className="mb-6 relative z-10 flex items-center justify-between">
              <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mb-1">L1 Network Node</p>
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Connected</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 mb-2">
              <span className="text-3xl font-black text-white tracking-wider">{hideBalances ? "****" : (ckb?.balance ?? "0.00")}</span>
              <span className="text-sm font-bold text-gray-500">CKB</span>
            </div>
            {ckbAddress && (
              <div className="text-[10px] font-mono text-gray-500 truncate mt-2 bg-black/50 px-2 py-1 rounded inline-block max-w-full">
                {ckbAddress}
              </div>
            )}
          </div>
        </div>

        {(error || fiberMsg) && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
            <p className="text-red-400 text-sm font-bold font-mono tracking-widest uppercase">{error || fiberMsg}</p>
          </div>
        )}

        {/* Action Center & Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            {/* Top Up Panel */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
              <h3 className="text-lg font-black tracking-widest mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#22d3ee]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                TOP UP
              </h3>

              <div className="flex bg-black/50 p-1 rounded-lg border border-white/5 mb-6">
                <button className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${currency === 'USDI' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`} onClick={() => setCurrency('USDI')}>USDI</button>
                <button className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${currency === 'CKB' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`} onClick={() => setCurrency('CKB')}>CKB</button>
                <button className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${currency === 'FIAT' ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`} onClick={() => setCurrency('FIAT')}>💳 FIAT</button>
              </div>

              <div className="space-y-4">
                {currency === 'FIAT' ? (
                  <>
                    <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2 block">Buy CKB with Card</label>
                    <React.Suspense fallback={<div className="text-center text-gray-500 py-8 text-xs font-mono">Loading payment widget...</div>}>
                      <OnRampWidget defaultAmount={Number(buyAmt) || 50} targetCurrency="CKB" />
                    </React.Suspense>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2 block">Amount ({currency})</label>
                      <div className="relative">
                        <input type="text" className="w-full bg-black border border-white/10 rounded-lg py-3 px-4 text-sm font-mono focus:border-[#22d3ee] outline-none transition-colors" placeholder="0.00" value={currency === 'USDI' ? buyAmt : buyAmtCKB} onChange={(e) => currency === 'USDI' ? setBuyAmt(e.target.value) : setBuyAmtCKB(e.target.value)} />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">{currency}</div>
                      </div>
                    </div>

                    <div className="bg-[#22d3ee]/5 border border-[#22d3ee]/20 rounded-lg p-3 flex justify-between items-center">
                      <span className="text-xs text-gray-400 font-mono">You receive ≈</span>
                      <span className="text-sm font-bold text-[#22d3ee]">
                        {currency === "USDI" ? Math.floor(((Number(buyAmt) || 0) * (points?.pointsPerUSDI ?? 1000))) : Math.floor(((Number(buyAmtCKB) || 0) * 1000))} PTS
                      </span>
                    </div>

                    <button className="w-full bg-gradient-to-r from-[#22d3ee] to-[#a855f7] text-black font-black uppercase tracking-widest py-3 rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50" disabled={buyPointsLoading || ckbOrderLoading || joyidPaying} onClick={currency === 'USDI' ? buyPoints : buyPointsByCKB}>
                      {currency === 'USDI' ? (buyPointsLoading ? "PROCESSING..." : "CONFIRM TOP UP") : (ckbOrderLoading || joyidPaying ? "PROCESSING..." : "CONFIRM TOP UP (CKB)")}
                    </button>
                  </>
                )}

                {/* Faucet Input Area as an alternative */}
                <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                  <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">Claim Faucet Points</label>
                  <div className="flex gap-2">
                    <input className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-xs font-mono" value={earnAmt} onChange={e => setEarnAmt(e.target.value)} placeholder="Amount" />
                    <button className="bg-white/10 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider" onClick={earnPoints} disabled={earnLoading}>Claim</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Withdraw Panel */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group hover:border-[#a855f7]/30 transition-colors">
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-[#a855f7]/10 blur-[40px] rounded-full group-hover:bg-[#a855f7]/20 transition-colors"></div>
              <h3 className="text-lg font-black tracking-widest mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#a855f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                WITHDRAW
              </h3>
              <button className="w-full border border-[#a855f7]/50 text-[#a855f7] bg-[#a855f7]/5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#a855f7]/10 transition-colors" onClick={() => setShowWithdrawModal(true)}>
                INITIATE TRANSFER
              </button>
              <p className="mt-4 text-[10px] text-gray-500 font-mono text-center mb-4">Converts PTS directly to CKB via Smart Contract</p>

              <div className="pt-4 border-t border-white/5">
                <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block mb-2">Fiber Network Invoice</label>
                <div className="flex gap-2">
                  <input className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-xs font-mono" value={fiberAmount} onChange={e => setFiberAmount(Number(e.target.value))} placeholder="Amount" type="number" />
                  <select className="bg-black border border-white/10 rounded-lg py-2 px-3 text-xs" value={fiberAsset} onChange={e => setFiberAsset(e.target.value as "USDI" | "CKB")}><option value="USDI">USDI</option><option value="CKB">CKB</option></select>
                </div>
                <button className="w-full mt-2 bg-white/10 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-[#22d3ee] border border-white/5 hover:bg-white/20" disabled={fiberBusy} onClick={async () => {
                  try { setFiberBusy(true); setFiberMsg(""); const inv = await client.post<FiberInvoiceCreateResponse>("/payment/fiber/invoice/new", { amount: String(fiberAmount || 0), asset: fiberAsset }); setFiberInvoice(inv); setFiberMsg("Invoice Created"); } catch (e: any) { setFiberMsg(e?.message || "Error"); } finally { setFiberBusy(false); }
                }}>{fiberBusy ? "..." : "CREATE FIBER INVOICE"}</button>
                {fiberInvoice?.payUrl && <a href={fiberInvoice.payUrl} target="_blank" className="block mt-2 text-center text-[10px] text-yellow-400 underline">Pay Fiber Invoice</a>}
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest block">Force Unlock Video (Debug)</label>
                <div className="flex gap-2">
                  <input className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-xs font-mono" value={redeemId} onChange={e => setRedeemId(e.target.value)} placeholder="Video ID" />
                  <button className="bg-white/10 px-3 py-2 rounded-lg text-xs font-bold uppercase" onClick={redeemById} disabled={redeemLoading}>Unlock</button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {/* Transaction Ledger */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <h3 className="text-lg font-black tracking-widest flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  ON-CHAIN LEDGER
                </h3>
                <span className="text-[10px] bg-white/5 border border-white/10 px-3 py-1 rounded-full uppercase tracking-wider font-mono text-gray-400">Syncing complete</span>
              </div>

              {ledgerTxns.length === 0 ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] opacity-30">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-600"></div>
                        <div><div className="w-24 h-4 bg-gray-600 rounded mb-2"></div><div className="w-32 h-3 bg-gray-700 rounded"></div></div>
                      </div>
                      <div><div className="w-16 h-5 bg-gray-600 rounded"></div></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                  {ledgerTxns.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-inner ${tx.type === 'earn' || tx.type === 'buy' ? 'bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20' : 'bg-pink-500/10 text-pink-500 border-pink-500/20'}`}>
                          {tx.type === 'earn' || tx.type === 'buy' ? '↓' : '↑'}
                        </div>
                        <div>
                          <div className="text-sm font-bold tracking-wider text-white uppercase">{tx.reason || (tx.type === "buy" ? "Purchase" : tx.type === "earn" ? "Faucet Claim" : "Spent")}</div>
                          <div className="text-[10px] font-mono text-gray-500 mt-1">{new Date(tx.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className={`text-lg font-black font-mono tracking-widest ${tx.type === 'earn' || tx.type === 'buy' ? 'text-[#22d3ee]' : 'text-pink-500'}`}>
                        {tx.type === 'earn' || tx.type === 'buy' ? '+' : '-'}{String(tx.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Withdraw Modal using Concept Style if shown */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a14] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(168,85,247,0.2)]">
            <h2 className="text-2xl font-black tracking-widest mb-4">WITHDRAW PTS</h2>
            <p className="text-sm text-gray-400 mb-6">Convert your Points to CKB directly to your connected wallet.</p>

            <div className="bg-black/50 p-4 rounded-xl border border-white/5 mb-6">
              <div className="flex justify-between text-xs text-gray-500 font-mono mb-2"><span>Available Balance</span><span>{(points?.balance ?? points?.points ?? 0).toLocaleString()} PTS</span></div>
              <div className="relative">
                <input type="number" className="w-full bg-transparent text-2xl font-black text-white outline-none py-2" placeholder="0" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} />
                <button onClick={() => setWithdrawAmt(String(points?.balance ?? points?.points ?? 0))} className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-bold text-[#a855f7] bg-[#a855f7]/10 px-3 py-1 rounded">MAX</button>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm mb-8 px-2">
              <span className="text-gray-400">You will receive</span>
              <span className="font-bold text-[#22d3ee]">{Math.floor((Number(withdrawAmt) || 0) / 10000)} CKB</span>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowWithdrawModal(false)} className="flex-1 py-3 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:bg-white/5">Cancel</button>
              <button onClick={handleWithdraw} disabled={withdrawing || !withdrawAmt || Number(withdrawAmt) <= 0} className="flex-1 py-3 bg-gradient-to-r from-[#22d3ee] to-[#a855f7] rounded-xl text-xs font-black uppercase tracking-wider text-black disabled:opacity-50">{withdrawing ? "PROCESSING..." : "CONFIRM"}</button>
            </div>
          </div>
        </div>
      )}

      {/* On-Ramp Widget (Buy CKB with fiat) */}
      {showOnRamp && (
        <React.Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, color: '#fff' }}>Loading...</div>}>
          <OnRampWidget
            walletAddress={(() => { try { const u = JSON.parse(sessionStorage.getItem('vp.user') || '{}'); return u.ckbAddress || ''; } catch { return ''; } })()}
            currency="CKB"
            onClose={() => setShowOnRamp(false)}
            onSuccess={() => { setShowOnRamp(false); refreshAll(); }}
          />
        </React.Suspense>
      )}

      {/* Off-Ramp Widget (Withdraw to fiat) */}
      {showOffRamp && (
        <React.Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, color: '#fff' }}>Loading...</div>}>
          <OffRampWidget
            walletAddress={(() => { try { const u = JSON.parse(sessionStorage.getItem('vp.user') || '{}'); return u.ckbAddress || ''; } catch { return ''; } })()}
            currency="CKB"
            onClose={() => setShowOffRamp(false)}
            onSuccess={() => { setShowOffRamp(false); refreshAll(); }}
          />
        </React.Suspense>
      )}
    </div>
  );
}