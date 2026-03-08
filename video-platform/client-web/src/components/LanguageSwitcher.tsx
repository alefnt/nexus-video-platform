/**
 * 语言切换组件
 * 
 * 显示当前语言，点击切换中/英文
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage, supportedLanguages } from '../i18n';

export default function LanguageSwitcher() {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = React.useState(false);
    const currentLang = getCurrentLanguage();
    const current = supportedLanguages.find(l => l.code === currentLang) || supportedLanguages[0];

    const handleSelect = (code: 'zh' | 'en') => {
        changeLanguage(code);
        setIsOpen(false);
        // 触发重新渲染
        window.location.reload();
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 14,
                }}
            >
                <span>{current.flag}</span>
                <span>{current.name}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 4,
                        background: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 8,
                        overflow: 'hidden',
                        minWidth: 120,
                        zIndex: 1000,
                    }}
                >
                    {supportedLanguages.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => handleSelect(lang.code as 'zh' | 'en')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '10px 16px',
                                background: lang.code === currentLang ? 'rgba(162, 103, 255, 0.2)' : 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: 14,
                                textAlign: 'left',
                            }}
                        >
                            <span>{lang.flag}</span>
                            <span>{lang.name}</span>
                            {lang.code === currentLang && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="3" style={{ marginLeft: 'auto' }}>
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
