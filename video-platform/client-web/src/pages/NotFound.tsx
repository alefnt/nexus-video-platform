/**
 * 404 Not Found Page
 * Cyberpunk-styled error page with navigation back to Home
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NotFound: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#030308',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Background glow */}
            <div style={{
                position: 'absolute',
                top: '30%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 600,
                height: 600,
                background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{
                textAlign: 'center',
                position: 'relative',
                zIndex: 1,
                padding: '0 24px',
            }}>
                {/* Glitch Effect 404 */}
                <div style={{
                    fontSize: 160,
                    fontWeight: 900,
                    lineHeight: 1,
                    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4, #ec4899)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: 16,
                    letterSpacing: -4,
                    textShadow: 'none',
                }}>
                    404
                </div>

                <h2 style={{
                    fontSize: 24,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: 'rgba(255,255,255,0.9)',
                }}>
                    {t('errors.pageNotFound')}
                </h2>

                <p style={{
                    fontSize: 16,
                    color: 'rgba(255,255,255,0.45)',
                    maxWidth: 420,
                    margin: '0 auto 32px',
                    lineHeight: 1.6,
                }}>
                    The page you are looking for doesn't exist or has been moved to another dimension.
                </p>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate('/home')}
                        style={{
                            padding: '12px 28px',
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                            color: '#fff',
                            fontSize: 15,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 0 25px rgba(139,92,246,0.3)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.04)';
                            e.currentTarget.style.boxShadow = '0 0 35px rgba(139,92,246,0.5)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 0 25px rgba(139,92,246,0.3)';
                        }}
                    >
                        {t('errors.goHome')}
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            padding: '12px 28px',
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                        {t('common.back')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
