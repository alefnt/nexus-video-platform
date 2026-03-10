// FILE: /video-platform/client-web/src/lib/analytics.ts
/**
 * Analytics & Error Tracking — Unified observability for client-side
 * 
 * Features:
 * - Sentry-compatible error tracking (when DSN is configured)
 * - Custom event tracking
 * - Performance monitoring (Core Web Vitals)
 * - User session tracking
 */

// ============== Error Tracking ==============

interface ErrorReport {
    message: string;
    stack?: string;
    component?: string;
    userId?: string;
    extra?: Record<string, any>;
    timestamp: number;
}

const errorBuffer: ErrorReport[] = [];
const MAX_BUFFER = 100;

const SENTRY_DSN = import.meta.env?.VITE_SENTRY_DSN || '';

// Initialize Sentry (if DSN is configured)
export async function initErrorTracking(): Promise<void> {
    if (SENTRY_DSN) {
        try {
            // Dynamic import — use string concat to avoid Vite's static analysis
            const sentryModule = '@sentry/' + 'browser';
            const Sentry = await import(/* @vite-ignore */ sentryModule);
            Sentry.init({
                dsn: SENTRY_DSN,
                environment: import.meta.env?.MODE || 'development',
                tracesSampleRate: 0.1,
                replaysSessionSampleRate: 0.1,
                replaysOnErrorSampleRate: 1.0,
            });
            console.log('[Analytics] Sentry initialized');
        } catch (e) {
            console.warn('[Analytics] Sentry not available, using local error tracking');
        }
    }

    // Global error handler
    window.addEventListener('error', (event) => {
        captureError(event.error || new Error(event.message), {
            component: 'global',
            extra: { filename: event.filename, lineno: event.lineno },
        });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        captureError(
            event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
            { component: 'promise' }
        );
    });
}

export function captureError(
    error: Error,
    context?: { component?: string; userId?: string; extra?: Record<string, any> }
): void {
    const report: ErrorReport = {
        message: error.message,
        stack: error.stack,
        component: context?.component,
        userId: context?.userId,
        extra: context?.extra,
        timestamp: Date.now(),
    };

    errorBuffer.push(report);
    if (errorBuffer.length > MAX_BUFFER) errorBuffer.shift();

    // Log to console in dev
    if (import.meta.env?.MODE !== 'production') {
        console.warn('[Analytics] Error captured:', report.message, report);
    }

    // Try to report to Sentry
    if (SENTRY_DSN) {
        const sentryMod = '@sentry/' + 'browser';
        import(/* @vite-ignore */ sentryMod)
            .then(Sentry => {
                Sentry.captureException(error, { extra: context?.extra });
            })
            .catch(() => { /* Sentry not available */ });
    }
}

export function getRecentErrors(): ErrorReport[] {
    return [...errorBuffer].reverse().slice(0, 20);
}

// ============== Event Tracking ==============

interface AnalyticsEvent {
    name: string;
    properties?: Record<string, any>;
    timestamp: number;
}

const eventBuffer: AnalyticsEvent[] = [];
const MAX_EVENTS = 500;

export function trackEvent(name: string, properties?: Record<string, any>): void {
    const event: AnalyticsEvent = {
        name,
        properties,
        timestamp: Date.now(),
    };

    eventBuffer.push(event);
    if (eventBuffer.length > MAX_EVENTS) eventBuffer.shift();

    // Log in dev
    if (import.meta.env?.MODE !== 'production') {
        console.debug('[Analytics] Event:', name, properties);
    }
}

// Pre-defined event helpers
export const events = {
    pageView: (page: string) => trackEvent('page_view', { page }),
    videoPlay: (videoId: string, title: string) => trackEvent('video_play', { videoId, title }),
    musicPlay: (trackId: string) => trackEvent('music_play', { trackId }),
    articleRead: (articleId: string) => trackEvent('article_read', { articleId }),
    paymentStart: (type: string, amount: number) => trackEvent('payment_start', { type, amount }),
    paymentComplete: (type: string, amount: number, backend: string) =>
        trackEvent('payment_complete', { type, amount, backend }),
    fiberConnect: () => trackEvent('fiber_connect'),
    nftMint: (contentId: string) => trackEvent('nft_mint', { contentId }),
    search: (query: string, type: string) => trackEvent('search', { query, type }),
    signup: (method: string) => trackEvent('signup', { method }),
    login: (method: string) => trackEvent('login', { method }),
    creatorUpload: (type: string) => trackEvent('creator_upload', { type }),
    withdraw: (amount: number) => trackEvent('withdraw', { amount }),
};

// ============== Performance Monitoring ==============

export function initPerformanceMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Core Web Vitals via PerformanceObserver
    try {
        // LCP (Largest Contentful Paint)
        const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            trackEvent('web_vital', {
                metric: 'LCP',
                value: Math.round(lastEntry.startTime),
                rating: lastEntry.startTime < 2500 ? 'good' : lastEntry.startTime < 4000 ? 'needs-improvement' : 'poor',
            });
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

        // FID (First Input Delay)
        const fidObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            for (const entry of entries) {
                const fidEntry = entry as PerformanceEventTiming;
                trackEvent('web_vital', {
                    metric: 'FID',
                    value: Math.round(fidEntry.processingStart - fidEntry.startTime),
                    rating: (fidEntry.processingStart - fidEntry.startTime) < 100 ? 'good' : 'poor',
                });
            }
        });
        fidObserver.observe({ type: 'first-input', buffered: true });

        // CLS (Cumulative Layout Shift)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!(entry as any).hadRecentInput) {
                    clsValue += (entry as any).value;
                }
            }
            trackEvent('web_vital', {
                metric: 'CLS',
                value: Math.round(clsValue * 1000) / 1000,
                rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor',
            });
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });

    } catch (e) {
        // PerformanceObserver not fully supported
        console.debug('[Analytics] Performance monitoring limited');
    }
}

// ============== Session Tracking ==============

export function getSessionId(): string {
    let sid = sessionStorage.getItem('nexus.session_id');
    if (!sid) {
        sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem('nexus.session_id', sid);
    }
    return sid;
}

// ============== Initialize All ==============

export function initAnalytics(): void {
    initErrorTracking();
    initPerformanceMonitoring();
    trackEvent('session_start', { sessionId: getSessionId() });
    console.log('[Analytics] Initialized — session:', getSessionId());
}
