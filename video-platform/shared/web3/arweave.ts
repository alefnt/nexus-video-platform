// FILE: /video-platform/shared/web3/arweave.ts
/**
 * Arweave 永久存储 SDK 封装
 * 使用 Irys (原 Bundlr) 作为 Layer 2 加速层
 * 
 * 功能：
 * - 上传视频/文件到 Arweave 永久存储
 * - 查询交易状态
 * - 获取存储费用估算
 */

// Irys/Bundlr 配置
const IRYS_NODE_URL = process.env.IRYS_NODE_URL || "https://node2.irys.xyz";
const IRYS_TOKEN = process.env.IRYS_TOKEN || "matic"; // 支持多种代币支付
const ARWEAVE_GATEWAY = process.env.ARWEAVE_GATEWAY || "https://arweave.net";

export interface ArweaveUploadResult {
    success: boolean;
    txId?: string;
    arweaveUrl?: string;
    error?: string;
    cost?: string;
    timestamp?: string;
}

export interface ArweaveCostEstimate {
    bytes: number;
    cost: string;
    currency: string;
}

/**
 * 估算上传费用
 */
export async function estimateUploadCost(fileSizeBytes: number): Promise<ArweaveCostEstimate> {
    try {
        // Irys 费用查询 API
        const response = await fetch(`${IRYS_NODE_URL}/price/${fileSizeBytes}`);
        if (response.ok) {
            const price = await response.text();
            return {
                bytes: fileSizeBytes,
                cost: price,
                currency: IRYS_TOKEN.toUpperCase()
            };
        }
        // 回退估算：约 0.0001 AR per KB (简化估算)
        const estimatedAR = (fileSizeBytes / 1024) * 0.0001;
        return {
            bytes: fileSizeBytes,
            cost: estimatedAR.toFixed(8),
            currency: "AR"
        };
    } catch (error) {
        console.error("Arweave cost estimate error:", error);
        return {
            bytes: fileSizeBytes,
            cost: "unknown",
            currency: "AR"
        };
    }
}

/**
 * 上传文件到 Arweave (通过 Irys)
 * 注意：生产环境需要配置钱包私钥
 */
export async function uploadToArweave(
    fileBuffer: Buffer,
    options?: {
        contentType?: string;
        tags?: Array<{ name: string; value: string }>;
    }
): Promise<ArweaveUploadResult> {
    try {
        // 检查是否配置了 Irys 私钥
        const privateKey = process.env.IRYS_PRIVATE_KEY || process.env.ARWEAVE_PRIVATE_KEY;

        if (!privateKey) {
            // 开发模式：模拟上传，返回模拟 TX ID
            console.warn("⚠️ Arweave: No private key configured, using mock upload");
            const mockTxId = `mock_ar_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            return {
                success: true,
                txId: mockTxId,
                arweaveUrl: `${ARWEAVE_GATEWAY}/${mockTxId}`,
                timestamp: new Date().toISOString(),
                cost: "0 (mock)"
            };
        }

        // 生产模式：使用 Irys SDK 上传
        // 动态导入 Irys SDK（避免在未安装时报错）
        /*
        try {
            // @ts-ignore
            const { default: Irys } = await import("@irys/sdk");

            const irys = new Irys({
                url: IRYS_NODE_URL,
                token: IRYS_TOKEN,
                key: privateKey,
            });

            // 准备标签
            const tags = options?.tags || [];
            if (options?.contentType) {
                tags.push({ name: "Content-Type", value: options.contentType });
            }
            tags.push({ name: "App-Name", value: "NexusVideo" });
            tags.push({ name: "App-Version", value: "1.0.0" });
            tags.push({ name: "Upload-Time", value: new Date().toISOString() });

            // 上传
            const receipt = await irys.upload(fileBuffer, { tags });

            return {
                success: true,
                txId: receipt.id,
                arweaveUrl: `${ARWEAVE_GATEWAY}/${receipt.id}`,
                timestamp: new Date().toISOString()
            };
        } catch (importError: any) {
            // Irys SDK 未安装，回退到原生 Arweave
            console.warn("Irys SDK not available, using native Arweave (slower)");
            return await uploadToArweaveNative(fileBuffer, options);
        }
        */
        // 暂时只使用原生 Arweave 或 Mock (为了 unblock 构建)
        return await uploadToArweaveNative(fileBuffer, options);
    } catch (error: any) {
        console.error("Arweave upload error:", error);
        return {
            success: false,
            error: error?.message || "Upload failed"
        };
    }
}

/**
 * 原生 Arweave 上传（备用方案）
 */
async function uploadToArweaveNative(
    fileBuffer: Buffer,
    options?: {
        contentType?: string;
        tags?: Array<{ name: string; value: string }>;
    }
): Promise<ArweaveUploadResult> {
    try {
        const Arweave = (await import("arweave")).default;
        const arweave = Arweave.init({
            host: "arweave.net",
            port: 443,
            protocol: "https"
        });

        const key = JSON.parse(process.env.ARWEAVE_WALLET_JSON || "{}");
        if (!key.n) {
            throw new Error("Arweave wallet not configured");
        }

        const tx = await arweave.createTransaction({ data: fileBuffer }, key);

        // 添加标签
        if (options?.contentType) {
            tx.addTag("Content-Type", options.contentType);
        }
        tx.addTag("App-Name", "NexusVideo");
        tx.addTag("App-Version", "1.0.0");

        if (options?.tags) {
            for (const tag of options.tags) {
                tx.addTag(tag.name, tag.value);
            }
        }

        await arweave.transactions.sign(tx, key);
        const response = await arweave.transactions.post(tx);

        if (response.status === 200 || response.status === 202) {
            return {
                success: true,
                txId: tx.id,
                arweaveUrl: `${ARWEAVE_GATEWAY}/${tx.id}`,
                timestamp: new Date().toISOString()
            };
        }

        return {
            success: false,
            error: `Upload failed with status ${response.status}`
        };
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || "Native Arweave upload failed"
        };
    }
}

/**
 * 检查交易确认状态
 */
export async function checkArweaveStatus(txId: string): Promise<{
    confirmed: boolean;
    confirmations?: number;
    blockHeight?: number;
}> {
    try {
        const response = await fetch(`${ARWEAVE_GATEWAY}/tx/${txId}/status`);
        if (!response.ok) {
            return { confirmed: false };
        }
        const data = await response.json();
        return {
            confirmed: data.number_of_confirmations > 0,
            confirmations: data.number_of_confirmations,
            blockHeight: data.block_height
        };
    } catch {
        return { confirmed: false };
    }
}

/**
 * 获取 Arweave 文件 URL
 */
export function getArweaveUrl(txId: string): string {
    return `${ARWEAVE_GATEWAY}/${txId}`;
}

/**
 * 检查是否为有效的 Arweave TX ID
 */
export function isValidArweaveTxId(txId: string): boolean {
    // Arweave TX ID 是 43 字符的 Base64URL
    return /^[a-zA-Z0-9_-]{43}$/.test(txId);
}
