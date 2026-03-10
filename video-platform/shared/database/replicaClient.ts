// FILE: /video-platform/shared/database/replicaClient.ts
/**
 * Database Read Replica Client
 * 
 * Provides automatic read/write splitting:
 * - Writes go to primary (DATABASE_URL)
 * - Reads go to replica (DATABASE_READ_URL) with primary fallback
 * 
 * Usage:
 *   import { readClient, writeClient } from './replicaClient';
 *   
 *   // Read operations
 *   const users = await readClient.user.findMany({ ... });
 *   
 *   // Write operations  
 *   const newUser = await writeClient.user.create({ ... });
 */

import { PrismaClient } from "@video-platform/database";

// ============== Primary (Write) Client ==============
const writeClient = new PrismaClient({
    datasources: {
        db: { url: process.env.DATABASE_URL },
    },
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query", "error", "warn"],
});

// ============== Replica (Read) Client ==============
const DATABASE_READ_URL = process.env.DATABASE_READ_URL || process.env.DATABASE_URL;

const readClient = new PrismaClient({
    datasources: {
        db: { url: DATABASE_READ_URL },
    },
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
});

// ============== Connection Pooling Config ==============
/**
 * When using PgBouncer, add the following to DATABASE_URL:
 *   ?pgbouncer=true&connection_limit=10
 * 
 * PgBouncer config is in deploy/database/pgbouncer.ini
 */

// ============== Health Check ==============
export async function checkDatabaseHealth(): Promise<{
    primary: boolean;
    replica: boolean;
    replicaLag?: number;
}> {
    let primary = false;
    let replica = false;

    try {
        await writeClient.$queryRaw`SELECT 1`;
        primary = true;
    } catch { /* primary down */ }

    try {
        await readClient.$queryRaw`SELECT 1`;
        replica = true;
    } catch { /* replica down */ }

    return { primary, replica };
}

// ============== Graceful Shutdown ==============
export async function disconnectAll(): Promise<void> {
    await Promise.all([
        writeClient.$disconnect(),
        readClient.$disconnect(),
    ]);
}

export { readClient, writeClient };
export default { readClient, writeClient, checkDatabaseHealth, disconnectAll };
