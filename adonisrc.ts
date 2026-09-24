import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  experimental: {},

  /*
  | Comandi ace dei pacchetti. I comandi dell'app stanno in ./commands
  */
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
    () => import('@adonisjs/session/commands'),
    () => import('@adonisjs/bouncer/commands'),
  ],

  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/core/providers/edge_provider'),
    () => import('@adonisjs/session/session_provider'),
    () => import('@adonisjs/vite/vite_provider'),
    () => import('@adonisjs/shield/shield_provider'),
    () => import('@adonisjs/static/static_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/auth/auth_provider'),
    () => import('@adonisjs/bouncer/bouncer_provider'),
    () => import('@adonisjs/transmit/transmit_provider'),
  ],

  /*
  | File importati all'avvio. start/routes.ts importa solo le rotte dei moduli.
  */
  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel'),
    () => import('#start/validator'),
    () => import('#start/view'),
    () => import('#start/transmit'),
    { file: () => import('#start/scheduler'), environment: ['web'] },
  ],

  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec.ts'],
        name: 'unit',
        timeout: 5000,
      },
      {
        files: ['tests/functional/**/*.spec.ts'],
        name: 'functional',
        timeout: 30000,
      },
    ],
    forceExit: true,
  },

  metaFiles: [
    {
      pattern: 'resources/views/**/*.edge',
      reloadServer: false,
    },
    {
      pattern: 'public/**',
      reloadServer: false,
    },
  ],

  hooks: {
    buildStarting: [() => import('@adonisjs/vite/build_hook')],
  },
})
