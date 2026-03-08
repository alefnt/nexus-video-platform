// FILE: /video-platform/shared/temporal/client.ts
/**
 * Temporal.io Client — Workflow Engine Integration
 * 
 * Provides connection to Temporal server for:
 * - Settlement workflows (replaces BullMQ for complex flows)
 * - Storage lifecycle workflows (Hot → Warm → Cold)
 * - Content publishing workflows
 * 
 * Environment Variables:
 * - TEMPORAL_ADDRESS: Temporal server gRPC endpoint (default: localhost:7233)
 * - TEMPORAL_NAMESPACE: Workflow namespace (default: default)
 * 
 * Usage:
 *   const client = await getTemporalClient();
 *   const handle = await client.workflow.start(settlementWorkflow, { ... });
 */

// NOTE: Requires @temporalio/client to be installed
// npm install @temporalio/client @temporalio/worker

let _client: any = null;

export async function getTemporalClient() {
    if (_client) return _client;

    try {
        const { Client, Connection } = await import("@temporalio/client");
        const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";
        const namespace = process.env.TEMPORAL_NAMESPACE || "default";

        const connection = await Connection.connect({ address });
        _client = new Client({ connection, namespace });

        console.log(`[Temporal] Connected to ${address} (namespace: ${namespace})`);
        return _client;
    } catch (err: any) {
        console.warn(`[Temporal] Connection failed: ${err?.message}. Workflows will not be available.`);
        return null;
    }
}

/**
 * Start a workflow execution
 */
export async function startWorkflow(
    workflowId: string,
    workflowType: string,
    args: any[],
    taskQueue: string = "nexus-main"
): Promise<{ workflowId: string; runId?: string } | null> {
    const client = await getTemporalClient();
    if (!client) {
        console.warn(`[Temporal] Not connected — cannot start workflow ${workflowType}`);
        return null;
    }

    try {
        const handle = await client.workflow.start(workflowType, {
            workflowId,
            taskQueue,
            args,
        });

        console.log(`[Temporal] Workflow started: ${workflowId} (type: ${workflowType})`);
        return {
            workflowId: handle.workflowId,
            runId: handle.firstExecutionRunId,
        };
    } catch (err: any) {
        console.error(`[Temporal] Start workflow error:`, err?.message);
        throw err;
    }
}

/**
 * Query workflow status
 */
export async function getWorkflowStatus(workflowId: string): Promise<string | null> {
    const client = await getTemporalClient();
    if (!client) return null;

    try {
        const handle = client.workflow.getHandle(workflowId);
        const desc = await handle.describe();
        return desc?.status?.name || "UNKNOWN";
    } catch {
        return null;
    }
}
