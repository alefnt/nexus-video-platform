// FILE: /video-platform/shared/events/eventStore.ts
/**
 * Event Sourcing — Lightweight Event Store
 * 
 * Records all business events as immutable entries for:
 * - Audit trail / compliance
 * - Event replay for debugging
 * - Analytics pipeline source
 * - Cross-service event bus (future)
 * 
 * Uses Prisma EventLog model (append-only).
 * 
 * Usage:
 *   await publishEvent("payment.settled", { invoiceId, amount }, userId);
 *   const events = await replayEvents("payment.settled", since);
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============== Event Types ==============

export type EventType =
    | "payment.created"
    | "payment.settled"
    | "payment.refunded"
    | "payment.failed"
    | "fiber.payout.sent"
    | "fiber.payout.confirmed"
    | "fiber.channel.opened"
    | "fiber.channel.closed"
    | "rgbpp.contract.created"
    | "rgbpp.split.executed"
    | "content.published"
    | "content.deleted"
    | "content.promoted"
    | "content.stored.hot"
    | "content.stored.warm"
    | "content.stored.cold"
    | "nft.minted"
    | "nft.transferred"
    | "user.registered"
    | "user.wallet.bound"
    | "user.login"
    | "tip.sent"
    | "tip.received"
    | "collab.created"
    | "collab.published";

export interface EventData {
    [key: string]: any;
}

// ============== Publish Event ==============

/**
 * Publish an immutable business event to the event store.
 * All events are append-only and cannot be modified.
 */
export async function publishEvent(
    type: EventType | string,
    data: EventData,
    userId?: string,
    metadata?: { source?: string; traceId?: string }
): Promise<string> {
    try {
        const event = await prisma.eventLog.create({
            data: {
                action: type,
                data: {
                    ...data,
                    _meta: metadata || {},
                    _ts: Date.now(),
                },
                userId: userId || "system",
                traceId: metadata?.traceId,
            },
        });

        console.log(`[EventStore] Published: ${type} (id: ${event.id}, user: ${userId || "system"})`);
        return event.id;
    } catch (err: any) {
        console.error(`[EventStore] Publish failed:`, err?.message);
        throw err;
    }
}

// ============== Replay Events ==============

/**
 * Replay events by type and optional time range.
 * Useful for debugging, audit, and rebuilding state.
 */
export async function replayEvents(
    type: string,
    since?: Date,
    until?: Date,
    limit: number = 100
): Promise<Array<{
    id: string;
    type: string;
    data: any;
    userId: string | null;
    createdAt: Date;
}>> {
    const events = await prisma.eventLog.findMany({
        where: {
            action: type,
            ...(since || until
                ? {
                    createdAt: {
                        ...(since ? { gte: since } : {}),
                        ...(until ? { lte: until } : {}),
                    },
                }
                : {}),
        },
        orderBy: { createdAt: "asc" },
        take: limit,
    });

    return events.map((e) => ({
        id: e.id,
        type: e.action,
        data: e.data,
        userId: e.userId,
        createdAt: e.createdAt,
    }));
}

// ============== Query Helpers ==============

/**
 * Get the latest event of a specific type for a user
 */
export async function getLatestEvent(
    type: string,
    userId: string
): Promise<any | null> {
    const event = await prisma.eventLog.findFirst({
        where: { action: type, userId },
        orderBy: { createdAt: "desc" },
    });
    if (!event) return null;
    return {
        id: event.id,
        type: event.action,
        data: event.data,
        userId: event.userId,
        createdAt: event.createdAt,
    };
}

/**
 * Count events of a specific type within a time range
 */
export async function countEvents(
    type: string,
    since?: Date,
    userId?: string
): Promise<number> {
    return prisma.eventLog.count({
        where: {
            action: type,
            ...(userId ? { userId } : {}),
            ...(since ? { createdAt: { gte: since } } : {}),
        },
    });
}
