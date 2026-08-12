import { test, expect } from '@playwright/test';

test.describe('RoadToUnina — Thematic Speedrun Playtests (Boris, antirez, Local LLMs, Napoli, Totò)', () => {
  const testId = Date.now().toString().slice(-5);

  // Helper to register and login a distinct user for each thematic test suite
  async function setupUser(page: any, username: string) {
    const user = {
      username: `${username}_${testId}`,
      email: `${username}.${testId}@unina.it`,
      password: 'Password123!',
    };

    await page.goto('/register');
    await page.fill('#register-email', user.email);
    await page.fill('#register-username', user.username);
    await page.fill('#register-password', user.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/game/, { timeout: 10000 });

    // Abandon any lingering active game
    const abandonBtn = page.locator('aside[aria-label*="HUD"] button:has-text("Abbandona")');
    if (await abandonBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await abandonBtn.click();
      await page.waitForTimeout(500);
    }

    return user;
  }

  // ---------------------------------------------------------------------------
  // TEST 1: BORIS (Serie TV) SPEEDRUN ➔ UNINA ("Dai dai dai!")
  // ---------------------------------------------------------------------------
  test('1. Boris Speedrun — "Dai dai dai!": Da "Boris (serie televisiva)" a Unina', async ({ page }) => {
    await setupUser(page, 'rene_ferretti');

    // Start speedrun from "Boris (serie televisiva)"
    await page.fill('#override-start-page', 'Boris (serie televisiva)');
    await page.click('button:has-text("Avvia Partita Ora")');

    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    await expect(page.locator('header h1')).toContainText(/Boris/i);

    // Step 1: Click "Italia"
    const nextChip1 = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /Italia/i,
    }).first();
    await expect(nextChip1).toBeVisible({ timeout: 10000 });
    await nextChip1.click();

    // Step 2: From Italia click "Napoli"
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    const napoliChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /Napoli/i,
    }).first();
    await expect(napoliChip).toBeVisible({ timeout: 10000 });
    await napoliChip.click();

    // Step 3: From Napoli reach target Unina
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    const uninaChip = wikiContent.locator('a[data-title*="Federico II"], a.wiki-chip:has-text("Federico II")').first();
    await expect(uninaChip).toBeVisible({ timeout: 10000 });
    await uninaChip.click();

    // Verify Victory Modal
    const victoryDialog = page.locator('div[role="dialog"][aria-modal="true"]');
    await expect(victoryDialog).toBeVisible({ timeout: 15000 });
    await expect(victoryDialog.locator('#victory-heading')).toContainText(/UNINA REACHED!/i);
    await expect(victoryDialog.getByText('Boris (serie televisiva)', { exact: true })).toBeVisible();
    await expect(victoryDialog.getByText('Università degli Studi di Napoli Federico II', { exact: true })).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // TEST 2: SALVATORE SANFILIPPO (antirez) & REDIS SPEEDRUN
  // ---------------------------------------------------------------------------
  test('2. antirez / Redis Speedrun — Da "Redis" a Unina via "Salvatore Sanfilippo"', async ({ page }) => {
    await setupUser(page, 'antirez_hacker');

    // Start speedrun from "Redis"
    await page.fill('#override-start-page', 'Redis');
    await page.click('button:has-text("Avvia Partita Ora")');

    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    await expect(page.locator('header h1')).toContainText(/Redis/i);

    // Step 1: Click "Salvatore Sanfilippo (programmatore)"
    const antirezChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /^Salvatore Sanfilippo/i,
    }).first();
    await expect(antirezChip).toBeVisible({ timeout: 10000 });
    await antirezChip.click();

    // Step 2: From Salvatore Sanfilippo click "Italia" (data-title="Italia" or text "italiano")
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    const italiaChip = wikiContent.locator('a[data-title="Italia"], a[href="/wiki/Italia"], a.wiki-chip:has-text("italiano")').first();
    await expect(italiaChip).toBeVisible({ timeout: 10000 });
    await italiaChip.click();

    // Step 3: From Italia click "Napoli"
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    const napoliChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /Napoli/i,
    }).first();
    await expect(napoliChip).toBeVisible({ timeout: 10000 });
    await napoliChip.click();

    // Step 4: From Napoli reach Unina target
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    const uninaChip = wikiContent.locator('a[data-title*="Federico II"], a.wiki-chip:has-text("Federico II")').first();
    await expect(uninaChip).toBeVisible({ timeout: 10000 });
    await uninaChip.click();

    // Verify Victory Modal
    const victoryDialog = page.locator('div[role="dialog"][aria-modal="true"]');
    await expect(victoryDialog).toBeVisible({ timeout: 15000 });
    await expect(victoryDialog.locator('#victory-heading')).toContainText(/UNINA REACHED!/i);
    await expect(victoryDialog.getByText('Redis', { exact: true })).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // TEST 3: LOCAL LLMs & INTELLIGENZA ARTIFICIALE SPEEDRUN
  // ---------------------------------------------------------------------------
  test('3. Local LLM / AI Speedrun — Da "Intelligenza artificiale" a Unina via "Alan Turing"', async ({ page }) => {
    await setupUser(page, 'local_llm_runner');

    // Start speedrun from "Intelligenza artificiale"
    await page.fill('#override-start-page', 'Intelligenza artificiale');
    await page.click('button:has-text("Avvia Partita Ora")');

    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    await expect(page.locator('header h1')).toContainText(/Intelligenza artificiale/i);

    // Step 1: Click "Alan Turing"
    const turingChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /^Alan Turing$/i,
    }).first();
    await expect(turingChip).toBeVisible({ timeout: 10000 });
    await turingChip.click();

    // Step 2: From Alan Turing click "Seconda guerra mondiale"
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    const ww2Chip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /^Seconda guerra mondiale$/i,
    }).first();
    await expect(ww2Chip).toBeVisible({ timeout: 10000 });
    await ww2Chip.click();

    // Step 3: From Seconda guerra mondiale click "Napoli"
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    const napoliChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /^Napoli$/i,
    }).first();
    await expect(napoliChip).toBeVisible({ timeout: 10000 });
    await napoliChip.click();

    // Step 4: From Napoli reach Unina target
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    const uninaChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /Università degli Studi di Napoli Federico II/i,
    }).first();
    await expect(uninaChip).toBeVisible({ timeout: 10000 });
    await uninaChip.click();

    // Verify Victory
    const victoryDialog = page.locator('div[role="dialog"][aria-modal="true"]');
    await expect(victoryDialog).toBeVisible({ timeout: 15000 });
    await expect(victoryDialog.locator('#victory-heading')).toContainText(/UNINA REACHED!/i);
    await expect(victoryDialog.getByText('Intelligenza artificiale', { exact: true })).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // TEST 4: DIEGO ARMANDO MARADONA SPEEDRUN (D10S)
  // ---------------------------------------------------------------------------
  test('4. Maradona Speedrun — "D10S": Da "Diego Armando Maradona" a Unina', async ({ page }) => {
    await setupUser(page, 'diego_maradona_10');

    await page.fill('#override-start-page', 'Diego Armando Maradona');
    await page.click('button:has-text("Avvia Partita Ora")');

    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    await expect(page.locator('header h1')).toContainText(/Maradona/i);

    // Step 1: Click "Napoli"
    const napoliChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /^Napoli$/i,
    }).first();
    await expect(napoliChip).toBeVisible({ timeout: 10000 });
    await napoliChip.click();

    // Step 2: From Napoli reach Unina target
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    const uninaChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /Università degli Studi di Napoli Federico II/i,
    }).first();
    await expect(uninaChip).toBeVisible({ timeout: 10000 });
    await uninaChip.click();

    // Verify Victory
    const victoryDialog = page.locator('div[role="dialog"][aria-modal="true"]');
    await expect(victoryDialog).toBeVisible({ timeout: 15000 });
    await expect(victoryDialog.locator('#victory-heading')).toContainText(/UNINA REACHED!/i);
    await expect(victoryDialog.getByText('Diego Armando Maradona', { exact: true })).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // TEST 5: PIZZA NAPOLETANA SPEEDRUN (Hyper-Speedrun 2 Clicks)
  // ---------------------------------------------------------------------------
  test('5. Pizza Napoletana Speedrun — Da "Pizza napoletana" a Unina in 2 Clicks', async ({ page }) => {
    await setupUser(page, 'mastro_pizzaiolo');

    await page.fill('#override-start-page', 'Pizza');
    await page.click('button:has-text("Avvia Partita Ora")');

    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    await expect(page.locator('header h1')).toContainText(/Pizza/i);

    // Step 1: Click "Napoli"
    const napoliChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /^Napoli$/i,
    }).first();
    await expect(napoliChip).toBeVisible({ timeout: 10000 });
    await napoliChip.click();

    // Step 2: Click Unina target
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    const uninaChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /Università degli Studi di Napoli Federico II/i,
    }).first();
    await expect(uninaChip).toBeVisible({ timeout: 10000 });
    await uninaChip.click();

    // Verify Victory in 2 clicks
    const victoryDialog = page.locator('div[role="dialog"][aria-modal="true"]');
    await expect(victoryDialog).toBeVisible({ timeout: 15000 });
    await expect(victoryDialog.locator('#victory-heading')).toContainText(/UNINA REACHED!/i);
    await expect(victoryDialog.locator('text=2 CLICKS')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // TEST 6: TOTÒ — 1-CLICK INSTANT SPEEDRUN RECORD
  // ---------------------------------------------------------------------------
  test('6. Totò Speedrun — 1-Click Record diretto a Unina', async ({ page }) => {
    await setupUser(page, 'principe_toto');

    await page.fill('#override-start-page', 'Totò');
    await page.click('button:has-text("Avvia Partita Ora")');

    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });
    await expect(page.locator('header h1')).toContainText(/Totò/i);

    // Direct link to Unina in Totò article
    const uninaChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /Università degli Studi di Napoli Federico II/i,
    }).first();
    await expect(uninaChip).toBeVisible({ timeout: 10000 });
    await uninaChip.click();

    // Verify 1-Click Instant Victory
    const victoryDialog = page.locator('div[role="dialog"][aria-modal="true"]');
    await expect(victoryDialog).toBeVisible({ timeout: 15000 });
    await expect(victoryDialog.locator('#victory-heading')).toContainText(/UNINA REACHED!/i);
    await expect(victoryDialog.locator('text=1 CLICKS')).toBeVisible();
  });
});
