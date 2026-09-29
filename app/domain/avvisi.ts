/**
 * Avvisi "da affrontare in riunione" (Obeya) e semafori del portafoglio.
 *
 * CONTRATTO fissato in Fase 0: il corpo lo scrive l'agente B1 (Fase 2).
 * Le soglie vengono da `impostazioni` (valori di esempio) tramite soglie.ts.
 */
import type { Avviso, DataIso, Indice, Minuti, Soglia } from '#domain/types'
import { semaforo } from '#domain/soglie'
import * as formato from '#ui/formato'

export interface DatiAvvisi {
  spi: Indice
  cpi: Indice
  pvMinuti: Minuti
  evMinuti: Minuti
  bacMinuti: Minuti
  eacMinuti: Minuti | null
  etcMinuti: Minuti | null
  oggi: DataIso
  vincoliAperti: readonly { codice: string; descrizione: string; dataNecessaria: DataIso | null }[]
  colonne: readonly { nome: string; conteggio: number; limite: number | null }[]
  elaboratiFermi: readonly { codice: string; giorniNelloStato: number }[]
}

export interface SoglieAvvisi {
  spi: Soglia
  cpi: Soglia
  /** Giorni entro cui un vincolo aperto in scadenza diventa avviso */
  giorniPreavvisoVincoli: number
  /** Giorni nello stesso stato oltre i quali un elaborato è "fermo" */
  giorniElaboratoFermo: number
}

/**
 * Genera gli avvisi, in quest'ordine:
 * 1. SPI in rosso → critico: "SPI x: in ritardo di N h di lavoro rispetto al piano" (N = PV − EV);
 * 2. CPI in rosso → critico: "CPI x: a completamento si stimano EAC h contro BAC h a budget (servono ancora ETC h)";
 * 3. vincoli aperti con data necessaria entro `giorniPreavvisoVincoli` → attenzione;
 * 4. colonne oltre il limite WIP → attenzione;
 * 5. elaborati fermi da ≥ `giorniElaboratoFermo` giorni → attenzione.
 * Indici null non generano avvisi. Nessun avviso nomina singole persone.
 */
export function generaAvvisi(dati: DatiAvvisi, soglie: SoglieAvvisi): Avviso[] {
  const avvisi: Avviso[] = []

  if (semaforo(dati.spi, soglie.spi) === 'rosso') {
    avvisi.push({
      gravita: 'critico',
      codice: 'spi',
      messaggio: `SPI ${formato.indice(dati.spi)}: in ritardo di ${formato.ore(dati.pvMinuti - dati.evMinuti)} di lavoro rispetto al piano`,
    })
  }

  if (semaforo(dati.cpi, soglie.cpi) === 'rosso') {
    avvisi.push({
      gravita: 'critico',
      codice: 'cpi',
      messaggio:
        `CPI ${formato.indice(dati.cpi)}: a completamento si stimano ${formato.ore(dati.eacMinuti)} ` +
        `contro ${formato.ore(dati.bacMinuti)} a budget (servono ancora ${formato.ore(dati.etcMinuti)})`,
    })
  }

  const giornoOggi = giornoAssoluto(dati.oggi)
  if (giornoOggi !== null) {
    for (const v of dati.vincoliAperti) {
      if (v.dataNecessaria === null) continue
      const giorno = giornoAssoluto(v.dataNecessaria)
      if (giorno === null || giorno - giornoOggi > soglie.giorniPreavvisoVincoli) continue
      const quando = formato.data(v.dataNecessaria)
      avvisi.push({
        gravita: 'attenzione',
        codice: `vincolo:${v.codice}`,
        messaggio:
          giorno < giornoOggi
            ? `Vincolo ${v.codice} ancora aperto, serviva entro il ${quando}: ${v.descrizione}`
            : `Vincolo ${v.codice} da rimuovere entro il ${quando}: ${v.descrizione}`,
      })
    }
  }

  for (const c of dati.colonne) {
    if (c.limite === null || c.conteggio <= c.limite) continue
    avvisi.push({
      gravita: 'attenzione',
      codice: `wip:${c.nome}`,
      messaggio: `Kanban: ${c.conteggio} elaborati in "${c.nome}" con limite WIP ${c.limite}`,
    })
  }

  for (const e of dati.elaboratiFermi) {
    if (e.giorniNelloStato < soglie.giorniElaboratoFermo) continue
    avvisi.push({
      gravita: 'attenzione',
      codice: `fermo:${e.codice}`,
      messaggio: `${e.codice} fermo nello stesso stato da ${e.giorniNelloStato} giorni`,
    })
  }

  return avvisi
}

/** Numero del giorno (UTC) di una data ISO, per confronti tra date senza fuso */
function giornoAssoluto(d: DataIso): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) return null
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000)
}
