/**
 * DAOVoting — Community governance proposals and voting
 * Stub page for future DAO integration
 */

import React, { useState, useEffect } from 'react';
import { getApiClient } from '../lib/apiClient';
import { usePageTitle } from '../hooks/usePageTitle';

const client = getApiClient();

interface Proposal {
    id: string;
    title: string;
    description: string;
    author: string;
    status: 'active' | 'passed' | 'rejected' | 'pending';
    votesFor: number;
    votesAgainst: number;
    totalVoters: number;
    deadline: string;
    createdAt: string;
}

const MOCK_PROPOSALS: Proposal[] = [
    { id: '1', title: 'Increase Creator Revenue Split to 85%', description: 'Proposal to increase the creator\'s share of content revenue from 80% to 85%, funded by reducing platform fees.', author: 'NexusDAO', status: 'active', votesFor: 1247, votesAgainst: 312, totalVoters: 1559, deadline: '2026-04-01', createdAt: '2026-03-01' },
    { id: '2', title: 'Add Community Moderation Council', description: 'Elect 7 community members to serve as content moderators with appeal rights.', author: 'CommunityGov', status: 'active', votesFor: 890, votesAgainst: 156, totalVoters: 1046, deadline: '2026-03-25', createdAt: '2026-02-28' },
    { id: '3', title: 'Implement Token Burn Mechanism', description: 'Burn 5% of all platform fees to create deflationary tokenomics.', author: 'TokenEco', status: 'passed', votesFor: 2100, votesAgainst: 340, totalVoters: 2440, deadline: '2026-02-28', createdAt: '2026-02-15' },
    { id: '4', title: 'Launch Mobile App Beta', description: 'Allocate funds for React Native mobile app development targeting Q3 2026.', author: 'MobileDev', status: 'pending', votesFor: 0, votesAgainst: 0, totalVoters: 0, deadline: '2026-04-15', createdAt: '2026-03-05' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    active: { bg: 'rgba(34,211,238,0.1)', text: '#22d3ee', border: 'rgba(34,211,238,0.3)' },
    passed: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
    rejected: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    pending: { bg: 'rgba(234,179,8,0.1)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
};

export default function DAOVoting() {
    usePageTitle('DAO Governance');
    const [proposals, setProposals] = useState<Proposal[]>(MOCK_PROPOSALS);
    const [filter, setFilter] = useState<string>('all');
    const [votingId, setVotingId] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const jwt = sessionStorage.getItem('vp.jwt');
                if (jwt) client.setJWT(jwt);
                const res = await client.get<{ proposals: Proposal[] }>('/dao/proposals');
                if (res?.proposals?.length) setProposals(res.proposals);
            } catch { /* keep mock data */ }
        })();
    }, []);

    const vote = async (proposalId: string, support: boolean) => {
        try {
            setVotingId(proposalId);
            const jwt = sessionStorage.getItem('vp.jwt');
            if (jwt) client.setJWT(jwt);
            await client.post('/dao/vote', { proposalId, support });
            setProposals(prev => prev.map(p => {
                if (p.id !== proposalId) return p;
                return {
                    ...p,
                    votesFor: support ? p.votesFor + 1 : p.votesFor,
                    votesAgainst: !support ? p.votesAgainst + 1 : p.votesAgainst,
                    totalVoters: p.totalVoters + 1,
                };
            }));
        } catch (e: any) {
            alert(e?.error || e?.message || 'Vote failed');
        } finally {
            setVotingId(null);
        }
    };

    const filtered = filter === 'all' ? proposals : proposals.filter(p => p.status === filter);

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 80px', color: '#fff' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 6px', letterSpacing: 2 }}>🏛️ DAO GOVERNANCE</h1>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Shape the future of Nexus through community proposals and voting</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
                {(['all', 'active', 'passed', 'rejected', 'pending'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                        padding: '8px 18px', borderRadius: 20, border: '1px solid', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: filter === f ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
                        borderColor: filter === f ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.1)',
                        color: filter === f ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                    }}>
                        {f === 'all' ? `All (${proposals.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${proposals.filter(p => p.status === f).length})`}
                    </button>
                ))}
            </div>

            {/* Proposals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filtered.map(proposal => {
                    const sc = STATUS_COLORS[proposal.status];
                    const totalVotes = proposal.votesFor + proposal.votesAgainst;
                    const forPercent = totalVotes > 0 ? Math.round((proposal.votesFor / totalVotes) * 100) : 0;

                    return (
                        <div key={proposal.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, transition: 'border-color 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                                            {proposal.status}
                                        </span>
                                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>by {proposal.author}</span>
                                    </div>
                                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>{proposal.title}</h3>
                                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>{proposal.description}</p>
                                </div>
                            </div>

                            {/* Vote Bar */}
                            <div style={{ margin: '16px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                                    <span style={{ color: '#22c55e' }}>For: {proposal.votesFor} ({forPercent}%)</span>
                                    <span style={{ color: '#ef4444' }}>Against: {proposal.votesAgainst} ({100 - forPercent}%)</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex' }}>
                                    <div style={{ width: `${forPercent}%`, background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: 3, transition: 'width 0.3s' }} />
                                    <div style={{ flex: 1, background: totalVotes > 0 ? 'rgba(239,68,68,0.3)' : 'transparent', borderRadius: 3 }} />
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                                    {proposal.totalVoters} voters · Deadline: {proposal.deadline}
                                </div>
                            </div>

                            {/* Vote Buttons */}
                            {proposal.status === 'active' && (
                                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                                    <button onClick={() => vote(proposal.id, true)} disabled={votingId === proposal.id}
                                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                        {votingId === proposal.id ? '...' : '👍 Vote For'}
                                    </button>
                                    <button onClick={() => vote(proposal.id, false)} disabled={votingId === proposal.id}
                                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                        {votingId === proposal.id ? '...' : '👎 Vote Against'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏛️</div>
                    <p>No proposals in this category</p>
                </div>
            )}
        </div>
    );
}
