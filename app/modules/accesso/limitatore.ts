/**
 * Limitatore semplice in memoria (un solo processo Node sul server).
 *
 * Conta gli eventi per chiave in una finestra fissa: alla prima occorrenza
 * parte la finestra, allo scadere il contatore riparte da zero. Al riavvio
 * del servizio i contatori si azzerano: va bene per il pilota, il blocco
 * vero degli account resta nel DB (utenti.bloccato_fino).
 */

interface Voce {
  conteggio: number
  scade: number
}

export class LimitatoreFinestra {
  private voci = new Map<string, Voce>()

  constructor(
    readonly massimo: number,
    readonly durataMs: number
  ) {}

  private voceValida(chiave: string, ora: number): Voce | null {
    const v = this.voci.get(chiave)
    if (!v) return null
    if (v.scade <= ora) {
      this.voci.delete(chiave)
      return null
    }
    return v
  }

  /** Registra un evento e restituisce il conteggio nella finestra */
  registra(chiave: string, ora = Date.now()): number {
    if (this.voci.size > 10_000) this.pulisci(ora)
    const v = this.voceValida(chiave, ora)
    if (v) {
      v.conteggio++
      return v.conteggio
    }
    this.voci.set(chiave, { conteggio: 1, scade: ora + this.durataMs })
    return 1
  }

  /** true se la chiave ha raggiunto il massimo nella finestra */
  superato(chiave: string, ora = Date.now()): boolean {
    const v = this.voceValida(chiave, ora)
    return v !== null && v.conteggio >= this.massimo
  }

  /** Secondi mancanti alla fine della finestra (0 se non c'è) */
  secondiRimanenti(chiave: string, ora = Date.now()): number {
    const v = this.voceValida(chiave, ora)
    return v ? Math.ceil((v.scade - ora) / 1000) : 0
  }

  azzera(chiave: string) {
    this.voci.delete(chiave)
  }

  svuota() {
    this.voci.clear()
  }

  private pulisci(ora: number) {
    for (const [k, v] of this.voci) if (v.scade <= ora) this.voci.delete(k)
  }
}

const QUINDICI_MINUTI = 15 * 60 * 1000

/** Richieste POST /accesso per indirizzo IP */
export const limitePerIp = new LimitatoreFinestra(30, QUINDICI_MINUTI)

/**
 * Tentativi falliti per email che non corrisponde a un account con password:
 * dopo 5 errori la risposta è la stessa di un account bloccato, così non si
 * capisce se l'email esiste.
 */
export const limitePerEmailSconosciuta = new LimitatoreFinestra(5, QUINDICI_MINUTI)

/** Solo per i test */
export function azzeraLimitatori() {
  limitePerIp.svuota()
  limitePerEmailSconosciuta.svuota()
}
