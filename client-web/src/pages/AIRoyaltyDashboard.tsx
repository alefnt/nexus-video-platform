import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Music, Film, FileText, TrendingUp, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { getApiClient } from '../lib/apiClient';

// ── Types ──────────────────────────────────────────────────

interface LedgerEntry {
    id: string;
    type: string;
    amount: number;
    reason: string;
    createdAt: string;
    videoId?: string;
}

interface SplitRecord {
    id: string;
    videoId: string;
    title: string;
    totalAmount: number;
    creatorShare: number;
    status: string;
    rgbppTxHash?: string;
    createdAt: string;
}

interface ContentItem {
    id: string;
    title: string;
    type: 'video' | 'audio' | 'article';
    views?: number;
    createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────

function formatCKB(amount: number): string {
    if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
    if (amount >= 1_000) return (amount / 1_000).toFixed(1) + 'K';
    return amount.toFixed(2);
}

function contentIcon(type: string) {
    switch (type) {
        case 'video': return <Film size={16} className="text-blue-400" />;
        case 'audio': return <Music size={16} className="text-pink-400" />;
        case 'article': return <FileText size={16} className="text-green-400" />;
        default: return <DollarSign size={16} className="text-amber-400" />;
    }
}

// ── Component ──────────────────────────────────────────────

export default function AIRoyaltyDashboard() {
    const api = getApiClient();

    // Data state
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [splits, setSplits] = useState<SplitRecord[]>([]);
    const [balance, setBalance] = useState(0);
    const [totalEarned, setTotalEarned] = useState(0);
    const [chartData, setChartData] = useState<{ label: string; value: number }[]>([]);

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Data Fetching ──────────────────────────────────────

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [balanceRes, ledgerRes, splitsRes] = await Promise.allSettled([
                api.get<{ balance: number; totalEarned?: number }>('/payment/points/balance'),
                api.get<{ ledger: LedgerEntry[] }>('/payment/points/ledger/me'),
                api.get<{ splits: SplitRecord[] }>('/payment/splits'),
            ]);

            if (balanceRes.status === 'fulfilled') {
                setBalance(balanceRes.value.balance);
                setTotalEarned(balanceRes.value.totalEarned || 0);
            }

            if (ledgerRes.status === 'fulfilled') {
                const entries = ledgerRes.value.ledger || [];
                setLedger(entries);

                // Build last 7 days chart from ledger
                const now = Date.now();
                const days: { label: string; value: number }[] = [];
                for (let i = 6; i >= 0; i--) {
                    const dayStart = new Date(now - i * 86400000);
                    const dayLabel = dayStart.toLocaleDateString('en', { weekday: 'short' });
                    const dayEarnings = entries
                        .filter(e => {
                            const t = new Date(e.createdAt).getTime();
                            return t >= dayStart.getTime() - 86400000 && t < dayStart.getTime() && e.amount > 0;
                        })
                        .reduce((sum, e) => sum + e.amount, 0);
                    days.push({ label: dayLabel, value: dayEarnings });
                }
                setChartData(days);
            }

            if (splitsRes.status === 'fulfilled') {
                setSplits(splitsRes.value.splits || []);
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to load royalty data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Chart rendering ────────────────────────────────────

    const maxChartVal = Math.max(...chartData.map(d => d.value), 1);

    // ── Loading State ──────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f0e15] text-white p-6 md:p-8 pb-32 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={40} className="animate-spin text-emerald-500 mx-auto mb-4" />
                    <p className="text-gray-400">Loading Royalty Dashboard...</p>
                </div>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#0f0e15] text-white p-6 md:p-8 pb-32">
            <div className="max-w-[1280px] mx-auto">

                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">AI Royalty Dashboard</h1>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 text-sm bg-[#1a1a2e] px-4 py-2 rounded-lg border border-gray-700 hover:border-emerald-500/30 transition-colors text-gray-300"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg border border-red-500/20 mb-6">
                        {error}
                    </div>
                )}

                {/* Top Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-emerald-500/10 to-[#1a1a2e] rounded-2xl p-6 border border-emerald-500/20 shadow-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <DollarSign size={18} className="text-emerald-400" />
                            <span className="text-sm text-gray-400">Current Balance</span>
                        </div>
                        <p className="text-3xl font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">{formatCKB(balance)} PTS</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-[#1a1a2e] rounded-2xl p-6 border border-purple-500/20 shadow-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp size={18} className="text-purple-400" />
                            <span className="text-sm text-gray-400">Total Earned</span>
                        </div>
                        <p className="text-3xl font-bold text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">{formatCKB(totalEarned)} PTS</p>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/10 to-[#1a1a2e] rounded-2xl p-6 border border-amber-500/20 shadow-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <DollarSign size={18} className="text-amber-400" />
                            <span className="text-sm text-gray-400">RGB++ Splits</span>
                        </div>
                        <p className="text-3xl font-bold text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">{splits.length}</p>
                        <p className="text-xs text-gray-500 mt-1">Royalty distributions</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                    {/* Chart Area (spans 2 cols) */}
                    <div className="col-span-2 bg-[#1a1a2e] rounded-2xl p-6 border border-gray-800">
                        <h2 className="text-lg font-bold mb-4">Earnings (Last 7 Days)</h2>
                        <div className="flex items-end gap-2 h-40">
                            {chartData.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <div
                                        className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-md transition-all duration-500"
                                        style={{ height: `${Math.max(4, (d.value / maxChartVal) * 100)}%`, minHeight: 4 }}
                                    />
                                    <span className="text-[10px] text-gray-500">{d.label}</span>
                                </div>
                            ))}
                        </div>
                        {chartData.every(d => d.value === 0) && (
                            <p className="text-center text-gray-500 text-sm mt-4">No earnings in the last 7 days</p>
                        )}
                    </div>

                    {/* Recent Activity (right side) */}
                    <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-gray-800">
                        <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
                        {ledger.length === 0 ? (
                            <p className="text-gray-500 text-sm">No activity yet.</p>
                        ) : (
                            <div className="space-y-3 max-h-40 overflow-y-auto">
                                {ledger.slice(0, 10).map((entry) => (
                                    <div key={entry.id} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400 truncate max-w-[150px]">{entry.reason || entry.type}</span>
                                        <span className={entry.amount > 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                                            {entry.amount > 0 ? '+' : ''}{entry.amount}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RGB++ Split Distributions Table */}
                <div className="mt-6 bg-[#1a1a2e] rounded-2xl p-6 border border-gray-800">
                    <h2 className="text-lg font-bold mb-4">RGB++ Royalty Distributions</h2>
                    {splits.length === 0 ? (
                        <p className="text-gray-500 text-sm">No royalty distributions yet. Earnings from content will appear here when processed via RGB++ smart contracts.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500 text-left border-b border-gray-800">
                                    <th className="pb-3 font-medium">Content</th>
                                    <th className="pb-3 font-medium">Total</th>
                                    <th className="pb-3 font-medium">Your Share</th>
                                    <th className="pb-3 font-medium">Status</th>
                                    <th className="pb-3 font-medium">TX</th>
                                </tr>
                            </thead>
                            <tbody>
                                {splits.map((split) => (
                                    <tr key={split.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                <Film size={14} className="text-blue-400" />
                                                <span className="text-gray-300 truncate max-w-[200px]">{split.title || split.videoId.slice(0, 8)}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-gray-300">{formatCKB(split.totalAmount)}</td>
                                        <td className="py-3 text-emerald-400 font-medium">{formatCKB(split.creatorShare)}</td>
                                        <td className="py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${split.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                                                {split.status}
                                            </span>
                                        </td>
                                        <td className="py-3">
                                            {split.rgbppTxHash ? (
                                                <span className="text-xs text-blue-400 font-mono flex items-center gap-1 cursor-pointer hover:underline">
                                                    {split.rgbppTxHash.slice(0, 10)}... <ExternalLink size={10} />
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-500">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

            </div>
        </div>
    );
}
