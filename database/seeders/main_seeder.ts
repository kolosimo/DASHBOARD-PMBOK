/**
 * Seeder unico con i dati di esempio del prototipo. Rifiuta di girare in
 * produzione. Uso: `npm run db:ricrea` (ricrea lo schema e semina).
 */
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { IMPOSTAZIONI_DEFAULT } from '#shared/impostazioni'
import {
  aggiungiSettimane,
  domenicaDi,
  giorniLavorativi,
  lunediDaSettimanaIso,
  FUSO,
} from '#shared/calendario'
import * as D from '#database/dati_esempio'

type Mappa = Record<string, number>

/** Istante in ora di Roma → ISO con fuso */
function roma(data: string, ora = '09:00') {
  return DateTime.fromISO(`${data}T${ora}`, { zone: FUSO }).toISO()!
}

function giornoPiu(data: string, giorni: number) {
  return DateTime.fromISO(data, { zone: FUSO }).plus({ days: giorni }).toISODate()!
}

/** Giorni lavorativi (lun–ven) da `dal` ad `al` inclusi */
function feriali(dal: string, al: string): string[] {
  const out: string[] = []
  let d = DateTime.fromISO(dal, { zone: FUSO })
  const fine = DateTime.fromISO(al, { zone: FUSO })
  while (d <= fine) {
    if (d.weekday <= 5) out.push(d.toISODate()!)
    d = d.plus({ days: 1 })
  }
  return out
}

/** Distribuisce `unita` in `n` parti intere il più uniformi possibile */
function distribuisci(unita: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.floor(((i + 1) * unita) / n) - Math.floor((i * unita) / n))
}

export default class extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    await this.client.transaction(async (trx) => {
      const utenti = await this.utenti(trx)
      const conf = await this.configurazione(trx)
      const commesse = await this.commesse(trx, utenti)
      const principale = commesse['CL-2026-031']
      const elaborati = await this.elaborati(trx, principale, utenti, conf)
      const acPerSettimana = await this.ore(trx, elaborati, utenti)
      await this.lastPlanner(trx, principale, utenti, conf, elaborati)
      await this.evm(trx, principale, elaborati, conf, utenti, acPerSettimana)
    })
  }

  private async utenti(trx: TransactionClientContract): Promise<Mappa> {
    const righe = await trx
      .table('utenti')
      .insert(
        D.UTENTI.map((u) => ({
          email: `${u.slug}@${D.DOMINIO_EMAIL}`,
          nome: u.nome,
          ruolo: u.ruolo,
          attivo: true,
        }))
      )
      .returning(['id', 'email'])
    return Object.fromEntries(righe.map((r) => [r.email.split('@')[0], r.id]))
  }

  private async configurazione(trx: TransactionClientContract) {
    const discipline = await trx
      .table('discipline')
      .insert(D.DISCIPLINE.map((d) => ({ ...d, attiva: true })))
      .returning(['id', 'codice'])
    const colonne = await trx
      .table('colonne_kanban')
      .insert(
        D.COLONNE_KANBAN.map((c) => ({
          codice: c.codice,
          nome: c.nome,
          ordine: c.ordine,
          limite_wip_default: c.limiteWipDefault,
        }))
      )
      .returning(['id', 'codice'])
    const colonnaId: Mappa = Object.fromEntries(colonne.map((c) => [c.codice, c.id]))
    const stati = await trx
      .table('stati_elaborato')
      .insert(
        D.STATI.map((s) => ({
          codice: s.codice,
          nome: s.nome,
          ordine: s.ordine,
          peso_ev_percento: s.peso,
          colonna_kanban_id: colonnaId[s.colonna],
          finale: s.ordine === 5,
        }))
      )
      .returning(['id', 'ordine', 'codice'])
    const cause = await trx
      .table('cause_non_completamento')
      .insert(D.CAUSE.map((c, i) => ({ ...c, ordine: i + 1, attiva: true })))
      .returning(['id', 'codice'])
    await trx.table('impostazioni').insert(
      Object.entries(IMPOSTAZIONI_DEFAULT).map(([chiave, v]) => ({
        chiave,
        valore: JSON.stringify(v.valore),
        descrizione: v.descrizione,
        di_esempio: true,
      }))
    )
    return {
      disciplinaId: Object.fromEntries(discipline.map((d) => [d.codice, d.id])) as Mappa,
      colonnaId,
      statoIdPerOrdine: Object.fromEntries(stati.map((s) => [s.ordine, s.id])) as Mappa,
      pesiPerCodice: Object.fromEntries(D.STATI.map((s) => [s.codice, s.peso])) as Mappa,
      causaId: Object.fromEntries(cause.map((c) => [c.codice, c.id])) as Mappa,
    }
  }

  private async commesse(trx: TransactionClientContract, utenti: Mappa): Promise<Mappa> {
    const ids: Mappa = {}
    for (const c of D.COMMESSE) {
      const [riga] = await trx
        .table('commesse')
        .insert({
          codice: c.codice,
          nome: c.nome,
          cliente: c.cliente,
          stato: 'attiva',
          pm_id: utenti[c.pm],
          data_inizio: c.dataInizio,
          data_fine_prevista: c.dataFinePrevista,
        })
        .returning(['id'])
      ids[c.codice] = riga.id
      await trx.table('membri_commessa').insert(
        c.membri.map(([slug, ruolo]) => ({
          commessa_id: riga.id,
          utente_id: utenti[slug],
          ruolo_commessa: ruolo,
        }))
      )
      await trx.table('milestone').insert(
        c.milestone.map((m, i) => ({
          commessa_id: riga.id,
          titolo: m.titolo,
          data_prevista: m.dataPrevista,
          data_effettiva: m.dataEffettiva,
          contrattuale: true,
          ordine: i + 1,
        }))
      )
    }
    return ids
  }

  private async elaborati(
    trx: TransactionClientContract,
    commessaId: number,
    utenti: Mappa,
    conf: Awaited<ReturnType<typeof this.configurazione>>
  ): Promise<Mappa> {
    const colonnaInCorso = conf.colonnaId['in_corso']
    const colonnaInVerifica = conf.colonnaId['in_verifica']
    await trx.table('limiti_wip_commessa').insert([
      { commessa_id: commessaId, colonna_kanban_id: colonnaInCorso, limite: 4 },
      { commessa_id: commessaId, colonna_kanban_id: colonnaInVerifica, limite: 3 },
    ])

    const ids: Mappa = {}
    for (const e of D.ELABORATI) {
      const statoDal = roma(giornoPiu(D.OGGI, -e.age), '09:00')
      const [riga] = await trx
        .table('elaborati')
        .insert({
          commessa_id: commessaId,
          codice: e.codice,
          titolo: e.titolo,
          disciplina_id: conf.disciplinaId[e.d],
          budget_minuti: e.bud * 60,
          classe_servizio: e.cls,
          data_fissa: 'dataFissa' in e ? e.dataFissa : null,
          responsabile_id: utenti[e.resp],
          stato_id: conf.statoIdPerOrdine[e.st],
          stato_dal: statoDal,
        })
        .returning(['id'])
      ids[e.codice] = riga.id

      // Storico delle transizioni: creazione il 01/07, poi uno stato alla volta,
      // l'ultima transizione coincide con stato_dal (Work Item Age).
      const transizioni: {
        elaborato_id: number
        da_stato_id: number | null
        a_stato_id: number
        utente_id: number
        avvenuta_il: string
      }[] = [
        {
          elaborato_id: riga.id,
          da_stato_id: null,
          a_stato_id: conf.statoIdPerOrdine[0],
          utente_id: utenti['pm1'],
          avvenuta_il: roma('2026-07-01', '09:00'),
        },
      ]
      for (let s = 1; s <= e.st; s++) {
        const giorniPrima = e.age + (e.st - s) * 7
        transizioni.push({
          elaborato_id: riga.id,
          da_stato_id: conf.statoIdPerOrdine[s - 1],
          a_stato_id: conf.statoIdPerOrdine[s],
          utente_id: utenti[e.resp],
          avvenuta_il: roma(giornoPiu(D.OGGI, -giorniPrima), '09:00'),
        })
      }
      await trx.table('transizioni_elaborato').insert(transizioni)
    }
    return ids
  }

  /**
   * Ore: lo storico del prototipo (ac, in ore) è distribuito in mezz'ore sui
   * giorni feriali da lunedì 20/07 a venerdì 18/09, poi si aggiungono le ore
   * della settimana W39. Restituisce l'AC cumulato (minuti) a fine settimana.
   */
  private async ore(trx: TransactionClientContract, elaborati: Mappa, utenti: Mappa) {
    const giorni = feriali('2026-07-20', '2026-09-18')
    const righe: { utente_id: number; elaborato_id: number; data: string; minuti: number }[] = []
    for (const e of D.ELABORATI) {
      const parti = distribuisci(e.ac * 2, giorni.length)
      parti.forEach((mezzore, i) => {
        if (mezzore > 0) {
          righe.push({
            utente_id: utenti[e.resp],
            elaborato_id: elaborati[e.codice],
            data: giorni[i],
            minuti: mezzore * 30,
          })
        }
      })
    }
    const giorniW39 = giorniLavorativi(D.LUNEDI_CORRENTE)
    for (const o of D.ORE_SETTIMANA) {
      o.ore.forEach((h, i) => {
        if (h > 0) {
          righe.push({
            utente_id: utenti[o.utente],
            elaborato_id: elaborati[o.elaborato],
            data: giorniW39[i],
            minuti: h * 60,
          })
        }
      })
    }
    await trx.table('registrazioni_ore').multiInsert(righe)

    const acPerSettimana: Record<string, number> = {}
    for (let w = 30; w <= 39; w++) {
      const lunedi = lunediDaSettimanaIso(2026, w)
      const domenica = domenicaDi(lunedi)
      acPerSettimana[lunedi] = righe
        .filter((r) => r.data <= domenica)
        .reduce((a, r) => a + r.minuti, 0)
    }
    return acPerSettimana
  }

  private async lastPlanner(
    trx: TransactionClientContract,
    commessaId: number,
    utenti: Mappa,
    conf: Awaited<ReturnType<typeof this.configurazione>>,
    elaborati: Mappa
  ) {
    // Milestone per le righe M1/M2 del lookahead
    const milestone = await trx.from('milestone').where('commessa_id', commessaId).select('id', 'titolo')
    const milestoneId: Mappa = Object.fromEntries(milestone.map((m) => [m.titolo, m.id]))

    const attivita: Mappa = {}
    for (const a of D.LOOKAHEAD) {
      const [riga] = await trx
        .table('attivita_lookahead')
        .insert({
          commessa_id: commessaId,
          codice: a.codice,
          titolo: a.titolo,
          tipo: 'milestone' in a ? 'milestone' : 'attivita',
          elaborato_id: 'elaborato' in a && a.elaborato ? elaborati[a.elaborato] : null,
          milestone_id: 'milestone' in a ? milestoneId[a.milestone] : null,
          responsabile_id: utenti['pm1'],
          settimana_inizio: lunediDaSettimanaIso(2026, a.da),
          settimana_fine: lunediDaSettimanaIso(2026, a.a),
        })
        .returning(['id'])
      attivita[a.codice] = riga.id
    }

    for (const v of D.VINCOLI) {
      const [riga] = await trx
        .table('vincoli')
        .insert({
          commessa_id: commessaId,
          codice: v.codice,
          descrizione: v.descrizione,
          categoria: v.categoria,
          stato: v.rimosso ? 'rimosso' : 'aperto',
          responsabile_id: utenti[v.resp],
          data_necessaria: v.serveEntro,
          identificato_il: '2026-09-07',
          rimosso_il: v.rimosso ? roma('2026-09-22', '10:00') : null,
        })
        .returning(['id'])
      await trx
        .table('vincoli_attivita')
        .insert(v.attivita.map((cod) => ({ vincolo_id: riga.id, attivita_id: attivita[cod] })))
    }

    // Storico W31–W38: piani chiusi con impegni e cause
    const codiciCause = Object.entries(D.CAUSE_STORICHE).flatMap(([c, n]) => Array(n).fill(c))
    let indiceCausa = 0
    let indiceElaborato = 0
    const elencoElaborati = D.ELABORATI
    for (let i = 0; i < D.STORICO_PIANI.length; i++) {
      const [promessi, fatti] = D.STORICO_PIANI[i]
      const settimana = lunediDaSettimanaIso(2026, 31 + i)
      const [piano] = await trx
        .table('piani_settimanali')
        .insert({
          commessa_id: commessaId,
          settimana,
          stato: 'chiuso',
          promesso_il: roma(settimana, '08:30'),
          chiuso_il: roma(giornoPiu(settimana, 4), '17:30'),
        })
        .returning(['id'])
      const impegni = []
      for (let k = 0; k < promessi; k++) {
        const el = elencoElaborati[indiceElaborato++ % elencoElaborati.length]
        const fatto = k < fatti
        impegni.push({
          piano_id: piano.id,
          elaborato_id: elaborati[el.codice],
          descrizione: `Impegno di esempio ${k + 1} · ${el.codice}`,
          last_planner_id: utenti[el.resp],
          fatto,
          causa_id: fatto ? null : conf.causaId[codiciCause[indiceCausa++]],
          aggiunto_dopo_promessa: false,
          ordine: k + 1,
        })
      }
      await trx.table('impegni').multiInsert(impegni)
      await trx.table('snapshot_lps').insert({
        commessa_id: commessaId,
        settimana,
        impegni_promessi: promessi,
        impegni_fatti: fatti,
        ppc: fatti / promessi,
        creato_il: roma(giornoPiu(settimana, 7), '06:00'),
      })
    }

    // Settimana corrente W39: piano promesso, righe già segnate in parte
    const [pianoW39] = await trx
      .table('piani_settimanali')
      .insert({
        commessa_id: commessaId,
        settimana: D.LUNEDI_CORRENTE,
        stato: 'promesso',
        promesso_il: roma(D.LUNEDI_CORRENTE, '08:30'),
      })
      .returning(['id'])
    await trx.table('impegni').multiInsert(
      D.IMPEGNI_W39.map((imp, k) => ({
        piano_id: pianoW39.id,
        elaborato_id: elaborati[imp.elaborato],
        descrizione: imp.descrizione,
        last_planner_id: utenti[imp.lp],
        fatto: imp.fatto,
        causa_id: imp.causa ? conf.causaId[imp.causa] : null,
        aggiunto_dopo_promessa: false,
        ordine: k + 1,
      }))
    )
  }

  private async evm(
    trx: TransactionClientContract,
    commessaId: number,
    elaborati: Mappa,
    conf: Awaited<ReturnType<typeof this.configurazione>>,
    utenti: Mappa,
    acPerSettimana: Record<string, number>
  ) {
    const bac = D.ELABORATI.reduce((a, e) => a + e.bud * 60, 0)
    const [baseline] = await trx
      .table('baseline')
      .insert({
        commessa_id: commessaId,
        numero: 1,
        stato: 'approvata',
        pesi_stati: JSON.stringify(conf.pesiPerCodice),
        bac_minuti: bac,
        approvata_da_id: utenti['pm1'],
        approvata_il: roma('2026-07-17', '12:00'),
        note: 'Baseline di esempio',
      })
      .returning(['id'])

    // Date pianificate per stato: raggiunti entro oggi gli stati ≤ pv, dopo gli altri
    const date = []
    for (const e of D.ELABORATI) {
      for (let s = 1; s <= 5; s++) {
        const data =
          s <= e.pv
            ? giornoPiu('2026-07-24', Math.round(((s - 1) / Math.max(e.pv, 1)) * 56) + 7)
            : giornoPiu('2026-09-28', Math.round(((s - e.pv - 1) / Math.max(5 - e.pv, 1)) * 42))
        date.push({
          baseline_id: baseline.id,
          elaborato_id: elaborati[e.codice],
          stato_id: conf.statoIdPerOrdine[s],
          budget_minuti: e.bud * 60,
          data_prevista: data,
        })
      }
    }
    await trx.table('baseline_date_stato').multiInsert(date)

    await trx.table('baseline_pv_settimana').multiInsert(
      D.PV_SERIE.map((pv, i) => ({
        baseline_id: baseline.id,
        settimana: lunediDaSettimanaIso(2026, 30 + i),
        pv_minuti: pv * 60,
      }))
    )

    // Snapshot W30–W38 (la W39 è la settimana corrente, calcolata dal vivo)
    const evAttuale = D.ELABORATI.reduce(
      (a, e) => a + (e.bud * 60 * D.STATI[e.st].peso) / 100,
      0
    )
    for (let i = 0; i < 9; i++) {
      const settimana = aggiungiSettimane(lunediDaSettimanaIso(2026, 30), i)
      const pv = D.PV_SERIE[i] * 60
      const ev = Math.round(D.EV_FRAZIONI[i] * evAttuale)
      const ac = acPerSettimana[settimana] ?? 0
      const spi = pv > 0 ? ev / pv : null
      const cpi = ac > 0 ? ev / ac : null
      const eac = cpi ? Math.round(bac / cpi) : null
      await trx.table('snapshot_evm').insert({
        commessa_id: commessaId,
        baseline_id: baseline.id,
        settimana,
        bac_minuti: bac,
        pv_minuti: pv,
        ev_minuti: ev,
        ac_minuti: ac,
        spi,
        cpi,
        eac_minuti: eac,
        etc_minuti: eac === null ? null : eac - ac,
        vac_minuti: eac === null ? null : bac - eac,
        creato_il: roma(giornoPiu(settimana, 7), '06:00'),
      })
    }
  }
}
