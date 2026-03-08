/**
 * Creator Contracts & Splits — Studio Contracts Page
 *
 * Features:
 * - List active split contracts from backend API
 * - Create new split contract with participant management
 * - Visual split flow diagram
 * - Edit + Execute revenue distribution
 * - RGB++ on-chain status indicator
 */
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { setPageSEO } from "../utils/seo";
import { getApiClient } from "../lib/apiClient";

/* ── Types ── */
interface SplitParticipant {
    address: string;
    label: string;
    percentage: number;
    role?: string;
}

interface SplitContract {
    contractId: string;
    name: string;
    targetType: string;
    targetIds: string[];
    playRatePerSecond?: number;
    createdAt: string;
    participants?: Array<{ nickname?: string; address?: string; percentage: number; role: string }>;
}

/* ── Colors for split bars ── */
const SPLIT_COLORS = [
    "bg-blue-500", "bg-green-500", "bg-pink-500", "bg-amber-500",
    "bg-purple-500", "bg-red-500", "bg-cyan-500", "bg-indigo-500",
];

/* ── Studio nav ── */
function StudioNav({ active }: { active: string }) {
    const navigate = useNavigate();
    const tabs = [
        { key: "dashboard", label: "Dashboard", path: "/creator/dashboard" },
        { key: "content", label: "Content", path: "/creator/content" },
        { key: "analytics", label: "Analytics", path: "/creator/analytics" },
        { key: "contracts", label: "Contracts & Splits", path: "/creator/contracts" },
    ];
    return (
        <nav className="flex items-center gap-6">
            {tabs.map(t => (
                <button key={t.key} onClick={() => navigate(t.path)}
                    className={`text-sm font-bold transition-colors ${active === t.key
                        ? "text-white border-b-2 border-nexusPurple pb-1 relative top-[2px]"
                        : "text-gray-500 hover:text-white"}`}>
                    {t.label}
                </button>
            ))}
        </nav>
    );
}

/* ── New Split Contract Modal ── */
function NewContractModal({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: () => void;
}) {
    const [name, setName] = useState("");
    const [contentType, setContentType] = useState("video");
    const [playRate, setPlayRate] = useState(0.1);
    const [participants, setParticipants] = useState<SplitParticipant[]>([
        { address: "", label: "You (Owner)", percentage: 70, role: "owner" },
        { address: "", label: "Collaborator", percentage: 30, role: "collaborator" },
    ]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const totalPct = participants.reduce((s, p) => s + p.percentage, 0);

    const addParticipant = () => {
        setParticipants([...participants, { address: "", label: "", percentage: 0, role: "collaborator" }]);
    };

    const removeParticipant = (i: number) => {
        if (participants.length <= 2) return;
        setParticipants(participants.filter((_, idx) => idx !== i));
    };

    const updateParticipant = (i: number, field: string, value: any) => {
        const updated = [...participants];
        (updated[i] as any)[field] = value;
        setParticipants(updated);
    };

    const handleCreate = async () => {
        if (!name.trim()) { setError("Contract name is required"); return; }
        if (Math.abs(totalPct - 100) > 0.01) { setError(`Percentages must total 100% (current: ${totalPct}%)`); return; }
        if (participants.some(p => !p.address.trim())) { setError("All participants must have a CKB address"); return; }

        setLoading(true);
        setError("");
        try {
            const api = getApiClient();
            await api.post("/payment/splits", {
                name,
                contentType,
                playRatePerSecond: playRate,
                participants: participants.map(p => ({
                    address: p.address, label: p.label, percentage: p.percentage, role: p.role,
                })),
                terms: { commercialUse: true, derivativeWorks: false, royaltyPercentage: playRate * 100 },
            });
            onCreated();
            onClose();
            setName(""); setParticipants([
                { address: "", label: "You (Owner)", percentage: 70, role: "owner" },
                { address: "", label: "Collaborator", percentage: 30, role: "collaborator" },
            ]);
        } catch (err: any) {
            setError(err?.response?.data?.error || err.message || "Failed to create contract");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#0A0A1A] border border-white/10 rounded-2xl w-full max-w-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-black text-white mb-2">New Split Contract</h2>
                <p className="text-gray-400 text-sm mb-6">Configure automatic revenue distribution for your content.</p>

                {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}

                {/* Contract Name */}
                <div className="mb-4">
                    <label className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-1 block">Contract Name</label>
                    <input value={name} onChange={e => setName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-nexusPurple/50 outline-none"
                        placeholder="e.g. Podcast Season 1 Pool" />
                </div>

                {/* Content Type */}
                <div className="mb-4 flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-1 block">Content Type</label>
                        <select value={contentType} onChange={e => setContentType(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none">
                            <option value="video">Video</option>
                            <option value="music">Music</option>
                            <option value="article">Article</option>
                            <option value="live">Live Stream</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-1 block">Play Rate (pts/sec)</label>
                        <div className="flex items-center gap-3">
                            <input type="range" min="0.01" max="1" step="0.01" value={playRate}
                                onChange={e => setPlayRate(Number(e.target.value))}
                                className="flex-1 accent-nexusPurple" />
                            <span className="text-nexusCyan font-mono font-bold w-12 text-right">{playRate.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Percentage Visual Bar */}
                <div className="mb-2 flex rounded-full overflow-hidden h-3 bg-black/40 border border-white/5">
                    {participants.map((p, i) => (
                        <div key={i} className={`${SPLIT_COLORS[i % SPLIT_COLORS.length]} transition-all duration-300`}
                            style={{ width: `${p.percentage}%` }} />
                    ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-4">
                    <span>Total: <span className={Math.abs(totalPct - 100) > 0.01 ? "text-red-400 font-bold" : "text-green-400 font-bold"}>{totalPct}%</span></span>
                    <span>{Math.abs(totalPct - 100) > 0.01 ? "⚠️ Must total 100%" : "✅ Valid"}</span>
                </div>

                {/* Participants */}
                <label className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-2 block">Participants</label>
                <div className="space-y-3 mb-4">
                    {participants.map((p, i) => (
                        <div key={i} className="flex gap-2 items-center bg-black/30 border border-white/5 rounded-xl p-3">
                            <div className={`w-3 h-3 rounded-full ${SPLIT_COLORS[i % SPLIT_COLORS.length]} flex-shrink-0`} />
                            <input value={p.label} onChange={e => updateParticipant(i, "label", e.target.value)}
                                className="bg-transparent border-b border-white/10 text-sm text-white w-24 outline-none"
                                placeholder="Label" />
                            <input value={p.address} onChange={e => updateParticipant(i, "address", e.target.value)}
                                className="bg-transparent border-b border-white/10 text-xs font-mono text-gray-300 flex-1 outline-none"
                                placeholder="ckt1q..." />
                            <select value={p.role} onChange={e => updateParticipant(i, "role", e.target.value)}
                                className="bg-transparent text-xs text-gray-400 outline-none border-b border-white/10">
                                <option value="owner">Owner</option>
                                <option value="collaborator">Collaborator</option>
                                <option value="editor">Editor</option>
                                <option value="producer">Producer</option>
                            </select>
                            <input type="number" value={p.percentage} onChange={e => updateParticipant(i, "percentage", Number(e.target.value))}
                                className="bg-transparent border-b border-white/10 text-sm text-white w-14 text-right outline-none font-mono"
                                min={0} max={100} />
                            <span className="text-gray-500 text-xs">%</span>
                            {participants.length > 2 && (
                                <button onClick={() => removeParticipant(i)} className="text-red-400 hover:text-red-300 text-lg ml-1">×</button>
                            )}
                        </div>
                    ))}
                </div>

                <button onClick={addParticipant}
                    className="text-sm text-nexusPurple hover:text-pink-400 font-bold mb-6 flex items-center gap-1">
                    <span className="text-lg">+</span> Add Participant
                </button>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm text-gray-400 hover:text-white transition">Cancel</button>
                    <button onClick={handleCreate} disabled={loading}
                        className="px-6 py-2.5 bg-gradient-to-r from-nexusPurple to-pink-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:shadow-lg hover:shadow-purple-500/30 transition-all">
                        {loading ? "Creating..." : "Create Contract"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── Main page ── */
export default function CreatorContracts() {
    const navigate = useNavigate();
    const [contracts, setContracts] = useState<SplitContract[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => { setPageSEO?.({ title: "Contracts & Splits | Nexus Video" }); }, []);

    const fetchContracts = useCallback(async () => {
        try {
            const api = getApiClient();
            const res = await api.get("/payment/splits");
            setContracts(res.data?.contracts || []);
        } catch {
            /* silently fail — show empty state */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchContracts(); }, [fetchContracts]);

    const handleExecute = async (contractId: string) => {
        const amount = prompt("Enter total revenue amount (points) to distribute:");
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
        try {
            const api = getApiClient();
            const res = await api.post(`/payment/splits/${contractId}/execute`, { totalRevenue: Number(amount) });
            alert(`✅ Distribution complete!\nPlatform fee: ${res.data.platformFee}\nTotal distributed: ${res.data.totalDistributed}\n\n${res.data.distributions?.map((d: any) => `${d.nickname || d.address}: ${d.amount} pts (${d.percentage}%)`).join('\n')}`);
        } catch (err: any) {
            alert("Distribution failed: " + (err?.response?.data?.error || err.message));
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <header className="h-20 flex-shrink-0 flex items-center justify-between px-10 border-b border-white/5 bg-[#050510] relative z-20">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/home")}>
                        <svg className="w-8 h-8 text-nexusCyan drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        <span className="text-xl font-black tracking-widest text-white">STUDIO</span>
                    </div>
                    <StudioNav active="contracts" />
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowModal(true)}
                        className="bg-gradient-to-r from-nexusPurple to-pink-500 hover:shadow-lg hover:shadow-purple-500/30 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        New Split Contract
                    </button>
                </div>
            </header>

            <main className="flex-1 p-8 overflow-y-auto w-full max-w-6xl mx-auto space-y-10 relative z-10">
                <div>
                    <h1 className="text-3xl font-black text-white mb-2 tracking-wide">Revenue Splits & Smart Contracts</h1>
                    <p className="text-gray-400 text-sm">Automatically route portions of your incoming streams and tips to collaborators, editors, and producers via RGB++ on CKB.</p>
                </div>

                <div className="space-y-6">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                        {loading ? "Loading..." : `Active Contracts (${contracts.length})`}
                    </h2>

                    {!loading && contracts.length === 0 && (
                        <div className="glass-panel rounded-2xl p-12 text-center border-white/5">
                            <div className="w-16 h-16 rounded-full bg-nexusPurple/10 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-nexusPurple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">No Split Contracts Yet</h3>
                            <p className="text-gray-500 text-sm mb-4">Create your first revenue split contract to automatically distribute earnings to collaborators.</p>
                            <button onClick={() => setShowModal(true)} className="text-nexusPurple hover:text-pink-400 font-bold text-sm">
                                + Create Split Contract
                            </button>
                        </div>
                    )}

                    {contracts.map((contract, ci) => (
                        <div key={contract.contractId} className="glass-panel rounded-2xl p-6 border-nexusPurple/30 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-nexusPurple/5 to-transparent" />
                            <div className="relative z-10 flex flex-col md:flex-row gap-8">
                                <div className="flex-1 space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                                {contract.name}
                                                <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">Active</span>
                                                <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">RGB++</span>
                                            </h3>
                                            <p className="text-xs text-gray-500 font-mono mt-1">Contract: {contract.contractId.slice(0, 8)}...{contract.contractId.slice(-4)}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex-1">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Content Type</p>
                                            <div className="text-sm font-bold text-nexusCyan capitalize">{contract.targetType}</div>
                                        </div>
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex-1">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Play Rate</p>
                                            <div className="text-sm font-bold text-white font-mono">{contract.playRatePerSecond || 0.1} pts/s</div>
                                        </div>
                                        <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex-1">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Linked Content</p>
                                            <div className="text-sm font-bold text-white">{contract.targetIds?.length || 0} items</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 border-l border-white/10 pl-8 relative min-h-[160px] flex items-center justify-center">
                                    <div className="w-full relative flex items-center justify-between">
                                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-nexusPurple to-pink-500 flex items-center justify-center relative z-10 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                        <div className="absolute left-16 right-48 top-1/2 h-px border-t border-dashed border-nexusPurple/50" />
                                        <div className="flex flex-col gap-3 relative z-10 w-48">
                                            {(contract.participants || []).map((s, i) => (
                                                <div key={i} className={`bg-[#0A0A14] border rounded p-2 flex items-center justify-between text-xs ${i === 0 ? "border-nexusPurple/50" : "border-white/10"}`}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded-full ${SPLIT_COLORS[i % SPLIT_COLORS.length]}`} />
                                                        <span className="font-mono text-gray-300">{s.nickname || s.address?.slice(0, 8) || "..."}</span>
                                                    </div>
                                                    <span className="font-bold text-white">{s.percentage}%</span>
                                                </div>
                                            ))}
                                            {(!contract.participants || contract.participants.length === 0) && (
                                                <div className="text-xs text-gray-500 italic">No participants data</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/5 flex gap-4 text-xs font-bold uppercase tracking-widest w-full">
                                <button className="text-nexusPurple hover:text-pink-400 transition-colors">Edit Split</button>
                                <button onClick={() => handleExecute(contract.contractId)} className="text-nexusCyan hover:text-white transition-colors">Execute Distribution</button>
                                <button className="text-gray-500 hover:text-white transition-colors" onClick={() => navigate("/creator/content")}>Manage Content</button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <NewContractModal open={showModal} onClose={() => setShowModal(false)} onCreated={fetchContracts} />
        </div>
    );
}
