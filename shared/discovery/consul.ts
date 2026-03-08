// FILE: /video-platform/shared/discovery/consul.ts
/**
 * Service Discovery — Consul-based service registry
 * 
 * Provides service registration/deregistration and dynamic lookup.
 * Falls back to static config when Consul is unavailable (dev mode).
 * 
 * Usage:
 *   // On service startup
 *   await ServiceRegistry.register('payment', 8091, { version: '1.1.0' });
 *   
 *   // On gateway routing
 *   const url = await ServiceRegistry.resolve('payment');
 *   // Returns: "http://10.0.0.5:8091"
 *   
 *   // On shutdown
 *   await ServiceRegistry.deregister('payment');
 */

// ============== Types ==============

export interface ServiceRegistration {
    name: string;
    id: string;
    address: string;
    port: number;
    tags?: string[];
    meta?: Record<string, string>;
    check?: {
        http?: string;
        interval?: string;
        timeout?: string;
        deregisterCriticalServiceAfter?: string;
    };
}

export interface ServiceInstance {
    id: string;
    name: string;
    address: string;
    port: number;
    tags: string[];
    meta: Record<string, string>;
    healthy: boolean;
}

// ============== Static Fallback Config (Dev Mode) ==============

const STATIC_SERVICES: Record<string, { host: string; port: number }> = {
    identity: { host: "localhost", port: 8080 },
    payment: { host: "localhost", port: 8091 },
    content: { host: "localhost", port: 8092 },
    metadata: { host: "localhost", port: 8093 },
    royalty: { host: "localhost", port: 8094 },
    nft: { host: "localhost", port: 8095 },
    live: { host: "localhost", port: 8096 },
    achievement: { host: "localhost", port: 8097 },
    governance: { host: "localhost", port: 8098 },
    bridge: { host: "localhost", port: 8099 },
    transcode: { host: "localhost", port: 8100 },
    search: { host: "localhost", port: 8101 },
    moderation: { host: "localhost", port: 8102 },
    messaging: { host: "localhost", port: 8103 },
    engagement: { host: "localhost", port: 8104 },
    recommendation: { host: "localhost", port: 8105 },
};

// ============== Consul Client ==============

const CONSUL_URL = process.env.CONSUL_URL || "http://localhost:8500";
const CONSUL_ENABLED = process.env.CONSUL_ENABLED === "1";
const HOSTNAME = process.env.HOSTNAME || "localhost";

async function consulFetch(path: string, options?: RequestInit): Promise<Response | null> {
    if (!CONSUL_ENABLED) return null;
    try {
        return await fetch(`${CONSUL_URL}${path}`, {
            ...options,
            headers: { "Content-Type": "application/json", ...options?.headers },
        });
    } catch (e: any) {
        console.warn(`[Consul] Request failed: ${path}`, e?.message);
        return null;
    }
}

// ============== Service Registry ==============

export const ServiceRegistry = {
    /**
     * Register a service with Consul
     */
    async register(name: string, port: number, meta?: Record<string, string>): Promise<boolean> {
        const serviceId = `${name}-${HOSTNAME}-${port}`;
        const registration = {
            ID: serviceId,
            Name: name,
            Address: HOSTNAME,
            Port: port,
            Tags: ["nexus", `v${meta?.version || "1.0.0"}`],
            Meta: meta || {},
            Check: {
                HTTP: `http://${HOSTNAME}:${port}/health`,
                Interval: "10s",
                Timeout: "3s",
                DeregisterCriticalServiceAfter: "60s",
            },
        };

        const resp = await consulFetch("/v1/agent/service/register", {
            method: "PUT",
            body: JSON.stringify(registration),
        });

        if (resp && resp.ok) {
            console.info(`[Consul] Registered: ${serviceId}`);
            return true;
        }

        // Fallback: register in static config
        STATIC_SERVICES[name] = { host: HOSTNAME, port };
        console.info(`[Consul] Static fallback registration: ${name}@${HOSTNAME}:${port}`);
        return false;
    },

    /**
     * Deregister a service from Consul
     */
    async deregister(name: string): Promise<void> {
        const serviceId = `${name}-${HOSTNAME}-*`;
        const resp = await consulFetch(`/v1/agent/service/deregister/${serviceId}`, { method: "PUT" });
        if (resp?.ok) {
            console.info(`[Consul] Deregistered: ${serviceId}`);
        }
    },

    /**
     * Resolve a service URL by name
     * Returns the base URL (e.g., "http://10.0.0.5:8091")
     */
    async resolve(name: string): Promise<string> {
        // Try Consul first
        const resp = await consulFetch(`/v1/health/service/${name}?passing=true`);
        if (resp && resp.ok) {
            const instances: any[] = await resp.json();
            if (instances.length > 0) {
                // Simple round-robin: pick random healthy instance
                const idx = Math.floor(Math.random() * instances.length);
                const svc = instances[idx].Service;
                return `http://${svc.Address}:${svc.Port}`;
            }
        }

        // Check env var override
        const envKey = `${name.toUpperCase()}_URL`;
        if (process.env[envKey]) return process.env[envKey]!;

        // Fallback to static config
        const staticSvc = STATIC_SERVICES[name];
        if (staticSvc) return `http://${staticSvc.host}:${staticSvc.port}`;

        throw new Error(`[Consul] Service not found: ${name}`);
    },

    /**
     * Get all registered services
     */
    async listServices(): Promise<ServiceInstance[]> {
        const resp = await consulFetch("/v1/agent/services");
        if (resp && resp.ok) {
            const services: Record<string, any> = await resp.json();
            return Object.values(services).map((svc: any) => ({
                id: svc.ID,
                name: svc.Service,
                address: svc.Address,
                port: svc.Port,
                tags: svc.Tags || [],
                meta: svc.Meta || {},
                healthy: true,
            }));
        }

        // Return static config as fallback
        return Object.entries(STATIC_SERVICES).map(([name, { host, port }]) => ({
            id: `${name}-static`,
            name,
            address: host,
            port,
            tags: ["static"],
            meta: {},
            healthy: true,
        }));
    },

    /**
     * Health check a specific service
     */
    async isHealthy(name: string): Promise<boolean> {
        try {
            const url = await this.resolve(name);
            const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
            return resp.ok;
        } catch {
            return false;
        }
    },
};

export default ServiceRegistry;
