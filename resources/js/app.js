/*
 * Script dell'app (compilato da Vite). HTMX e Alpine sono caricati a parte da
 * public/vendor (versione fissata nel nome del file).
 *
 * - CSRF: ogni richiesta HTMX porta l'intestazione X-CSRF-TOKEN.
 * - 409 e 422: HTMX sostituisce comunque il frammento (conflitto o errore).
 * - Toast: evento "toast" (HX-Trigger dal server) o funzione mostraToast().
 * - Tempo reale: se <body data-commessa-id> è presente, ci si iscrive al canale
 *   SSE "commesse/<id>" e ogni evento diventa l'evento DOM "evento-commessa"
 *   sul body. Se SSE non funziona, si genera "polling-commessa" ogni 30 s.
 */
import { Transmit } from '@adonisjs/transmit-client'

const htmx = window.htmx

function tokenCsrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
}

if (htmx) {
  htmx.config.responseHandling = [
    { code: '204', swap: false },
    { code: '[23]..', swap: true },
    { code: '409', swap: true, error: false },
    { code: '422', swap: true, error: false },
    { code: '[45]..', swap: false, error: true },
  ]
  document.body.addEventListener('htmx:configRequest', (e) => {
    e.detail.headers['X-CSRF-TOKEN'] = tokenCsrf()
  })
  document.body.addEventListener('htmx:responseError', () => {
    mostraToast('Operazione non riuscita. Riprova o ricarica la pagina.')
  })
}

let timerToast
export function mostraToast(messaggio) {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = messaggio
  t.hidden = false
  clearTimeout(timerToast)
  timerToast = setTimeout(() => (t.hidden = true), 2600)
}
window.mostraToast = mostraToast

document.body.addEventListener('toast', (e) => {
  const d = e.detail
  mostraToast(typeof d === 'string' ? d : (d?.value ?? d?.messaggio ?? ''))
})
document.body.addEventListener('conflitto', (e) => {
  mostraToast(e.detail?.messaggio ?? 'Dato modificato da un altro utente')
})

// ---------- tempo reale ----------
const POLLING_MS = 30_000

function avviaTempoReale(commessaId) {
  const stato = document.getElementById('stato-connessione')
  let polling = null
  const avviaPolling = () => {
    if (polling) return
    polling = setInterval(() => {
      document.body.dispatchEvent(new CustomEvent('polling-commessa'))
    }, POLLING_MS)
    if (stato) stato.textContent = 'aggiornamento ogni 30 s'
  }
  const fermaPolling = () => {
    if (polling) clearInterval(polling)
    polling = null
    if (stato) stato.textContent = 'aggiornamenti in tempo reale'
  }

  try {
    const transmit = new Transmit({
      baseUrl: window.location.origin,
      maxReconnectAttempts: 10,
      beforeSubscribe: (request) => request.headers.set('X-CSRF-TOKEN', tokenCsrf()),
      beforeUnsubscribe: (request) => request.headers.set('X-CSRF-TOKEN', tokenCsrf()),
      onReconnectFailed: avviaPolling,
      onSubscribeFailed: avviaPolling,
    })
    transmit.on('connected', fermaPolling)
    transmit.on('disconnected', avviaPolling)
    const sub = transmit.subscription(`commesse/${commessaId}`)
    sub.onMessage((evento) => {
      document.body.dispatchEvent(new CustomEvent('evento-commessa', { detail: evento }))
    })
    sub.create().catch(avviaPolling)
  } catch {
    avviaPolling()
  }
}

const commessaId = document.body.dataset.commessaId
if (commessaId) avviaTempoReale(commessaId)
