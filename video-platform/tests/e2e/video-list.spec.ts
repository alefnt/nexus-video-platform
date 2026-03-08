// FILE: /video-platform/tests/e2e/video-list.spec.ts
import { test, expect } from "@playwright/test";

// 与当前 UI 保持一致：
// - 付费视频按钮："购买"（另有 "用积分购买"）
// - 免费视频按钮："直接播放"
// - 收藏按钮使用 title 作为可访问名称："收藏"/"取消收藏"

test.describe("Video List interactions", () => {
  test("renders demo list, allows favorite toggle and search filter", async ({ page }) => {
    page.on("console", (msg) => console.log("[console]", msg.type(), msg.text()));
    // 拦截视频列表请求，返回多条示例数据以测试交互
    await page.route("**/metadata/list", async (route) => {
      const demos = [
        {
          id: "demo-1",
          title: "示例：海边日落",
          description: "傍晚海边的延时摄影",
          creatorBitDomain: "alice.bit",
          creatorCkbAddress: "ckt1qyqexamplealice",
          priceUSDI: "1.99",
          cdnUrl: "https://example.com/hls/demo1.m3u8",
          createdAt: new Date().toISOString(),
        },
        {
          id: "demo-2",
          title: "示例：森林徒步",
          description: "穿越森林的徒步记录",
          creatorBitDomain: "bob.bit",
          creatorCkbAddress: "ckt1qyqexamplebob",
          priceUSDI: "0",
          cdnUrl: "https://example.com/hls/demo2.m3u8",
          createdAt: new Date().toISOString(),
        },
      ];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(demos) });
    });

    await page.goto("/#/videos");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1.heading")).toContainText("视频列表");

    // 渲染了两张卡片
    const cards = page.locator(".video-card");
    await expect(cards).toHaveCount(2);

    // 按价格显示对应按钮文案
    await expect(cards.nth(0).getByRole("button", { name: "购买" })).toBeVisible();
    await expect(cards.nth(1).getByRole("button", { name: "直接播放" })).toBeVisible();

    // 第一个卡片收藏切换（使用 title 作为可访问名称）
    await expect(cards.nth(0).getByRole("button", { name: /收藏|取消收藏/ })).toBeVisible();
    await cards.nth(0).getByRole("button", { name: "收藏" }).click();
    await expect(cards.nth(0).getByRole("button", { name: "取消收藏" })).toBeVisible();
    // 取消收藏
    await cards.nth(0).getByRole("button", { name: "取消收藏" }).click();
    await expect(cards.nth(0).getByRole("button", { name: "收藏" })).toBeVisible();

    // 搜索过滤：仅保留“海边”卡片
    await page.getByPlaceholder("搜索视频名称").fill("海边");
    await expect(cards).toHaveCount(1);
    await expect(page.locator(".card-title")).toContainText("示例：海边日落");

    // 搜索结果中的按钮存在且可用
    await expect(page.getByRole("button", { name: "购买" })).toBeEnabled();
  });
});