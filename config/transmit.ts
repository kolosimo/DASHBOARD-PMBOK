import { defineConfig } from '@adonisjs/transmit'

/**
 * Tempo reale (SSE). Un solo processo sul server: nessun trasporto
 * esterno (Redis) necessario. Il ping tiene aperta la connessione
 * attraverso proxy e VPN.
 */
export default defineConfig({
  pingInterval: '30s',
  transport: null,
})
