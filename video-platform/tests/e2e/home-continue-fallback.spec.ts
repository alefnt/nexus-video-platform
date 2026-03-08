import { test, expect } from "@playwright/test";

// 验证首页“继续观看”在服务端不可用时，能正确从本地 vp.recent 兜底并显示进度
// 进度条元素通过 data-testid="continue-progress" 进行断言

test.describe("Home continue watching fallback progress", () => {
  test("displays progress from local storage fallback", async ({ page }) => {
    await page.addInitScript(() => {
      const data = [
        { id: "vp-demo-1", title: "Demo Video", ts: Date.now(), positionSec: 30, durationSec: 100 },
      ];
      try { localStorage.setItem("vp.recent", JSON.stringify(data)); } catch {}
    });

    await page.goto("/#/home");

    const progress = page.locator('[data-testid="continue-progress"]').first();
    await progress.waitFor({ state: "visible", timeout: 8000 });

    const width = await progress.evaluate((el) => (el as HTMLElement).style.width);
    expect(width).toBe("30%");

    await expect(page.getByRole("button", { name: "Demo Video" })).toBeVisible();

    await page.getByRole("button", { name: "继续播放" }).first().click();
    await expect(page).toHaveURL(/\/#\/player\/vp-demo-1$/);
  });
});