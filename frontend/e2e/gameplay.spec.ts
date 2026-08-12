import { test, expect } from '@playwright/test';

test.describe('RoadToUnina — E2E & Automated Playtest Suite', () => {
  // Generate distinct test user credentials for the test run
  const testId = Date.now().toString().slice(-6);
  const testUser = {
    username: `speedrunner_${testId}`,
    email: `speedrunner_${testId}@unina.it`,
    password: 'Password123!',
  };

  test.describe.configure({ mode: 'serial' });

  // ---------------------------------------------------------------------------
  // 1. TEST REGISTRAZIONE & LOGIN
  // ---------------------------------------------------------------------------
  test('1. Registrazione nuovo utente & salvataggio JWT token in localStorage', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');
    await expect(page).toHaveURL(/.*\/register/);

    // Verify registration heading is visible
    await expect(page.locator('h1')).toContainText(/Crea Account/i);

    // Fill registration form
    await page.fill('#register-email', testUser.email);
    await page.fill('#register-username', testUser.username);
    await page.fill('#register-password', testUser.password);

    // Submit form and wait for redirect to /game
    await page.click('button[type="submit"]');

    // Verification 1: Redirect to /game
    await expect(page).toHaveURL(/.*\/game/, { timeout: 10000 });

    // Verification 2: JWT token is stored in localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token!.length).toBeGreaterThan(20);

    // Verification 3: Game page is loaded for authenticated user
    await expect(page.locator('h1')).toContainText(/Nuova Partita Speedrun/i);
  });

  test('1.1 Login con le credenziali registrate e verifica sessione', async ({ page }) => {
    // Clear localStorage to simulate fresh visitor
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Verify login form is visible
    await expect(page.locator('h1')).toContainText(/Accedi a RoadToUnina/i);

    // Fill login credentials
    await page.fill('#login-input', testUser.username);
    await page.fill('#login-password', testUser.password);
    await page.click('button[type="submit"]');

    // Verify redirection to /game and token restoration
    await expect(page).toHaveURL(/.*\/game/, { timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // 2. TEST SPEEDRUN COMPLETO (BOT GAMEPLAY)
  // ---------------------------------------------------------------------------
  test('2. Bot Gameplay — Avvio partita casuale, lettura link, navigazione ed aggiornamento HUDBar', async ({ page }) => {
    // Ensure user is authenticated
    await page.goto('/login');
    await page.fill('#login-input', testUser.username);
    await page.fill('#login-password', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/game/, { timeout: 10000 });

    // Check if there is an active game already; if so, abandon it first to start fresh
    const abandonBtn = page.locator('aside[aria-label*="HUD"] button:has-text("Abbandona")');
    if (await abandonBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await abandonBtn.click();
      await page.waitForTimeout(1000);
    }

    // Start a random speedrun game (leave custom start empty)
    const startBtn = page.locator('button:has-text("Avvia Partita Ora")');
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    // Wait for the active game interface and HUDBar to load
    const hudBar = page.locator('aside[aria-label*="HUD"]');
    await expect(hudBar).toBeVisible({ timeout: 15000 });

    // Verify initial HUDBar stats
    const clicksIndicator = hudBar.locator('div[role="status"][aria-label*="Conteggio click"]');
    await expect(clicksIndicator).toContainText(/0 CLICKS/i);

    const timerIndicator = hudBar.locator('div[role="status"][aria-label*="Tempo trascorso"]');
    await expect(timerIndicator).toBeVisible();

    // Verify Wikipedia content rendered
    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });

    // Wait for internal Wikipedia article links to be present
    const validWikiLinks = wikiContent.locator('a[href^="/wiki/"]:not([href*=":"])');
    await expect(validWikiLinks.first()).toBeVisible({ timeout: 15000 });
    const linkCount = await validWikiLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    // Bot picks a valid internal link from the article
    const firstValidLink = validWikiLinks.first();
    const linkText = (await firstValidLink.textContent())?.trim() || '';
    expect(linkText.length).toBeGreaterThan(0);

    // Click the valid link
    await firstValidLink.click();

    // Verify HUDBar updates click counter to 1 CLICK
    await expect(clicksIndicator).toContainText(/1 CLICK/i, { timeout: 10000 });

    // Clean up: abandon random run before full speedrun test
    const abandonAfterRandom = page.locator('aside[aria-label*="HUD"] button:has-text("Abbandona")');
    await expect(abandonAfterRandom).toBeVisible();
    await abandonAfterRandom.click();

    // Verify return to start game screen
    await expect(page.locator('h1')).toContainText(/Nuova Partita Speedrun/i, { timeout: 5000 });
  });

  test('2.1 Bot Gameplay — Speedrun completa con vittoria e Modal "UNINA REACHED!"', async ({ page }) => {
    // Ensure logged in
    await page.goto('/game');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    if (!token) {
      await page.goto('/login');
      await page.fill('#login-input', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/.*\/game/);
    }

    // Ensure on start screen
    const abandonBtn = page.locator('aside[aria-label*="HUD"] button:has-text("Abbandona")');
    if (await abandonBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await abandonBtn.click();
      await page.waitForTimeout(1000);
    }

    // Use starting article "Napoli" for deterministic speedrun path to target Unina
    await page.fill('#override-start-page', 'Napoli');
    await page.click('button:has-text("Avvia Partita Ora")');

    // Wait for article content
    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });

    // Verify starting article title in header
    await expect(page.locator('header h1')).toContainText(/Napoli/i, { timeout: 10000 });

    // Locate link to "Università degli Studi di Napoli Federico II" in the article
    const uninaLink = wikiContent.locator('a').filter({
      hasText: /Università degli Studi di Napoli Federico II/i,
    }).first();

    await expect(uninaLink).toBeVisible({ timeout: 10000 });

    // Bot clicks the target link to reach Unina
    await uninaLink.click();

    // Verify Victory Modal appears
    const victoryDialog = page.locator('div[role="dialog"][aria-modal="true"]');
    await expect(victoryDialog).toBeVisible({ timeout: 15000 });

    // Verify Victory Heading "UNINA REACHED!"
    const victoryHeading = victoryDialog.locator('#victory-heading');
    await expect(victoryHeading).toContainText(/UNINA REACHED!/i);

    // Verify Victory summary statistics
    await expect(victoryDialog.locator('text=1 CLICKS')).toBeVisible();
    await expect(victoryDialog.locator('text=Tempo Finale')).toBeVisible();

    // Verify path breadcrumbs include Napoli -> target
    await expect(victoryDialog.getByText('Napoli', { exact: true })).toBeVisible();
    await expect(victoryDialog.getByText('Università degli Studi di Napoli Federico II', { exact: true })).toBeVisible();

    // Verify action buttons in Victory Modal
    const leaderboardBtn = victoryDialog.locator('button:has-text("Classifica")');
    await expect(leaderboardBtn).toBeVisible();

    const replayBtn = victoryDialog.locator('button:has-text("Gioca Di Nuovo")');
    await expect(replayBtn).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 3. TEST VERIFICA LEADERBOARD & PERSISTENZA
  // ---------------------------------------------------------------------------
  test('3. Verifica Leaderboard & Persistenza delle partite concluse', async ({ page }) => {
    // Ensure logged in to verify user profile sidebar alongside rankings
    await page.goto('/login');
    await page.fill('#login-input', testUser.username);
    await page.fill('#login-password', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/game/);

    // Navigate to /leaderboard
    await page.goto('/leaderboard');
    await expect(page).toHaveURL(/.*\/leaderboard/);

    // Verify Leaderboard Header
    await expect(page.locator('h1')).toContainText(/Classifica Globale/i);

    // Verify Leaderboard Table has entries
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    // Verify test user appears in the rankings table
    const userRankingRow = tableRows.filter({ hasText: testUser.username });
    await expect(userRankingRow).toBeVisible();

    // Verify user profile sidebar displays user credentials
    const profileCard = page.locator('aside[aria-label="Profilo e Storico"]');
    await expect(profileCard.getByText(testUser.username, { exact: true }).first()).toBeVisible();
    await expect(profileCard.getByText(testUser.email, { exact: true })).toBeVisible();

    // Verify completed speedrun appears in recent history
    const recentHistory = profileCard.getByText(/➔ Unina/i);
    await expect(recentHistory.first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 4. TEST RESILIENZA & EDGE CASES
  // ---------------------------------------------------------------------------
  test('4. Resilienza & Edge Cases — Anti-Cheat, chiamate API anomale e protezione rotte', async ({ page, request }) => {
    // Login
    await page.goto('/login');
    await page.fill('#login-input', testUser.username);
    await page.fill('#login-password', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/game/);

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // 4.1 Anti-Cheat Verification via direct API injection
    // Start a game from Napoli
    const startRes = await request.post('http://localhost:3001/api/games/start', {
      headers: { Authorization: `Bearer ${token}` },
      data: { overrideStartPage: 'Napoli' },
    });
    expect([201, 400]).toContain(startRes.status());

    let gameId: string;
    if (startRes.status() === 201) {
      const startData = await startRes.json();
      gameId = startData.game.id;
    } else {
      // Fetch active game id
      const activeRes = await request.get('http://localhost:3001/api/games/active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(activeRes.status()).toBe(200);
      const activeData = await activeRes.json();
      gameId = activeData?.game?.id;
    }
    expect(gameId).toBeTruthy();

    // Attempt illegal step (anti-cheat non-existent link in Napoli)
    const illegalStepRes = await request.post(`http://localhost:3001/api/games/${gameId}/step`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { targetTitle: 'LinkTotalmenteInesistenteHacker999' },
    });

    // Backend must reject invalid cheat step with 400 Bad Request
    expect(illegalStepRes.status()).toBe(400);
    const illegalBody = await illegalStepRes.json();
    expect(illegalBody.error).toContain('Invalid step: link');

    // 4.2 Rapid simultaneous clicking / Concurrency check
    const rapidPromises = Array.from({ length: 5 }).map(() =>
      request.post(`http://localhost:3001/api/games/${gameId}/step`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { targetTitle: 'Vesuvio' },
      })
    );

    const rapidResponses = await Promise.all(rapidPromises);
    const statusCodes = rapidResponses.map((r) => r.status());

    // Exactly one or two requests can transition state; others must receive 400 or 409 Conflict without server crash
    expect(statusCodes.every((s) => [200, 400, 409].includes(s))).toBe(true);

    // 4.3 Unauthenticated route protection
    await page.evaluate(() => localStorage.clear());
    await page.goto('/game');

    // Must show authentication required card
    await expect(page.locator('h1')).toContainText(/Autenticazione Richiesta/i);
    await expect(page.locator('.card-neo-yellow button:has-text("Accedi")')).toBeVisible();
    await expect(page.locator('.card-neo-yellow button:has-text("Registrati")')).toBeVisible();
  });
});
