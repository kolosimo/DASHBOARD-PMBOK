import { test } from '@japa/runner'
import { controllaConfigurazioneAvvio, elencoEmailAdmin } from '#shared/avvio'

test.group('Controlli di avvio', () => {
  test('rifiuta NODE_ENV=production con AUTH_MODE=dev', ({ assert }) => {
    assert.throws(
      () => controllaConfigurazioneAvvio({ NODE_ENV: 'production', AUTH_MODE: 'dev' }),
      /AUTH_MODE=dev non è ammesso/
    )
  })

  test('accetta AUTH_MODE=dev in sviluppo e nei test', ({ assert }) => {
    assert.doesNotThrow(() =>
      controllaConfigurazioneAvvio({ NODE_ENV: 'development', AUTH_MODE: 'dev' })
    )
    assert.doesNotThrow(() => controllaConfigurazioneAvvio({ NODE_ENV: 'test', AUTH_MODE: 'dev' }))
  })

  test('con AUTH_MODE=oidc servono issuer, client id e redirect', ({ assert }) => {
    assert.throws(
      () => controllaConfigurazioneAvvio({ NODE_ENV: 'production', AUTH_MODE: 'oidc' }),
      /OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_REDIRECT_URI/
    )
    assert.doesNotThrow(() =>
      controllaConfigurazioneAvvio({
        NODE_ENV: 'production',
        AUTH_MODE: 'oidc',
        OIDC_ISSUER: 'https://login.microsoftonline.com/t/v2.0',
        OIDC_CLIENT_ID: 'id',
        OIDC_REDIRECT_URI: 'https://cruscotto.local/auth/callback',
      })
    )
  })

  test('ADMIN_EMAILS: separatori, spazi e maiuscole', ({ assert }) => {
    assert.deepEqual(elencoEmailAdmin(' A@x.it; b@X.it ,, '), ['a@x.it', 'b@x.it'])
    assert.deepEqual(elencoEmailAdmin(undefined), [])
  })
})
