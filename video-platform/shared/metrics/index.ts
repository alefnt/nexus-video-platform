/**
 * Prometheus-compatible Metrics Endpoint
 *
 * Provides /metrics endpoint in OpenMetrics/Prometheus format.
 * Can be imported and registered with any Fastify instance.
 *
 * Usage:
 *   import { registerMetrics } from '@video-platform/shared/metrics';
 *   registerMetrics(app);
 *
 * Exposes:
 *   GET /metrics → Prometheus text format
 */

// ═══ Metric Collectors ═══

interface Counter {
    name: string;
    help: string;
    labels: Record<string, number>;
}

interface Gauge {
    name: string;
    help: string;
    value: () => number;
}

interface Histogram {
    name: string;
    help: string;
    buckets: number[];
    observations: number[];
}

const counters: Map<string, Counter> = new Map();
const gauges: Map<string, Gauge> = new Map();
const histograms: Map<string, Histogram> = new Map();

// ═══ Public Metric API ═══

export const metrics = {
    /** Increment a counter */
    inc(name: string, labels: Record<string, string> = {}, value = 1) {
        const labelKey = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",");
        const fullKey = labelKey ? `${name}{${labelKey}}` : name;
        let counter = counters.get(name);
        if (!counter) {
            counter = { name, help: name, labels: {} };
            counters.set(name, counter);
        }
        counter.labels[fullKey] = (counter.labels[fullKey] || 0) + value;
    },

    /** Register a gauge (lazy value function) */
    gauge(name: string, help: string, valueFn: () => number) {
        gauges.set(name, { name, help, value: valueFn });
    },

    /** Observe a histogram value */
    observe(name: string, value: number) {
        let hist = histograms.get(name);
        if (!hist) {
            hist = { name, help: name, buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10], observations: [] };
            histograms.set(name, hist);
        }
        hist.observations.push(value);
        // Keep last 10000 observations
        if (hist.observations.length > 10000) hist.observations = hist.observations.slice(-5000);
    },

    /** Record request duration */
    timer(name: string): () => void {
        const start = Date.now();
        return () => metrics.observe(name, (Date.now() - start) / 1000);
    },
};

// ═══ Prometheus Text Format ═══

function renderMetrics(): string {
    const lines: string[] = [];
    const ts = Date.now();

    // Counters
    counters.forEach((counter) => {
        lines.push(`# HELP ${counter.name} ${counter.help}`);
        lines.push(`# TYPE ${counter.name} counter`);
        Object.entries(counter.labels).forEach(([key, val]) => {
            lines.push(`${key} ${val} ${ts}`);
        });
    });

    // Gauges
    gauges.forEach((gauge) => {
        lines.push(`# HELP ${gauge.name} ${gauge.help}`);
        lines.push(`# TYPE ${gauge.name} gauge`);
        lines.push(`${gauge.name} ${gauge.value()} ${ts}`);
    });

    // Histograms
    histograms.forEach((hist) => {
        if (hist.observations.length === 0) return;
        lines.push(`# HELP ${hist.name} ${hist.help}`);
        lines.push(`# TYPE ${hist.name} histogram`);
        const sorted = [...hist.observations].sort((a, b) => a - b);
        const sum = sorted.reduce((s, v) => s + v, 0);
        hist.buckets.forEach((bucket) => {
            const count = sorted.filter((v) => v <= bucket).length;
            lines.push(`${hist.name}_bucket{le="${bucket}"} ${count} ${ts}`);
        });
        lines.push(`${hist.name}_bucket{le="+Inf"} ${sorted.length} ${ts}`);
        lines.push(`${hist.name}_sum ${sum.toFixed(6)} ${ts}`);
        lines.push(`${hist.name}_count ${sorted.length} ${ts}`);
    });

    return lines.join("\n") + "\n";
}

// ═══ Fastify Plugin ═══

export function registerMetrics(app: any, serviceName = "unknown") {
    // Built-in gauges
    metrics.gauge("nodejs_heap_used_bytes", "Node.js heap used", () => process.memoryUsage().heapUsed);
    metrics.gauge("nodejs_heap_total_bytes", "Node.js heap total", () => process.memoryUsage().heapTotal);
    metrics.gauge("nodejs_rss_bytes", "Node.js RSS", () => process.memoryUsage().rss);
    metrics.gauge("nodejs_uptime_seconds", "Node.js uptime", () => process.uptime());

    // Auto-instrument requests
    app.addHook("onRequest", async (req: any) => {
        req._metricsTimer = metrics.timer("http_request_duration_seconds");
    });

    app.addHook("onResponse", async (req: any, reply: any) => {
        if (req._metricsTimer) req._metricsTimer();
        metrics.inc("http_requests_total", {
            method: req.method,
            route: req.routeOptions?.url || req.url,
            status: String(reply.statusCode),
            service: serviceName,
        });
    });

    // /metrics endpoint
    app.get("/metrics", async (_req: any, reply: any) => {
        reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
        return renderMetrics();
    });

    console.log(`📊 Prometheus metrics registered: GET /metrics (service: ${serviceName})`);
}

export default metrics;
