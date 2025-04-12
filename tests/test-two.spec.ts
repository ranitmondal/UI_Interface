import { test } from '@playwright/test';

test("Test ONE", async ({ page }) => { await page.goto("https://playwright.dev"); });

test("Test Two - Documentation Check", async ({ page }) => { 
  await page.goto("https://playwright.dev/docs/intro");
  await page.waitForLoadState('domcontentloaded');
});
