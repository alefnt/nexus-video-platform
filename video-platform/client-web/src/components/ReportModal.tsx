/**
 * ReportModal — Universal content report dialog
 * Supports: copyright, inappropriate, spam, harassment, other
 */

import React, { useState } from 'react';
import { getApiClient } from '../lib/apiClient';

const client = getApiClient();

const REPORT_REASONS = [
    { id: 'copyright', icon: '©️', label: 'Copyright Infringement', desc: 'Unauthorized use of copyrighted material' },
    { id: 'inappropriate', icon: '🔞', label: 'Inappropriate Content', desc: 'Adult, violent, or disturbing content' },
    { id: 'spam', icon: '🚫', label: 'Spam / Scam', desc: 'Misleading, deceptive, or repetitive content' },
    { id: 'harassment', icon: '⚠️', label: 'Harassment / Hate Speech', desc: 'Targeting individuals or groups' },
    { id: 'misinformation', icon: '❌', label: 'Misinformation', desc: 'False or misleading information' },
    { id: 'other', icon: '📝', label: 'Other', desc: 'Something else not listed above' },
];

interface ReportModalProps {
    contentId: string;
    contentType: 'video' | 'music' | 'article' | 'live' | 'comment' | 'user';
    onClose: () => void;
}

export default function ReportModal({ contentId, contentType, onClose }: ReportModalProps) {
    const [selectedReason, setSelectedReason] = useState('');
    const [details, setDetails] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!selectedReason) return;
        try {
            setLoading(true); setError('');
            const jwt = sessionStorage.getItem('vp.jwt');
            if (jwt) client.setJWT(jwt);
            await client.post('/moderation/report', {
                contentId,
                contentType,
                reason: selectedReason,
                details: details.trim() || undefined,
            });
            setSubmitted(true);
        } catch (e: any) {
            setError(e?.error || e?.message || 'Failed to submit report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md mx-4 bg-[#0A0A14] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.1)]"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                        🚩 Report {contentType}
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">✕</button>
                </div>

                <div className="p-5">
                    {submitted ? (
                        <div className="text-center py-8 space-y-4">
                            <div className="text-4xl">✅</div>
                            <p className="text-lg font-bold text-white">Report Submitted</p>
                            <p className="text-sm text-gray-400">Thank you for helping keep Nexus safe. Our moderation team will review this report.</p>
                            <button onClick={onClose} className="px-8 py-2 bg-white/10 text-white rounded-lg text-sm font-bold hover:bg-white/20 transition-colors">Close</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Reason Selection */}
                            <div className="space-y-2">
                                {REPORT_REASONS.map(reason => (
                                    <button key={reason.id} onClick={() => setSelectedReason(reason.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${selectedReason === reason.id
                                                ? 'bg-red-500/10 border-red-500/30 text-white'
                                                : 'bg-white/3 border-white/5 text-gray-400 hover:border-white/15 hover:text-gray-200'
                                            }`}>
                                        <span className="text-lg">{reason.icon}</span>
                                        <div>
                                            <div className="text-sm font-bold">{reason.label}</div>
                                            <div className="text-[10px] text-gray-500">{reason.desc}</div>
                                        </div>
                                        {selectedReason === reason.id && <span className="ml-auto text-red-400">●</span>}
                                    </button>
                                ))}
                            </div>

                            {/* Details */}
                            {selectedReason && (
                                <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-600 resize-none focus:border-red-500/30 outline-none"
                                    placeholder="Additional details (optional)..." />
                            )}

                            {error && <div className="text-red-400 text-xs p-2 bg-red-500/10 rounded">{error}</div>}

                            {/* Submit */}
                            <button onClick={handleSubmit} disabled={!selectedReason || loading}
                                className="w-full py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-30 bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                                {loading ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
