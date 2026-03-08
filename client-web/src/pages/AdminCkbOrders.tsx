/**
 * AdminCkbOrders - CKB Order Management Dashboard
 * View, filter, and manage CKB payment intents
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { getApiClient } from '../lib/apiClient';
import { showAlert } from '../components/ui/ConfirmModal';

const client = getApiClient();

type OrderStatus = 'all' | 'pending' | 'confirmed' | 'expired';

interface IntentItem {
    orderId: string;
    userId?: string;
    payerAddress?: string;
    depositAddress: string;
    expectedAmountCKB: string;
    expectedAmountShannons: string;
    status: 'pending' | 'confirmed' | 'expired';
    confirmations?: number;
    txHash?: string;
    creditedPoints?: number;
    createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    confirmed: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
    expired: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

export default function AdminCkbOrders() {
    const { t } = useTranslation();
    usePageTitle('Admin: CKB Orders');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<IntentItem[]>([]);
    const [statusFilter, setStatusFilter] = useState<OrderStatus>('all');
    const [userIdFilter, setUserIdFilter] = useState('');
    const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

    const fetchIntents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const jwt = sessionStorage.getItem('vp.jwt');
            if (jwt) client.setJWT(jwt);
            const params: Record<string, string> = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (userIdFilter.trim()) params.userId = userIdFilter.trim();
            const q = new URLSearchParams(params).toString();
            const data = await client.get<{ items: IntentItem[]; total: number }>('/payment/ckb/intents' + (q ? '?' + q : ''));
            setItems((data as any)?.items || []);
        } catch (e: any) {
            setError(e?.message || 'Failed to fetch orders');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, userIdFilter]);

    useEffect(() => { fetchIntents(); }, []);

    useEffect(() => {
        if (!refreshInterval) return;
        const id = setInterval(fetchIntents, refreshInterval * 1000);
        return () => clearInterval(id);
    }, [refreshInterval, fetchIntents]);

    const copy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            showAlert({ title: 'Copied', message: text, variant: 'success' });
        }).catch(() => { });
    };

    const trunc = (s: string, n = 12) => s.length <= n ? s : s.slice(0, n / 2) + '...' + s.slice(-n / 2);

    return (
        <div style={{ minHeight: '100vh', padding: '32px 40px 80px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Admin: CKB Orders</h1>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Manage on-chain payment intents</p>
                </div>
                <select value={refreshInterval || ''} onChange={e => setRefreshInterval(e.target.value ? Number(e.target.value) : null)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '6px 12px', fontSize: 12, outline: 'none' }}>
                    <option value="">Auto-refresh: Off</option>
                    <option value="10">Every 10s</option>
                    <option value="30">Every 30s</option>
                </select>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const, gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    {(['all', 'pending', 'confirmed', 'expired'] as OrderStatus[]).map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)} style={{
                            padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            border: statusFilter === s ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                            background: statusFilter === s ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                            color: statusFilter === s ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
                        }}>
                            {s === 'all' ? 'All' : s === 'pending' ? 'Pending' : s === 'confirmed' ? 'Confirmed' : 'Expired'}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', padding: '6px 12px', fontSize: 13, outline: 'none', width: 200 }}
                        value={userIdFilter} onChange={e => setUserIdFilter(e.target.value)} placeholder="Filter by User ID..." />
                    <button onClick={fetchIntents} disabled={loading} style={{
                        padding: '6px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                        color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>{loading ? '...' : 'Search'}</button>
                </div>
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#fca5a5', marginBottom: 16 }}>{error}</div>}

            {/* Stats */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                {[
                    { label: 'Total', val: items.length, color: '#fff' },
                    { label: 'Pending', val: items.filter(i => i.status === 'pending').length, color: '#f59e0b' },
                    { label: 'Confirmed', val: items.filter(i => i.status === 'confirmed').length, color: '#22c55e' },
                    { label: 'Expired', val: items.filter(i => i.status === 'expired').length, color: '#ef4444' },
                ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 20px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                        <tr>
                            {['Order ID', 'User ID', 'Deposit Addr', 'CKB Amount', 'Status', 'Confirms', 'TX Hash', 'Points', 'Created'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => {
                            const sc = STATUS_COLORS[item.status];
                            return (
                                <tr key={item.orderId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}><span style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} onClick={() => copy(item.orderId)}>{trunc(item.orderId, 10)}</span></td>
                                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}><span style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} onClick={() => copy(item.userId || '')}>{trunc(item.userId || '-', 8)}</span></td>
                                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}><span style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} onClick={() => copy(item.depositAddress)}>{trunc(item.depositAddress, 14)}</span></td>
                                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>{item.expectedAmountCKB}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: sc.bg, color: sc.text, border: '1px solid ' + sc.border }}>{item.status}</span>
                                    </td>
                                    <td style={{ padding: '10px 14px', fontSize: 13, textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>{item.confirmations ?? '-'}</td>
                                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{item.txHash ? <span style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} onClick={() => copy(item.txHash!)}>{trunc(item.txHash, 12)}</span> : '-'}</td>
                                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#22c55e', fontWeight: 600 }}>{item.creditedPoints ?? '-'}</td>
                                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{new Date(item.createdAt).toLocaleString()}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {items.length === 0 && !loading && <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)' }}>No orders found</div>}
            </div>
        </div>
    );
}
