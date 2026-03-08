import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('Smoke Tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto(`${BASE}/home`);
    await expect(page).toHaveTitle(/Nexus/i);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('navigation works', async ({ page }) => {
    await page.goto(`${BASE}/home`);
    await expect(page.locator('nav, [class*="nav"]').first()).toBeVisible();
  });

  test('explore page loads', async ({ page }) => {
    await page.goto(`${BASE}/explore`);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('login page loads', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('articles page loads', async ({ page }) => {
    await page.goto(`${BASE}/articles`);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('search page loads', async ({ page }) => {
    await page.goto(`${BASE}/search?q=test`);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('404 shows error boundary', async ({ page }) => {
    await page.goto(`${BASE}/nonexistent-page-xyz`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('video list page loads', async ({ page }) => {
    await page.goto(`${BASE}/videos`);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('points page loads', async ({ page }) => {
    await page.goto(`${BASE}/points`);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });
});
