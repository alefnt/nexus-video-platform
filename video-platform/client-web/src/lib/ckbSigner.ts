// FILE: /client-web/src/lib/ckbSigner.ts
/**
 * 统一 CKB 签名工具
 *
 * 支持三种签名方式:
 * 1. JoyID (Passkey) — 主推, Web2 用户零门槛
 * 2. CCC (Common Chains Connector) — CKB 原生钱包
 * 3. MetaMask (EVM) — 通过 CCC EVM signer
 *
 * 所有 CKB 链上支付统一走此模块:
 * - QuickTip CKB 模式
 * - PaymentModal CKB 类型
 * - NFT 铸造
 * - 内容上链
 */

import { getApiClient } from "./apiClient";

/** 签名结果 */
export interface SignResult {
    success: boolean;
    txHash?: string;
    signedTx?: unknown;
    error?: string;
}

/** 钱包类型 */
export type WalletType = "joyid" | "ccc" | "metamask";

/**
 * 检测当前用户的钱包类型
 */
export function detectWalletType(): WalletType | null {
    const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
    if (!userRaw) return null;
    try {
        const user = JSON.parse(userRaw);
        if (user.authType === "ccc") return "ccc";
        if (user.authType === "evm" || user.authType === "ethereum") return "metamask";
        if (user.ckbAddress) return "joyid";
        return null;
    } catch {
        return null;
    }
}

/**
 * 获取用户 CKB 地址
 */
export function getUserCkbAddress(): string | null {
    const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
    if (!userRaw) return null;
    try {
        return JSON.parse(userRaw)?.ckbAddress || null;
    } catch {
        return null;
    }
}

/**
 * 使用 JoyID 签名 CKB 交易
 */
export async function signWithJoyID(txSkeleton: unknown): Promise<SignResult> {
    const address = getUserCkbAddress();
    if (!address) {
        return { success: false, error: "未连接 JoyID 钱包" };
    }
    try {
        const { signRawTransaction } = await import("@joyid/ckb");
        const signedTx = await signRawTransaction(txSkeleton as any, address);
        return { success: true, signedTx };
    } catch (e: any) {
        if (e?.message?.includes("cancelled") || e?.message?.includes("abort")) {
            return { success: false, error: "用户取消签名" };
        }
        return { success: false, error: e?.message || "JoyID 签名失败" };
    }
}

/**
 * CCC Signer — shared reference set by React provider
 * Components that use CCC should call `setCCCSigner(signer)` after connecting
 */
let _cccSigner: any = null;

/** Called by React components to register the CCC signer instance */
export function setCCCSigner(signer: any): void {
    _cccSigner = signer;
}

/**
 * Sign CKB transaction using CCC connector (supports CCC wallet + MetaMask EVM)
 */
export async function signWithCCC(txSkeleton: unknown): Promise<SignResult> {
    if (!_cccSigner) {
        return { success: false, error: "CCC wallet not connected. Please connect your wallet first." };
    }
    try {
        // CCC signer.signTransaction expects a Transaction object
        const signedTx = await _cccSigner.signTransaction(txSkeleton);
        return { success: true, signedTx };
    } catch (e: any) {
        if (e?.message?.includes("cancel") || e?.message?.includes("reject") || e?.message?.includes("abort")) {
            return { success: false, error: "Transaction cancelled by user" };
        }
        return { success: false, error: e?.message || "CCC signing failed" };
    }
}

/**
 * 签名并广播 CKB 交易 (端到端流程)
 *
 * 1. 调用后端构建未签名交易
 * 2. 前端通过 JoyID/CCC 签名
 * 3. 将签名结果发回后端广播
 */
export async function signAndBroadcast(params: {
    /** 后端构建交易的 endpoint */
    buildEndpoint: string;
    /** 构建交易的参数 */
    buildPayload: Record<string, unknown>;
}): Promise<SignResult> {
    const api = getApiClient();
    const walletType = detectWalletType();

    if (!walletType) {
        return { success: false, error: "未连接钱包，请先连接 JoyID" };
    }

    try {
        // Step 1: 后端构建交易
        const buildResp = await api.post<{
            txSkeleton?: unknown;
            txParams?: { to: string; amount: string };
            requiresWallet?: boolean;
            error?: string;
        }>(params.buildEndpoint, params.buildPayload);

        if (buildResp?.error) {
            return { success: false, error: buildResp.error };
        }

        if (!buildResp?.txSkeleton && !buildResp?.requiresWallet) {
            // 不需要签名 (如积分支付已完成)
            return { success: true };
        }

        const txSkeleton = buildResp.txSkeleton;
        if (!txSkeleton) {
            return { success: false, error: "后端未返回交易骨架" };
        }

        // Step 2: Sign transaction
        let signResult: SignResult;
        switch (walletType) {
            case "joyid":
                signResult = await signWithJoyID(txSkeleton);
                break;
            case "ccc":
            case "metamask":
                signResult = await signWithCCC(txSkeleton);
                break;
            default:
                signResult = { success: false, error: "Unsupported wallet type" };
        }

        if (!signResult.success) {
            return signResult;
        }

        // Step 3: 广播
        const broadcastResp = await api.post<{
            txHash?: string;
            error?: string;
        }>("/payment/broadcast", {
            signedTx: signResult.signedTx,
        });

        if (broadcastResp?.error) {
            return { success: false, error: broadcastResp.error };
        }

        return { success: true, txHash: broadcastResp?.txHash };
    } catch (e: any) {
        return { success: false, error: e?.message || "交易失败" };
    }
}

/**
 * CKB 打赏 — 完整端到端流程
 */
export async function tipWithCkb(params: {
    videoId: string;
    creatorAddress: string;
    amount: number;
}): Promise<SignResult> {
    return signAndBroadcast({
        buildEndpoint: "/payment/tip/build",
        buildPayload: {
            videoId: params.videoId,
            toCreatorAddress: params.creatorAddress,
            amount: params.amount,
            currency: "ckb",
        },
    });
}
