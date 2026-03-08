// FILE: /video-platform/tests/e2e/navigation.spec.ts
import { test, expect } from "@playwright/test";

// 更新：不再依赖登录页的“跳过登录”按钮。
// 直接通过预置 sessionStorage 的 dev 会话，验证导航与页面可见性。

test.describe("Navigation", () => {
  test("Preset dev session and go to VideoList", async ({ page }) => {
    page.on("console", (msg) => console.log("[console]", msg.type(), msg.text()));

    // 预置会话（键名与当前前端一致：vp.jwt / vp.user）
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("vp.jwt", "dev-jwt-123");
        sessionStorage.setItem("vp.user", JSON.stringify({ bitDomain: "alice.bit", ckbAddress: "ckt1qyqexamplealice" }));
      } catch {}
    });

    // 稳定列表渲染
    await page.route("**/metadata/list", async (route) => {
      const demos = [
        {
          id: "demo-1",
          title: "示例：海边日落",
          creatorBitDomain: "alice.bit",
          creatorCkbAddress: "ckt1qyqexamplealice",
          priceUSDI: "1.99",
          cdnUrl: "https://example.com/hls/demo1.m3u8",
          createdAt: new Date().toISOString(),
        },
      ];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(demos) });
    });

    await page.goto("/#/videos");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1.heading")).toContainText("视频列表");
  });

  test("Home -> Creator Upload via TopNav", async ({ page }) => {
    page.on("console", (msg) => console.log("[console]", msg.type(), msg.text()));
    await page.goto("/#/home");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("text=欢迎回来")).toBeVisible();
    await page.getByRole("button", { name: "创作者上传" }).click();
    await expect(page.getByRole("heading", { name: "创作者上传" })).toBeVisible();
  });
});