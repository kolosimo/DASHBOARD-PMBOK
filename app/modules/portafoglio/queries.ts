/**
 * Query del portafoglio. Proprietario: agente B1 (Fase 2).
 *
 * Solo indicatori per commessa (e totali di portafoglio): nessun dato per
 * persona, nessuna classifica (art. 4 Statuto dei lavoratori). La colonna PM
 * non compare, così il portafoglio non diventa un confronto tra persone.
 *
 * Letture incrociate: EVM, vincoli e commesse visibili dalle query dei
 * rispettivi moduli. Il PPC delle ultime 4 settimane si legge con una sola
 * query aggregata su `piani_settimanali` e `impegni` (tabelle LPS, sola
 * lettura) per non fare 4 × N chiamate a `indicatoriSettimana`: vedi handoff B1.
 */
import db from '@adonisjs/lucid/services/db'
import type Utente from '#models/utente'
import type { DataIso, Indice, Lunedi, Minuti, StatoCommessa, StatoPiano } from '#domain/types'
import { calcolaCpi, calcolaSpi } from '#domain/evm'
import { aggiungiSettimane, lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import { commesseVisibili } from '#modules/anagrafiche/queries'
import { riepilogoEvm } from '#modules/evm/queries'
import { contaVincoliAperti } from '#modules/lps/queries'

/** Settimane considerate per il PPC del portafoglio */
export const SETTIMANE_PPC_PORTAFOGLIO = 4

export interface RigaPortafoglio {
  commessaId: number
  codice: string
  nome: string
  spi: Indice
  cpi: Indice
  /** PPC delle ultime 4 settimane pesato sugli impegni (rapporto 0–1) */
  ppc4Settimane: Indice
  vincoliAperti: number
  prossimaMilestone: { titolo: string; data: DataIso } | null
  // Campi aggiuntivi (Fase 2)
  stato: StatoCommessa
  baselinePresente: boolean
  bacMinuti: Minuti
  /** 0 senza baseline */
  pvMinuti: Minuti
  evMinuti: Minuti
  acMinuti: Minuti
  impegniPromessi4Settimane: number
  impegniFatti4Settimane: number
}

export interface TotaliPortafoglio {
  commesse: number
  bacMinuti: Minuti
  pvMinuti: Minuti
  evMinuti: Minuti
  acMinuti: Minuti
  /** Σ EV / Σ PV sulle sole commesse con baseline */
  spi: Indice
  /** Σ EV / Σ AC */
  cpi: Indice
  ppc4Settimane: Indice
  vincoliAperti: number
}

/** Piano di una settimana con i conteggi degli impegni promessi e fatti */
export interface PianoConteggi {
  settimana: Lunedi
  stato: StatoPiano
  promessi: number
  fatti: number
}

function rapporto(numeratore: number, denominatore: number): Indice {
  return denominatore === 0 ? null : numeratore / denominatore
}

/**
 * Settimane della finestra PPC: le ultime 4 concluse; se il piano della
 * settimana corrente è già chiuso, entra anche lei (e la finestra scorre).
 */
export function settimanePpc(settimanaCorrente: Lunedi, correnteChiusa: boolean): Lunedi[] {
  const ultima = correnteChiusa ? settimanaCorrente : aggiungiSettimane(settimanaCorrente, -1)
  return Array.from({ length: SETTIMANE_PPC_PORTAFOGLIO }, (_, i) =>
    aggiungiSettimane(ultima, i - (SETTIMANE_PPC_PORTAFOGLIO - 1))
  )
}

/**
 * PPC pesato sugli impegni: Σ fatti / Σ promessi sulle settimane della
 * finestra. I piani in bozza non hanno promesse e non contano; null se
 * nella finestra non c'è nessun impegno promesso.
 */
export function ppcPesato(
  piani: readonly PianoConteggi[],
  settimanaCorrente: Lunedi
): { ppc: Indice; promessi: number; fatti: number } {
  const corrente = piani.find((p) => p.settimana === settimanaCorrente)
  const finestra = new Set(settimanePpc(settimanaCorrente, corrente?.stato === 'chiuso'))
  let promessi = 0
  let fatti = 0
  for (const p of piani) {
    if (!finestra.has(p.settimana) || p.stato === 'bozza') continue
    promessi += p.promessi
    fatti += p.fatti
  }
  return { ppc: rapporto(fatti, promessi), promessi, fatti }
}

/** Piani delle commesse tra `dal` e `al` (lunedì) con i conteggi degli impegni */
async function pianiConConteggi(
  commessaIds: number[],
  dal: Lunedi,
  al: Lunedi
): Promise<Map<number, PianoConteggi[]>> {
  const esito = new Map<number, PianoConteggi[]>()
  if (commessaIds.length === 0) return esito
  const righe = await db
    .from('piani_settimanali as p')
    .leftJoin('impegni as i', 'i.piano_id', 'p.id')
    .whereIn('p.commessa_id', commessaIds)
    .whereBetween('p.settimana', [dal, al])
    .groupBy('p.commessa_id', 'p.settimana', 'p.stato')
    .select(
      'p.commessa_id',
      'p.settimana',
      'p.stato',
      db.raw('count(i.id) FILTER (WHERE NOT i.aggiunto_dopo_promessa) AS promessi'),
      db.raw('count(i.id) FILTER (WHERE NOT i.aggiunto_dopo_promessa AND i.fatto) AS fatti')
    )
  for (const r of righe) {
    const elenco = esito.get(r.commessa_id) ?? []
    elenco.push({
      settimana: String(r.settimana) as Lunedi,
      stato: r.stato,
      promessi: Number(r.promessi),
      fatti: Number(r.fatti),
    })
    esito.set(r.commessa_id, elenco)
  }
  return esito
}

/** Righe del portafoglio per l'utente (le commesse che vede, esclusa quelle chiuse) */
export async function righePortafoglio(
  utente: Utente,
  oggi: DataIso = oggiRoma()
): Promise<RigaPortafoglio[]> {
  const visibili = await commesseVisibili(utente)
  const commesse = visibili.filter((c) => c.stato !== 'chiusa')
  const settimana = lunediDellaSettimana(oggi)
  const piani = await pianiConConteggi(
    commesse.map((c) => c.id),
    aggiungiSettimane(settimana, -SETTIMANE_PPC_PORTAFOGLIO),
    settimana
  )

  return Promise.all(
    commesse.map(async (c) => {
      const [evm, vincoliAperti] = await Promise.all([
        riepilogoEvm(c.id, oggi),
        contaVincoliAperti(c.id),
      ])
      const baselinePresente = evm.baselineId !== null
      const ppc = ppcPesato(piani.get(c.id) ?? [], settimana)
      return {
        commessaId: c.id,
        codice: c.codice,
        nome: c.nome,
        spi: baselinePresente ? evm.spi : null,
        cpi: evm.cpi,
        ppc4Settimane: ppc.ppc,
        vincoliAperti,
        prossimaMilestone: c.prossimaMilestone,
        stato: c.stato,
        baselinePresente,
        bacMinuti: evm.bacMinuti,
        pvMinuti: baselinePresente ? evm.pvMinuti : 0,
        evMinuti: evm.evMinuti,
        acMinuti: evm.acMinuti,
        impegniPromessi4Settimane: ppc.promessi,
        impegniFatti4Settimane: ppc.fatti,
      }
    })
  )
}

/** Totali di portafoglio (somme per commessa, indici ricalcolati sulle somme) */
export function totaliPortafoglio(righe: readonly RigaPortafoglio[]): TotaliPortafoglio {
  let bac = 0
  let pv = 0
  let evConBaseline = 0
  let ev = 0
  let ac = 0
  let promessi = 0
  let fatti = 0
  let vincoli = 0
  for (const r of righe) {
    bac += r.bacMinuti
    ev += r.evMinuti
    ac += r.acMinuti
    if (r.baselinePresente) {
      pv += r.pvMinuti
      evConBaseline += r.evMinuti
    }
    promessi += r.impegniPromessi4Settimane
    fatti += r.impegniFatti4Settimane
    vincoli += r.vincoliAperti
  }
  return {
    commesse: righe.length,
    bacMinuti: bac,
    pvMinuti: pv,
    evMinuti: ev,
    acMinuti: ac,
    spi: calcolaSpi(evConBaseline, pv),
    cpi: calcolaCpi(ev, ac),
    ppc4Settimane: rapporto(fatti, promessi),
    vincoliAperti: vincoli,
  }
}
