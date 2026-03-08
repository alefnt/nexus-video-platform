/**
 * OnChainProof ...链上验证证明组件
 *
 * 在视...内容详情中以可折叠面板形式展示链上记...
 * 用户点击可验证：
 * - 内容哈希 (SHA-256)
 * - Arweave 永久存储 ...ViewBlock
 * - CKB 交易 ...CKB Explorer
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    generateProofLinks,
    hasRealProof,
    type OnChainProofLinks
} from '../../../shared/web3/blockchainExplorer';

interface OnChainProofProps {
    /** SHA-256 content hash */
    contentHash?: string;
    /** CKB transaction hash */
    ckbTxHash?: string;
    /** Arweave transaction ID */
    arweaveTxId?: string;
    /** Spore NFT ID */
    sporeId?: string;
    /** Spore Cluster ID */
    clusterId?: string;
    /** Creator's CKB address */
    creatorAddress?: string;
    /** Compact mode (inline badge) */
    compact?: boolean;
}

export default function OnChainProof({
    contentHash,
    ckbTxHash,
    arweaveTxId,
    sporeId,
    clusterId,
    creatorAddress,
    compact = false,
}: OnChainProofProps) {
    const [expanded, setExpanded] = useState(false);
    const { t } = useTranslation();

    const links = generateProofLinks({
        ckbTxHash,
        ckbAddress: creatorAddress,
        arweaveTxId,
        sporeId,
        clusterId,
    });

    const hasProof = hasRealProof(links) || !!contentHash;

    if (!hasProof) return null;

    // 紧凑模式: 只显示一个小标签
    if (compact) {
        return (
            <span
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    background: 'rgba(0, 245, 212, 0.1)',
                    border: '1px solid rgba(0, 245, 212, 0.2)',
                    color: 'var(--accent-cyan, #00f5d4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                }}
                title="On-chain verified"
            >
                ⛓️ {t('proof.verified', 'Verified')}
            </span>
        );
    }

    return (
        <div style={{ marginTop: 12 }}>
            {/* 折叠头部 */}
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(0, 245, 212, 0.06)',
                    border: '1px solid rgba(0, 245, 212, 0.15)',
                    borderRadius: expanded ? '10px 10px 0 0' : 10,
                    color: 'var(--accent-cyan, #00f5d4)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    transition: 'all 0.2s',
                }}
            >
                <span style={{ fontSize: 16 }}>⛓️</span>
                <span>{t('proof.onChainVerification', 'On-Chain Verification')}</span>
                <span style={{
                    marginLeft: 'auto',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    fontSize: 12,
                }}>
                    ▼
                </span>
            </button>

            {/* 展开内容 */}
            {expanded && (
                <div
                    style={{
                        padding: '14px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(0, 245, 212, 0.15)',
                        borderTop: 'none',
                        borderRadius: '0 0 10px 10px',
                    }}
                >
                    {/* 内容哈希 */}
                    {contentHash && (
                        <ProofRow
                            icon="🔒"
                            label={t('proof.contentHash', 'Content Hash')}
                            value={`${contentHash.slice(0, 12)}...${contentHash.slice(-8)}`}
                            fullValue={contentHash}
                            copyable
                        />
                    )}

                    {/* CKB 交易 */}
                    {links.ckbTx && (
                        <ProofRow
                            icon="💎"
                            label={t('proof.ckbTransaction', 'CKB Transaction')}
                            value={`${ckbTxHash!.slice(0, 10)}...${ckbTxHash!.slice(-6)}`}
                            link={links.ckbTx}
                        />
                    )}

                    {/* Spore NFT */}
                    {links.spore && (
                        <ProofRow
                            icon="🧬"
                            label={t('proof.sporeNFT', 'Spore NFT')}
                            value={`${sporeId!.slice(0, 10)}...${sporeId!.slice(-6)}`}
                            link={links.spore}
                        />
                    )}

                    {/* Arweave 永久存储 */}
                    {links.arweaveTx && (
                        <ProofRow
                            icon="♾️"
                            label={t('proof.permanentStorage', 'Permanent Storage')}
                            value={`${arweaveTxId!.slice(0, 10)}...${arweaveTxId!.slice(-6)}`}
                            link={links.arweaveTx}
                        />
                    )}

                    {/* Creator 地址 */}
                    {links.ckbAddress && (
                        <ProofRow
                            icon="👤"
                            label={t('proof.creatorWallet', 'Creator Wallet')}
                            value={`${creatorAddress!.slice(0, 10)}...${creatorAddress!.slice(-6)}`}
                            link={links.ckbAddress}
                        />
                    )}

                    {/* Cluster */}
                    {links.cluster && (
                        <ProofRow
                            icon="📦"
                            label={t('proof.collection', 'Collection')}
                            value={`${clusterId!.slice(0, 10)}...${clusterId!.slice(-6)}`}
                            link={links.cluster}
                        />
                    )}

                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                        {t('proof.disclaimer', 'Click links to verify on-chain. Data is immutable once recorded.')}
                    </div>
                </div>
            )}
        </div>
    );
}
// ============== 行组件 ==============
function ProofRow({
    icon,
    label,
    value,
    fullValue,
    link,
    copyable,
}: {
    icon: string;
    label: string;
    value: string;
    fullValue?: string;
    link?: string;
    copyable?: boolean;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(fullValue || value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: 13,
            }}
        >
            <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{icon}</span>
            <span style={{ color: 'var(--text-secondary)', minWidth: 100, flexShrink: 0 }}>{label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
                {link ? (
                    <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-cyan, #00f5d4)', textDecoration: 'none' }}
                    >
                        {value} ...
                    </a>
                ) : (
                    value
                )}
            </span>
            {copyable && (
                <button
                    onClick={handleCopy}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: copied ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        padding: '2px 6px',
                    }}
                >
                    {copied ? '已复制' : '📋'}
                </button>
            )}
        </div>
    );
}
