import { test, expect } from '@playwright/test';

test.describe('RoadToUnina — E2E Speedrun Playtest: Moon Knight ➔ Unina', () => {
  const testId = Date.now().toString().slice(-5);
  const testUser = {
    username: `speedrunner_marvel_${testId}`,
    email: `marvel_${testId}@unina.it`,
    password: 'MarvelPassword123!',
  };

  test.describe.configure({ mode: 'serial' });

  test('Speedrun E2E: Da "Moon Knight" a "Università degli Studi di Napoli Federico II"', async ({ page }) => {
    // 1. Registrazione nuovo utente speedrunner
    await page.goto('/register');
    await expect(page).toHaveURL(/.*\/register/);
    await expect(page.locator('h1')).toContainText(/Crea Account/i);

    await page.fill('#register-email', testUser.email);
    await page.fill('#register-username', testUser.username);
    await page.fill('#register-password', testUser.password);
    await page.click('button[type="submit"]');

    // Verifica redirect alla pagina di gioco /game
    await expect(page).toHaveURL(/.*\/game/, { timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // Se esiste una partita precedente attiva, abbandonala per partire puliti
    const abandonBtn = page.locator('aside[aria-label*="HUD"] button:has-text("Abbandona")');
    if (await abandonBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await abandonBtn.click();
      await page.waitForTimeout(1000);
    }

    // 2. Avvio nuova partita con overrideStartPage "Moon Knight"
    await expect(page.locator('h1')).toContainText(/Nuova Partita Speedrun/i);
    await page.fill('#override-start-page', 'Moon Knight');
    await page.click('button:has-text("Avvia Partita Ora")');

    // 3. Attesa caricamento articolo "Moon Knight" e verifica HUDBar
    const hudBar = page.locator('aside[aria-label*="HUD"]');
    await expect(hudBar).toBeVisible({ timeout: 15000 });
    await expect(page.locator('header h1')).toContainText(/Moon Knight/i, { timeout: 15000 });

    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });

    // Step 1: Navigazione da Moon Knight
    // Cerca il chip "Egitto" (o "Italia")
    const egittoChip = wikiContent.locator('a.wiki-chip, a').filter({ hasText: /^Egitto$/i }).first();
    const italiaChip = wikiContent.locator('a.wiki-chip, a').filter({ hasText: /^Italia$/i }).first();

    let clickCountExpected = 0;

    if (await egittoChip.isVisible({ timeout: 4000 }).catch(() => false)) {
      await egittoChip.click();
      clickCountExpected++;
      await expect(page.locator('header h1')).toContainText(/Egitto/i, { timeout: 15000 });

      // Su Egitto, naviga verso Italia
      const italiaFromEgitto = wikiContent.locator('a.wiki-chip, a').filter({ hasText: /^Italia$/i }).first();
      await expect(italiaFromEgitto).toBeVisible({ timeout: 10000 });
      await italiaFromEgitto.click();
      clickCountExpected++;
    } else {
      await expect(italiaChip).toBeVisible({ timeout: 10000 });
      await italiaChip.click();
      clickCountExpected++;
    }

    // Step 2: Su Italia, clicca sul chip "Napoli"
    await expect(page.locator('header h1')).toContainText(/Italia/i, { timeout: 15000 });
    const napoliChip = wikiContent.locator('a.wiki-chip, a').filter({ hasText: /^Napoli$/i }).first();
    await expect(napoliChip).toBeVisible({ timeout: 10000 });
    await napoliChip.click();
    clickCountExpected++;

    // Step 3: Su Napoli, clicca sul chip "Università degli Studi di Napoli Federico II"
    await expect(page.locator('header h1')).toContainText(/Napoli/i, { timeout: 15000 });
    const uninaChip = wikiContent.locator('a.wiki-chip, a').filter({
      hasText: /Università degli Studi di Napoli Federico II/i,
    }).first();
    await expect(uninaChip).toBeVisible({ timeout: 10000 });
    await uninaChip.click();
    clickCountExpected++;

    // 4. Verifica della comparsa del Modal di Vittoria "UNINA REACHED!"
    const victoryDialog = page.locator('div[role="dialog"][aria-modal="true"]');
    await expect(victoryDialog).toBeVisible({ timeout: 15000 });

    const victoryHeading = victoryDialog.locator('#victory-heading');
    await expect(victoryHeading).toContainText(/UNINA REACHED!/i);

    // Verifica statistiche di vittoria (click e tempo)
    const clicksBadge = victoryDialog.locator(`text=${clickCountExpected} CLICKS`);
    await expect(clicksBadge).toBeVisible();
    await expect(victoryDialog.locator('text=Tempo Finale')).toBeVisible();

    // Verifica percorso completato nella timeline
    await expect(victoryDialog.getByText('Moon Knight', { exact: true })).toBeVisible();
    await expect(victoryDialog.getByText('Napoli', { exact: true })).toBeVisible();
    await expect(
      victoryDialog.getByText('Università degli Studi di Napoli Federico II', { exact: true })
    ).toBeVisible();

    // 5. Navigazione e verifica Leaderboard
    const leaderboardBtn = victoryDialog.locator('button:has-text("Classifica")');
    await expect(leaderboardBtn).toBeVisible();
    await leaderboardBtn.click();

    await expect(page).toHaveURL(/.*\/leaderboard/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText(/Classifica Globale/i);

    // Verifica che l'utente test compaia nella classifica
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    const userRow = tableRows.filter({ hasText: testUser.username });
    await expect(userRow.first()).toBeVisible();

    // Verifica storico partite nel profilo utente
    const profileAside = page.locator('aside[aria-label="Profilo e Storico"]');
    await expect(profileAside.getByText(testUser.username, { exact: true }).first()).toBeVisible();
  });
});
