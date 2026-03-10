import React, { useState, useEffect, useCallback } from 'react';
import { Users, Coins, Gavel, Hand, Check, X, MoreVertical, Plus, Loader2 } from 'lucide-react';
import { getApiClient } from '../lib/apiClient';

// ── Types ──────────────────────────────────────────────────

interface Proposal {
    id: string;
    title: string;
    description: string;
    category: string;
    proposer: string;
    status: string;
    createdAt: string;
    endAt: string;
    forVotes: number;
    againstVotes: number;
    abstainVotes: number;
    totalVoters: number;
    quorum: number;
    passingThreshold: number;
}

interface GovernanceToken {
    userId: string;
    balance: number;
    votingPower: number;
    delegatedTo?: string;
}

interface VoteRecord {
    id: string;
    proposalId: string;
    choice: string;
    votingPower: number;
    timestamp: string;
    proposal?: { title: string; id: string };
}

// ── Helpers ────────────────────────────────────────────────

function timeLeft(endAt: string): string {
    const diff = new Date(endAt).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h left`;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m left`;
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

function statusColor(status: string) {
    switch (status) {
        case 'active': return { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/30' };
        case 'passed': return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' };
        case 'rejected': return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' };
        case 'pending': return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' };
        case 'executed': return { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' };
        default: return { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' };
    }
}

// ── Component ──────────────────────────────────────────────

export default function DAOGovernance() {
    const api = getApiClient();

    // Data state
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [totalProposals, setTotalProposals] = useState(0);
    const [token, setToken] = useState<GovernanceToken | null>(null);
    const [votingPower, setVotingPower] = useState(0);
    const [myVotes, setMyVotes] = useState<VoteRecord[]>([]);
    const [totalMembers, setTotalMembers] = useState(0);
    const [treasuryBalance, setTreasuryBalance] = useState(0);

    // UI state
    const [loading, setLoading] = useState(true);
    const [votingId, setVotingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Create proposal modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newCategory, setNewCategory] = useState<string>('platform');
    const [creating, setCreating] = useState(false);

    // ── Data Fetching ──────────────────────────────────────

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [proposalsRes, tokenRes, votesRes, leaderboardRes] = await Promise.allSettled([
                api.get<{ proposals: Proposal[]; total: number }>('/governance/proposals'),
                api.get<{ token: GovernanceToken; effectiveVotingPower: number }>('/governance/token/my'),
                api.get<{ votes: VoteRecord[]; total: number }>('/governance/votes/my'),
                api.get<{ totalSupply: number; totalHolders: number }>('/governance/token/leaderboard?limit=1'),
            ]);

            if (proposalsRes.status === 'fulfilled') {
                setProposals(proposalsRes.value.proposals);
                setTotalProposals(proposalsRes.value.total);
            }
            if (tokenRes.status === 'fulfilled') {
                setToken(tokenRes.value.token);
                setVotingPower(tokenRes.value.effectiveVotingPower);
            }
            if (votesRes.status === 'fulfilled') {
                setMyVotes(votesRes.value.votes);
            }
            if (leaderboardRes.status === 'fulfilled') {
                setTotalMembers(leaderboardRes.value.totalHolders);
                setTreasuryBalance(leaderboardRes.value.totalSupply);
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to load governance data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Vote Handler ───────────────────────────────────────

    const handleVote = async (proposalId: string, choice: 'for' | 'against') => {
        if (votingId) return;
        setVotingId(proposalId);
        try {
            await api.post('/governance/proposal/vote', { proposalId, choice });
            await fetchData(); // Refresh all data after voting
        } catch (err: any) {
            const msg = err?.error || err?.message || 'Vote failed';
            alert(msg);
        } finally {
            setVotingId(null);
        }
    };

    // ── Create Proposal Handler ────────────────────────────

    const handleCreateProposal = async () => {
        if (!newTitle.trim() || !newDescription.trim()) return;
        setCreating(true);
        try {
            await api.post('/governance/proposal/create', {
                title: newTitle,
                description: newDescription,
                category: newCategory,
                actions: [],
            });
            setShowCreateModal(false);
            setNewTitle('');
            setNewDescription('');
            await fetchData();
        } catch (err: any) {
            alert(err?.error || 'Failed to create proposal');
        } finally {
            setCreating(false);
        }
    };

    // ── Helpers for current user's vote status on a proposal ──

    const myVoteForProposal = (proposalId: string) => {
        return myVotes.find(v => v.proposalId === proposalId);
    };

    // ── Loading Skeleton ───────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-[#141416] text-white p-6 md:p-8 pb-32 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={40} className="animate-spin text-amber-500 mx-auto mb-4" />
                    <p className="text-gray-400">Loading Governance Data...</p>
                </div>
            </div>
        );
    }

    // ── Active proposals count ──────────────────────────────
    const activeCount = proposals.filter(p => p.status === 'active' || p.status === 'pending').length;

    // ── Render ─────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#141416] text-[#e5e5e5] p-6 md:p-8 pb-32 font-sans selection:bg-amber-500/30">
            <div className="max-w-[1200px] mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold text-white tracking-wide">DAO Governance</h1>
                    {error && (
                        <div className="bg-red-500/10 text-red-400 text-sm px-4 py-2 rounded-lg border border-red-500/20">
                            {error}
                        </div>
                    )}
                </div>

                {/* Top Stats Cards */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <div className="bg-[#1c1d21] rounded-2xl p-6 border border-gray-800 shadow-md relative overflow-hidden group hover:border-amber-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-[#2a2b30] flex items-center justify-center mb-4 text-amber-500">
                            <Users size={20} />
                        </div>
                        <h3 className="text-gray-400 text-sm font-medium mb-1">Total Members</h3>
                        <p className="text-3xl font-bold text-white mb-2 tracking-tight">{formatNumber(totalMembers)}</p>
                        <p className="text-xs text-gray-500">Token holders</p>
                    </div>

                    <div className="bg-[#1c1d21] rounded-2xl p-6 border border-gray-800 shadow-md relative overflow-hidden group hover:border-amber-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-[#2a2b30] flex items-center justify-center mb-4 text-amber-500">
                            <Coins size={20} />
                        </div>
                        <h3 className="text-gray-400 text-sm font-medium mb-1">Total Supply</h3>
                        <p className="text-3xl font-bold text-white mb-2 tracking-tight">{formatNumber(treasuryBalance)} GOV</p>
                        <p className="text-xs text-gray-500">Governance tokens</p>
                    </div>

                    <div className="bg-[#1c1d21] rounded-2xl p-6 border border-gray-800 shadow-md relative overflow-hidden group hover:border-amber-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-[#2a2b30] flex items-center justify-center mb-4 text-amber-500">
                            <Gavel size={20} />
                        </div>
                        <h3 className="text-gray-400 text-sm font-medium mb-1">Active Proposals</h3>
                        <p className="text-3xl font-bold text-white mb-2 tracking-tight">{activeCount}</p>
                        <p className="text-xs text-amber-500 font-medium">{totalProposals} total</p>
                    </div>

                    <div className="bg-[#1c1d21] rounded-2xl p-6 border border-gray-800 shadow-md relative overflow-hidden group hover:border-amber-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-[#2a2b30] flex items-center justify-center mb-4 text-amber-500">
                            <Hand size={20} />
                        </div>
                        <h3 className="text-gray-400 text-sm font-medium mb-1">Your Voting Power</h3>
                        <p className="text-3xl font-bold text-white mb-2 tracking-tight">{votingPower}</p>
                        <p className="text-xs text-gray-500">Balance: {token?.balance ?? 0}</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    {/* Main Content Area (Proposals Grid) */}
                    <div className="flex-[3]">
                        {proposals.length === 0 ? (
                            <div className="bg-[#1c1d21] rounded-2xl p-12 border border-gray-800 text-center">
                                <Gavel size={48} className="text-gray-700 mx-auto mb-4" />
                                <p className="text-gray-400 text-lg mb-2">No proposals yet</p>
                                <p className="text-gray-500 text-sm">Be the first to create a proposal for the community.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {proposals.map((proposal) => {
                                    const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
                                    const forPercent = totalVotes > 0 ? Math.round((proposal.forVotes / totalVotes) * 100) : 0;
                                    const againstPercent = totalVotes > 0 ? Math.round((proposal.againstVotes / totalVotes) * 100) : 0;
                                    const sc = statusColor(proposal.status);
                                    const existingVote = myVoteForProposal(proposal.id);
                                    const canVote = (proposal.status === 'active') && !existingVote && votingPower > 0;
                                    const isVotingThis = votingId === proposal.id;

                                    return (
                                        <div key={proposal.id} className={`bg-[#1c1d21] rounded-2xl p-6 border shadow-lg transition-colors flex flex-col ${sc.border}`}>
                                            {/* Status & Top bar */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div className={`flex items-center gap-1.5 ${sc.bg} ${sc.text} px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase`}>
                                                    <Check size={12} strokeWidth={3} /> {proposal.status}
                                                </div>
                                                <span className="text-xs text-gray-500">{proposal.totalVoters} voters</span>
                                            </div>

                                            {/* Title */}
                                            <h3 className="text-lg font-bold text-white leading-snug mb-2">{proposal.title}</h3>
                                            <p className="text-xs text-gray-500 mb-4 line-clamp-2">{proposal.description}</p>

                                            {/* Timing */}
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-xs text-gray-400 bg-[#2a2b30] px-2 py-1 rounded">{proposal.category}</span>
                                                <span className={`text-sm font-medium ${proposal.status === 'active' ? 'text-amber-500' : 'text-gray-500'}`}>
                                                    {proposal.status === 'active' || proposal.status === 'pending' ? timeLeft(proposal.endAt) : proposal.status}
                                                </span>
                                            </div>

                                            {/* Vote progress bar */}
                                            <div className="mb-4 mt-auto">
                                                <div className="h-1.5 w-full bg-[#2a2b30] rounded-full flex overflow-hidden mb-3">
                                                    {forPercent > 0 && <div className="h-full bg-amber-500" style={{ width: `${forPercent}%` }}></div>}
                                                    {againstPercent > 0 && <div className="h-full bg-red-500" style={{ width: `${againstPercent}%` }}></div>}
                                                </div>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-amber-500 font-medium">{forPercent}% For</span>
                                                    <span className="text-gray-400 font-medium">{againstPercent}% Against</span>
                                                </div>
                                                <div className="flex justify-between text-xs text-gray-500">
                                                    <span>{totalVotes} total votes</span>
                                                    <span>Quorum: {proposal.quorum}</span>
                                                </div>
                                            </div>

                                            {/* Vote buttons */}
                                            {canVote ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleVote(proposal.id, 'for')}
                                                        disabled={isVotingThis}
                                                        className="flex-1 bg-gradient-to-br from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-bold py-3 rounded-xl shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {isVotingThis ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} For
                                                    </button>
                                                    <button
                                                        onClick={() => handleVote(proposal.id, 'against')}
                                                        disabled={isVotingThis}
                                                        className="flex-1 bg-[#2a2b30] text-red-400 hover:bg-red-500/10 font-bold py-3 rounded-xl border border-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {isVotingThis ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Against
                                                    </button>
                                                </div>
                                            ) : existingVote ? (
                                                <div className={`text-center py-3 rounded-xl font-medium text-sm ${existingVote.choice === 'for' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    You voted {existingVote.choice === 'for' ? '✓ For' : '✗ Against'}
                                                </div>
                                            ) : (
                                                <div className="text-center py-3 rounded-xl bg-[#2a2b30] text-gray-500 text-sm font-medium">
                                                    {proposal.status !== 'active' ? 'Voting ended' : 'No voting power'}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right Panel */}
                    <div className="flex-1 max-w-[320px] flex flex-col gap-4">

                        {/* Profile Summary Card */}
                        <div className="bg-[#1c1d21] rounded-2xl p-6 border border-amber-500/20 shadow-lg flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-[#2a2b30] border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center justify-center mb-4">
                                <Hand size={28} className="text-amber-500" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-1">{votingPower}</h2>
                            <p className="text-gray-400 text-sm font-medium mb-6">Voting Power</p>

                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="w-full bg-gradient-to-br from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-bold py-3 rounded-xl shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={18} /> Create Proposal
                            </button>
                        </div>

                        {/* Voting History Card */}
                        <div className="bg-[#1c1d21] rounded-2xl p-6 border border-gray-800 shadow-lg">
                            <h3 className="text-lg font-bold text-white mb-4">Voting History</h3>

                            {myVotes.length === 0 ? (
                                <p className="text-gray-500 text-sm">No votes cast yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {myVotes.slice(0, 8).map((vote) => (
                                        <div key={vote.id} className="flex justify-between items-center bg-[#2a2b30] p-3 rounded-xl">
                                            <span className="text-gray-400 text-sm font-medium truncate max-w-[120px]">
                                                {vote.proposal?.title || vote.proposalId.slice(0, 8)}
                                            </span>
                                            <span className={`text-sm font-medium flex items-center gap-1 ${vote.choice === 'for' ? 'text-green-500' : vote.choice === 'against' ? 'text-red-500' : 'text-gray-400'}`}>
                                                {vote.choice === 'for' ? 'For' : vote.choice === 'against' ? 'Against' : 'Abstain'}
                                                {vote.choice === 'for' ? <Check size={14} /> : <X size={14} />}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Create Proposal Modal ────────────────────── */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-[#1c1d21] rounded-2xl p-8 border border-gray-700 shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-white mb-6">Create Proposal</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Title</label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="e.g. Increase creator revenue share to 92%"
                                    className="w-full bg-[#2a2b30] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Description</label>
                                <textarea
                                    value={newDescription}
                                    onChange={e => setNewDescription(e.target.value)}
                                    rows={4}
                                    placeholder="Describe what this proposal aims to achieve..."
                                    className="w-full bg-[#2a2b30] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none transition-colors resize-none"
                                />
                            </div>

                            <div>
                                <label className="text-sm text-gray-400 mb-1 block">Category</label>
                                <select
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    className="w-full bg-[#2a2b30] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none transition-colors"
                                >
                                    <option value="platform">Platform</option>
                                    <option value="treasury">Treasury</option>
                                    <option value="parameter">Parameter</option>
                                    <option value="community">Community</option>
                                    <option value="emergency">Emergency</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 bg-[#2a2b30] text-gray-300 font-bold py-3 rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateProposal}
                                disabled={creating || !newTitle.trim() || !newDescription.trim()}
                                className="flex-1 bg-gradient-to-br from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-bold py-3 rounded-xl shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
