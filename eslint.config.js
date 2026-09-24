import { configApp } from '@adonisjs/eslint-config'

export default configApp(
  {
    ignores: ['public/vendor/**', 'public/fonts/**', 'prototipo/**', 'screenshots/**'],
  },
  {
    // Nei test è comodo leggere subito il corpo della risposta: (await r.text())
    files: ['tests/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      '@unicorn/no-await-expression-member': 'off',
    },
  }
)
