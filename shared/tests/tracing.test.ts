// FILE: /video-platform/shared/tests/tracing.test.ts
/**
 * 分布式追踪模块单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    generateTraceId,
    generateSpanId,
    parseTraceparent,
    buildTraceparent,
    getTracingStats,
} from "../monitoring/tracing";

describe("Tracing Module", () => {
    describe("generateTraceId", () => {
        it("should generate 32-character hex string", () => {
            const traceId = generateTraceId();

            expect(traceId).toHaveLength(32);
            expect(/^[0-9a-f]+$/.test(traceId)).toBe(true);
        });

        it("should generate unique IDs", () => {
            const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));

            expect(ids.size).toBe(100);
        });
    });

    describe("generateSpanId", () => {
        it("should generate 16-character hex string", () => {
            const spanId = generateSpanId();

            expect(spanId).toHaveLength(16);
            expect(/^[0-9a-f]+$/.test(spanId)).toBe(true);
        });
    });

    describe("parseTraceparent", () => {
        it("should parse valid W3C traceparent header", () => {
            const header = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
            const result = parseTraceparent(header);

            expect(result).toEqual({
                traceId: "0af7651916cd43dd8448eb211c80319c",
                parentSpanId: "b7ad6b7169203331",
                sampled: true,
            });
        });

        it("should parse sampled=false", () => {
            const header = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00";
            const result = parseTraceparent(header);

            expect(result?.sampled).toBe(false);
        });

        it("should return null for invalid header", () => {
            expect(parseTraceparent(undefined)).toBeNull();
            expect(parseTraceparent("invalid")).toBeNull();
            expect(parseTraceparent("00-abc")).toBeNull();
        });
    });

    describe("buildTraceparent", () => {
        it("should build valid W3C traceparent header", () => {
            const header = buildTraceparent(
                "0af7651916cd43dd8448eb211c80319c",
                "b7ad6b7169203331",
                true
            );

            expect(header).toBe("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01");
        });

        it("should set flags to 00 when not sampled", () => {
            const header = buildTraceparent(
                "0af7651916cd43dd8448eb211c80319c",
                "b7ad6b7169203331",
                false
            );

            expect(header).toBe("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00");
        });
    });

    describe("getTracingStats", () => {
        it("should return stats object", () => {
            const stats = getTracingStats();

            expect(stats).toHaveProperty("spanCount");
            expect(stats).toHaveProperty("avgDurationMs");
            expect(stats).toHaveProperty("errorRate");
            expect(typeof stats.spanCount).toBe("number");
        });
    });
});
