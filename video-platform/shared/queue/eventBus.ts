// FILE: /video-platform/shared/queue/eventBus.ts
/**
 * Event Bus — Typed publish/subscribe layer on top of BullMQ
 * 
 * Provides a clean API for event-driven communication between services.
 * Each event type maps to a specific BullMQ queue with typed payloads.
 * 
 * Usage:
 *   // Publisher (e.g., Payment Service)
 *   await EventBus.emit('payment.settled', { sessionId, amount, videoId, creatorId });
 * 
 *   // Subscriber (e.g., Royalty Service)
 *   EventBus.on('payment.settled', async (data) => { ... });
 */

import { addJob, createWorker, QUEUE_NAMES, type QueueName } from "./index";
import type { Job } from "bullmq";

// ============== Event Types ==============

export interface EventMap {
    // Payment events
    "payment.settled": {
        sessionId: string;
        userId: string;
        videoId: string;
        creatorId: string;
        amount: number;
        paymentType: "stream" | "buy_once" | "tip";
        timestamp: number;
    };
    "payment.refunded": {
        userId: string;
        amount: number;
        reason: string;
        timestamp: number;
    };

    // Content events
    "content.uploaded": {
        videoId: string;
        creatorId: string;
        contentType: "video" | "audio" | "article";
        sourceUrl: string;
        fileSize: number;
        timestamp: number;
    };
    "content.transcoded": {
        videoId: string;
        status: "completed" | "failed";
        profiles: string[];
        outputUrls: Record<string, string>;
        timestamp: number;
    };

    // Moderation events
    "moderation.completed": {
        contentId: string;
        contentType: "video" | "image" | "text";
        result: "approved" | "rejected" | "review";
        confidence: number;
        labels: string[];
        timestamp: number;
    };

    // User events
    "user.created": {
        userId: string;
        authMethod: "joyid" | "email" | "twitter" | "google" | "nostr" | "metamask";
        timestamp: number;
    };
    "user.achievement": {
        userId: string;
        achievementId: string;
        achievementName: string;
        timestamp: number;
    };

    // Storage events
    "storage.tier_migrated": {
        fileId: string;
        fromTier: "hot" | "warm" | "cold";
        toTier: "hot" | "warm" | "cold";
        newUrl: string;
        timestamp: number;
    };
}

export type EventName = keyof EventMap;

// ============== Event -> Queue Mapping ==============

const EVENT_QUEUE_MAP: Record<EventName, QueueName> = {
    "payment.settled": QUEUE_NAMES.SETTLEMENT,
    "payment.refunded": QUEUE_NAMES.SETTLEMENT,
    "content.uploaded": QUEUE_NAMES.TRANSCODE,
    "content.transcoded": QUEUE_NAMES.TRANSCODE,
    "moderation.completed": QUEUE_NAMES.NOTIFICATION,
    "user.created": QUEUE_NAMES.ANALYTICS,
    "user.achievement": QUEUE_NAMES.NOTIFICATION,
    "storage.tier_migrated": QUEUE_NAMES.STORAGE,
};

// ============== Event Bus ==============

type EventHandler<T> = (data: T, job: Job<T>) => Promise<void>;

const handlers = new Map<string, EventHandler<any>[]>();

export const EventBus = {
    /**
     * Publish an event to the message queue
     */
    async emit<E extends EventName>(event: E, data: EventMap[E]): Promise<void> {
        const queueName = EVENT_QUEUE_MAP[event];
        if (!queueName) {
            console.warn(`[EventBus] No queue mapping for event: ${event}`);
            return;
        }
        await addJob(queueName, event, { ...data, _event: event });
        console.info(`[EventBus] Emitted: ${event}`);
    },

    /**
     * Subscribe to an event. Creates a BullMQ worker if not already running.
     */
    on<E extends EventName>(event: E, handler: EventHandler<EventMap[E]>): void {
        const existing = handlers.get(event) || [];
        existing.push(handler);
        handlers.set(event, existing);

        // Ensure a worker exists for this event's queue
        const queueName = EVENT_QUEUE_MAP[event];
        if (queueName) {
            try {
                createWorker(queueName, async (job: Job) => {
                    const eventName = job.data?._event || job.name;
                    const eventHandlers = handlers.get(eventName) || [];
                    for (const h of eventHandlers) {
                        await h(job.data, job);
                    }
                }, 3);
            } catch {
                // Worker already exists, that's fine
            }
        }
    },

    /**
     * Remove all handlers for an event
     */
    off(event: EventName): void {
        handlers.delete(event);
    },

    /**
     * Get registered handler count for debugging
     */
    getHandlerCount(event?: EventName): Record<string, number> | number {
        if (event) return handlers.get(event)?.length || 0;
        const counts: Record<string, number> = {};
        for (const [e, h] of handlers) counts[e] = h.length;
        return counts;
    },
};

export default EventBus;
