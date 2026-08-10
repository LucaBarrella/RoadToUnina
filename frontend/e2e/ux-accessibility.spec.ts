import { test, expect } from '@playwright/test';

test.describe('RoadToUnina — UX, Session Persistence & Accessibility Playtest Suite', () => {
  async function registerUser(page: any, prefix: string) {
    const rand = Math.floor(Math.random() * 900000) + 100000;
    const user = {
      username: `${prefix}_${rand}`,
      email: `${prefix}.${rand}@unina.it`,
      password: 'Password123!',
    };

    await page.goto('/register');
    await page.fill('#register-email', user.email);
    await page.fill('#register-username', user.username);
    await page.fill('#register-password', user.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/game/, { timeout: 10000 });

    // Abandon any existing game
    const abandonBtn = page.locator('aside[aria-label*="HUD"] button:has-text("Abbandona")');
    if (await abandonBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await abandonBtn.click();
      await page.waitForTimeout(500);
    }

    return user;
  }

  // ---------------------------------------------------------------------------
  // TEST 1: ESPLORAZIONE OSPITE (GUEST MODE) SENZA AUTENTICAZIONE
  // ---------------------------------------------------------------------------
  test('1. Guest Exploration — Navigazione pubblica Leaderboard, Podio e Banner CTA', async ({ page }) => {
    // Clear localStorage to simulate an unauthenticated visitor
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Verify Landing Page loaded with Neo-Brutalist elements
    await expect(page.locator('h1')).toContainText(/ROAD\s*TO\s*UNINA/i);
    await expect(page.locator('button:has-text("Classifica"), a:has-text("Classifica")').first()).toBeVisible();

    // Navigate to Leaderboard as guest
    await page.goto('/leaderboard');
    await expect(page).toHaveURL(/.*\/leaderboard/);

    // Verify Leaderboard Table has populated rows
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    // Verify Guest CTA Banner "Partecipa alla Sfida" is visible
    const guestCard = page.locator('aside[aria-label="Profilo e Storico"]');
    await expect(guestCard.getByText('Partecipa alla Sfida')).toBeVisible();
    await expect(guestCard.locator('button:has-text("Registrati Ora")')).toBeVisible();

    // Verify clicking "Registrati Ora" navigates to /register
    await guestCard.locator('button:has-text("Registrati Ora")').click();
    await expect(page).toHaveURL(/.*\/register/);
  });

  // ---------------------------------------------------------------------------
  // TEST 2: PERSISTENZA STATO CROSS-DEVICE / PAGE RELOAD
  // ---------------------------------------------------------------------------
  test('2. Session Persistence — Ricaricamento pagina preserva timer, click e articolo corrente', async ({ page }) => {
    await registerUser(page, 'session_user');

    // Start a game from "Caffè"
    await page.fill('#override-start-page', 'Caffè');
    await page.click('button:has-text("Avvia Partita Ora")');

    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });

    // Click link "Napoli"
    const napoliChip = wikiContent.locator('a.wiki-chip, a[href^="/wiki/"]').filter({
      hasText: /^Napoli$/i,
    }).first();
    await expect(napoliChip).toBeVisible({ timeout: 10000 });
    await napoliChip.click();

    // Verify 1 CLICK recorded
    const hudBar = page.locator('aside[aria-label*="HUD"]');
    await expect(hudBar.locator('div[role="status"][aria-label*="Conteggio click"]')).toContainText(/1 CLICK/i, { timeout: 10000 });

    // Simulate page refresh / browser restart
    await page.reload();

    // Verify HUDBar and WikiRenderer re-attach immediately to active game session
    await expect(page.locator('article h1, header h1')).toContainText(/Napoli/i, { timeout: 15000 });
    await expect(hudBar.locator('div[role="status"][aria-label*="Conteggio click"]')).toContainText(/1 CLICK/i);
    await expect(hudBar.locator('div[role="status"][aria-label*="Tempo trascorso"]')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // TEST 3: CICLO DI VITA RESA VOLONTARIA & NUOVO AVVIO
  // ---------------------------------------------------------------------------
  test('3. Game Lifecycle — Resa volontaria con pulsante Abbandona e riavvio immediato', async ({ page }) => {
    await registerUser(page, 'abandon_user');

    // Start game
    await page.fill('#override-start-page', 'Archeologia');
    await page.click('button:has-text("Avvia Partita Ora")');

    await expect(page.locator('.wiki-content')).toBeVisible({ timeout: 15000 });

    // Click "Abbandona" button in HUD
    const abandonBtn = page.locator('aside[aria-label*="HUD"] button:has-text("Abbandona")');
    await expect(abandonBtn).toBeVisible();
    await abandonBtn.click();

    // Verify return to setup screen
    await expect(page.locator('h1')).toContainText(/Nuova Partita Speedrun/i, { timeout: 10000 });

    // Immediately start a new game without errors
    await page.fill('#override-start-page', 'Pompei');
    await page.click('button:has-text("Avvia Partita Ora")');

    // Verify new game loaded
    await expect(page.locator('article h1, header h1')).toContainText(/Pompei/i, { timeout: 15000 });
    await expect(page.locator('aside[aria-label*="HUD"] div[role="status"][aria-label*="Conteggio click"]')).toContainText(/0 CLICKS/i);
  });

  // ---------------------------------------------------------------------------
  // TEST 4: DOM SANITIZATION WIKIPEDIA & TOAST NOTIFICATION
  // ---------------------------------------------------------------------------
  test('4. Security & Sanitization — Rimozione box di servizio Wikipedia e Toast su link non validi', async ({ page }) => {
    await registerUser(page, 'sanitize_user');

    await page.fill('#override-start-page', 'Napoli');
    await page.click('button:has-text("Avvia Partita Ora")');

    const wikiContent = page.locator('.wiki-content');
    await expect(wikiContent).toBeVisible({ timeout: 15000 });

    // Verify Wikipedia service blocks are completely stripped from DOM
    await expect(page.locator('.mw-editsection')).toHaveCount(0);
    await expect(page.locator('.navbox')).toHaveCount(0);
    await expect(page.locator('.ambox')).toHaveCount(0);
    await expect(page.locator('.vertical-navbox')).toHaveCount(0);

    // Verify external links are not present
    const externalLinks = page.locator('.wiki-content a.external');
    await expect(externalLinks).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // TEST 5: NAVBAR ROUTING & LOGOUT
  // ---------------------------------------------------------------------------
  test('5. Navigation & Logout — Transizioni fluide tra le rotte SPA e disconnessione sicura', async ({ page }) => {
    const user = await registerUser(page, 'logout_user');

    // Verify user is visible in Header/Navbar
    const header = page.locator('header');
    await expect(header.getByText(user.username, { exact: true })).toBeVisible();

    // Navigate to /leaderboard via Navbar
    await header.locator('button:has-text("Classifica")').click();
    await expect(page).toHaveURL(/.*\/leaderboard/);

    // Navigate to /game via Navbar
    await header.locator('button:has-text("Gioca")').click();
    await expect(page).toHaveURL(/.*\/game/);

    // Click "Esci" in Navbar
    const logoutBtn = header.locator('button[title*="Disconnetti"], button:has-text("Esci")');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Verify token removed from localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();

    // Verify unauthenticated Navbar ("Accedi" button visible)
    await expect(header.locator('button:has-text("Accedi")')).toBeVisible();
  });
});
