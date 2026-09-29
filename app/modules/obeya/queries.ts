/**
 * Query della vista Obeya. Proprietario: agente B1 (Fase 2).
 * Compone le query degli altri moduli (EVM, LPS, flusso, anagrafiche) e le
 * loro funzioni SVG; non scrive su nessuna tabella e non legge tabelle altrui.
 */
import type { Avviso, DataIso, Lunedi, Minuti, Soglia, StatoPiano } from '#domain/types'
import { generaAvvisi, type DatiAvvisi } from '#domain/avvisi'
import { leggiTutteLeImpostazioni } from '#shared/impostazioni'
import { lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import { riepilogoEvm, serieCurvaS, type RiepilogoEvm } from '#modules/evm/queries'
import { svgCurvaS } from '#modules/evm/curva_s'
import { registroVincoli, riepilogoLps, type RiepilogoLps } from '#modules/lps/queries'
import { graficoPpc } from '#modules/lps/grafici'
import { riepilogoFlusso, type RiepilogoFlusso } from '#modules/flusso/queries'
import { elencoMilestone } from '#modules/anagrafiche/queries'

export interface SoglieObeya {
  spi: Soglia
  cpi: Soglia
  ppc: Soglia
  pcr: Soglia
}

/** Milestone del master schedule, con lo stato per il disegno */
export interface MilestoneObeya {
  id: number
  titolo: string
  dataPrevista: DataIso
  dataEffettiva: DataIso | null
  contrattuale: boolean
  /** completata (data effettiva) */
  fatta: boolean
  /** la prima non completata */
  prossima: boolean
  /** non completata e con data prevista già passata */
  inRitardo: boolean
}

/** Cosa manca alla commessa: guida lo stato vuoto della vista */
export interface PassiMancanti {
  elaborati: boolean
  baseline: boolean
  pianoSettimana: boolean
  milestone: boolean
  ore: boolean
}

export interface DatiObeya {
  oggi: DataIso
  settimana: Lunedi
  soglie: SoglieObeya
  evm: Pick<
    RiepilogoEvm,
    | 'bacMinuti'
    | 'evMinuti'
    | 'acMinuti'
    | 'spi'
    | 'cpi'
    | 'eacMinuti'
    | 'etcMinuti'
    | 'vacMinuti'
    | 'baselineNumero'
  > & {
    /** null senza baseline approvata */
    pvMinuti: Minuti | null
  }
  lps: Pick<RiepilogoLps, 'ppc' | 'promessi' | 'fatti' | 'pcr' | 'vincoliAperti'> & {
    statoPiano: StatoPiano | null
  }
  numeroElaborati: number
  milestone: MilestoneObeya[]
  avvisi: Avviso[]
  /** SVG già pronto (funzioni dei moduli LPS ed EVM) */
  graficoPpc: string
  curvaS: string
  mancano: PassiMancanti
  /** Nessun dato di avanzamento: la commessa è appena stata creata */
  commessaVuota: boolean
}

/** Dati per `generaAvvisi` a partire dai riepiloghi dei moduli */
function datiPerAvvisi(
  evm: RiepilogoEvm,
  flusso: RiepilogoFlusso,
  vincoli: { codice: string; descrizione: string; dataNecessaria: DataIso | null }[],
  oggi: DataIso
): DatiAvvisi {
  const baseline = evm.baselineId !== null
  return {
    // senza baseline il PV non esiste: SPI resta n.d. e non genera avvisi
    spi: baseline ? evm.spi : null,
    cpi: evm.cpi,
    pvMinuti: evm.pvMinuti,
    evMinuti: evm.evMinuti,
    bacMinuti: evm.bacMinuti,
    eacMinuti: evm.eacMinuti,
    etcMinuti: evm.etcMinuti,
    oggi,
    vincoliAperti: vincoli,
    colonne: flusso.colonne.map((c) => ({
      nome: c.nome,
      conteggio: c.schede.length,
      limite: c.limiteWip,
    })),
    elaboratiFermi: flusso.colonne
      .flatMap((c) => c.schede)
      .filter((s) => s.etaGiorni !== null)
      .sort((a, b) => (b.etaGiorni ?? 0) - (a.etaGiorni ?? 0) || a.codice.localeCompare(b.codice))
      .map((s) => ({ codice: s.codice, giorniNelloStato: s.etaGiorni ?? 0 })),
  }
}

async function soglieAvvisi() {
  const imp = await leggiTutteLeImpostazioni()
  return {
    imp,
    soglie: {
      spi: imp['soglie.spi'],
      cpi: imp['soglie.cpi'],
      giorniPreavvisoVincoli: imp['avvisi.giorni_preavviso_vincoli'],
      giorniElaboratoFermo: imp['flusso.giorni_elaborato_fermo'],
    },
  }
}

async function vincoliAperti(commessaId: number) {
  const righe = await registroVincoli(commessaId, 'aperti')
  return righe.map((v) => ({
    codice: v.codice,
    descrizione: v.descrizione,
    dataNecessaria: v.dataNecessaria,
  }))
}

/** Avvisi "da affrontare in riunione" per la commessa */
export async function avvisiCommessa(
  commessaId: number,
  oggi: DataIso = oggiRoma()
): Promise<Avviso[]> {
  const [evm, flusso, vincoli, { soglie }] = await Promise.all([
    riepilogoEvm(commessaId, oggi),
    riepilogoFlusso(commessaId, oggi),
    vincoliAperti(commessaId),
    soglieAvvisi(),
  ])
  return generaAvvisi(datiPerAvvisi(evm, flusso, vincoli, oggi), soglie)
}

/** Milestone con lo stato per il master schedule */
export function statoMilestone(
  righe: readonly {
    id: number
    titolo: string
    dataPrevista: DataIso
    dataEffettiva: DataIso | null
    contrattuale: boolean
  }[],
  oggi: DataIso
): MilestoneObeya[] {
  const indiceProssima = righe.findIndex((m) => m.dataEffettiva === null)
  return righe.map((m, i) => ({
    id: m.id,
    titolo: m.titolo,
    dataPrevista: m.dataPrevista,
    dataEffettiva: m.dataEffettiva,
    contrattuale: m.contrattuale,
    fatta: m.dataEffettiva !== null,
    prossima: i === indiceProssima,
    inRitardo: m.dataEffettiva === null && m.dataPrevista < oggi,
  }))
}

/** Tutto ciò che serve alla vista Obeya, alla data `oggi` (Roma) */
export async function datiObeya(
  commessaId: number,
  oggi: DataIso = oggiRoma()
): Promise<DatiObeya> {
  const settimana = lunediDellaSettimana(oggi)
  const [evm, serie, lps, flusso, vincoli, milestone, { imp, soglie: soglieAv }] =
    await Promise.all([
      riepilogoEvm(commessaId, oggi),
      serieCurvaS(commessaId, oggi),
      riepilogoLps(commessaId, settimana),
      riepilogoFlusso(commessaId, oggi),
      vincoliAperti(commessaId),
      elencoMilestone(commessaId),
      soglieAvvisi(),
    ])

  const soglie: SoglieObeya = {
    spi: imp['soglie.spi'],
    cpi: imp['soglie.cpi'],
    ppc: imp['soglie.ppc'],
    pcr: imp['soglie.pcr'],
  }
  const numeroElaborati = flusso.colonne.reduce((n, c) => n + c.schede.length, 0)
  const baseline = evm.baselineId !== null
  const acMinuti: Minuti = evm.acMinuti

  const mancano: PassiMancanti = {
    elaborati: numeroElaborati === 0,
    baseline: !baseline,
    pianoSettimana: lps.statoPiano === null,
    milestone: milestone.length === 0,
    ore: acMinuti === 0,
  }
  const pianiPassati = lps.storicoPpc.some((p) => p.daSnapshot)

  return {
    oggi,
    settimana,
    soglie,
    evm: {
      bacMinuti: evm.bacMinuti,
      // senza baseline il PV non è definito (vedi vista EVM)
      pvMinuti: baseline ? evm.pvMinuti : null,
      evMinuti: evm.evMinuti,
      acMinuti,
      spi: baseline ? evm.spi : null,
      cpi: evm.cpi,
      eacMinuti: evm.eacMinuti,
      etcMinuti: evm.etcMinuti,
      vacMinuti: evm.vacMinuti,
      baselineNumero: evm.baselineNumero,
    },
    lps: {
      ppc: lps.ppc,
      promessi: lps.promessi,
      fatti: lps.fatti,
      pcr: lps.pcr,
      vincoliAperti: lps.vincoliAperti,
      statoPiano: lps.statoPiano,
    },
    numeroElaborati,
    milestone: statoMilestone(milestone, oggi),
    avvisi: generaAvvisi(datiPerAvvisi(evm, flusso, vincoli, oggi), soglieAv),
    graficoPpc:
      lps.statoPiano === null && !pianiPassati
        ? ''
        : graficoPpc(lps.storicoPpc, { soglia: soglie.ppc, altezza: 200 }),
    curvaS: baseline
      ? svgCurvaS(serie, {
          bacMinuti: evm.bacMinuti,
          eacMinuti: evm.eacMinuti,
          settimanaCorrente: settimana,
          altezza: 240,
        })
      : '',
    mancano,
    commessaVuota: mancano.elaborati && mancano.baseline && mancano.pianoSettimana && mancano.ore,
  }
}
