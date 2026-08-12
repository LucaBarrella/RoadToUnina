import { test, expect } from '@playwright/test';

test('Verify complete error recovery, invalid title rejection, and clean gameplay', async ({ page }) => {
  const testId = Date.now().toString().slice(-6);
  const testUser = {
    username: `verifier_${testId}`,
    email: `verifier_${testId}@unina.it`,
    password: 'Password123!',
  };

  // 1. Register fresh user
  await page.goto('/register');
  await page.fill('#register-email', testUser.email);
  await page.fill('#register-username', testUser.username);
  await page.fill('#register-password', testUser.password);
  await page.click('button[type="submit"]');

  // Wait for redirect to /game
  await page.waitForURL('**/game', { timeout: 10000 });
  await page.waitForTimeout(500);

  // 2. We are on the "Nuova Partita Speedrun" screen
  await expect(page.locator('h1')).toContainText('Nuova Partita Speedrun');

  // 3. Test Invalid Title Error: Enter an invalid non-existent Wikipedia article
  await page.fill('#override-start-page', 'questa_voce_sicuramente_non_esiste_su_wikipedia_999999');
  await page.click('button:has-text("Avvia Partita Ora")');

  // Verify that a friendly Italian error banner is displayed
  const errorAlert = page.locator('[role="alert"]');
  await expect(errorAlert).toBeVisible({ timeout: 5000 });
  const errorText = await errorAlert.innerText();
  console.log('Displayed error text on invalid start:', errorText);
  expect(errorText).toContain('Pagina Wikipedia non trovata');
  expect(errorText).not.toContain('Request failed');
  expect(errorText).not.toContain('400');
  expect(errorText).not.toContain('404');

  // Screenshot the clean error message
  await page.screenshot({ path: 'e2e-screenshots/1-invalid-start-error.png' });

  // 4. Test Error Dismissal: Click the close button
  const closeBtn = errorAlert.locator('button');
  await closeBtn.click();
  await expect(errorAlert).not.toBeVisible();

  // 5. Test Valid Start: Start with a real Wikipedia article
  await page.fill('#override-start-page', 'Fisica quantistica');
  await page.click('button:has-text("Avvia Partita Ora")');

  // Verify active game loads
  await page.waitForSelector('text=Obiettivo Finale', { timeout: 10000 });
  await expect(page.locator('text=Fisica quantistica')).toBeVisible();

  // Screenshot active gameplay
  await page.screenshot({ path: 'e2e-screenshots/2-valid-game-active.png' });

  // 6. Test abandonment and fresh restart
  await page.click('button:has-text("Abbandona")');
  await page.waitForTimeout(1000);
  await expect(page.locator('h1')).toContainText('Nuova Partita Speedrun');

  // Start with empty field (random article)
  await page.fill('#override-start-page', '');
  await page.click('button:has-text("Avvia Partita Ora")');
  await page.waitForSelector('text=Obiettivo Finale', { timeout: 10000 });

  // Screenshot random game
  await page.screenshot({ path: 'e2e-screenshots/3-random-game-active.png' });
});
