/**
 * ArticleEditor — Rich content editor for creators
 * Supports Markdown editing with live preview, tags, cover image, pricing
 */

import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { getApiClient } from '../lib/apiClient';
import { showAlert, showConfirm } from '../components/ui/ConfirmModal';

const client = getApiClient();

interface ArticleDraft {
    title: string;
    content: string;
    tags: string[];
    coverUrl: string;
    priceMode: 'free' | 'paid';
    price: number;
    summary: string;
}

const INITIAL_DRAFT: ArticleDraft = {
    title: '',
    content: '',
    tags: [],
    coverUrl: '',
    priceMode: 'free',
    price: 0,
    summary: '',
};

export default function ArticleEditor() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    usePageTitle('Article Editor');

    const [draft, setDraft] = useState<ArticleDraft>(INITIAL_DRAFT);
    const [tagInput, setTagInput] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const set = useCallback(<K extends keyof ArticleDraft>(key: K, val: ArticleDraft[K]) => {
        setDraft(prev => ({ ...prev, [key]: val }));
    }, []);

    const addTag = useCallback(() => {
        const tag = tagInput.trim();
        if (tag && !draft.tags.includes(tag) && draft.tags.length < 8) {
            setDraft(prev => ({ ...prev, tags: [...prev.tags, tag] }));
            setTagInput('');
        }
    }, [tagInput, draft.tags]);

    const removeTag = useCallback((tag: string) => {
        setDraft(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
    }, []);

    const handlePublish = useCallback(async () => {
        if (!draft.title.trim()) {
            showAlert({ title: 'Missing Title', message: 'Please enter an article title.' });
            return;
        }
        if (!draft.content.trim()) {
            showAlert({ title: 'Missing Content', message: 'Please write some content before publishing.' });
            return;
        }

        const confirmed = await showConfirm({
            title: 'Publish Article / 发布文章',
            message: `"${draft.title}" will be published ${draft.priceMode === 'paid' ? `at ${draft.price} PTS` : 'for free'}.\n\nContinue?`,
            confirmText: 'Publish',
            variant: 'success',
        });
        if (!confirmed) return;

        setPublishing(true);
        try {
            const jwt = sessionStorage.getItem('vp.jwt');
            if (jwt) client.setJWT(jwt);

            const userRaw = sessionStorage.getItem('vp.user');
            const user = userRaw ? JSON.parse(userRaw) as { bitDomain?: string; ckbAddress?: string } : null;

            const articleId = crypto.randomUUID();
            const pointsPrice = draft.priceMode === 'paid' ? draft.price : 0;

            await client.post('/metadata/write', {
                meta: {
                    id: articleId,
                    contentType: 'article',
                    title: draft.title,
                    description: draft.summary || draft.content.slice(0, 200),
                    textContent: draft.content,
                    creatorBitDomain: user?.bitDomain || '',
                    creatorCkbAddress: user?.ckbAddress || '',
                    priceUSDI: pointsPrice > 0 ? (pointsPrice / 1000).toString() : '0',
                    pointsPrice: pointsPrice,
                    priceMode: draft.priceMode === 'paid' ? 'both' : 'free',
                    buyOncePrice: pointsPrice,
                    streamPricePerMinute: draft.priceMode === 'paid' ? 2 : 0,
                    cdnUrl: '',
                    posterUrl: draft.coverUrl || undefined,
                    genre: 'Article',
                    tags: draft.tags,
                    createdAt: new Date().toISOString(),
                },
            });

            showAlert({ title: 'Published! / 发布成功！', message: 'Your article is now live.', variant: 'success' });
            navigate('/articles');
        } catch (e: any) {
            showAlert({ title: 'Publish Failed', message: e?.message || 'Unknown error', variant: 'danger' });
        } finally {
            setPublishing(false);
        }
    }, [draft, navigate]);

    // Simple markdown to HTML converter for preview
    const renderPreview = (md: string) => {
        return md
            .replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:700;margin:16px 0 8px;color:#fff">$1</h3>')
            .replace(/^## (.+)$/gm, '<h2 style="font-size:22px;font-weight:700;margin:20px 0 10px;color:#fff">$1</h2>')
            .replace(/^# (.+)$/gm, '<h1 style="font-size:28px;font-weight:800;margin:24px 0 12px;color:#fff">$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff">$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code style="background:rgba(139,92,246,0.15);padding:2px 6px;border-radius:4px;font-size:13px;color:#c4b5fd">$1</code>')
            .replace(/\n/g, '<br/>');
    };

    const S = styles;

    return (
        <div style={S.container}>
            <div style={S.header}>
                <h1 style={S.title}>✏️ Article Editor</h1>
                <p style={S.subtitle}>Create and publish articles on Nexus</p>
            </div>

            <div style={S.editorGrid}>
                {/* Left: Editor */}
                <div style={S.editorPane}>
                    {/* Title */}
                    <input
                        style={S.titleInput}
                        placeholder="Article title..."
                        value={draft.title}
                        onChange={e => set('title', e.target.value)}
                        maxLength={120}
                    />

                    {/* Summary */}
                    <input
                        style={{ ...S.titleInput, fontSize: 14, fontWeight: 400 }}
                        placeholder="Brief summary (optional)..."
                        value={draft.summary}
                        onChange={e => set('summary', e.target.value)}
                        maxLength={300}
                    />

                    {/* Toolbar */}
                    <div style={S.toolbar}>
                        <button style={S.toolBtn} onClick={() => setPreviewMode(!previewMode)}>
                            {previewMode ? '📝 Edit' : '👁 Preview'}
                        </button>
                        <button style={S.toolBtn} onClick={() => {
                            const ta = textareaRef.current;
                            if (ta) {
                                const pos = ta.selectionStart;
                                const before = draft.content.slice(0, pos);
                                const after = draft.content.slice(pos);
                                set('content', before + '**bold**' + after);
                            }
                        }}>B</button>
                        <button style={S.toolBtn} onClick={() => {
                            const ta = textareaRef.current;
                            if (ta) {
                                const pos = ta.selectionStart;
                                const before = draft.content.slice(0, pos);
                                const after = draft.content.slice(pos);
                                set('content', before + '*italic*' + after);
                            }
                        }}>I</button>
                        <button style={S.toolBtn} onClick={() => {
                            set('content', draft.content + '\n## Heading\n');
                        }}>H2</button>
                        <button style={S.toolBtn} onClick={() => {
                            set('content', draft.content + '\n```\ncode block\n```\n');
                        }}>{'</>'}</button>
                        <span style={{ flex: 1 }} />
                        <span style={S.charCount}>{draft.content.length} chars</span>
                    </div>

                    {/* Content Area */}
                    {previewMode ? (
                        <div
                            style={S.previewArea}
                            dangerouslySetInnerHTML={{ __html: renderPreview(draft.content) }}
                        />
                    ) : (
                        <textarea
                            ref={textareaRef}
                            style={S.textarea}
                            placeholder="Write your article in Markdown...\n\n# Heading\n**bold** *italic* `code`\n\nStart writing..."
                            value={draft.content}
                            onChange={e => set('content', e.target.value)}
                        />
                    )}
                </div>

                {/* Right: Settings */}
                <div style={S.settingsPane}>
                    {/* Cover Image */}
                    <div style={S.settingGroup}>
                        <label style={S.label}>Cover Image URL</label>
                        <input
                            style={S.input}
                            placeholder="https://..."
                            value={draft.coverUrl}
                            onChange={e => set('coverUrl', e.target.value)}
                        />
                        {draft.coverUrl && (
                            <img src={draft.coverUrl} alt="cover" style={S.coverPreview} />
                        )}
                    </div>

                    {/* Tags */}
                    <div style={S.settingGroup}>
                        <label style={S.label}>Tags ({draft.tags.length}/8)</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input
                                style={{ ...S.input, flex: 1 }}
                                placeholder="Add tag..."
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addTag()}
                                maxLength={20}
                            />
                            <button style={S.addBtn} onClick={addTag}>+</button>
                        </div>
                        <div style={S.tagList}>
                            {draft.tags.map(tag => (
                                <span key={tag} style={S.tag}>
                                    {tag}
                                    <span style={S.tagRemove} onClick={() => removeTag(tag)}>×</span>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Pricing */}
                    <div style={S.settingGroup}>
                        <label style={S.label}>Pricing</label>
                        <div style={S.priceModes}>
                            <button
                                style={{ ...S.priceBtn, ...(draft.priceMode === 'free' ? S.priceBtnActive : {}) }}
                                onClick={() => set('priceMode', 'free')}
                            >
                                🆓 Free
                            </button>
                            <button
                                style={{ ...S.priceBtn, ...(draft.priceMode === 'paid' ? S.priceBtnActive : {}) }}
                                onClick={() => set('priceMode', 'paid')}
                            >
                                💰 Paid
                            </button>
                        </div>
                        {draft.priceMode === 'paid' && (
                            <input
                                style={S.input}
                                type="number"
                                placeholder="Price in PTS"
                                value={draft.price || ''}
                                onChange={e => set('price', Number(e.target.value))}
                                min={1}
                            />
                        )}
                    </div>

                    {/* Publish */}
                    <button
                        style={{
                            ...S.publishBtn,
                            opacity: publishing ? 0.6 : 1,
                        }}
                        onClick={handlePublish}
                        disabled={publishing}
                    >
                        {publishing ? 'Publishing...' : '🚀 Publish Article'}
                    </button>

                    <button
                        style={S.draftBtn}
                        onClick={() => {
                            localStorage.setItem('nexus.articleDraft', JSON.stringify(draft));
                            showAlert({ title: 'Saved', message: 'Draft saved locally.', variant: 'success' });
                        }}
                    >
                        💾 Save Draft
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Inline Styles ──────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        padding: '32px 40px 80px',
        color: '#fff',
    },
    header: { marginBottom: 28 },
    title: { fontSize: 28, fontWeight: 800, margin: 0 },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
    editorGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 24,
        alignItems: 'start',
    },
    editorPane: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    settingsPane: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        position: 'sticky' as const,
        top: 80,
    },
    titleInput: {
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        color: '#fff',
        fontSize: 22,
        fontWeight: 700,
        padding: '8px 0',
        outline: 'none',
        width: '100%',
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    toolBtn: {
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        color: 'rgba(255,255,255,0.7)',
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
    },
    charCount: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
    textarea: {
        background: 'transparent',
        border: 'none',
        color: 'rgba(255,255,255,0.85)',
        fontSize: 15,
        lineHeight: 1.8,
        resize: 'vertical',
        outline: 'none',
        minHeight: 450,
        fontFamily: `'JetBrains Mono', 'Fira Code', monospace`,
    },
    previewArea: {
        minHeight: 450,
        color: 'rgba(255,255,255,0.8)',
        fontSize: 15,
        lineHeight: 1.8,
        padding: '8px 0',
    },
    settingGroup: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
    label: { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: 1 },
    input: {
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        color: '#fff',
        padding: '8px 12px',
        fontSize: 13,
        outline: 'none',
    },
    coverPreview: {
        width: '100%',
        height: 120,
        objectFit: 'cover' as const,
        borderRadius: 8,
        marginTop: 4,
    },
    tagList: { display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 4 },
    tag: {
        background: 'rgba(139,92,246,0.15)',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: 12,
        color: '#c4b5fd',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    tagRemove: { cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.4)' },
    addBtn: {
        background: 'rgba(139,92,246,0.2)',
        border: '1px solid rgba(139,92,246,0.4)',
        borderRadius: 8,
        color: '#c4b5fd',
        padding: '6px 14px',
        fontWeight: 700,
        cursor: 'pointer',
    },
    priceModes: { display: 'flex', gap: 8 },
    priceBtn: {
        flex: 1,
        padding: '10px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        textAlign: 'center' as const,
    },
    priceBtnActive: {
        background: 'rgba(139,92,246,0.15)',
        border: '1px solid rgba(139,92,246,0.5)',
        color: '#c4b5fd',
    },
    publishBtn: {
        padding: '14px',
        borderRadius: 12,
        border: 'none',
        background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
        color: '#fff',
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 0 25px rgba(139,92,246,0.3)',
    },
    draftBtn: {
        padding: '10px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.04)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        textAlign: 'center' as const,
    },
};
