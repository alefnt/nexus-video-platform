/**
 * 区块链浏览器 URL 生成器
 *
 * 为 CKB / Arweave / Spore 生成可验证的浏览器链接
 * 用于「链上证明」展示 —— 让用户可以点击验证真实性
 */

// ============== CKB Explorer ==============

const CKB_EXPLORER_MAINNET = "https://explorer.nervos.org";
const CKB_EXPLORER_TESTNET = "https://pudge.explorer.nervos.org";
const CKB_NETWORK = process.env.CKB_NETWORK || "testnet";

function getCkbExplorerBase(): string {
    return CKB_NETWORK === "mainnet" ? CKB_EXPLORER_MAINNET : CKB_EXPLORER_TESTNET;
}

/** CKB 交易链接 */
export function getCkbTxUrl(txHash: string): string {
    if (!txHash || txHash.startsWith("mock_") || txHash.startsWith("db_")) return "";
    return `${getCkbExplorerBase()}/transaction/${txHash}`;
}

/** CKB 地址链接 */
export function getCkbAddressUrl(address: string): string {
    if (!address) return "";
    return `${getCkbExplorerBase()}/address/${address}`;
}

/** CKB Cell (UTXO) 链接 */
export function getCkbCellUrl(txHash: string, index: number): string {
    if (!txHash) return "";
    return `${getCkbExplorerBase()}/transaction/${txHash}#${index}`;
}

// ============== Arweave Explorer ==============

const ARWEAVE_GATEWAY = process.env.ARWEAVE_GATEWAY || "https://arweave.net";
const VIEWBLOCK_ARWEAVE = "https://viewblock.io/arweave/tx";

/** Arweave 交易链接 (ViewBlock) */
export function getArweaveTxUrl(txId: string): string {
    if (!txId || txId.startsWith("mock_")) return "";
    return `${VIEWBLOCK_ARWEAVE}/${txId}`;
}

/** Arweave 文件直链 */
export function getArweaveContentUrl(txId: string): string {
    if (!txId || txId.startsWith("mock_")) return "";
    return `${ARWEAVE_GATEWAY}/${txId}`;
}

// ============== Spore Explorer ==============

const SPORE_EXPLORER = "https://spore.nervos.org";

/** Spore NFT 链接 */
export function getSporeUrl(sporeId: string): string {
    if (!sporeId || sporeId.startsWith("mock_") || sporeId.startsWith("spore_")) return "";
    return `${SPORE_EXPLORER}/spore/${sporeId}`;
}

/** Spore Cluster 链接 */
export function getClusterUrl(clusterId: string): string {
    if (!clusterId) return "";
    return `${SPORE_EXPLORER}/cluster/${clusterId}`;
}

// ============== 统一入口 ==============

export interface OnChainProofLinks {
    ckbTx?: string;
    ckbAddress?: string;
    arweaveTx?: string;
    arweaveContent?: string;
    spore?: string;
    cluster?: string;
}

/**
 * 根据已有数据生成所有可用的链上证明链接
 */
export function generateProofLinks(params: {
    ckbTxHash?: string;
    ckbAddress?: string;
    arweaveTxId?: string;
    sporeId?: string;
    clusterId?: string;
}): OnChainProofLinks {
    const links: OnChainProofLinks = {};

    if (params.ckbTxHash) links.ckbTx = getCkbTxUrl(params.ckbTxHash);
    if (params.ckbAddress) links.ckbAddress = getCkbAddressUrl(params.ckbAddress);
    if (params.arweaveTxId) {
        links.arweaveTx = getArweaveTxUrl(params.arweaveTxId);
        links.arweaveContent = getArweaveContentUrl(params.arweaveTxId);
    }
    if (params.sporeId) links.spore = getSporeUrl(params.sporeId);
    if (params.clusterId) links.cluster = getClusterUrl(params.clusterId);

    return links;
}

/**
 * 判断是否有真实的链上证明 (排除 mock 数据)
 */
export function hasRealProof(links: OnChainProofLinks): boolean {
    return Object.values(links).some((url) => !!url && url.length > 0);
}
