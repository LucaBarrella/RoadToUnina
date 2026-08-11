import { GameStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/db';

interface SeedGameDefinition {
  userIndex: number;
  startPage: string;
  steps: string[];
  durationSeconds: number;
  status: GameStatus;
  hoursAgo: number;
}

async function main() {
  console.log('🌱 Starting comprehensive database seeding for RoadToUnina...');

  // 1. Clean existing test/seed data
  await prisma.gameStep.deleteMany({});
  await prisma.game.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('🧹 Cleaned existing tables (GameStep, Game, User).');

  // 2. Create password hash for all seed users
  const defaultPassword = await bcrypt.hash('Password123!', 10);

  // 3. Create 10 realistic simulated users
  const userData = [
    { username: 'unina_runner', email: 'runner@unina.it' },
    { username: 'speedrunner_napoli', email: 'napoli.runner@unina.it' },
    { username: 'wiki_master', email: 'wikimaster@unina.it' },
    { username: 'claudia_fed2', email: 'claudia.fed2@unina.it' },
    { username: 'mario_rossi', email: 'mario.rossi@unina.it' },
    { username: 'gennaro_speed', email: 'gennaro.speed@unina.it' },
    { username: 'lucia_bytes', email: 'lucia.bytes@unina.it' },
    { username: 'antonio_unina', email: 'antonio.unina@unina.it' },
    { username: 'sofia_traveler', email: 'sofia.traveler@unina.it' },
    { username: 'marco_neobrutal', email: 'marco.neobrutal@unina.it' },
  ];

  const createdUsers = [];
  for (const u of userData) {
    const user = await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        password: defaultPassword,
      },
    });
    createdUsers.push(user);
  }

  console.log(`👤 Created ${createdUsers.length} simulated users.`);

  // 4. Define realistic completed and in-progress game trails
  const TARGET_PAGE = 'Università degli Studi di Napoli Federico II';

  const gamesToSeed: SeedGameDefinition[] = [
    // --- 16 COMPLETED GAMES (Rich Leaderboard & History) ---
    // Rank 1 Candidate (unina_runner): 2 clicks, 25 seconds
    {
      userIndex: 0,
      startPage: 'Pizza',
      steps: ['Pizza', 'Napoli', TARGET_PAGE],
      durationSeconds: 25,
      status: GameStatus.COMPLETED,
      hoursAgo: 2,
    },
    // Rank 2 Candidate (speedrunner_napoli): 3 clicks, 38 seconds
    {
      userIndex: 1,
      startPage: 'Diego Armando Maradona',
      steps: ['Diego Armando Maradona', 'SSC Napoli', 'Napoli', TARGET_PAGE],
      durationSeconds: 38,
      status: GameStatus.COMPLETED,
      hoursAgo: 4,
    },
    // Rank 3 Candidate (wiki_master): 3 clicks, 44 seconds
    {
      userIndex: 2,
      startPage: 'Moon Knight',
      steps: ['Moon Knight', 'Italia', 'Napoli', TARGET_PAGE],
      durationSeconds: 44,
      status: GameStatus.COMPLETED,
      hoursAgo: 6,
    },
    // Claudia run 1: 3 clicks, 49 seconds
    {
      userIndex: 3,
      startPage: 'Caffè',
      steps: ['Caffè', 'Espresso', 'Napoli', TARGET_PAGE],
      durationSeconds: 49,
      status: GameStatus.COMPLETED,
      hoursAgo: 8,
    },
    // Mario run 1: 4 clicks, 56 seconds
    {
      userIndex: 4,
      startPage: 'Vesuvio',
      steps: ['Vesuvio', 'Golfo di Napoli', 'Campania', 'Napoli', TARGET_PAGE],
      durationSeconds: 56,
      status: GameStatus.COMPLETED,
      hoursAgo: 10,
    },
    // Gennaro run 1: 4 clicks, 64 seconds
    {
      userIndex: 5,
      startPage: 'Archeologia',
      steps: ['Archeologia', 'Pompei', 'Napoli', TARGET_PAGE],
      durationSeconds: 64,
      status: GameStatus.COMPLETED,
      hoursAgo: 12,
    },
    // Lucia run 1: 5 clicks, 74 seconds
    {
      userIndex: 6,
      startPage: 'Informatica',
      steps: ['Informatica', 'Alan Turing', 'Regno Unito', 'Italia', 'Napoli', TARGET_PAGE],
      durationSeconds: 74,
      status: GameStatus.COMPLETED,
      hoursAgo: 14,
    },
    // Antonio run 1: 4 clicks, 82 seconds
    {
      userIndex: 7,
      startPage: 'Rinascimento',
      steps: ['Rinascimento', 'Italia', 'Regno di Napoli', 'Napoli', TARGET_PAGE],
      durationSeconds: 82,
      status: GameStatus.COMPLETED,
      hoursAgo: 16,
    },
    // Sofia run 1: 5 clicks, 95 seconds
    {
      userIndex: 8,
      startPage: 'Fisica quantistica',
      steps: ['Fisica quantistica', 'Enrico Fermi', 'Italia', 'Napoli', TARGET_PAGE],
      durationSeconds: 95,
      status: GameStatus.COMPLETED,
      hoursAgo: 18,
    },
    // Marco run 1: 5 clicks, 110 seconds
    {
      userIndex: 9,
      startPage: 'Cinema italiano',
      steps: ['Cinema italiano', 'Commedia all\'italiana', 'Totò', 'Napoli', TARGET_PAGE],
      durationSeconds: 110,
      status: GameStatus.COMPLETED,
      hoursAgo: 20,
    },
    // unina_runner run 2: 4 clicks, 62 seconds
    {
      userIndex: 0,
      startPage: 'Dante Alighieri',
      steps: ['Dante Alighieri', 'Firenze', 'Italia', 'Napoli', TARGET_PAGE],
      durationSeconds: 62,
      status: GameStatus.COMPLETED,
      hoursAgo: 22,
    },
    // speedrunner_napoli run 2: 3 clicks, 41 seconds
    {
      userIndex: 1,
      startPage: 'Capri',
      steps: ['Capri', 'Golfo di Napoli', 'Napoli', TARGET_PAGE],
      durationSeconds: 41,
      status: GameStatus.COMPLETED,
      hoursAgo: 24,
    },
    // wiki_master run 2: 5 clicks, 88 seconds
    {
      userIndex: 2,
      startPage: 'Astronomia',
      steps: ['Astronomia', 'Galileo Galilei', 'Toscana', 'Italia', 'Napoli', TARGET_PAGE],
      durationSeconds: 88,
      status: GameStatus.COMPLETED,
      hoursAgo: 26,
    },
    // Claudia run 2: 6 clicks, 135 seconds
    {
      userIndex: 3,
      startPage: 'Intelligenza artificiale',
      steps: ['Intelligenza artificiale', 'Informatica', 'Algoritmo', 'Matematica', 'Renato Caccioppoli', 'Napoli', TARGET_PAGE],
      durationSeconds: 135,
      status: GameStatus.COMPLETED,
      hoursAgo: 28,
    },
    // Mario run 2: 4 clicks, 72 seconds
    {
      userIndex: 4,
      startPage: 'Musica barocca',
      steps: ['Musica barocca', 'Opera lirica', 'Teatro di San Carlo', 'Napoli', TARGET_PAGE],
      durationSeconds: 72,
      status: GameStatus.COMPLETED,
      hoursAgo: 30,
    },
    // Gennaro run 2: 4 clicks, 89 seconds
    {
      userIndex: 5,
      startPage: 'Filosofia moderna',
      steps: ['Filosofia moderna', 'Illuminismo', 'Giambattista Vico', 'Napoli', TARGET_PAGE],
      durationSeconds: 89,
      status: GameStatus.COMPLETED,
      hoursAgo: 32,
    },

    // --- 2 IN_PROGRESS GAMES ---
    {
      userIndex: 6, // lucia_bytes
      startPage: 'Fisica teorica',
      steps: ['Fisica teorica', 'Albert Einstein'],
      durationSeconds: 45,
      status: GameStatus.IN_PROGRESS,
      hoursAgo: 0.2,
    },
    {
      userIndex: 7, // antonio_unina
      startPage: 'Biologia molecolare',
      steps: ['Biologia molecolare'],
      durationSeconds: 15,
      status: GameStatus.IN_PROGRESS,
      hoursAgo: 0.1,
    },

    // --- 2 ABANDONED GAMES ---
    {
      userIndex: 8, // sofia_traveler
      startPage: 'Mitologia norrena',
      steps: ['Mitologia norrena', 'Odino', 'Scandinavia'],
      durationSeconds: 180,
      status: GameStatus.ABANDONED,
      hoursAgo: 36,
    },
    {
      userIndex: 9, // marco_neobrutal
      startPage: 'Geologia',
      steps: ['Geologia', 'Tettonica delle placche'],
      durationSeconds: 120,
      status: GameStatus.ABANDONED,
      hoursAgo: 40,
    },
  ];

  let gameCounter = 0;
  for (const g of gamesToSeed) {
    const user = createdUsers[g.userIndex];
    if (!user) continue;

    const baseTime = new Date(Date.now() - g.hoursAgo * 60 * 60 * 1000);
    const startTime = baseTime;
    const endTime =
      g.status === GameStatus.COMPLETED
        ? new Date(startTime.getTime() + g.durationSeconds * 1000)
        : null;

    const clickCount = g.steps.length > 0 ? g.steps.length - 1 : 0;
    const currentPageTitle = g.steps[g.steps.length - 1] || g.startPage;

    const stepsData = g.steps.map((stepTitle, i) => {
      const stepTime = new Date(startTime.getTime() + (i * g.durationSeconds * 1000) / Math.max(1, g.steps.length));
      return {
        pageTitle: stepTitle,
        stepOrder: i + 1,
        createdAt: stepTime,
      };
    });

    await prisma.game.create({
      data: {
        userId: user.id,
        startPageTitle: g.startPage,
        currentPageTitle,
        targetPageTitle: TARGET_PAGE,
        status: g.status,
        clickCount,
        startTime,
        endTime,
        createdAt: startTime,
        updatedAt: endTime || startTime,
        steps: {
          create: stepsData,
        },
      },
    });

    gameCounter++;
  }

  console.log(`🎮 Created ${gameCounter} games with detailed breadcrumbs (${gamesToSeed.filter(g => g.status === GameStatus.COMPLETED).length} COMPLETED, 2 IN_PROGRESS, 2 ABANDONED).`);
  console.log('🏆 Leaderboard populated with top podium positions:');
  console.log('   🥇 1°: unina_runner (2 clicks, 25s)');
  console.log('   🥈 2°: speedrunner_napoli (3 clicks, 38s)');
  console.log('   🥉 3°: wiki_master (3 clicks, 44s)');
  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
