// FILE: /video-platform/tests/e2e/points-center.spec.ts
import { test, expect } from "@playwright/test";

// 目标：验证“积分中心”页面在未登录和已登录场景下的加载与余额展示。
// - 未登录：断言页面提示“未登录或网关不可用，暂无法获取积分余额。”并展示操作按钮。
// - 已登录：拦截余额接口，稳定展示数值；断言顶部行与参考值。

test.describe("Points Center", () => {
  test("unauthenticated: shows login hint", async ({ page }) => {
    // 清理会话，确保未登录状态
    await page.addInitScript(() => {
      try {
        sessionStorage.removeItem("vp.jwt");
        sessionStorage.removeItem("vp.user");
      } catch {}
    });

    await page.goto("/#/points");
    await page.waitForLoadState("domcontentloaded");

    // 标题
    await expect(page.getByRole("heading", { name: "积分中心" })).toBeVisible();

    // 未登录或网关不可用提示（页面固定文案）
    await expect(page.locator("text=未登录或网关不可用，暂无法获取积分余额。")).toBeVisible();

    // 基本操作按钮可见
    await expect(page.getByRole("button", { name: "刷新余额" })).toBeVisible();
    await expect(page.getByRole("button", { name: "领取演示积分" })).toBeVisible();
    await expect(page.getByText("用 USDI 购买积分")).toBeVisible();
  });

  test("authenticated: displays mocked balances", async ({ page }) => {
    // 预置本地会话
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("vp.jwt", "dev-jwt-456");
        sessionStorage.setItem(
          "vp.user",
          JSON.stringify({ bitDomain: "alice.bit", ckbAddress: "ckt1qyqexamplealice" })
        );
      } catch {}
    });

    // 拦截余额接口（与前端类型一致：PointsBalance / USDIBalance）
    await page.route("**/payment/points/balance", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          balance: 1200,
          pointsPerUSDI: 10000,
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route("**/payment/usdi/balance", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ balance: "56.78 USDI", token: "USDI", updatedAt: new Date().toISOString() }),
      });
    });

    await page.goto("/#/points");
    await page.waitForLoadState("domcontentloaded");

    // 基本标题
    await expect(page.getByRole("heading", { name: "积分中心" })).toBeVisible();

    // 顶部信息行片段：分拆断言便于定位
    await expect(page.locator("text=我的USDI：56.78 USDI")).toBeVisible();
    await expect(page.locator("text=我的积分：1200")).toBeVisible();
    await expect(page.locator("text=汇率：1 USDI ≈ 10000 积分")).toBeVisible();

    // 参考值：≈ 0.12 USDI（1200 / 10000）
    await expect(page.locator("text=参考值：≈ 0.12 USDI")).toBeVisible();

    // 操作按钮
    await expect(page.getByRole("button", { name: "刷新余额" })).toBeVisible();
    await expect(page.getByRole("button", { name: "领取演示积分" })).toBeVisible();
    await expect(page.getByText("用 USDI 购买积分")).toBeVisible();
  });
});