interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

const REPORT_ENDPOINT = '/api/metrics/vitals';

function reportMetric(metric: PerformanceMetric) {
  if (import.meta.env.DEV) {
    console.log(`[WebVital] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`);
    return;
  }
  navigator.sendBeacon?.(REPORT_ENDPOINT, JSON.stringify(metric));
}

export async function initWebVitals() {
  try {
    const { onCLS, onFID, onLCP, onFCP, onTTFB } = await import('web-vitals');
    onCLS((m) => reportMetric({ name: 'CLS', value: m.value, rating: m.rating }));
    onFID((m) => reportMetric({ name: 'FID', value: m.value, rating: m.rating }));
    onLCP((m) => reportMetric({ name: 'LCP', value: m.value, rating: m.rating }));
    onFCP((m) => reportMetric({ name: 'FCP', value: m.value, rating: m.rating }));
    onTTFB((m) => reportMetric({ name: 'TTFB', value: m.value, rating: m.rating }));
  } catch (e) {
    console.warn('Web Vitals not available:', e);
  }
}

export function trackError(error: Error, context?: Record<string, unknown>) {
  console.error('[ErrorTracker]', error, context);
  if (import.meta.env.DEV) return;

  try {
    navigator.sendBeacon?.('/api/metrics/errors', JSON.stringify({
      message: error.message,
      stack: error.stack?.slice(0, 2000),
      url: window.location.href,
      timestamp: Date.now(),
      ...context,
    }));
  } catch {}
}

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    trackError(event.error || new Error(event.message), { type: 'uncaught' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    trackError(error, { type: 'unhandled_rejection' });
  });
}
