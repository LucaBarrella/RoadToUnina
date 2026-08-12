import { test, expect } from '@playwright/test';

test('Verify complete end-to-end user experience on LIVE production (Vercel + Render)', async ({ page }) => {
  const testId = Date.now().toString().slice(-6);
  const testUser = {
    username: `live_runner_${testId}`,
    email: `live_runner_${testId}@unina.it`,
    password: 'Password123!',
  };

  // 1. Register a new user on production
  await page.goto('https://road-to-unina.vercel.app/register');
  await page.fill('#register-email', testUser.email);
  await page.fill('#register-username', testUser.username);
  await page.fill('#register-password', testUser.password);
  await page.click('button[type="submit"]');

  // Wait for redirect to /game
  await page.waitForURL('**/game', { timeout: 15000 });
  await expect(page.locator('h1')).toContainText('Nuova Partita Speedrun');

  // 2. Test Invalid Title Error on production
  await page.fill('#override-start-page', 'questa_voce_sicuramente_non_esiste_su_wikipedia_999999');
  await page.click('button:has-text("Avvia Partita Ora")');

  const errorAlert = page.locator('[role="alert"]');
  await expect(errorAlert).toBeVisible({ timeout: 10000 });
  const errorText = await errorAlert.innerText();
  console.log('Production Error Banner Text:', errorText);
  expect(errorText).toContain('Pagina Wikipedia non trovata');

  await page.screenshot({ path: 'e2e-screenshots/live-prod-1-error-banner.png' });

  // 3. Close the error banner
  await errorAlert.locator('button').click();
  await expect(errorAlert).not.toBeVisible();

  // 4. Start a real speedrun game on production
  await page.fill('#override-start-page', 'Fisica quantistica');
  await page.click('button:has-text("Avvia Partita Ora")');

  // Wait for active game page
  await page.waitForSelector('text=Obiettivo Finale', { timeout: 20000 });
  await expect(page.locator('h1:has-text("Meccanica quantistica")')).toBeVisible();

  // Verify HUD bar and no occluded error banners
  await expect(page.locator('aside[aria-label="Pannello di controllo della partita (HUD)"]')).toBeVisible();

  await page.screenshot({ path: 'e2e-screenshots/live-prod-2-active-game.png' });

  console.log('SUCCESS: Full live production verification passed 100%!');
});
