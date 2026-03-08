// FILE: /video-platform/shared/tests/database.test.ts
/**
 * 数据库客户端模块单元测试
 */

import { describe, it, expect, vi } from "vitest";
import {
    buildCursorPagination,
    processCursorResult,
} from "../database/client";

describe("Database Client Module", () => {
    describe("buildCursorPagination", () => {
        it("should return default take without cursor", () => {
            const result = buildCursorPagination({});

            expect(result.take).toBe(21); // defaultTake (20) + 1 for hasMore check
            expect(result.skip).toBe(0);
            expect(result.cursor).toBeUndefined();
        });

        it("should respect custom take parameter", () => {
            const result = buildCursorPagination({ take: 10 });

            expect(result.take).toBe(11); // 10 + 1
        });

        it("should cap take at maxTake", () => {
            const result = buildCursorPagination({ take: 500 }, 20, 100);

            expect(result.take).toBe(101); // 100 + 1 (capped)
        });

        it("should set cursor when provided", () => {
            const result = buildCursorPagination({ cursor: "cursor-id-123" });

            expect(result.cursor).toEqual({ id: "cursor-id-123" });
            expect(result.skip).toBe(1);
        });
    });

    describe("processCursorResult", () => {
        it("should return hasMore=false when items <= take", () => {
            const items = [
                { id: "1", name: "Item 1" },
                { id: "2", name: "Item 2" },
            ];

            const result = processCursorResult(items, 5);

            expect(result.hasMore).toBe(false);
            expect(result.items).toHaveLength(2);
            expect(result.nextCursor).toBeUndefined();
        });

        it("should return hasMore=true when items > take", () => {
            const items = [
                { id: "1", name: "Item 1" },
                { id: "2", name: "Item 2" },
                { id: "3", name: "Item 3" },
            ];

            const result = processCursorResult(items, 2);

            expect(result.hasMore).toBe(true);
            expect(result.items).toHaveLength(2);
            expect(result.nextCursor).toBe("2");
        });

        it("should set nextCursor to last item id", () => {
            const items = [
                { id: "a", name: "A" },
                { id: "b", name: "B" },
                { id: "c", name: "C" },
            ];

            const result = processCursorResult(items, 2);

            expect(result.nextCursor).toBe("b");
            expect(result.items.map(i => i.id)).toEqual(["a", "b"]);
        });
    });
});
