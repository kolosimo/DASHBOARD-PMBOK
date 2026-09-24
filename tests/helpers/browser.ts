/**
 * Piccolo "browser" per i test funzionali: fetch verso il server di test con
 * cookie conservati tra le richieste e redirect gestiti a mano.
 */
import env from '#start/env'

export class Browser {
  cookie = new Map<string, string>()
  base: string

  constructor(base?: string) {
    this.base = base ?? `http://${env.get('HOST')}:${env.get('PORT')}`
  }

  private salvaCookie(r: Response) {
    for (const riga of r.headers.getSetCookie()) {
      const [coppia] = riga.split(';')
      const i = coppia.indexOf('=')
      const nome = coppia.slice(0, i).trim()
      const valore = coppia.slice(i + 1).trim()
      if (valore === '' || /max-age=0/i.test(riga) || /expires=thu, 01 jan 1970/i.test(riga)) {
        this.cookie.delete(nome)
      } else {
        this.cookie.set(nome, valore)
      }
    }
  }

  private intestazioni(extra: Record<string, string> = {}) {
    const h: Record<string, string> = { ...extra }
    if (this.cookie.size > 0) {
      h.cookie = [...this.cookie].map(([k, v]) => `${k}=${v}`).join('; ')
    }
    return h
  }

  url(percorso: string) {
    return percorso.startsWith('http') ? percorso : `${this.base}${percorso}`
  }

  /** GET senza seguire i redirect */
  async get(percorso: string, intestazioni: Record<string, string> = {}) {
    const r = await fetch(this.url(percorso), {
      redirect: 'manual',
      headers: this.intestazioni(intestazioni),
    })
    this.salvaCookie(r)
    return r
  }

  /** GET seguendo i redirect sullo stesso server (max 10) */
  async vai(percorso: string) {
    let r = await this.get(percorso)
    for (let i = 0; i < 10 && r.status >= 300 && r.status < 400; i++) {
      const dove = r.headers.get('location')!
      r = await this.get(dove)
    }
    return r
  }

  /** POST di un form (application/x-www-form-urlencoded) */
  async post(
    percorso: string,
    campi: Record<string, string>,
    intestazioni: Record<string, string> = {}
  ) {
    const r = await fetch(this.url(percorso), {
      method: 'POST',
      redirect: 'manual',
      headers: this.intestazioni({
        'content-type': 'application/x-www-form-urlencoded',
        ...intestazioni,
      }),
      body: new URLSearchParams(campi).toString(),
    })
    this.salvaCookie(r)
    return r
  }

  /** Token CSRF letto dal meta della pagina */
  static csrfDa(html: string): string {
    const m = html.match(/<meta name="csrf-token" content="([^"]+)"/)
    if (!m) throw new Error('csrf-token non trovato nella pagina')
    return m[1]
  }

  /** Login di sviluppo come utente del seed (parte locale dell'email) */
  async loginSviluppo(come: string) {
    const r = await this.get(`/dev/login?come=${encodeURIComponent(come)}`)
    if (r.status !== 302) throw new Error(`login di sviluppo fallito: ${r.status}`)
    return r
  }
}
