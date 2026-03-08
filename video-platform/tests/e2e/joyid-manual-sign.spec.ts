import { test as base, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "path";

// 使用 Chrome 持久化用户目录以复用你在 Chrome 中的 passkey
// Windows 默认目录：%LOCALAPPDATA%\Google\Chrome\User Data\Default
const CHROME_PROFILE = process.env.CHROME_USER_DATA_DIR || path.join(
  process.env.LOCALAPPDATA || "C:\\Users\\30263\\AppData\\Local",
  "Google",
  "Chrome",
  "User Data",
  "Default"
);

// 覆盖默认 fixtures：改为使用 Chrome 持久化上下文，并关闭弹窗拦截
const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext(CHROME_PROFILE, {
      channel: "chrome",
      headless: false,
      args: ["--disable-popup-blocking"],
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    const p = context.pages()[0] || (await context.newPage());
    await use(p);
  },
});

// 放宽单测超时，避免默认 30s 导致等待弹窗失败
test.setTimeout(180_000);

const POINTS_URL = "/#/points";

test.describe("JoyID manual sign flow (Chrome persistent)", () => {
  test("CKB purchase via JoyID [manual sign]", async ({ page }) => {
    // 预置会话与本地状态：启用 JoyID，注入一个 CKB 地址以跳过 connect()（减少干扰）
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("vp.jwt", "dev-jwt-joyid");
        sessionStorage.setItem(
          "vp.user",
          JSON.stringify({ bitDomain: "tester.bit", ckbAddress: "ckt1qyqexampletester" })
        );
        localStorage.setItem("vp.pointsJoyid", "1");
      } catch {}
    });

    await page.goto(POINTS_URL);
    await page.waitForLoadState("domcontentloaded");

    // 切换到 CKB 币种
    const purchaseCard = page.locator("div.card").filter({ hasText: "购买积分" });
    await expect(purchaseCard).toBeVisible();
    await purchaseCard.locator("select").selectOption("CKB");

    // 填入金额（CKB），默认已有 100，可保持或覆盖
    const amountInput = purchaseCard.getByRole("textbox");
    await expect(amountInput).toBeVisible();
    await amountInput.fill("100");

    // 预先监听弹窗，以捕获 JoyID 页面（使用 popup 事件更稳定）
    const joyPagePromise = page.waitForEvent("popup");

    // 创建订单（自动触发 JoyID 付款）
    const createBtn = purchaseCard.getByRole("button", { name: /创建订单|重新创建订单/ });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // 等待 JoyID 弹窗出现并加载
    const joyPage = await joyPagePromise;
    await joyPage.waitForLoadState("domcontentloaded");
    await expect(joyPage).toHaveURL(/joyid\.dev/);

    console.log("[E2E] JoyID 弹窗已打开，请在弹窗内手动完成签名。");

    // 等待签名完成后的广播：/payment/ckb/send_tx 200
    const sendTxResp = page.waitForResponse(
      (res) => res.url().includes("/payment/ckb/send_tx") && res.status() === 200,
      { timeout: 180_000 }
    );

    // JoyID 弹窗关闭不是强制条件，仅作为辅助信号
    const joyClosed = joyPage.waitForEvent("close", { timeout: 180_000 }).catch(() => null);

    await Promise.race([sendTxResp, joyClosed]);

    await expect(page.locator("text=交易已广播")).toBeVisible({ timeout: 180_000 });
    await expect(page.getByRole("button", { name: "确认入账" })).toBeVisible();

    console.log("[E2E] JoyID 签名与广播验证完成。");
  });
});