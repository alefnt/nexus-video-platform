/**
 * WalletConnect 钱包连接组件
 * 
 * 显示连接状态，支持多链切换
 */

import React from 'react';
import { useWallet, chainInfo } from '../lib/walletConnect';

export default function WalletConnectButton() {
    const { address, chainId, isConnected, isConnecting, error, connect, disconnect, switchChain } = useWallet();
    const [showMenu, setShowMenu] = React.useState(false);

    const currentChain = chainId ? chainInfo[chainId] : null;
    const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

    const handleConnect = async (type: 'injected' | 'walletConnect') => {
        try {
            await connect(type);
        } catch (err) {
            console.error('Connect failed:', err);
        }
    };

    if (isConnected && address) {
        return (
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        borderRadius: 12,
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 600,
                    }}
                >
                    <span style={{
                        width: 8,
                        height: 8,
                        background: '#00ff88',
                        borderRadius: '50%'
                    }} />
                    <span>{currentChain?.symbol || 'ETH'}</span>
                    <span>{shortAddress}</span>
                </button>

                {showMenu && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: 8,
                            background: '#1a1a2e',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 12,
                            padding: 16,
                            minWidth: 200,
                            zIndex: 1000,
                        }}
                    >
                        <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                            {currentChain?.name || 'Unknown Network'}
                        </div>

                        <div style={{ marginBottom: 16, wordBreak: 'break-all', fontSize: 13 }}>
                            {address}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button
                                onClick={() => { navigator.clipboard.writeText(address); }}
                                style={{
                                    padding: '8px 12px',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: 8,
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                }}
                            >
                                📋 Copy Address
                            </button>

                            <button
                                onClick={() => { currentChain && window.open(`${currentChain.explorer}/address/${address}`, '_blank'); }}
                                style={{
                                    padding: '8px 12px',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: 8,
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                }}
                            >
                                🔗 View on Explorer
                            </button>

                            <button
                                onClick={() => { disconnect(); setShowMenu(false); }}
                                style={{
                                    padding: '8px 12px',
                                    background: 'rgba(255,77,77,0.2)',
                                    border: 'none',
                                    borderRadius: 8,
                                    color: '#ff4d4d',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                }}
                            >
                                🔌 Disconnect
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                disabled={isConnecting}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: 12,
                    color: 'white',
                    cursor: isConnecting ? 'wait' : 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    opacity: isConnecting ? 0.7 : 1,
                }}
            >
                {isConnecting ? '连接中...' : '🦊 Connect Wallet'}
            </button>

            {showMenu && !isConnecting && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 8,
                        background: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 12,
                        padding: 12,
                        minWidth: 200,
                        zIndex: 1000,
                    }}
                >
                    <button
                        onClick={() => { handleConnect('injected'); setShowMenu(false); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            width: '100%',
                            padding: '12px 16px',
                            background: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            borderRadius: 8,
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: 14,
                            marginBottom: 8,
                        }}
                    >
                        <span style={{ fontSize: 24 }}>🦊</span>
                        <span>MetaMask</span>
                    </button>

                    <button
                        onClick={() => { handleConnect('walletConnect'); setShowMenu(false); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            width: '100%',
                            padding: '12px 16px',
                            background: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            borderRadius: 8,
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: 14,
                        }}
                    >
                        <span style={{ fontSize: 24 }}>🔗</span>
                        <span>WalletConnect</span>
                    </button>
                </div>
            )}

            {error && (
                <div style={{
                    marginTop: 8,
                    padding: 8,
                    background: 'rgba(255,77,77,0.1)',
                    borderRadius: 8,
                    color: '#ff6b6b',
                    fontSize: 12
                }}>
                    {error}
                </div>
            )}
        </div>
    );
}
