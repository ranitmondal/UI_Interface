import { test, expect } from '@playwright/test';

test("Google Search for Amazon", async ({ page }) => {
  // Go to Google
  await page.goto('https://www.google.com');

  // Accept cookies popup if it appears (Google often shows this in Europe or private windows)
  const acceptButton = page.locator('button:has-text("I agree"), button:has-text("Accept all")');
  if (await acceptButton.isVisible()) {
    await acceptButton.click();
  }

  // Type 'Amazon' in the search box and press Enter
  await page.fill('input[name="q"]', 'Amazon');
  await page.keyboard.press('Enter');

  // Wait for search results to load
  await page.waitForSelector('#search');

  // Verify that search results contain the word 'amazon'
  const resultsText = await page.locator('#search').innerText();
  expect(resultsText.toLowerCase()).toContain('amazon');
});
