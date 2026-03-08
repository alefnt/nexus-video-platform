// FILE: /video-platform/client-web/src/lib/ipfs.ts
/**
 * Nexus Video - IPFS 存储集成
 * 
 * 功能说明：
 * - 视频加密 (AES-GCM)
 * - IPFS 上传/下载
 * - 支持多种 IPFS 网关
 * 
 * 注意：此模块主要用于客户端加密，服务端可使用更高效的方案
 */

// IPFS 网关列表（按优先级排序）
const IPFS_GATEWAYS = [
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
    "https://dweb.link/ipfs/",
];

// 默认 IPFS API 端点
const DEFAULT_IPFS_API = "https://ipfs.infura.io:5001/api/v0";

export interface EncryptedContent {
    cid: string;
    iv: string;        // Base64 编码的 IV
    contentType: string;
    size: number;
}

export interface DecryptedContent {
    blob: Blob;
    url: string;       // Object URL，使用后需要释放
}

/**
 * 生成 AES-GCM 加密密钥
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * 从密码派生加密密钥
 */
export async function deriveKeyFromPassword(password: string, salt?: Uint8Array): Promise<{
    key: CryptoKey;
    salt: Uint8Array;
}> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
    );

    const usedSalt = salt || crypto.getRandomValues(new Uint8Array(16));

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: usedSalt,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    return { key, salt: usedSalt };
}

/**
 * 导出密钥为 Base64
 */
export async function exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * 从 Base64 导入密钥
 */
export async function importKey(keyData: string): Promise<CryptoKey> {
    const raw = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
    return await crypto.subtle.importKey(
        "raw",
        raw,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * 加密文件并上传到 IPFS
 */
export async function encryptAndUpload(
    file: File,
    encryptionKey: CryptoKey,
    ipfsApi: string = DEFAULT_IPFS_API
): Promise<EncryptedContent> {
    // 1. 读取文件
    const buffer = await file.arrayBuffer();

    // 2. 生成随机 IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 3. AES-GCM 加密
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        encryptionKey,
        buffer
    );

    // 4. 上传到 IPFS
    const formData = new FormData();
    formData.append("file", new Blob([encrypted]));

    const response = await fetch(`${ipfsApi}/add`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`IPFS upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    return {
        cid: result.Hash || result.cid,
        iv: btoa(String.fromCharCode(...iv)),
        contentType: file.type,
        size: encrypted.byteLength,
    };
}

/**
 * 从 IPFS 获取并解密文件
 */
export async function fetchAndDecrypt(
    cid: string,
    encryptionKey: CryptoKey,
    ivBase64: string,
    contentType: string = "video/mp4"
): Promise<DecryptedContent> {
    // 1. 解析 IV
    const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));

    // 2. 尝试多个网关获取内容
    let encrypted: ArrayBuffer | null = null;
    let lastError: Error | null = null;

    for (const gateway of IPFS_GATEWAYS) {
        try {
            const response = await fetch(`${gateway}${cid}`, {
                signal: AbortSignal.timeout(30000),
            });
            if (response.ok) {
                encrypted = await response.arrayBuffer();
                break;
            }
        } catch (e) {
            lastError = e as Error;
            continue;
        }
    }

    if (!encrypted) {
        throw lastError || new Error("Failed to fetch from all IPFS gateways");
    }

    // 3. AES-GCM 解密
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        encryptionKey,
        encrypted
    );

    // 4. 创建 Blob 和 Object URL
    const blob = new Blob([decrypted], { type: contentType });
    const url = URL.createObjectURL(blob);

    return { blob, url };
}

/**
 * 检查 IPFS CID 是否可访问
 */
export async function checkCIDAvailability(cid: string): Promise<boolean> {
    for (const gateway of IPFS_GATEWAYS) {
        try {
            const response = await fetch(`${gateway}${cid}`, {
                method: "HEAD",
                signal: AbortSignal.timeout(5000),
            });
            if (response.ok) return true;
        } catch {
            continue;
        }
    }
    return false;
}

/**
 * 释放 Object URL（避免内存泄漏）
 */
export function revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
}

/**
 * 获取最快的 IPFS 网关
 */
export async function getFastestGateway(cid?: string): Promise<string> {
    const testCid = cid || "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"; // IPFS 欢迎页

    const results = await Promise.allSettled(
        IPFS_GATEWAYS.map(async (gateway) => {
            const start = Date.now();
            const response = await fetch(`${gateway}${testCid}`, {
                method: "HEAD",
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) throw new Error("Not OK");
            return { gateway, latency: Date.now() - start };
        })
    );

    const successful = results
        .filter((r): r is PromiseFulfilledResult<{ gateway: string; latency: number }> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value)
        .sort((a, b) => a.latency - b.latency);

    return successful[0]?.gateway || IPFS_GATEWAYS[0];
}

// 导出常量
export { IPFS_GATEWAYS, DEFAULT_IPFS_API };
