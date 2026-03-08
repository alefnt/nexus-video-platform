import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:5173";

test.describe("Authenticated UI", () => {
  test("shows purchase, offline, favorite in logged-in state", async ({ page }) => {
    // 预置本地会话（与前端键名一致：vp.jwt / vp.user）
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("vp.jwt", "dev-token-1234567890");
        sessionStorage.setItem("vp.user", JSON.stringify({ bitDomain: "alice.bit", ckbAddress: "ckt1qyqexamplealice" }));
      } catch {}
    });

    // 稳定视频列表渲染（示例数据）
    await page.route("**/metadata/list", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "demo-1",
            title: "示例：海边日落",
            description: "傍晚海边的延时摄影",
            creatorBitDomain: "alice.bit",
            creatorCkbAddress: "ckt1qyqexamplealice",
            priceUSDI: "2.50",
            cdnUrl: "http://localhost:8092/content/hls/demo-1/index.m3u8",
            createdAt: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto(`${BASE_URL}/#/videos`);

    // 基本元素
    await expect(page.getByText("视频列表")).toBeVisible();
    // 购买或直接播放按钮（根据价格）
    const cards = page.locator(".video-card");
    await expect(cards.first()).toBeVisible();
    await expect(cards.first().getByRole("button", { name: /购买|直接播放/ })).toBeVisible();
    // 离线授权按钮
    await expect(cards.first().getByRole("button", { name: "离线授权并下载" })).toBeVisible();
    // 收藏按钮（使用 title 可访问名称）
    await expect(cards.first().getByRole("button", { name: /收藏|取消收藏/ })).toBeVisible();

    // 保护接口拦截为成功
    await page.route("**/payment/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.route("**/content/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    // 收藏切换
    await cards.first().getByRole("button", { name: "收藏" }).click().catch(async () => {
      await cards.first().getByRole("button", { name: "取消收藏" }).click();
      await cards.first().getByRole("button", { name: "收藏" }).click();
    });
  });
});