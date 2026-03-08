// FILE: /video-platform/tests/e2e/home.spec.ts
import { test, expect } from "@playwright/test";

// 验证首页模块渲染与交互基础，以及 TopNav 在首页隐藏“返回”按钮

test.describe("Home page", () => {
  test("renders modules and hides back button on /home", async ({ page }) => {
    // 进入首页
    await page.goto("/#/home");

    // 顶部欢迎语
    await expect(page.locator("text=欢迎回来")).toBeVisible();

    // TopNav：在首页不应显示“返回”按钮
    await expect(page.locator("text=返回")).toHaveCount(0);

    // 关键模块标题存在（容错与骨架允许数据为空）
    const headings = [
      "观看者快捷区",
      "创作者工作台",
      "收益与积分",
      "账户与设备",
      "通知与消息",
      "系统设置",
      "任务与勋章",
      "最近播放（本地）",
    ];
    for (const h of headings) {
      await expect(page.locator(`text=${h}`)).toBeVisible();
    }

    // 搜索交互（允许接口失败，保持页面稳定）
    const searchInput = page.locator('input[placeholder*="搜索"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("测试");
    await page.click("text=搜索");
    // 搜索后页面仍正常显示观看者快捷区
    await expect(page.locator("text=观看者快捷区")).toBeVisible();

    // 继续观看区标题可见（数据为空时显示占位文案）
    await expect(page.locator("text=继续观看")).toBeVisible();
  });
});