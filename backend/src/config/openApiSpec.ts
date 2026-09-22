export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'RoadToUnina REST API',
    version: '1.0.0',
    description:
      'Specifica OpenAPI per il backend di RoadToUnina (Wikipedia Speedrun). Include autenticazione JWT, gestione delle sessioni di gioco e statistiche pubbliche.',
    contact: {
      name: 'Luca Barrella',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'API base path relativo',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Autenticazione stateless tramite JSON Web Token (RFC 7519)',
      },
    },
    schemas: {
      UserProfile: {
        type: 'object',
        required: ['id', 'email', 'username', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid', example: 'd3b07384-d113-40bf-98bc-e7e0ac05c317' },
          email: { type: 'string', format: 'email', example: 'studente@unina.it' },
          username: { type: 'string', example: 'speedrunner99' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        required: ['user', 'token'],
        properties: {
          user: { $ref: '#/components/schemas/UserProfile' },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
      },
      RegisterDTO: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 255 },
          username: { type: 'string', minLength: 3, maxLength: 30 },
          password: { type: 'string', minLength: 6, maxLength: 128 },
        },
      },
      LoginDTO: {
        type: 'object',
        required: ['login', 'password'],
        properties: {
          login: { type: 'string', minLength: 1, maxLength: 255 },
          password: { type: 'string', minLength: 1, maxLength: 128 },
        },
      },
      GameStatus: {
        type: 'string',
        enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
      },
      GameStep: {
        type: 'object',
        required: ['id', 'gameId', 'pageTitle', 'stepOrder', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          gameId: { type: 'string', format: 'uuid' },
          pageTitle: { type: 'string' },
          stepOrder: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Game: {
        type: 'object',
        required: [
          'id',
          'userId',
          'startPageTitle',
          'currentPageTitle',
          'targetPageTitle',
          'status',
          'clickCount',
          'startTime',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          startPageTitle: { type: 'string' },
          currentPageTitle: { type: 'string' },
          targetPageTitle: { type: 'string' },
          status: { $ref: '#/components/schemas/GameStatus' },
          clickCount: { type: 'integer' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time', nullable: true },
          steps: {
            type: 'array',
            items: { $ref: '#/components/schemas/GameStep' },
          },
        },
      },
      WikiArticleContent: {
        type: 'object',
        required: ['title', 'html', 'validLinks'],
        properties: {
          title: { type: 'string' },
          html: { type: 'string' },
          validLinks: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      ActiveGameResponse: {
        type: 'object',
        required: ['game', 'pageContent', 'isGoalReached'],
        properties: {
          game: { $ref: '#/components/schemas/Game' },
          pageContent: { $ref: '#/components/schemas/WikiArticleContent' },
          isGoalReached: { type: 'boolean' },
        },
      },
      StartGameDTO: {
        type: 'object',
        properties: {
          overrideStartPage: { type: 'string', maxLength: 300 },
        },
      },
      MakeStepDTO: {
        type: 'object',
        required: ['targetTitle'],
        properties: {
          targetTitle: { type: 'string', minLength: 1, maxLength: 300 },
        },
      },
      LeaderboardEntry: {
        type: 'object',
        required: ['rank', 'username', 'completedGames', 'bestClicks', 'bestTimeSeconds', 'totalClicks'],
        properties: {
          rank: { type: 'integer' },
          username: { type: 'string' },
          completedGames: { type: 'integer' },
          bestClicks: { type: 'integer' },
          bestTimeSeconds: { type: 'integer' },
          totalClicks: { type: 'integer' },
        },
      },
      CompletedGameView: {
        type: 'object',
        required: ['id', 'username', 'startPageTitle', 'targetPageTitle', 'clickCount', 'startTime', 'endTime', 'durationSeconds', 'steps'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          startPageTitle: { type: 'string' },
          targetPageTitle: { type: 'string' },
          clickCount: { type: 'integer' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          durationSeconds: { type: 'integer' },
          steps: {
            type: 'array',
            items: { $ref: '#/components/schemas/GameStep' },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['error', 'code'],
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object', nullable: true },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Controllo dello stato di salute del server (Health Check)',
        description: 'Endpoint per monitoraggio e cloud uptime (zero database overhead).',
        responses: {
          200: {
            description: 'Server attivo e funzionante',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptime: { type: 'integer' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Registrazione nuovo account',
        description: 'Crea un nuovo profilo utente, cripta la password con bcrypt e restituisce il JWT token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterDTO' },
            },
          },
        },
        responses: {
          201: {
            description: 'Utente registrato con successo',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          400: {
            description: 'Validazione fallita o email/username già registrati',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Accesso utente (Login)',
        description: 'Verifica le credenziali (email o username) e restituisce il JWT Bearer token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginDTO' },
            },
          },
        },
        responses: {
          200: {
            description: 'Login effettuato con successo',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          401: {
            description: 'Credenziali non valide',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Profilo utente autenticato',
        description: 'Recupera il profilo dell utente a partire dal token Bearer.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Profilo utente recuperato',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserProfile' },
              },
            },
          },
          401: {
            description: 'Non autorizzato (token mancante o scaduto)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/games/start': {
      post: {
        tags: ['Games'],
        summary: 'Avvio nuova sessione di gioco (Speedrun)',
        description: 'Inizializza una nuova partita da una pagina casuale verso la pagina obiettivo (Federico II).',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StartGameDTO' },
            },
          },
        },
        responses: {
          201: {
            description: 'Partita avviata con successo',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ActiveGameResponse' },
              },
            },
          },
          400: {
            description: 'Partita già attiva per questo utente o input non valido',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'Non autorizzato',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/games/active': {
      get: {
        tags: ['Games'],
        summary: 'Recupera partita attiva',
        description: 'Restituisce lo stato della sessione IN_PROGRESS e l HTML della pagina corrente.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Partita attiva recuperata (o null se nessuna attiva)',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/ActiveGameResponse' },
                    { type: 'null' },
                  ],
                },
              },
            },
          },
          401: {
            description: 'Non autorizzato',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/games/{id}/step': {
      post: {
        tags: ['Games'],
        summary: 'Naviga un link (Step di gioco)',
        description: 'Esegue un click su un link di Wikipedia. Valida anti-cheat se il link era realmente presente nella pagina.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'ID univoco della partita',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MakeStepDTO' },
            },
          },
        },
        responses: {
          200: {
            description: 'Passo eseguito e nuova pagina caricata',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ActiveGameResponse' },
              },
            },
          },
          400: {
            description: 'Link non valido o non presente nella pagina attuale (Anti-cheat)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'Non autorizzato',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'Partita non trovata o non appartenente all utente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/games/{id}/abandon': {
      post: {
        tags: ['Games'],
        summary: 'Abbandona partita attiva',
        description: 'Imposta lo stato della partita corrente su ABANDONED.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'ID univoco della partita',
          },
        ],
        responses: {
          200: {
            description: 'Partita abbandonata',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Game' },
              },
            },
          },
          401: {
            description: 'Non autorizzato',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'Partita non trovata',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/public/leaderboard': {
      get: {
        tags: ['Public'],
        summary: 'Classifica globale (Leaderboard)',
        description: 'Restituisce i migliori speedrunner ordinati per minor numero di click e tempo.',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 50, minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          200: {
            description: 'Classifica globale recuperata',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/LeaderboardEntry' },
                },
              },
            },
          },
        },
      },
    },
    '/public/completed-games': {
      get: {
        tags: ['Public'],
        summary: 'Ultime partite completate',
        description: 'Restituisce lo storico delle partite concluse con successo e l elenco completo dei passi.',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          200: {
            description: 'Lista partite completate',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/CompletedGameView' },
                },
              },
            },
          },
        },
      },
    },
  },
};
