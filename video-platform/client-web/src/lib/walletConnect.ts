/**
 * WalletConnect 多链钱包集成
 * 
 * 支持: Ethereum, BSC, Polygon, Arbitrum
 */

import { createConfig, http, connect, disconnect, getAccount, switchChain } from '@wagmi/core';
import { mainnet, bsc, polygon, arbitrum, sepolia } from '@wagmi/core/chains';
import { walletConnect, injected } from '@wagmi/connectors';

// WalletConnect Project ID (从 cloud.walletconnect.com 获取)
const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'e1dfd9a4c1e525add5d9ad4170d87351';

// 支持的链
export const supportedChains = [mainnet, bsc, polygon, arbitrum, sepolia] as const;

// 链信息映射
export const chainInfo: Record<number, { name: string; symbol: string; explorer: string }> = {
    1: { name: 'Ethereum', symbol: 'ETH', explorer: 'https://etherscan.io' },
    56: { name: 'BNB Chain', symbol: 'BNB', explorer: 'https://bscscan.com' },
    137: { name: 'Polygon', symbol: 'MATIC', explorer: 'https://polygonscan.com' },
    42161: { name: 'Arbitrum', symbol: 'ETH', explorer: 'https://arbiscan.io' },
    11155111: { name: 'Sepolia', symbol: 'ETH', explorer: 'https://sepolia.etherscan.io' },
};

// Wagmi 配置
export const wagmiConfig = createConfig({
    chains: supportedChains,
    connectors: [
        injected(),
        walletConnect({
            projectId: WALLET_CONNECT_PROJECT_ID,
            metadata: {
                name: 'Nexus Video',
                description: 'Decentralized Video Platform',
                url: 'https://nexusvideo.io',
                icons: ['https://nexusvideo.io/logo.png'],
            },
        }),
    ],
    transports: {
        [mainnet.id]: http(),
        [bsc.id]: http(),
        [polygon.id]: http(),
        [arbitrum.id]: http(),
        [sepolia.id]: http(),
    },
});

// ============== 钱包操作函数 ==============

/**
 * 连接钱包
 */
export async function connectWallet(connectorType: 'injected' | 'walletConnect' = 'injected') {
    try {
        const connector = wagmiConfig.connectors.find(c => c.id === connectorType);
        if (!connector) throw new Error('Connector not found');

        const result = await connect(wagmiConfig, { connector });
        return {
            address: result.accounts[0],
            chainId: result.chainId,
        };
    } catch (error: any) {
        console.error('Connect wallet failed:', error);
        throw error;
    }
}

/**
 * 断开钱包
 */
export async function disconnectWallet() {
    await disconnect(wagmiConfig);
}

/**
 * 获取当前账户
 */
export function getWalletAccount() {
    return getAccount(wagmiConfig);
}

/**
 * 切换链
 */
export async function switchToChain(chainId: number) {
    try {
        await switchChain(wagmiConfig, { chainId: chainId as any });
        return true;
    } catch (error: any) {
        console.error('Switch chain failed:', error);
        return false;
    }
}

/**
 * 签名消息 (用于登录验证)
 */
export async function signMessage(message: string): Promise<string> {
    const { connector } = getAccount(wagmiConfig);
    if (!connector) throw new Error('No wallet connected');

    const provider = await connector.getProvider();
    const accounts = await (provider as any).request({ method: 'eth_accounts' });
    const signature = await (provider as any).request({
        method: 'personal_sign',
        params: [message, accounts[0]],
    });

    return signature;
}

/**
 * 生成登录挑战消息
 */
export function generateLoginMessage(address: string, nonce: string): string {
    return `Welcome to Nexus Video!

Sign this message to verify your wallet.

Wallet: ${address}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}`;
}

// ============== React Hook ==============

import { useState, useEffect, useCallback } from 'react';

export interface WalletState {
    address: string | null;
    chainId: number | null;
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
}

export function useWallet() {
    const [state, setState] = useState<WalletState>({
        address: null,
        chainId: null,
        isConnected: false,
        isConnecting: false,
        error: null,
    });

    useEffect(() => {
        const account = getWalletAccount();
        if (account.isConnected) {
            setState({
                address: account.address || null,
                chainId: account.chainId || null,
                isConnected: true,
                isConnecting: false,
                error: null,
            });
        }
    }, []);

    const connect = useCallback(async (type: 'injected' | 'walletConnect' = 'injected') => {
        setState(prev => ({ ...prev, isConnecting: true, error: null }));
        try {
            const result = await connectWallet(type);
            setState({
                address: result.address,
                chainId: result.chainId,
                isConnected: true,
                isConnecting: false,
                error: null,
            });
            return result;
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                isConnecting: false,
                error: error.message || 'Connection failed',
            }));
            throw error;
        }
    }, []);

    const disconnect = useCallback(async () => {
        await disconnectWallet();
        setState({
            address: null,
            chainId: null,
            isConnected: false,
            isConnecting: false,
            error: null,
        });
    }, []);

    return {
        ...state,
        connect,
        disconnect,
        switchChain: switchToChain,
        signMessage,
    };
}
